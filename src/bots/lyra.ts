import { createLyraController, type LyraAdapter, type LyraController } from './controller';

let current: LyraController | undefined;
let serial: Promise<void> = Promise.resolve();
let generation = 0;

/** Official bot-starter-kit entry. Importing this module performs no WA access or startup. */
async function run(_metadata: unknown): Promise<void> {
  const ticket = ++generation;
  current?.stop('replaced by a new dedicated run');
  serial = serial.catch(() => {}).then(async () => {
    await current?.done;
    if (ticket !== generation) return;
    if (typeof WA === 'undefined') throw Error('Lyra requires an initialized dedicated WorkAdventure bot browser');
    await WA.onInit();
    if (ticket !== generation) return;
    const api: LyraAdapter = {
      map: () => WA.room.getTiledMap(), roomId: () => WA.room.id,
      position: () => WA.player.getPosition(), move: point => WA.player.moveTo(point.x, point.y),
      say: text => WA.chat.sendChatMessage(text, { scope: 'bubble' }),
      diagnostic: text => console.warn(text),
      onChat: callback => {
        const subscription = WA.chat.onChatMessage((text, event) => callback({ text, authorId: event.authorId }), { scope: 'bubble' });
        return () => subscription.unsubscribe();
      },
      onBubble: callback => {
        const subscription = WA.player.meetings.onJoin().subscribe(meeting => {
          if (meeting.kind !== 'proximity') return;
          callback({
            participants: meeting.participants.map(player => player.playerId),
            onJoin: cb => { const s = meeting.onParticipantJoin().subscribe(player => cb(player.playerId)); return () => s.unsubscribe(); },
            onLeave: cb => { const s = meeting.onParticipantLeave().subscribe(player => cb(player.playerId)); return () => s.unsubscribe(); },
            onEnd: cb => { const s = meeting.onLeave().subscribe(cb); return () => s.unsubscribe(); },
          });
        });
        return () => subscription.unsubscribe();
      },
    };
    const controller = createLyraController(api); current = controller;
    const shutdown = () => controller.stop('dedicated page closed');
    globalThis.addEventListener?.('pagehide', shutdown, { once: true });
    void controller.done.then(() => globalThis.removeEventListener?.('pagehide', shutdown));
    await controller.start();
  });
  return serial;
}
export default { run };
