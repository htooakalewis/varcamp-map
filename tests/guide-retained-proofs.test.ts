import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { failureRecord } from '../ops/bots/evidence.mjs';
import { writeDiagnostic } from '../src/bots/lyra';
import { createLyraController } from '../src/bots/controller';
import { createRunnerLifecycle, probeHeartbeat } from '../ops/bots/runner.mjs';
import { BotManager } from '../ops/bots/manager.mjs';
import { config, labelsFor } from '../ops/bots/config.mjs';
const sentinel='AUDIT_SENTINEL';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it.each([{apiKey:sentinel},{api_key:sentinel},'HTTPS://user:AUDIT_SENTINEL@example.invalid/?access=AUDIT_SENTINEL'])('BOT-03 retained original proof redacts %j',value=>{
 const record=failureRecord(value);expect(JSON.stringify(record)).not.toContain(sentinel);expect(record.redacted).toBe(true);
});
it.each(['apiKey','api_key','API-KEY','Api_Key','authorization','accessToken','clientSecret','credential'])('BOT-03 shares canonical structured/text classification for %s',key=>{
 for(const input of [{[key]:sentinel},`Error: ${key}=${sentinel}`,JSON.stringify({[key]:sentinel})]){
  const record=failureRecord(input);expect(JSON.stringify(record)).not.toContain(sentinel);expect(record.redacted).toBe(true);
 }
});
it('BOT-03 nested causes/cycles and uppercase URL credentials stay redacted through frame console and stored JSON',async()=>{
 const cause:any={apiKey:sentinel,api_key:sentinel,url:`HtTpS://user:${sentinel}@example.invalid/a?access=${sentinel}#${sentinel}`};cause.self=cause;
 const original=new Error(`HTTPS://user:${sentinel}@example.invalid/?access=${sentinel}`,{cause});original.stack='AbortError: safe sentinel\n at safeOrigin (https://example.invalid/iframe_api.js:4:2)';
 const saved:any[]=[];const state=createRunnerLifecycle({save:async row=>{saved.push(JSON.parse(JSON.stringify(row)));}});
 const record=failureRecord(original,{event:'controller-terminal',persona:'lyra'});
 expect(record.redacted).toBe(true);expect(record.truncated).toBe(true);expect(record.error.stack).toBe(original.stack);
 writeDiagnostic('safe summary',record,line=>{expect(line).not.toContain(sentinel);state.console(line);});await state.flush();
 const stored=JSON.stringify(saved.at(-1));expect(stored).not.toContain(sentinel);expect(saved.at(-1).failure.redacted).toBe(true);expect(saved.at(-1).failure.error.stack).toBe(original.stack);
});
it('BOT-01 retained 180s patrol-position proof is terminal and cannot admit identity or another move',async()=>{
 vi.useFakeTimers();let position={x:2256,y:2256},reads=0,moves=0,release!:(p:any)=>void;const rows:any[]=[],logs:any[]=[];
 vi.stubGlobal('WA',{player:{playerId:7,name:config.botName},room:{id:config.roomUrl}});
 const c=createLyraController({self:()=>({id:7,name:config.botName}),roomId:()=>config.roomUrl,map:async()=>JSON.parse(readFileSync('maps/overworld.tmj','utf8')),position:()=>++reads<=2?Promise.resolve(position):new Promise(r=>{release=r;}),move:async p=>{moves++;position=p;return {...p,cancelled:false};},say(){},diagnostic:(_,e)=>logs.push(e),receipt:e=>{rows.push(e);vi.stubGlobal('__varcampGuideEvidence',e);},onChat:()=>()=>{},onBubble:()=>()=>{}});
 await c.start();for(let i=0;i<30;i++)await Promise.resolve();expect(moves).toBe(1);
 await vi.advanceTimersByTimeAsync(100);expect(reads).toBe(3);expect(rows.at(-1).state).toBe('pending');
 await vi.advanceTimersByTimeAsync(180000);expect(moves).toBe(1);expect(logs).toHaveLength(1);expect(rows.at(-1)).toMatchObject({state:'terminal',quarantine:true});
 const {readIdentity}=await import('../ops/bots/browser-session.mjs');await expect(readIdentity({evaluate:async(fn:any,value:any)=>fn(value)},config,{assertLive(){}})).rejects.toThrow(/terminal/);
 release(position);await c.done;expect(moves).toBe(1);expect(rows.at(-1)).toMatchObject({state:'terminal',quarantine:false});
});
it('BOT-02 retained fatal heartbeat held visibility cannot click after release',async()=>{
 let release!:()=>void,reached=false,clicks=0,media=true;const held=new Promise<void>(r=>{release=r;});
 const page={getByRole(){return {async isVisible(){if(!reached){reached=true;await held;}return media;},async click(){clicks++;media=false;},async waitFor(){}};},getByTestId(){return {async isVisible(){return false;},async waitFor(){},async getAttribute(){return 'bg-danger';}};},getByText(){return {async isVisible(){return false;}};},locator(){return {async all(){return [];}};},async evaluate(){return ['denied','denied'];}};
 const state=createRunnerLifecycle();const probe=probeHeartbeat({state,page,provenance:undefined,frame:{async evaluate(){throw Error('identity must not run');}}});void probe.catch(()=>{});
 for(let i=0;i<50&&!reached;i++)await Promise.resolve();expect(reached).toBe(true);state.fail(Error('AUDIT terminal'));await expect(probe).rejects.toThrow('AUDIT terminal');
 release();for(let i=0;i<100;i++)await Promise.resolve();expect(clicks).toBe(0);expect(state.snapshot().healthy).toBe(false);
});
it.each(['logs','inspect','stop','remove'])('BOT-04 retained primary startup failure survives %s compensation failure with exact ID',async failure=>{
 const id='1'.repeat(64),primary=Error('AUDIT_PRIMARY_STARTUP');const container={Id:id,Name:'/'+config.name,Config:{Labels:labelsFor()},State:{Running:failure!=='remove',Status:'running'}};
 let created=false,startFailed=false;const mutations:string[]=[];
 const engine={async inspect(target:string){expect([config.name,id]).toContain(target);if(startFailed&&failure==='inspect')throw Error('AUDIT_CLEANUP_INSPECT');return created?container:null;},async create(){created=true;return id;},async start(target:string){expect(target).toBe(id);startFailed=true;throw primary;},async logs(target:string){expect(target).toBe(id);if(failure==='logs')throw Error('AUDIT_DIAGNOSTIC');return 'AUDIT_ORIGINAL_LOGS';},async stop(target:string){mutations.push('stop:'+target);if(failure==='stop')throw Error('AUDIT_CLEANUP_STOP');},async remove(target:string){mutations.push('remove:'+target);if(failure==='remove')throw Error('AUDIT_CLEANUP_REMOVE');}};
 const error:any=await new BotManager(engine).start('sha256:'+'a'.repeat(64),'/synthetic/seccomp.json').catch(e=>e);
 expect(error.cause).toBe(primary);expect(error.containerId).toBe(id);expect(error.message).toContain('AUDIT_PRIMARY_STARTUP');expect(JSON.stringify(error.diagnostic)).toContain(failure==='logs'?'AUDIT_DIAGNOSTIC':'AUDIT_ORIGINAL_LOGS');
 if(failure!=='logs')expect(JSON.stringify(error.cleanup)).toContain('AUDIT_CLEANUP_');if(failure==='inspect'||failure==='stop')expect(mutations).not.toContain('remove:'+id);expect(mutations.every(value=>value.endsWith(id))).toBe(true);
});
