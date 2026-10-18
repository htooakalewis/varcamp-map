import {beforeEach,afterEach,describe,it,expect,vi}from'vitest';
import {createBotCommunication,createHumanCommunication,GUIDE_REQUEST_EVENT,GUIDE_REPLY_EVENT,validRequest,validReply,type GuideApi,type TrackedPlayer}from'../src/bots/event-bridge';
import {PERSONAS}from'../src/bots/personas';
class Bus<T>{listeners=new Set<(x:T)=>void>();subscribe(cb:(x:T)=>void){this.listeners.add(cb);return{unsubscribe:()=>this.listeners.delete(cb)};}next(x:T){for(const cb of this.listeners)cb(x);}}
function harness(name='Lyra[BOT]',id=10){
 const enter=new Bus<TrackedPlayer>(),leave=new Bus<TrackedPlayer>(),move=new Bus<{player:TrackedPlayer}>(),local=new Bus<{x:number;y:number}>(),request=new Bus<{senderId:number|undefined;data:unknown}>(),reply=new Bus<{senderId:number|undefined;data:unknown}>();
 const calls:string[]=[],sent:{id:number;name:string;data:any}[]=[],peers=new Map<number,TrackedPlayer>();
 const add=(playerId:number,playerName='Visitor',x=30,y=0)=>{const p={playerId,name:playerName,position:{x,y},sendEvent:async(name:string,data:unknown)=>{sent.push({id:playerId,name,data});}};peers.set(playerId,p);return p;};
 const api:GuideApi={room:{id:'overworld'},player:{name,playerId:id,getPosition:async()=>({x:0,y:0}),onPlayerMove:cb=>local.subscribe(cb)},controls:{disablePlayerProximityMeeting:()=>{calls.push('disable');}},players:{configureTracking:async()=>{calls.push('tracking');},list:()=>peers.values(),get:id=>peers.get(id),onPlayerEnters:enter,onPlayerLeaves:leave,onPlayerMoves:move},event:{on:name=>name===GUIDE_REQUEST_EVENT?request:reply}};
 return{api,calls,sent,peers,add,enter,leave,move,local,request,reply,buses:[enter,leave,move,local,request,reply]};
}
const session='test-session-00000001';
const request=(requestId=1,kind:'hello'|'command'='hello',text='')=>({version:1,persona:'lyra',session,requestId,kind,text});
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers());
describe('closed event transport',()=>{
 it('rejects malformed/extra/identity fields and bounded oversized requests/replies',()=>{
  expect(validRequest(request())).toBe(true);expect(validReply({version:1,persona:'lyra',session,requestId:1,text:'Welcome'})).toBe(true);
  for(const value of [null,[],{...request(),authorId:1},{...request(),requestId:0},{...request(),persona:'anyone'},{...request(),session:'short'},{...request(),text:'x'},{...request(2,'command','x'.repeat(513))}])expect(validRequest(value)).toBe(false);
  expect(validReply({version:1,persona:'lyra',session,requestId:1,text:'x'.repeat(2049)})).toBe(false);
 });
 it('disables native meetings before tracking, authenticates actual near sender, targets responses and tears down all listeners',async()=>{
  const h=harness();const human=h.add(1),bot=h.add(20,'Nova[BOT]');const errors:unknown[]=[],received:unknown[]=[],members:any[]=[];
  const c=await createBotCommunication(h.api,PERSONAS.lyra,e=>errors.push(e));c.onAudience(a=>{members.push(...a.participants);a.onLeave(id=>members.push({left:id}));});c.onRequest(r=>received.push(r));c.activate();
  expect(h.calls).toEqual(['disable','tracking']);expect(members).toContainEqual({id:1,name:'Visitor'});
  for(const id of [undefined,999,20])h.request.next({senderId:id,data:request()});await flush();expect(h.sent).toEqual([]);
  h.request.next({senderId:1,data:request()});await flush();expect(h.sent).toHaveLength(1);expect(h.sent[0]).toMatchObject({id:1,name:GUIDE_REPLY_EVENT,data:{session,requestId:1,persona:'lyra'}});
  h.request.next({senderId:1,data:request(2,'command','Gemini')});expect(received).toEqual([{text:'lyra: Gemini',authorId:1,authorName:'Visitor'}]);c.reply(1,'Go to Gemini');await flush();expect(h.sent.at(-1)?.id).toBe(1);
  h.request.next({senderId:1,data:request(3,'command','Cancer')});expect(received).toHaveLength(1);await vi.advanceTimersByTimeAsync(2000);h.request.next({senderId:1,data:request(3,'command','Cancer')});expect(received).toHaveLength(2);
  h.request.next({senderId:1,data:request(2,'command','Libra')});expect(received).toHaveLength(2);
  human.position.x=129;h.move.next({player:human});expect(members).toContainEqual({left:1});h.request.next({senderId:1,data:request(4,'command','Libra')});c.reply(1,'Out of range');await flush();expect(received).toHaveLength(2);expect(h.sent).toHaveLength(2);
  c.close();for(const bus of h.buses)expect(bus.listeners.size).toBe(0);expect(errors).toEqual([]);expect(vi.getTimerCount()).toBe(0);void bot;
 });
 it('requires matching hello session, actual distance and safe explicit fixed guide identity',async()=>{
  const h=harness();const p=h.add(1);const c=await createBotCommunication(h.api,PERSONAS.lyra,()=>{});const received:unknown[]=[];c.onRequest(r=>received.push(r));c.activate();
  h.request.next({senderId:1,data:request(1,'command','Cancer')});expect(received).toEqual([]);h.request.next({senderId:1,data:request()});await flush();
  h.request.next({senderId:1,data:{...request(2,'command','Cancer'),session:'old-session-00000000'}});expect(received).toEqual([]);
  h.local.next({x:500,y:0});h.request.next({senderId:1,data:request(2,'command','Cancer')});expect(received).toEqual([]);c.close();void p;
  await expect(createBotCommunication(harness('Pretend').api,PERSONAS.lyra,()=>{})).rejects.toThrow(/identity/);
 });
 it('human accepts only selected actual guide sender/session/sequence and rejects duplicate names/out-of-range responses',async()=>{
  const h=harness('Attendee',1);const guide=h.add(10,'Lyra[BOT]');const received:unknown[]=[],errors:unknown[]=[];const c=await createHumanCommunication(h.api,session,r=>received.push(r),()=>{},e=>errors.push(e));
  expect(h.calls).toEqual(['tracking']);expect(c.guides()).toMatchObject([{id:10,responsive:false}]);expect(c.request(10,'Gemini')).toBe(false);expect(c.hello(10)).toBe(true);await flush();
  const response={version:1,persona:'lyra',session,requestId:1,text:'Welcome'};
  for(const event of [{senderId:999,data:response},{senderId:10,data:{...response,session:'stale-session-000000'}},{senderId:10,data:{...response,requestId:3}}])h.reply.next(event);
  expect(received).toEqual([]);h.reply.next({senderId:10,data:response});expect(received).toHaveLength(1);expect(c.request(10,'Gemini')).toBe(true);await flush();expect(h.sent.at(-1)).toMatchObject({id:10,name:GUIDE_REQUEST_EVENT,data:{kind:'command',text:'Gemini',requestId:2}});
  h.add(11,'Lyra[BOT]');expect(c.guides()).toEqual([]);h.reply.next({senderId:10,data:{...response,requestId:2}});expect(received).toHaveLength(1);h.peers.delete(11);guide.position.x=129;h.reply.next({senderId:10,data:{...response,requestId:2}});expect(received).toHaveLength(1);
  c.close();for(const bus of h.buses)expect(bus.listeners.size).toBe(0);expect(errors).toEqual([]);
 });
 it('keeps send failure terminal and does not send after close or flood beyond bounded outbox',async()=>{
  const h=harness();const p=h.add(1);p.sendEvent=async()=>{throw Error('actual transport failure');};const errors:unknown[]=[];const c=await createBotCommunication(h.api,PERSONAS.lyra,e=>errors.push(e));c.activate();h.request.next({senderId:1,data:request()});await flush();expect(String(errors[0])).toContain('actual transport failure');c.close();expect(vi.getTimerCount()).toBe(0);
 });
});
it('expires old responsiveness instead of claiming live availability from a stale reply',async()=>{
 const h=harness('Attendee',1);h.add(10,'Lyra[BOT]');const c=await createHumanCommunication(h.api,session,()=>{},()=>{},()=>{});c.hello(10);await flush();h.reply.next({senderId:10,data:{version:1,persona:'lyra',session,requestId:1,text:'Welcome'}});expect(c.guides()[0].responsive).toBe(true);await vi.advanceTimersByTimeAsync(15000);expect(c.guides()[0].responsive).toBe(false);expect(c.request(10,'Gemini')).toBe(false);c.close();
});
it('retires disconnected guide sessions so a reused ID cannot inherit responsiveness or accept a stale reply',async()=>{
 const h=harness('Attendee',1);const old=h.add(10,'Lyra[BOT]');const received:unknown[]=[];const c=await createHumanCommunication(h.api,session,r=>received.push(r),()=>{},()=>{});c.hello(10);await flush();const reply={version:1,persona:'lyra',session,requestId:1,text:'Old welcome'};h.reply.next({senderId:10,data:reply});expect(c.guides()[0].responsive).toBe(true);h.peers.delete(10);h.leave.next(old);h.add(10,'Lyra[BOT]');expect(c.guides()[0].responsive).toBe(false);h.reply.next({senderId:10,data:reply});expect(received).toHaveLength(1);expect(c.request(10,'Cancer')).toBe(false);c.close();
});
