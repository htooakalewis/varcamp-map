import { diagnosticLine } from '../../ops/bots/evidence.mjs';
import { personaByName, personaFromMetadata } from './personas';
import { createBotCommunication } from './event-bridge';
import { createLyraController, type LyraAdapter, type LyraController } from './controller';

export function writeDiagnostic(text: string, evidence?: Record<string, unknown>, output: (message: string) => void = message => console.warn(message)): void {
  output(diagnosticLine(text, evidence));
}
let current: LyraController | undefined;
let currentCommunication: { close(): void } | undefined;
let serial: Promise<void> = Promise.resolve();
let generation = 0;

/** Official bot-starter-kit entry. Importing this module performs no WA access or startup. */
async function run(metadata?: unknown): Promise<void> {
  const persona = personaFromMetadata(metadata);
  const ticket = ++generation;
  currentCommunication?.close(); current?.stop('replaced by a new dedicated run');
  serial = serial.catch(() => {}).then(async () => {
    await current?.done;
    if (ticket !== generation) return;
    if (typeof WA === 'undefined') throw Error('Guides require an initialized dedicated WorkAdventure bot browser');
    await WA.onInit();
    if (ticket !== generation) return;
    const self = { id: WA.player.playerId, name: WA.player.name };
    if (!Number.isFinite(self.id) || personaByName(self.name)?.key !== persona.key) throw Error('Guide identity does not match fixed persona');
    let bridgeFailure: unknown;
    const communication = await createBotCommunication(WA, persona, error => {
      bridgeFailure = error; current?.stop('Guide communication failed: ' + String(error));
    });
    currentCommunication = communication;
    if (bridgeFailure) { communication.close(); throw bridgeFailure; }
    const api: LyraAdapter = {
      self: () => self,
      map: () => WA.room.getTiledMap(), roomId: () => WA.room.id,
      position: () => WA.player.getPosition(), move: point => WA.player.moveTo(point.x, point.y),
      reply: communication.reply, onRequest: communication.onRequest, onAudience: communication.onAudience,
      diagnostic: writeDiagnostic,
      receipt: evidence => { (globalThis as typeof globalThis & { __varcampGuideEvidence?: Record<string, unknown> }).__varcampGuideEvidence = evidence; },
    };
    const controller = createLyraController(api, undefined, persona, ticket); current = controller;
    const shutdown = () => { communication.close(); controller.stop('dedicated page closed'); };
    globalThis.addEventListener?.('pagehide', shutdown, { once: true });
    void controller.done.then(() => { communication.close(); globalThis.removeEventListener?.('pagehide', shutdown); });
    await controller.start(); communication.activate();
  });
  return serial;
}
export default { run };
