import { afterEach, expect, it, vi } from 'vitest';
import * as session from '../bots/browser-session.mjs';
import { config } from '../bots/config.mjs';
afterEach(() => vi.useRealTimers());
const identity = {playerId:4,name:config.botName,roomId:config.roomUrl};
const status = (state, extra = {}) => {
 const at=Date.now();
 const shape=state==='pending'?{operation:'move',phase:'pre-step',sequence:1,operationBudgetMs:10000,startedAt:at,deadline:at+10000}:state==='allowed-idle'?{reason:'conversation',idleBudgetMs:20000,idleStartedAt:at,deadline:at+20000}:{operationBudgetMs:10000};
 const e={state,persona:'lyra',controllerGeneration:7,playerId:4,name:config.botName,roomId:config.roomUrl,steps:1,at,...shape,...extra};
 return {identity,evidence:{...e,leaseDeadline:state==='pending'?e.deadline:state==='allowed-idle'?e.deadline+10000:e.at+10000}};
};
it.each(['pending','progress','allowed-idle','terminal'])('host observer classifies %s using controller state and binding', async kind => {
  const frame = {evaluate: async () => status(kind)};
  const observer = session.createControllerObserver(frame, config, {assertLive(){}});
  if (kind === 'terminal') await expect(observer.read()).rejects.toThrow(/terminal/);
  else expect((await observer.read()).outcome).toBe(kind);
});
it('a stalled host read has one flight and one absolute deadline with no late resurrection', async () => {
  vi.useFakeTimers(); let release, calls=0;
  const frame = {evaluate: () => {calls++; return new Promise(r => {release=r;});}};
  const observer = session.createControllerObserver(frame, config, {assertLive(){},timeout:1000});
  const results = Promise.allSettled([observer.read(), observer.read()]); await vi.advanceTimersByTimeAsync(1000);
  expect((await results).every(r=>r.status==='rejected')).toBe(true); expect(calls).toBe(1);
  release(status('progress')); await Promise.resolve(); await expect(observer.read()).rejects.toThrow(/deadline|terminal/); expect(calls).toBe(1);
});
it.each([{deadline:0},{persona:'nova'},{controllerGeneration:8}])('rejects expired or rebound status %j', async changed => {
  let row=status('progress'); const observer=session.createControllerObserver({evaluate:async()=>row},config,{assertLive(){}});
  await observer.read(); row=status('pending',changed); await expect(observer.read()).rejects.toThrow();
});
it('required action authority rejects absent guards before any UI dispatch', async () => {
  let actions=0; await expect(session.joinRoom({goto:async()=>{actions++;}})).rejects.toThrow(/authority|assertLive/); expect(actions).toBe(0);
});
it.each(['isVisible','click','waitFor','getAttribute','evaluate','all'])('terminal transition during %s prevents subsequent action dispatch', async held => {
  let live=true, release, reached=false, dispatched=0, visible=true;
  const boundary = async (name, value) => {
    if(name===held && !reached) { reached=true; await new Promise(r=>{release=r;}); }
    return value;
  };
  const control = {isVisible:()=>boundary('isVisible',visible),click:async()=>{dispatched++;visible=false;await boundary('click',undefined);}, waitFor:()=>boundary('waitFor',undefined),getAttribute:()=>boundary('getAttribute','bg-danger')};
  const page={getByRole:()=>control,getByTestId:()=>control,getByText:()=>control,locator:()=>({all:()=>boundary('all',[])}),evaluate:()=>boundary('evaluate',['denied','denied'])};
  const work=session.verifyRoomUI(page,{assertLive(){if(!live) throw Error('terminal');}}); void work.catch(()=>{});
  for(let i=0;i<100 && !reached;i++) await Promise.resolve();
  expect(reached).toBe(true); const before=dispatched;live=false;release();await expect(work).rejects.toThrow(/terminal/);expect(dispatched).toBe(before);
});
it('manager retains primary startup error and independent cleanup failure', async () => {
  const {BotManager}=await import('../bots/manager.mjs'); const {labelsFor}=await import('../bots/config.mjs');
  const id='a'.repeat(64), primary=Error('primary start'); let created=false;
  const engine={inspect:async()=>created?{Id:id,Name:'/'+config.name,Config:{Labels:labelsFor()},State:{Running:true}}:null,create:async()=>{created=true;return id;},start:async()=>{throw primary;},logs:async()=>{throw Error('logs failure');},stop:async()=>{throw Error('cleanup failure');},remove:async()=>{throw Error('must not remove');}};
  const error=await new BotManager(engine).start('sha256:'+'b'.repeat(64),'/tmp/seccomp.json').catch(e=>e);
  expect(error.cause).toBe(primary); expect(error.cleanup.error.message).toBe('cleanup failure');expect(error.diagnostic.error.message).toBe('logs failure');expect(error.containerId).toBe(id);
});
it('health refresh cannot renew an expired controller pending operation', async () => {
  const {RuntimeHealth}=await import('../bots/config.mjs'); const health=new RuntimeHealth();
  health.observe({outcome:'pending',evidence:{at:0,operation:'move',phase:'pre-step',sequence:1,startedAt:0,operationBudgetMs:10000,deadline:10000,leaseDeadline:10000}}); health.ready(identity,9999);
  expect(health.snapshot(9999).healthy).toBe(true); health.ready(identity,10001); expect(health.snapshot(10001).healthy).toBe(false);
});
it('normalizes untrusted evidence context as well as error before transport', async () => {
  const {failureRecord,diagnosticLine}=await import('../bots/evidence.mjs');
  const record=failureRecord('safe',{token:'secret',detail:'x'.repeat(50000)});
  expect(JSON.stringify(record)).not.toContain('secret'); expect(Buffer.byteLength(diagnosticLine('safe',record))).toBeLessThan(22000);
});
it('owned shutdown records close failure independently of the first runner error', async () => {
  const {createRunnerLifecycle,shutdownOwned}=await import('../bots/runner.mjs');const state=createRunnerLifecycle();state.fail(Error('primary'));
  await expect(shutdownOwned({state,close:async()=>{throw Error('close failure');}})).rejects.toThrow('close failure');
  expect(state.snapshot().failure.error.message).toBe('primary');expect(state.snapshot().secondaryFailures).toMatchObject([{phase:'close',error:{message:'close failure'}}]);
});
it.each([100,2000,20000])('phase end of %ims idle is descriptive; a controller lease bridges queued wake and next bounded operation', async milliseconds => {
  vi.useFakeTimers(); const began=Date.now();
  const row=status('allowed-idle',{reason:milliseconds===100?'step-rest':milliseconds===2000?'rest':'conversation',idleStartedAt:began,idleBudgetMs:milliseconds,deadline:began+milliseconds});
  const observer=session.createControllerObserver({evaluate:async()=>row},config,{assertLive(){}});
  await vi.advanceTimersByTimeAsync(milliseconds+1); expect((await observer.read()).outcome).toBe('allowed-idle');
  await vi.advanceTimersByTimeAsync(9999);await expect(observer.read()).rejects.toThrow(/lease|deadline/);
});
it.each([
 {state:'pending',operation:'move',phase:'pre-step',sequence:1,operationBudgetMs:10000,startedAt:0,deadline:1000000},
 {state:'allowed-idle',reason:'rest',idleBudgetMs:2000,idleStartedAt:0,deadline:1000000},
 {state:'allowed-idle',reason:'unknown',idleBudgetMs:100,idleStartedAt:0,deadline:100},
 {state:'allowed-idle',reason:'conversation',idleBudgetMs:20000,idleStartedAt:0,deadline:30000},
])('all host consumers reject malformed state-specific lease %j',async malformed=>{
 vi.useFakeTimers();vi.setSystemTime(0);const {hasLiveControllerLease}=await import('../bots/evidence.mjs');const {RuntimeHealth}=await import('../bots/config.mjs');
 const row=status(malformed.state,malformed), observation={outcome:malformed.state,evidence:row.evidence};
 expect(hasLiveControllerLease(observation,0)).toBe(false);
 const health=new RuntimeHealth();health.observe(observation);health.ready(identity,0);expect(health.snapshot(0).healthy).toBe(false);
 const observer=session.createControllerObserver({evaluate:async()=>row},config,{assertLive(){}});await expect(observer.read()).rejects.toThrow();
});
it('persists the recognized idle reason and fixed phase budget in the observation projection',async()=>{
 const began=Date.now(),row=status('allowed-idle',{reason:'conversation',idleStartedAt:began,idleBudgetMs:20000,deadline:began+20000});
 const observed=await session.createControllerObserver({evaluate:async()=>row},config,{assertLive(){}}).read();
 expect(observed.evidence).toMatchObject({reason:'conversation',idleStartedAt:began,idleBudgetMs:20000,deadline:began+20000});
});
