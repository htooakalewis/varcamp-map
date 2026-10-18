import {OPERATION_BUDGET_MS} from '../../ops/bots/evidence.mjs';
import {PERSONAS,personaByName,type Persona,type PersonaKey} from './personas';
import type {Audience,Participant,GuideRequest,Point,Dispose} from './controller';
export const GUIDE_REQUEST_EVENT='varcamp.guide.request.v1',GUIDE_REPLY_EVENT='varcamp.guide.reply.v1';
export const GUIDE_RADIUS=128;
export interface Stream<T>{subscribe(callback:(value:T)=>void):{unsubscribe():void}}
export interface TrackedPlayer {readonly playerId:number;readonly name:string;readonly position:Point;sendEvent(name:string,data:unknown):Promise<void>}
export interface GuideApi {
 room:{readonly id:string};
 player:{readonly playerId:number;readonly name:string;getPosition():Promise<Point>;onPlayerMove(callback:(position:Point)=>void):{unsubscribe():void}};
 controls:{disablePlayerProximityMeeting():void};
 players:{configureTracking(options:{players:boolean;movement:boolean}):Promise<void>;list():IterableIterator<TrackedPlayer>;get(id:number):TrackedPlayer|undefined;onPlayerEnters:Stream<TrackedPlayer>;onPlayerLeaves:Stream<TrackedPlayer>;onPlayerMoves:Stream<{player:TrackedPlayer}>};
 event:{on(name:string):Stream<{senderId?:number;data?:unknown}>};
}
interface Request {version:1;persona:PersonaKey;session:string;requestId:number;kind:'hello'|'command';text:string}
export interface GuideReply {version:1;persona:PersonaKey;session:string;requestId:number;text:string}
const keys=(x:object,names:string[])=>JSON.stringify(Object.keys(x).sort())===JSON.stringify(names.sort());
const record=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const key=(x:unknown):x is PersonaKey=>x==='lyra'||x==='nova'||x==='orion';
const token=(x:unknown):x is string=>typeof x==='string'&&/^[a-zA-Z0-9-]{16,64}$/.test(x);
const number=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>0&&x<=0x7fffffff;
export const validRequest=(x:unknown):x is Request=>record(x)&&keys(x,['version','persona','session','requestId','kind','text'])&&x.version===1&&key(x.persona)&&token(x.session)&&number(x.requestId)&&(x.kind==='hello'||x.kind==='command')&&typeof x.text==='string'&&x.text.length<=512&&(x.kind==='hello'?x.text==='':x.text.trim().length>0);
export const validReply=(x:unknown):x is GuideReply=>record(x)&&keys(x,['version','persona','session','requestId','text'])&&x.version===1&&key(x.persona)&&token(x.session)&&number(x.requestId)&&typeof x.text==='string'&&x.text.length>0&&x.text.length<=2048;
const position=(p:Point)=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const nearby=(a:Point,b:Point)=>position(a)&&position(b)&&Math.hypot(a.x-b.x,a.y-b.y)<=GUIDE_RADIUS;
/** Actual SDK player cache is the only membership/coordinate authority. Event data
 * never supplies IDs, names or positions. All five subscriptions have one owner. */
export async function trackAudience(api:GuideApi,changed:()=>void){
 await api.players.configureTracking({players:true,movement:true});
 let active=true,local=await api.player.getPosition();if(!position(local))throw Error('Invalid native local position');
 const refresh=()=>{if(active)changed();};
 const subscriptions=[api.player.onPlayerMove(p=>{if(!position(p))return;local={x:p.x,y:p.y};refresh();}),api.players.onPlayerEnters.subscribe(refresh),api.players.onPlayerLeaves.subscribe(refresh),api.players.onPlayerMoves.subscribe(refresh)];
 const peers=()=>{
  const peers:TrackedPlayer[]=[];
  if(active)for(const p of api.players.list())if(number(p.playerId)&&p.playerId!==api.player.playerId&&typeof p.name==='string'&&p.name.length<=128&&nearby(local,p.position)){if(peers.length===256)break;peers.push(p);}
  return peers;
 };
 return {peers,peer:(id:number)=>{const p=api.players.get(id);return p&&peers().some(current=>current===p&&current.playerId===id)?p:undefined;},close:()=>{if(!active)return;active=false;for(const s of subscriptions)s.unsubscribe();}};
}
/** Finite outbox. Timeout quarantines this communication owner; a late promise
 * cannot enqueue or authorize another message, and is never treated as delivery. */
