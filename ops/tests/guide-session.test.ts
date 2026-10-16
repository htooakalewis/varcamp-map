import { afterEach, expect, it, vi } from 'vitest';
import * as session from '../bots/browser-session.mjs';
import * as runtimeModule from '../bots/runner.mjs';
import { failureRecord } from '../bots/evidence.mjs';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function pageFixture({ remains = false, rejectClick = false, unknown = false, permissions = 'denied', missingControl = false } = {}) {
  const events: string[] = []; let welcome = true, modal = unknown, prompt = true;
  const control = kind => ({ async isVisible() { return kind === 'welcome' ? welcome : kind === 'close' ? modal : kind === 'prompt' ? prompt : true; }, async click(options) { events.push(`click:${kind}:${options?.timeout ?? 'default'}`); if (kind === 'welcome') { welcome = false; modal = true; } else if (kind === 'close') modal = false; else { if (rejectClick) throw Error('ordinary click failed'); if (!remains) prompt = false; } }, async waitFor({ state }) { if (kind === 'device' && missingControl) throw Error('missing device'); if (kind === 'prompt' && state === 'hidden' && prompt) throw Error('popup remains visible'); if (kind === 'close' && state === 'hidden' && modal) throw Error('modal remains'); }, async getAttribute() { return 'bg-danger'; } });
  return { events, setPrompt: value => { prompt = value; }, page: { getByText: () => control('welcome'), getByTestId: id => control(id === 'close-modal-button' ? 'close' : 'device'), getByRole: () => control('prompt'), locator: () => ({ async all() { return unknown ? [control('close')] : []; } }), async evaluate() { events.push('permissions'); return [permissions, permissions]; } } };
}
it('retains normal modal closure and media predicates for observed generic room UI', async () => {
  const f = pageFixture(); await session.settleWelcome(f.page); await session.verifyRoomUI(f.page);
  expect(f.events).toEqual(['click:welcome:default', 'click:close:default', 'click:prompt:5000', 'permissions']);
});
it.each([{ remains: true }, { rejectClick: true }, { unknown: true }, { permissions: 'prompt' }, { missingControl: true }])('generic UI observation still rejects unresolved modal/media state %j', async options => {
  const f = pageFixture(options);
  await expect((async () => { await session.settleWelcome(f.page); await session.verifyRoomUI(f.page); })()).rejects.toThrow();
});
it('handles a late popup through the same ordinary guarded check and fails if it remains', async () => {
  const f = pageFixture({ remains: true });
  await expect(session.verifyRoomUI(f.page)).rejects.toThrow(/popup/);
});
it('a fatal failure during a deferred probe forbids ready and another heartbeat even after release', async () => {
  const stored: any[] = [], events: string[] = []; let release;
  const state = runtimeModule.createRunnerLifecycle({ save: async value => { stored.push(value); }, log: value => events.push(value.event) });
  const held = new Promise<void>(resolve => { release = resolve; });
  const tick = runtimeModule.heartbeatOnce({ state, probe: async () => { await held; return { playerId: 4 }; }, expected: { playerId: 4 }, schedule: () => events.push('scheduled') });
  state.fail(new Error('fatal browser rejection')); release(); await tick; await state.flush();
  expect(events).not.toContain('ready'); expect(events).not.toContain('scheduled'); expect(stored.at(-1).healthy).toBe(false); expect(stored.at(-1).failure.error.message).toBe('fatal browser rejection');
});
it('stores first error before hanging optional artifacts and initiates owned closure within the bound', async () => {
  vi.useFakeTimers(); const events: string[] = [];
  const state = runtimeModule.createRunnerLifecycle({ save: async value => { if (value.failure) events.push('stored'); } }); state.fail(new Error('first'));
  const done = runtimeModule.shutdownOwned({ state, artifact: () => new Promise(() => {}), close: async () => { events.push('close'); }, artifactTimeout: 1000 });
  await vi.advanceTimersByTimeAsync(1001); await done;
  expect(events[0]).toBe('stored'); expect(events).toContain('close'); expect(state.snapshot().failure.error.message).toBe('first'); expect(state.snapshot().artifacts).toBe('incomplete');
});
it('redacts credential material and bounds nested/non-Error rejection values without losing the original safe stack', () => {
  const original = new Error('failed https://user:password@world.invalid/api?token=secret', { cause: { headers: { Authorization: 'Bearer hidden' }, detail: 'x'.repeat(20000) } }); original.stack = 'AbortError: sentinel\n at browserOrigin (https://world.invalid/iframe_api.js:4:2)';
  const proof = failureRecord(original); const encoded = JSON.stringify(proof);
  expect(proof.error.stack).toBe(original.stack); expect(proof.redacted).toBe(true); expect(proof.truncated).toBe(true); expect(encoded.length).toBeLessThan(20000); expect(encoded).not.toContain('password@'); expect(encoded).not.toContain('token=secret'); expect(encoded).not.toContain('Bearer hidden');
  expect(failureRecord({ code: 12, cause: { code: 13 } }).error).toEqual({ code: 12, cause: { code: 13 } });
});
it('captures only delivered selected script response bytes and explicitly marks absent executing provenance', async () => {
  const listeners = new Map(); let fetches = 0;
  const page = { on: (event, cb) => listeners.set(event, cb), off: event => listeners.delete(event) };
  const evidence = session.captureScriptResponses(page, { now: () => 123 });
  expect(evidence.snapshot().every(row => row.capture === 'missing:not-observed')).toBe(true);
  const response = { url: () => 'https://world.invalid/iframe_api.js?token=hidden', status: () => 200, frame: () => ({ url: () => 'about:srcdoc' }), allHeaders: async () => ({}), body: async () => { fetches++; return Buffer.from('actually delivered script'); } };
  listeners.get('response')(response); await evidence.settle();
  expect(evidence.snapshot()[0]).toMatchObject({ kind: 'iframe-sdk', observedAt: 123, frame: 'about:srcdoc', origin: 'captured-response-body', capture: 'captured', sha256: '97aeced61a241a24b351444ee74d93f16e56411a6d3824339092b2531290efa5', size: 25 });
  expect(JSON.stringify(evidence.snapshot())).not.toContain('hidden'); expect(fetches).toBe(1); evidence.detach();
});
it('preserves native pageerror stack and first-failure authority even when the logger throws', async () => {
  const saved: any[] = []; const state = runtimeModule.createRunnerLifecycle({ save: async value => { saved.push(value); }, log() { throw Error('logger fault'); } });
  const original = new Error('native timeline exception', { cause: 'original cause' }); original.stack = 'TypeError: native timeline exception\n at RoomTimeline.svelte:520';
  state.fail(original, { source: 'pageerror' }); state.fail(new Error('later closure')); await state.flush();
  expect(saved.at(-1).failure).toMatchObject({ source: 'pageerror', error: { stack: original.stack, cause: 'original cause' } });
  await expect(state.ready({})).rejects.toThrow(/terminal/);
});
it('bounds UTF-8 evidence bytes, handles hostile rejection getters and retains explicit serialization flags', () => {
  const huge = Object.fromEntries(Array.from({ length: 16 }, (_, n) => [`key${n}`, 'မြန်မာ'.repeat(3000)]));
  const proof = failureRecord(huge);
  expect(Buffer.byteLength(JSON.stringify(proof))).toBeLessThanOrEqual(16384); expect(proof.truncated).toBe(true);
  const hostile = { get stack() { throw Error('getter failed'); } };
  expect(failureRecord(hostile).serializationFailed).toBe(true);
});
it('bounds and redacts terminal console transport again before final storage', async () => {
  const saved: any[] = []; const state = runtimeModule.createRunnerLifecycle({ save: async value => { saved.push(value); } });
  state.console('VARCAMP_GUIDE_TERMINAL ' + JSON.stringify({ event: 'controller-terminal', persona: 'lyra', operation: 'position', phase: 'pre-step', error: { name: 'AbortError', message: 'failed', stack: 'at https://user:secret@world.invalid/a.js?token=private', cause: { Authorization: 'Bearer secret' } } }));
  await state.flush(); const proof = saved.at(-1).failure;
  expect(proof.redacted).toBe(true); expect(JSON.stringify(proof)).not.toContain('user:secret'); expect(JSON.stringify(proof)).not.toContain('token=private'); expect(proof.operation).toBe('position');
});
it('revalidates the fixed room/name and original player ID after controller startup for each profile', async () => {
  const { selectProfile } = await import('../bots/config.mjs');
  vi.stubGlobal('__lyraDevelopmentHealth', { started: true, stopped: null, playerId: 4 }); vi.stubGlobal('__varcampGuideEvidence', { state: 'pending', steps: 1 });
  const frame = { evaluate: async (fn, value) => fn(value) };
  for (const persona of ['lyra', 'nova', 'orion']) {
    const profile = selectProfile(persona); const wa = { player: { playerId: 4, name: profile.botName }, room: { id: profile.roomUrl } }; vi.stubGlobal('WA', wa);
    expect((await session.readIdentity(frame, profile)).name).toBe(profile.botName);
    for (const change of [() => { wa.player.name = 'Other'; }, () => { wa.player.playerId = 5; }, () => { wa.room.id = 'other-room'; }]) {
      change(); await expect(session.readIdentity(frame, profile)).rejects.toThrow(/identity/); wa.player = { playerId: 4, name: profile.botName }; wa.room.id = profile.roomUrl;
    }
  }
});
it.each(['deadline', 'fatal'])('the actual heartbeat UI boundary terminates a held permission evaluation on %s before late resolution', async reason => {
  vi.useFakeTimers();
  const events: { event: string; at: number }[] = []; const saved: any[] = [];
  const state = runtimeModule.createRunnerLifecycle({ save: async snapshot => { saved.push(snapshot); }, log: value => events.push({ event: value.event, at: Date.now() }) });
  const identity = { playerId: 4, name: 'Lyra [BOT]', roomId: 'expected-room' };
  await state.ready(identity); events.length = 0;
  const f = pageFixture(); await session.settleWelcome(f.page);
  let release, reached = false, settled = false, identityReads = 0;
  f.page.evaluate = async () => { reached = true; return new Promise(resolve => { release = () => resolve(['denied', 'denied']); }); };
  const tick = runtimeModule.heartbeatOnce({ state, expected: identity, probe: () => runtimeModule.probeHeartbeat({ state, page: f.page, frame: { evaluate: async () => { identityReads++; return identity; } } }), schedule: () => events.push({ event: 'scheduled', at: Date.now() }) }).then(() => { settled = true; });
  const closed = state.failure.catch(() => runtimeModule.shutdownOwned({ state, close: async () => { events.push({ event: 'owned-close', at: Date.now() }); } }));
  try {
    await vi.advanceTimersByTimeAsync(0); expect(reached).toBe(true);
    const began = Date.now();
    if (reason === 'deadline') {
      await vi.advanceTimersByTimeAsync(4999); expect(state.snapshot().healthy).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
    } else { state.fail(new Error('native fatal during permissions'), { source: 'pageerror' }); await vi.advanceTimersByTimeAsync(0); }
    expect(state.snapshot().healthy).toBe(false); expect(settled).toBe(true); expect(identityReads).toBe(0);
    await closed; await state.flush();
    expect(events.find(row => row.event === 'owned-close')?.at - began).toBeLessThanOrEqual(reason === 'deadline' ? 5000 : 0);
    expect(saved.at(-1).failure.error.message).toBe(reason === 'deadline' ? 'Heartbeat UI probe timed out' : 'native fatal during permissions');
    release(); await tick; await vi.advanceTimersByTimeAsync(10000); expect(identityReads).toBe(0);
    expect(state.snapshot().healthy).toBe(false); expect(events.map(row => row.event)).not.toContain('ready'); expect(events.map(row => row.event)).not.toContain('scheduled');
  } finally { release?.(); await tick; }
});
