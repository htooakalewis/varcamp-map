import { describe, it, expect, vi } from 'vitest';
import { normalizeProgress, summarizeProgress } from '../src/quests/model';
import { createProgressStore } from '../src/quests/store';
import { registerInteractions } from '../src/quests/interactions';
import { parseJournalView } from '../src/journal/view';
import { renderJournal } from '../src/journal/main';
import { WORLD_CATALOG } from '../src/world/catalog';
import type { WorkAdventureApi } from '../src/runtime';

const checkpoint = (n: string) => `varcamp2026.comet.checkpoint.${n}` as any;
const finish = 'varcamp2026.cometComplete' as any;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
describe('saved Comet challenge', () => {
 it('requires three confirmed checkpoints and an explicit finish; old badges remain intact', async () => {
  const raw: Record<string,unknown> = { 'varcamp2026.mazeComplete': true };
  const save = vi.fn(async (k:string,v:boolean) => { raw[k]=v; });
  const store = createProgressStore({read:k=>raw[k],save});
  for (const n of ['1','2','3']) {
   await store.saveFlag(finish);
   expect(save.mock.calls.some(([k])=>k===finish)).toBe(false);
   await store.saveFlag(checkpoint(n));
  }
  expect(summarizeProgress(store.get()).badges).toEqual(['maze-navigator']);
  await store.saveFlag(finish);
  const refreshed = createProgressStore({read:k=>raw[k],save});
  expect(summarizeProgress(refreshed.load())).toMatchObject({cometCheckpoints:['1','2','3'],badges:['maze-navigator','comet-trailblazer']});
 });
 it('does not use an optimistic rejected checkpoint to unlock the shrine', async () => {
  const raw:Record<string,unknown>={}; let fail=true;
  const store=createProgressStore({read:k=>raw[k],save:async(k,v)=>{raw[k]=v;if(k===checkpoint('3')&&v&&fail)throw Error('quota');}});
  await store.saveFlag(checkpoint('1'));await store.saveFlag(checkpoint('2'));
  await expect(store.saveFlag(checkpoint('3'))).rejects.toThrow('quota');
  await store.saveFlag(finish);
  expect(raw[finish]).not.toBe(true);
  expect(summarizeProgress(store.get()).cometCheckpoints).toEqual(['1','2']);
  fail=false;await store.saveFlag(checkpoint('3'));await store.saveFlag(finish);
  expect(summarizeProgress(store.get()).badges).toContain('comet-trailblazer');
 });
 it('rejects a fabricated finish without checkpoints and accepts a confirmed journal bridge', () => {
  const raw:Record<string,unknown>={[finish]:true};
  expect(summarizeProgress(normalizeProgress(raw)).badges).not.toContain('comet-trailblazer');
  for(const n of ['1','2','3'])raw[checkpoint(n)]=true;
  const view={ready:true,summary:summarizeProgress(normalizeProgress(raw)),pendingKeys:[checkpoint('2')]};
  expect(parseJournalView(view)).toEqual(view);
  expect(parseJournalView({...view,summary:{...view.summary,cometCheckpoints:['1']}}).ready).toBe(false);
  const container={innerHTML:''} as HTMLElement;renderJournal(view,container);
  expect(container.innerHTML).toContain('Comet Trailblazer — Earned');
  expect(container.innerHTML).toContain('3 of 3 checkpoints saved');
 });
 it('binds explicit native checkpoint and finish actions only in the Comet scene', async () => {
  const raw:Record<string,unknown>={},enters=new Map<string,()=>void>(),actions=new Map<string,()=>void>();
  const api={room:{id:'https://play.example/~/demo/maps/comet-maze.wam'},player:{state:{saveVariable:async(k:string,v:unknown)=>{raw[k]=v;}}},mapEditor:{area:{onEnter:(n:string)=>({subscribe:(fn:()=>void)=>{enters.set(n,fn);return{unsubscribe(){}};}}),onLeave:()=>({subscribe:()=>({unsubscribe(){}})})}},ui:{displayActionMessage:({message,callback}:{message:string,callback:()=>void})=>{actions.set(message,callback);return{remove:async()=>{actions.delete(message);}};},modal:{openModal:vi.fn()}},nav:{goToRoom:vi.fn()}} as unknown as WorkAdventureApi;
  const store=createProgressStore({read:k=>raw[k],save:async(k,v)=>{raw[k]=v;}});
  const dispose=registerInteractions(api,store,WORLD_CATALOG);
  enters.get('comet-finish')!();actions.get('Complete Comet Maze · three saved checkpoints required')!();await settle();
  expect(raw[finish]).toBeUndefined();expect(api.ui.modal.openModal).toHaveBeenCalled();
  for(const n of ['1','2','3']){enters.get(`comet-checkpoint-${n}`)!();expect(raw[checkpoint(n)]).toBeUndefined();actions.get(`Collect Comet checkpoint ${n}`)!();await settle();}
  enters.get('comet-finish')!();actions.get('Complete Comet Maze · three saved checkpoints required')!();await settle();
  expect(raw[finish]).toBe(true);expect(raw['varcamp2026.journalView']).toMatchObject({summary:{cometCheckpoints:['1','2','3'],badges:['comet-trailblazer']}});
  dispose();expect(actions.size).toBe(0);
 });
});