function outbox(fatal:(error:unknown)=>void){
 let active=true,pending=0,queue=Promise.resolve();const timers=new Set<ReturnType<typeof setTimeout>>();
 return {send(action:()=>Promise<void>):boolean{if(!active||pending>=8)return false;pending++;
  queue=queue.then(async()=>{if(!active)return;let timer:ReturnType<typeof setTimeout>|undefined;
   try{await Promise.race([action(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Guide event delivery deadline expired')),OPERATION_BUDGET_MS);timers.add(timer);})]);}
   catch(error){if(active){active=false;fatal(error);}}finally{if(timer){clearTimeout(timer);timers.delete(timer);}}
  }).finally(()=>{pending--;});return true;
 },close(){active=false;for(const timer of timers)clearTimeout(timer);timers.clear();}};
}
export async function createBotCommunication(api:GuideApi,persona:Persona,onFatal:(error:unknown)=>void,now=()=>Date.now()){
 if(api.player.name!==persona.name)throw Error('Fixed guide identity required');
 api.controls.disablePlayerProximityMeeting();
 let active=true,ready=false,audienceCallback:((audience:Audience)=>void)|undefined,requestCallback:((request:GuideRequest)=>void)|undefined;
 const joined=new Set<(p:Participant)=>void>(),left=new Set<(id:number)=>void>(),ended=new Set<()=>void>();
 let members=new Map<number,Participant>();
 const sessions=new Map<number,{session:string;last:number;commandAt:number;helloAt:number}>();const box=outbox(onFatal);
 const changed=()=>{if(!active||!tracking)return;const next=new Map(tracking.peers().map(p=>[p.playerId,{id:p.playerId,name:p.name}]));
  for(const id of sessions.keys())if(!next.has(id))sessions.delete(id);
  for(const id of members.keys())if(!next.has(id)){for(const cb of left)cb(id);}
  for(const[id,p]of next)if(!members.has(id))for(const cb of joined)cb(p);
  members=next;
 };
 let tracking:Awaited<ReturnType<typeof trackAudience>>|undefined;tracking=await trackAudience(api,changed);changed();
 const send=(id:number,text:string)=>{const session=sessions.get(id),peer=tracking?.peer(id);if(!active||!ready||!session||!peer||personaByName(peer.name)||typeof text!=='string'||text.length>2048)return;
  const payload:GuideReply={version:1,persona:persona.key,session:session.session,requestId:session.last,text};
  box.send(async()=>{const current=tracking?.peer(id);if(!active||!current||current!==peer||sessions.get(id)?.session!==payload.session)return;await current.sendEvent(GUIDE_REPLY_EVENT,payload);});
 };
 const events=api.event.on(GUIDE_REQUEST_EVENT).subscribe(event=>{
  if(!active||!ready||!number(event.senderId)||!validRequest(event.data)||event.data.persona!==persona.key)return;
  changed();const peer=tracking?.peer(event.senderId);if(!peer||personaByName(peer.name))return;
  const r=event.data,previous=sessions.get(event.senderId);
  if(r.kind==='hello'){
   if(previous&&now()-previous.helloAt<2000)return;
   if(previous&&previous.session===r.session&&r.requestId<=previous.last)return;
   if(!previous&&sessions.size>=256)return;
   sessions.set(event.senderId,{session:r.session,last:r.requestId,commandAt:previous?.commandAt??-Infinity,helloAt:now()});
   send(event.senderId,`Hi, I’m ${persona.name}. Choose a zodiac room or type Gemini, Cancer or Libra. I’ll walk with you.`);return;
  }
  if(!previous||previous.session!==r.session||r.requestId<=previous.last||now()-previous.commandAt<2000)return;
  previous.last=r.requestId;previous.commandAt=now();
  requestCallback?.({text:`${persona.key}: ${r.text}`,authorId:event.senderId,authorName:peer.name});
 });
 return {
  onAudience(callback:(audience:Audience)=>void):Dispose{if(audienceCallback)throw Error('Guide audience already owned');audienceCallback=callback;
   callback({participants:[...members.values()],onJoin:cb=>{joined.add(cb);return()=>{joined.delete(cb);};},onLeave:cb=>{left.add(cb);return()=>{left.delete(cb);};},onEnd:cb=>{ended.add(cb);return()=>{ended.delete(cb);};}});
   return()=>{audienceCallback=undefined;};
  },
  onRequest(callback:(request:GuideRequest)=>void):Dispose{if(requestCallback)throw Error('Guide request already owned');requestCallback=callback;return()=>{requestCallback=undefined;};},
  reply:send,activate(){if(active)ready=true;},
  close(){if(!active)return;active=false;ready=false;events.unsubscribe();tracking?.close();box.close();for(const cb of ended)cb();joined.clear();left.clear();ended.clear();sessions.clear();members.clear();requestCallback=undefined;audienceCallback=undefined;},
 };
}
export interface AvailableGuide {id:number;persona:Persona;responsive:boolean}
export async function createHumanCommunication(api:GuideApi,session:string,onReply:(reply:GuideReply)=>void,onChange:()=>void,onError:(error:unknown)=>void){
 if(!token(session)||personaByName(api.player.name))throw Error('Human guide session required');
 let active=true,sequence=0;const selected=new Map<number,{persona:PersonaKey;last:number;responsive:boolean;sentAt:number;respondedAt:number;peer:TrackedPlayer}>();const box=outbox(onError);
 let invalidate=()=>{};
 const tracking=await trackAudience(api,()=>{if(active){invalidate();onChange();}});
 const guides=():AvailableGuide[]=>{
  const peers=tracking.peers(),current=Object.values(PERSONAS).flatMap(persona=>{const found=peers.filter(p=>p.name===persona.name);return found.length===1?[{id:found[0].playerId,persona}]:[];});
  const ids=new Set(current.map(g=>g.id));for(const id of selected.keys())if(!ids.has(id)||selected.get(id)!.peer!==tracking.peer(id))selected.delete(id);
  return current.map(g=>({...g,responsive:!!selected.get(g.id)?.responsive&&Date.now()-selected.get(g.id)!.respondedAt<15000}));
 };
 invalidate=()=>{guides();};
 const events=api.event.on(GUIDE_REPLY_EVENT).subscribe(event=>{
  if(!active||!number(event.senderId)||!validReply(event.data)||event.data.session!==session)return;
  const item=selected.get(event.senderId),guide=guides().find(g=>g.id===event.senderId),r=event.data;
  if(!item||!guide||item.persona!==r.persona||r.requestId!==item.last)return;
  item.responsive=true;item.respondedAt=Date.now();onReply(r);onChange();
 });
 const send=(id:number,text:string,kind:'hello'|'command')=>{
  const guide=guides().find(g=>g.id===id),peer=tracking.peer(id);if(!active||!guide||!peer||text.length>512||sequence>=0x7fffffff)return false;
  const previous=selected.get(id),at=Date.now();if(kind==='command'&&(!guide.responsive||at-previous!.sentAt<2000))return false;
  const request:Request={version:1,persona:guide.persona.key,session,requestId:++sequence,kind,text};if(!validRequest(request))return false;
  const accepted=box.send(async()=>{const current=tracking.peer(id);if(active&&current===peer&&guides().some(g=>g.id===id))await current.sendEvent(GUIDE_REQUEST_EVENT,request);});
  if(!accepted)return false;
  selected.set(id,{persona:guide.persona.key,last:request.requestId,responsive:previous?.responsive??false,sentAt:kind==='command'?at:-Infinity,respondedAt:previous?.respondedAt??-Infinity,peer});return true;
 };
 return {guides,hello:(id:number)=>send(id,'','hello'),request:(id:number,text:string)=>send(id,text.trim(),'command'),close(){if(!active)return;active=false;events.unsubscribe();tracking.close();box.close();selected.clear();}};
}
