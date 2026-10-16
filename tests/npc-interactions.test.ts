import { it, expect } from 'vitest';
import { registerNpcInteractions } from '../src/npc/interactions';
import type { WorkAdventureApi } from '../src/runtime';

it.each(['overworld','orbit-maze','comet-maze','shipyard-beach'])('offers no ghost Talk action for retained legacy areas in %s', map => {
 const listeners=new Map<string,()=>void>(),actions:unknown[]=[],modals:unknown[]=[];
 const api={room:{id:`https://play.example/~/demo/maps/${map}.wam`},mapEditor:{area:{onEnter:(name:string)=>({subscribe:(f:()=>void)=>{listeners.set(name,f);return{unsubscribe(){listeners.delete(name);}};}}),onLeave:()=>({subscribe:()=>({unsubscribe(){}})})}},ui:{modal:{openModal:(v:unknown)=>modals.push(v)},displayActionMessage:(v:unknown)=>{actions.push(v);return{remove:async()=>{}};}}} as unknown as WorkAdventureApi;
 const dispose=registerNpcInteractions(api);
 for(const name of ['npc-guide','npc-maze-keeper','npc-dockmaster'])listeners.get(name)?.();
 expect(actions).toEqual([]);expect(modals).toEqual([]);expect(listeners.size).toBe(0);
 dispose();dispose();
});
