import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { createLyraController, type LyraAdapter } from '../src/bots/controller';
const map = JSON.parse(readFileSync('maps/overworld.tmj', 'utf8'));
afterEach(() => vi.useRealTimers());
it.each(['map', 'position', 'move'])('expires pending %s, preserves quarantine and first failure across late rejection', async operation => {
  vi.useFakeTimers();
  let reject!: (e: Error) => void, calls = 0, finished = false;
  let entered!: () => void;
  const operationEntered = new Promise<void>(resolve => { entered = resolve; });
  const evidence: any[] = [], diagnostics: any[] = [];
  const pending = () => new Promise<any>((_, r) => { reject = r; entered(); });
  const api: LyraAdapter = { map: () => operation === 'map' ? pending() : Promise.resolve(map), roomId: () => 'overworld',
    position: () => operation === 'position' ? pending() : Promise.resolve({x:2256,y:2256}),
    move: () => { calls++; return pending(); }, say() {}, diagnostic: (_, e) => diagnostics.push(e), receipt: e => evidence.push(e), onChat: () => () => {}, onBubble: () => () => {} };
  const c = createLyraController(api); const starting = c.start(); void c.done.then(() => { finished = true; });
  await Promise.race([operationEntered, c.done.then(() => { throw Error('Controller ended before the requested adapter operation'); })]);
  expect(evidence.at(-1)?.operation).toBe(operation);
  await vi.advanceTimersByTimeAsync(10001);
  expect(evidence.at(-1).state).toBe('terminal');
  expect(diagnostics[0]).toMatchObject({ operation, error: { message: expect.stringMatching(/deadline|timeout/) } });
  expect(finished).toBe(false);
  const failure = diagnostics[0]; reject(new Error('late native rejection')); await starting; await c.done;
  expect(diagnostics[0]).toBe(failure); expect(diagnostics).toHaveLength(1);
  expect(evidence.at(-1)).toMatchObject({state:'terminal', quarantine:false}); expect(calls).toBe(operation === 'move' ? 1 : 0);
});
it('records cleanup failures separately without suppressing remaining owned disposers', async () => {
  const rows: any[] = []; let disposed = 0;
  const c = createLyraController({ map: async () => { throw Error('primary'); }, roomId: () => 'overworld', position: async () => ({x:2256,y:2256}), move: async p => ({...p,cancelled:false}), say() {}, diagnostic() {}, receipt: e => rows.push(e), onChat: () => () => {}, onBubble: () => () => { disposed++; throw Error('cleanup'); } });
  await c.start(); await c.done; expect(disposed).toBe(1);
  expect(rows.at(-1)).toMatchObject({state:'terminal', failure:{error:{message:'primary'}}, cleanupFailures:[{error:{message:'cleanup'}}]});
});
it.each(['map', 'position', 'move'])('rejects a late %s settlement at the absolute deadline when its watchdog callback has not run', async operation => {
  let now=0, release!: (value:any)=>void, moves=0;
  let entered!: () => void;
  const operationEntered = new Promise<void>(resolve => { entered = resolve; });
  const callbacks=new Map<number,()=>void>();let serial=0;
  const scheduler={now:()=>now,setTimeout:(callback:()=>void)=>{const id=++serial;callbacks.set(id,callback);return id as any;},clearTimeout:(id:any)=>{callbacks.delete(id);}};
  const rows:any[]=[],diagnostics:any[]=[];
  const held=()=>new Promise<any>(resolve=>{release=resolve;entered();});
  const c=createLyraController({map:()=>operation==='map'?held():Promise.resolve(map),roomId:()=> 'overworld',position:()=>operation==='position'?held():Promise.resolve({x:2256,y:2256}),move:()=>{moves++;return held();},say(){},diagnostic:(_,e)=>diagnostics.push(e),receipt:e=>rows.push(e),onChat:()=>()=>{},onBubble:()=>()=>{}},scheduler);
  const start=c.start();
  await Promise.race([operationEntered,c.done.then(()=>{throw Error('Controller ended before the requested adapter operation');})]);
  expect(release).toBeTypeOf('function');expect(rows.at(-1).operation).toBe(operation);
  // Simulate an event loop where native completion runs ahead of the overdue timer task.
  now=10000; release(operation==='map'?map:operation==='move'?{x:2288,y:2256,cancelled:false}:{x:2256,y:2256});
  await start;await c.done;
  expect(rows.at(-1)).toMatchObject({state:'terminal',quarantine:false,failure:{operation,error:{message:expect.stringMatching(/deadline|timeout/)}}});
  expect(moves).toBe(operation==='move'?1:0);expect(diagnostics).toHaveLength(1);expect(callbacks.size).toBe(0);await c.done;
});
