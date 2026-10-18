import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {nativeGuide,flushNative} from './helpers/guide-event-native';
beforeEach(()=>{vi.useFakeTimers();vi.resetModules();});afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
const native=()=>JSON.parse(readFileSync('maps/overworld.tmj','utf8'));
describe('current dedicated event adapter lifecycle',()=>{
 it('disables meetings, answers zodiac requests by actual targeted sender and serializes replacement behind unresolved native movement',async()=>{
  const h=nativeGuide();const bot=(await import('../src/bots/lyra')).default;await bot.run({});await flushNative();expect(h.calls).toEqual(['disable','tracking']);expect(h.nativeMoves).toHaveLength(1);h.add(1);
  h.hello();await flushNative();expect(h.messages).toHaveLength(1);h.request('Gemini');await flushNative();expect(h.messages.at(-1)).toMatchObject({id:1,data:{text:expect.stringContaining('Gemini')}});
  const replacement=bot.run({});await flushNative();expect(h.listenerCount()).toBe(0);expect(h.nativeMoves).toHaveLength(1);await h.complete();await replacement;await flushNative();expect(h.nativeMoves).toHaveLength(2);expect(h.listenerCount()).toBe(5);await h.complete(true);await flushNative();expect(h.listenerCount()).toBe(0);expect(vi.getTimerCount()).toBe(0);
 });
 it('retains only current server-tracked membership during map validation and drops removed/guide senders',async()=>{
  const h=nativeGuide('nova',20);h.add(1);h.add(10,'Lyra[BOT]');let resolve!:(m:unknown)=>void;h.wa.room.getTiledMap=()=>new Promise(r=>{resolve=r;});const bot=(await import('../src/bots/lyra')).default;const running=bot.run({persona:'nova'});await flushNative();expect(h.listenerCount()).toBe(5);
  const old=h.peers.get(1)!;h.peers.delete(1);h.leaves.next(old);h.add(2,'Other visitor');h.hello(2);expect(h.messages).toEqual([]);resolve(native());await running;await flushNative();h.hello(1);h.hello(10);expect(h.messages).toEqual([]);h.hello(2);await flushNative();h.request('Cancer',2);await flushNative();expect(h.messages.at(-1)).toMatchObject({id:2,data:{text:expect.stringContaining('Cancer')}});await expect(bot.run({persona:'lyra'})).rejects.toThrow(/identity/);expect(h.listenerCount()).toBe(0);
 });
 it('cleans an invalid replacement without changing map or moving a second controller',async()=>{
  const h=nativeGuide('nova',20);const bot=(await import('../src/bots/lyra')).default;await bot.run({persona:'nova'});h.add(1);h.hello();await flushNative();h.wa.room.getTiledMap=async()=>({...native(),width:64});const replaced=bot.run({persona:'nova'});await flushNative();expect(h.listenerCount()).toBe(0);await h.complete();await replaced;await flushNative();expect(h.listenerCount()).toBe(0);expect(h.nativeMoves).toHaveLength(1);expect(vi.getTimerCount()).toBe(0);
 });
 it('replaces a pending map run without replaying old requests or overlapping initialization',async()=>{
  const h=nativeGuide('nova',20);h.add(1);let resolve!:(m:unknown)=>void;h.wa.room.getTiledMap=()=>new Promise(r=>{resolve=r;});const bot=(await import('../src/bots/lyra')).default;const running=bot.run({persona:'nova'});await flushNative();h.hello();expect(h.messages).toEqual([]);h.wa.room.getTiledMap=async()=>native();const replacement=bot.run({persona:'nova'});await flushNative();expect(h.listenerCount()).toBe(0);resolve(native());await running;await replacement;await flushNative();expect(h.messages).toEqual([]);expect(h.nativeMoves).toHaveLength(0);h.hello();await flushNative();expect(h.messages[0].data.text).toContain('Nova[BOT]');await expect(bot.run({persona:'lyra'})).rejects.toThrow(/identity/);expect(h.listenerCount()).toBe(0);
 });
 it('rejects invalid metadata and mismatched identity before tracking/map/movement then accepts actual Orion',async()=>{
  const h=nativeGuide('orion',30),map=vi.spyOn(h.wa.room,'getTiledMap');const bot=(await import('../src/bots/lyra')).default;await expect(bot.run({persona:'aster'})).rejects.toThrow(/persona/);await expect(bot.run({persona:'nova'})).rejects.toThrow(/identity/);expect(map).not.toHaveBeenCalled();expect(h.calls).toEqual([]);expect(h.nativeMoves).toEqual([]);await bot.run({persona:'orion'});h.add(1);h.hello();await flushNative();expect(h.messages[0].data.text).toContain('Orion[BOT]');await h.complete(true);expect(h.listenerCount()).toBe(0);
 });
});
