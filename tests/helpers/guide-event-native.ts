import {readFileSync} from 'node:fs';
import {vi} from 'vitest';
import {center} from '../../src/bots/venue';
import {PERSONAS,type PersonaKey} from '../../src/bots/personas';
import {GUIDE_REQUEST_EVENT,type TrackedPlayer} from '../../src/bots/event-bridge';
class Stream<T>{listeners=new Set<(x:T)=>void>();subscribe(callback:(x:T)=>void){this.listeners.add(callback);return{unsubscribe:()=>this.listeners.delete(callback)};}next(x:T){for(const callback of this.listeners)callback(x);}}
export const flushNative=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
export function nativeGuide(key:PersonaKey='lyra',id=10){
 const persona=PERSONAS[key];let position=center(persona.home),pending:((p:typeof position&{cancelled:boolean})=>void)|undefined;
 const enters=new Stream<TrackedPlayer>(),leaves=new Stream<TrackedPlayer>(),moves=new Stream<{player:TrackedPlayer}>(),local=new Stream<typeof position>(),events=new Stream<{senderId?:number;data?:unknown}>();
 const peers=new Map<number,TrackedPlayer>(),messages:{id:number;data:any}[]=[],nativeMoves:typeof position[]=[],calls:string[]=[];
 const add=(playerId:number,name='Visitor')=>{const peer={playerId,name,position:{...position},sendEvent:async(_name:string,data:unknown)=>{messages.push({id:playerId,data});}};peers.set(playerId,peer);enters.next(peer);return peer;};
 const wa={onInit:async()=>{},room:{id:'test',getTiledMap:async():Promise<unknown>=>JSON.parse(readFileSync('maps/overworld.tmj','utf8'))},player:{name:persona.name,playerId:id,getPosition:async()=>position,onPlayerMove:(cb:(p:typeof position)=>void)=>local.subscribe(cb),moveTo:(x:number,y:number)=>{if(pending)throw Error('Overlapping actual native move');nativeMoves.push({x,y});return new Promise<typeof position&{cancelled:boolean}>(resolve=>{pending=resolve;});}},controls:{disablePlayerProximityMeeting:()=>{calls.push('disable');}},players:{configureTracking:async()=>{calls.push('tracking');},list:()=>peers.values(),get:(id:number)=>peers.get(id),onPlayerEnters:enters,onPlayerLeaves:leaves,onPlayerMoves:moves},event:{on:()=>events}};
 vi.stubGlobal('WA',wa);vi.spyOn(console,'warn').mockImplementation(()=>{});
 const hello=(senderId=1)=>events.next({senderId,data:{version:1,persona:key,session:'native-test-session-00001',requestId:1,kind:'hello',text:''}});
 return{wa,add,peers,messages,nativeMoves,calls,events,enters,leaves,moves,local,hello,request:(text:string,senderId=1,requestId=2)=>events.next({senderId,data:{version:1,persona:key,session:'native-test-session-00001',requestId,kind:'command',text}}),
  async complete(cancelled=false){const resolve=pending;pending=undefined;if(!cancelled){position=nativeMoves.at(-1)!;local.next(position);}resolve?.({...position,cancelled});await flushNative();},
  listenerCount:()=>[enters,leaves,moves,local,events].reduce((n,b)=>n+b.listeners.size,0),GUIDE_REQUEST_EVENT};
}
