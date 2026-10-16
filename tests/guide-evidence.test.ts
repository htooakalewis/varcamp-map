import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { writeDiagnostic } from '../src/bots/lyra';
import { createRunnerLifecycle } from '../ops/bots/runner.mjs';
import { createLyraController } from '../src/bots/controller';
import type { LyraAdapter } from '../src/bots/controller';

const native = JSON.parse(readFileSync('maps/overworld.tmj', 'utf8'));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it.each(['map', 'startup-position', 'pre-step-position', 'move'])('retains original %s rejection through adapter console into stored runner evidence', async boundary => {
  vi.useFakeTimers();
  const original = new Error('sentinel', { cause: new Error('inner cause') }); original.name = 'AbortError'; original.stack = `AbortError: sentinel\n at original_${boundary} (https://world.invalid/iframe_api.js:12:3)`;
  const stored: any[] = []; const runtime = createRunnerLifecycle({ save: async (snapshot: unknown) => { stored.push(structuredClone(snapshot)); } });
  let positions = 0, moves = 0;
  const api: LyraAdapter = { self: () => ({ id: 4, name: 'Lyra [BOT]' }), roomId: () => 'overworld', map: async () => { if (boundary === 'map') throw original; return native; }, position: async () => { positions++; if (boundary === 'startup-position' && positions === 1 || boundary === 'pre-step-position' && positions === 2) throw original; return { x: 2256, y: 2256 }; }, move: async p => { moves++; if (boundary === 'move') throw original; return { ...p, cancelled: false }; }, say() {}, diagnostic: (text, evidence) => writeDiagnostic(text, evidence, message => runtime.console(message)), onChat: () => () => {}, onBubble: () => () => {} };
  const c = createLyraController(api); await c.start(); await c.done; await runtime.flush();
  const proof = stored.at(-1).failure;
  expect(proof, 'original structured failure was lost').toBeTruthy();
  expect(proof.error).toMatchObject({ name: 'AbortError', message: 'sentinel', stack: original.stack, cause: { message: 'inner cause' } });
  expect(proof.operation).toBe(boundary === 'map' ? 'map' : boundary === 'move' ? 'move' : 'position');
  expect(proof.phase).toBe(boundary.startsWith('startup') || boundary === 'map' ? 'startup' : 'pre-step');
  expect(proof.persona).toBe('lyra'); expect(proof.controllerGeneration).toBeGreaterThanOrEqual(0);
  expect(proof.sequence).toBeGreaterThan(0); expect(proof.settledAt).toBeGreaterThanOrEqual(proof.startedAt);
  if (boundary === 'move' || boundary === 'pre-step-position') expect(proof.attemptedCell).toEqual([71, 70]);
  expect(moves).toBe(boundary === 'move' ? 1 : 0);
});
it('quarantines a pending position after operator stop until its actual continuation settles', async () => {
  let release!: (value: { x: number; y: number }) => void; let count = 0, moves = 0, settled = false;
  const api: LyraAdapter = { map: async () => native, roomId: () => 'overworld', position: () => ++count === 1 ? Promise.resolve({ x: 2256, y: 2256 }) : new Promise<{ x: number; y: number }>(r => { release = r; }), move: async p => { moves++; return { ...p, cancelled: false }; }, say() {}, diagnostic() {}, onChat: () => () => {}, onBubble: () => () => {} };
  const c = createLyraController(api); await c.start(); void c.done.then(() => { settled = true; }); c.stop(); await Promise.resolve(); expect(settled).toBe(false);
  release({ x: 2256, y: 2256 }); await c.done; expect(moves).toBe(0);
});
it('a diagnostic exception cannot leave startup failure active or prevent done settling', async () => {
  const c = createLyraController({ map: async () => { throw new Error('map failure'); }, roomId: () => 'overworld', position: async () => ({ x: 2256, y: 2256 }), move: async p => ({ ...p, cancelled: false }), say() {}, diagnostic() { throw new Error('logger failed'); }, onChat: () => () => {}, onBubble: () => () => {} });
  await expect(c.start()).resolves.toBeUndefined(); await expect(c.done).resolves.toBeUndefined();
});
it('a hostile original Error getter still reaches terminal cleanup and settled done', async () => {
  const original = new Error('hidden'); Object.defineProperty(original, 'message', { get() { throw new Error('unreadable message'); } });
  let disposed = false;
  const c = createLyraController({ map: async () => { throw original; }, roomId: () => 'overworld', position: async () => ({ x: 2256, y: 2256 }), move: async p => ({ ...p, cancelled: false }), say() {}, diagnostic() {}, onChat: () => () => {}, onBubble: () => () => { disposed = true; } });
  await expect(c.start()).resolves.toBeUndefined(); await c.done; expect(disposed).toBe(true);
});
it('read-only controller health remains terminal when logging fails and a stopped position later settles', async () => {
  const { readIdentity } = await import('../ops/bots/browser-session.mjs');
  vi.stubGlobal('__lyraDevelopmentHealth', { started: true, stopped: null }); vi.stubGlobal('WA', { player: { playerId: 4, name: 'Lyra [BOT]' }, room: { id: 'overworld' } });
  let release!: (p: { x: number; y: number }) => void; let positions = 0;
  const c = createLyraController({ map: async () => native, roomId: () => 'overworld', position: () => ++positions === 1 ? Promise.resolve({ x: 2256, y: 2256 }) : new Promise(r => { release = r; }), move: async p => ({ ...p, cancelled: false }), say() {}, diagnostic() { throw Error('logger unavailable'); }, receipt: record => { vi.stubGlobal('__varcampGuideEvidence', record); }, onChat: () => () => {}, onBubble: () => () => {} });
  await c.start(); c.stop(); release({ x: 2256, y: 2256 }); await c.done;
  await expect(readIdentity({ evaluate: async (fn: (value: unknown) => unknown, value: unknown) => fn(value) })).rejects.toThrow(/terminal|stopped/);
});
