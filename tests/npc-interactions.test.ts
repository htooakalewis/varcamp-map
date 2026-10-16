import { it, expect, vi } from 'vitest';
import { registerNpcInteractions } from '../src/npc/interactions';
import type { WorkAdventureApi } from '../src/runtime';

it('ignores a stale guide action after re-entry and cleans subscriptions on scene disposal', () => {
 const enters=new Map<string,()=>void>(),leaves=new Map<string,()=>void>();
 const offered:{callback:()=>void,remove:ReturnType<typeof vi.fn>}[]=[];
 const unsubscribe=vi.fn(),openModal=vi.fn();
 const api={room:{id:'https://play.example/~/demo/maps/overworld.wam'},mapEditor:{area:{onEnter:(n:string)=>({subscribe:(f:()=>void)=>{enters.set(n,f);return{unsubscribe};}}),onLeave:(n:string)=>({subscribe:(f:()=>void)=>{leaves.set(n,f);return{unsubscribe};}})}},ui:{modal:{openModal},displayActionMessage:({callback}:{callback:()=>void})=>{const a={callback,remove:vi.fn(async()=>{})};offered.push(a);return a;}}} as unknown as WorkAdventureApi;
 const dispose=registerNpcInteractions(api);
 enters.get('npc-guide')!();const old=offered[0];
 leaves.get('npc-guide')!();enters.get('npc-guide')!();const fresh=offered[1];
 old.callback();expect(openModal).not.toHaveBeenCalled();expect(fresh.remove).not.toHaveBeenCalled();
 fresh.callback();expect(openModal).toHaveBeenCalledOnce();expect(openModal.mock.calls[0][0]).toMatchObject({title:'Lyra · Plaza Guide',allowApi:true});
 enters.get('npc-guide')!();const last=offered[2];dispose();last.callback();
 expect(openModal).toHaveBeenCalledOnce();expect(unsubscribe).toHaveBeenCalledTimes(2);expect(last.remove).toHaveBeenCalledOnce();
});
