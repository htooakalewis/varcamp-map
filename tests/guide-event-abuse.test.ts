import {afterEach,expect,it,vi} from 'vitest';
import {createBotCommunication} from '../src/bots/event-bridge';
import {PERSONAS} from '../src/bots/personas';
import {nativeGuide,flushNative} from './helpers/guide-event-native';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('bounds untrusted hello bursts without letting an attendee terminate a healthy guide',async()=>{
 vi.useFakeTimers();const h=nativeGuide();h.add(1);const errors:unknown[]=[];const communication=await createBotCommunication(h.wa,PERSONAS.lyra,e=>errors.push(e));communication.activate();
 for(let requestId=1;requestId<=20;requestId++)h.events.next({senderId:1,data:{version:1,persona:'lyra',session:'native-test-session-00001',requestId,kind:'hello',text:''}});
 await flushNative();expect(errors).toEqual([]);expect(h.messages).toHaveLength(1);communication.close();expect(vi.getTimerCount()).toBe(0);
});
it('backpressures many distinct legitimate attendees without exceeding eight concurrent outbound messages or terminating',async()=>{
 vi.useFakeTimers();const h=nativeGuide(),errors:unknown[]=[];const pending:(()=>void)[]=[];
 for(let id=1;id<=30;id++){const p=h.add(id);p.sendEvent=()=>new Promise<void>(resolve=>pending.push(resolve));}
 const communication=await createBotCommunication(h.wa,PERSONAS.lyra,e=>errors.push(e));communication.activate();
 for(let id=1;id<=30;id++)h.events.next({senderId:id,data:{version:1,persona:'lyra',session:'native-test-session-00001',requestId:1,kind:'hello',text:''}});
 await flushNative();expect(errors).toEqual([]);expect(pending).toHaveLength(1);
 for(let i=0;i<8;i++){pending[i]?.();await flushNative();}expect(pending).toHaveLength(8);expect(errors).toEqual([]);communication.close();expect(vi.getTimerCount()).toBe(0);
});
it('never reports a command queued after the human transport has failed',async()=>{
 vi.useFakeTimers();const h=nativeGuide();h.wa.player.name='Attendee';const peer=h.add(20,'Nova[BOT]');const {createHumanCommunication,GUIDE_REPLY_EVENT}=await import('../src/bots/event-bridge');
 const errors:unknown[]=[];const c=await createHumanCommunication(h.wa,'native-test-session-00001',()=>{},()=>{},e=>errors.push(e));c.hello(20);await flushNative();
 h.events.next({senderId:20,data:{version:1,persona:'nova',session:'native-test-session-00001',requestId:1,text:'Welcome'}});peer.sendEvent=async()=>{throw Error('transport closed');};expect(c.request(20,'Gemini')).toBe(true);await flushNative();expect(errors).toHaveLength(1);await vi.advanceTimersByTimeAsync(2000);expect(c.request(20,'Cancer')).toBe(false);c.close();void GUIDE_REPLY_EVENT;
});
it('uses the same bounded tracked audience for enumeration and sender lookup, rejecting the257th nearby sender',async()=>{
 vi.useFakeTimers();const h=nativeGuide();for(let id=1;id<=258;id++)if(id!==10)h.add(id);const errors:unknown[]=[];const c=await createBotCommunication(h.wa,PERSONAS.lyra,e=>errors.push(e));let admitted:number[]=[];c.onAudience(a=>{admitted=a.participants.map(p=>typeof p==='number'?p:p.id);});c.activate();expect(admitted).toHaveLength(256);expect(admitted).not.toContain(258);h.hello(258);await flushNative();expect(h.messages).toEqual([]);expect(errors).toEqual([]);c.close();expect(vi.getTimerCount()).toBe(0);
});
