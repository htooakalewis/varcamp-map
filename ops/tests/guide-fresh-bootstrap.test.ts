import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as session from '../bots/browser-session.mjs';
import * as runner from '../bots/runner.mjs';
import { selectProfile } from '../bots/config.mjs';
const welcomeText = 'Open the welcome directory';
const journalSrc = 'https://maps.3-1-133-135.sslip.io/varcamp-demo/src/journal/index.html?v=reviewed#directory';
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function knownWelcomeRoot() {
  let root;
  for (const classes of ['text-center leading-6 responsive-message', 'flex items-center p-4 px-10 pointer-events-auto justify-center grow', 'popup-container', 'popupwrapper popupwrapper-0']) {
    root = { tagName: 'DIV', textContent: welcomeText, children: root ? [root] : [], getAttribute(name) { return name === 'class' ? classes : null; } };
  }
  return root;
}
function fixture(options: any = {}) {
  const profile = selectProfile(options.persona ?? 'lyra');
  const events: { name: string; at: number; details?: any }[] = [];
  const state = { welcome: options.delayed ? 0 : 1, modal: options.preexistingModal ?? false, media: options.media !== false,
    location: 'about:srcdoc', position: { x: 2032, y: 2128 }, room: profile.roomUrl, name: profile.botName, closed: false, frameLost: false, source: journalSrc, title: 'VarCamp Quest Journal', unknown: false, controls: true, off: true, denied: true, iframeName: 'modalIframe', ...options.state };
  const waiters = new Set<any>(); let url = options.resumed ? profile.roomUrl : 'about:blank', starts = 0, moves = 0, positionReads = 0, issuedGrant;
  const record = (name, details?) => events.push({ name, at: Date.now(), details });
  const update = values => { Object.assign(state, values); for (const wake of [...waiters]) wake(); };
  const wait = (predicate, timeout = 15000, label = 'native state') => {
    record(`wait:${label}`, { timeout });
    return new Promise<void>((resolve, reject) => {
      let timer;
      const wake = () => {
        try { if (state.closed) throw Error('owned page closed'); if (!predicate()) return;
          clearTimeout(timer); waiters.delete(wake); resolve();
          if (label === 'welcome-absent' && options.reappears) queueMicrotask(() => update({ welcome: 1 }));
        } catch (error) { clearTimeout(timer); waiters.delete(wake); reject(error); }
      };
      if (!(options.wedgedWelcome && label === 'welcome-visible')) timer = setTimeout(() => { waiters.delete(wake); reject(Error(`${label} timed out`)); }, timeout);
      waiters.add(wake); wake();
    });
  };
  const exactWelcome = () => { if (state.welcome > 1) throw Error('ambiguous welcome action'); return state.welcome === 1; };
  const welcome = {
    async isVisible() { record('observe:welcome', state.welcome); return exactWelcome(); },
    async waitFor({ state: wanted, timeout = 15000 }) { await wait(() => wanted === 'visible' ? exactWelcome() : !exactWelcome(), timeout, wanted === 'visible' ? 'welcome-visible' : 'welcome-absent'); },
    async click() { record('welcome-click'); if (options.clickDelay) await new Promise(resolve => setTimeout(resolve, options.clickDelay)); if (state.unknown) throw Error('unknown popup intercepts welcome');
      if (!options.residual) update({ welcome: 0 });
      if (options.modalDelay) setTimeout(() => update({ modal: true }), options.modalDelay); else update({ modal: true });
    },
  };
  const close = {
    async isVisible() { return state.modal; },
    async waitFor({ state: wanted, timeout = 15000 }) { await wait(() => wanted === 'visible' ? state.modal : !state.modal, timeout, `modal-${wanted}`); },
    async click() { record('modal-close');
      if (!options.stuckModal) { if (options.closeDelay) setTimeout(() => update({ modal: false }), options.closeDelay); else update({ modal: false }); }
      if (options.residual && options.removalDelay !== undefined) setTimeout(() => update({ welcome: 0 }), options.removalDelay);
    },
  };
  const media = {
    async isVisible() { return state.media; },
    async click({ timeout }) { record('media-click', { timeout }); if (options.interceptedMedia || state.welcome) throw Error('native popup intercepts media'); if (!options.stuckMedia) update({ media: false }); },
    async waitFor({ state: wanted, timeout }) { await wait(() => wanted === 'hidden' && !state.media, timeout, 'media-hidden'); },
  };
  const modalFrame = {
    async waitFor({ state: wanted, timeout = 15000 }) { await wait(() => wanted === 'visible' && state.modal && state.iframeName === 'modalIframe' && state.source.endsWith('#directory'), timeout, 'directory-source'); },
    async isVisible() { return state.modal; }, async getAttribute(name) { if (name !== 'src') throw Error('unexpected iframe attribute'); return state.source; },
  };
  const page: any = {
    context: () => context, url: () => url,
    getByText(text) { if (text === welcomeText) return welcome;
      if (text === 'VarCamp Quest Journal') return { async waitFor({ state: wanted, timeout = 15000 }) { await wait(() => wanted === 'visible' && state.modal && state.title === text, timeout, 'directory-title'); }, async isVisible() { return state.modal && state.title === text; } };
      throw Error(`Unexpected fixture text ${text}`);
    },
    getByTestId(id) { if (id === 'close-modal-button') return close; return { async waitFor({ timeout = 15000 }) { await wait(() => state.controls, timeout, 'visible-device'); }, async getAttribute() { return state.off ? 'bg-danger' : 'bg-success'; } }; },
    getByRole(role, { name }) { if (role !== 'button' || name !== 'Continue without webcam and microphone') throw Error('Unexpected native media control'); return media; },
    locator(selector) {
      if (selector === 'iframe[name="modalIframe"][src$="#directory"]') return modalFrame;
      return { async all() {
        if (selector === '.popupwrapper') return [...(state.welcome ? [{ async isVisible() { return true; }, async evaluate(fn) { return fn(knownWelcomeRoot()); } }] : []), ...(state.unknown ? [{ async isVisible() { return true; }, async evaluate() { return false; } }] : [])];
        if (selector === '[role="dialog"], [role="alertdialog"], [aria-modal]') return state.modal ? [{ async isVisible() { return true; } }] : [];
        throw Error(`Unexpected fixture selector ${selector}`);
      } };
    },
    async evaluate() { record('permissions'); return state.denied ? ['denied', 'denied'] : ['prompt', 'denied']; },
  };
  const context: any = { pages: () => options.extraPage ? [page, {}] : [page], async newPage() { return page; } };
  const browser = { async newContext(settings) { record('fresh-context', settings); return context; } };
  vi.stubGlobal('document', { location: { get href() { return state.location; } }, scripts: [{ src: 'https://maps.3-1-133-135.sslip.io/varcamp-demo/assets/src-main-reviewed.js' }] });
  vi.stubGlobal('WA', { room: { get id() { return state.room; } }, player: { playerId: 7, get name() { return state.name; }, async getPosition() { positionReads++; if (options.positionError) throw options.positionError; return { ...state.position }; }, async moveTo() { moves++; throw Error('movement forbidden before controller start'); } } });
  const frame = { isDetached: () => state.frameLost, async evaluate(fn, value) { if (state.frameLost) throw Error('frame lost'); record('frame-read'); return fn(value); }, async waitForFunction(fn) { expect(fn()).toBe(true); record('step-progress'); } };
  const health = runner.createRunnerLifecycle({ profile });
  const launch = async (overrides: any = {}) => {
    const freshContext = await session.createFreshRunnerContext(browser);
    const fresh = session.claimFreshBootstrap(freshContext, page, profile); issuedGrant = fresh;
    const action = async () => {
      const result = await session.bootstrapSession(page, { profile, fresh, assertLive: health.assertLive,
        join: async () => { url = profile.roomUrl; record('joined'); }, find: async () => { record('frame-ready'); return frame; },
        start: async () => { record('module-start'); starts++; if (options.returnAfterStart) update({ welcome: 1 }); vi.stubGlobal('__lyraDevelopmentHealth', { started: true, stopped: null, playerId: 7 }); vi.stubGlobal('__varcampGuideEvidence', { state: 'progress', steps: 1 }); return { playerId: 7, name: state.name, roomId: state.room }; }, ...overrides });
      await health.ready(result.identity); return result;
    };
    return runner.startupBoundary(health, action);
  };
  return { state, page, context, browser, frame, profile, health, events, update, launch,
    get grant() { return issuedGrant; }, get starts() { return starts; }, get moves() { return moves; }, get positionReads() { return positionReads; },
    close() { update({ closed: true }); },
  };
}
it('waits for delayed native world registration before media or import although API/frame are already ready', async () => {
  const f = fixture({ delayed: true }); setTimeout(() => f.update({ welcome: 1 }), 1000);
  const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0); expect(f.events.some(row => row.name === 'frame-ready')).toBe(true);
    expect(f.events.filter(row => row.name === 'media-click')).toHaveLength(0); expect(f.starts).toBe(0);
    await vi.advanceTimersByTimeAsync(1000); const result = await task;
    expect(result.identity.name).toBe('Lyra [BOT]'); expect(f.starts).toBe(1); expect(f.health.snapshot().healthy).toBe(true);
    expect(f.events.filter(row => row.name === 'welcome-click')).toHaveLength(1); expect(f.events.filter(row => row.name === 'modal-close')).toHaveLength(1);
    expect(f.events.find(row => row.name === 'media-click')?.at).toBeGreaterThanOrEqual(f.events.find(row => row.name === 'modal-close')!.at);
    expect(f.state.modal).toBe(false); expect(f.state.welcome).toBe(0); expect(f.moves).toBe(0);
  } finally { f.close(); await task.catch(() => {}); }
});
it('closes the positively identified directory before waiting for residual native action removal', async () => {
  const f = fixture({ residual: true, removalDelay: 1000 }); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0);
    expect(f.events.filter(row => row.name === 'modal-close')).toHaveLength(1); expect(f.state.modal).toBe(false); expect(f.state.welcome).toBe(1);
    expect(f.events.filter(row => row.name === 'media-click')).toHaveLength(0); expect(f.starts).toBe(0);
    await vi.advanceTimersByTimeAsync(999); expect(f.starts).toBe(0);
    await vi.advanceTimersByTimeAsync(1); const result = await task;
    expect(result.welcome.consumedAfterActivation).toBe(false); expect(f.starts).toBe(1); expect(f.state.welcome).toBe(0); expect(f.moves).toBe(0);
  } finally { f.close(); await task.catch(() => {}); }
});
const normalCases = ['lyra', 'nova', 'orion'].flatMap(persona => [false, true].flatMap(delayed => [false, true].map(media => ({ persona, delayed, media }))));
it.each(normalCases)('one fresh $persona handshake handles delayed=$delayed media=$media with no movement', async options => {
  const f = fixture(options); if (options.delayed) setTimeout(() => f.update({ welcome: 1 }), 100);
  const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(100); await task;
    expect(f.starts).toBe(1); expect(f.health.snapshot().healthy).toBe(true); expect(f.moves).toBe(0); expect(f.positionReads).toBeGreaterThanOrEqual(2);
    expect(f.events.filter(row => row.name === 'welcome-click')).toHaveLength(1); expect(f.events.filter(row => row.name === 'modal-close')).toHaveLength(1);
    expect(f.events.filter(row => row.name === 'media-click')).toHaveLength(options.media ? 1 : 0);
    if (options.media) expect(f.events.find(row => row.name === 'media-click')?.details.timeout).toBe(5000);
  } finally { f.close(); await task.catch(() => {}); }
});
const invalid = [
  { name: 'duplicate action', state: { welcome: 2 } }, { name: 'unknown popup', state: { unknown: true } },
  { name: 'preexisting modal', preexistingModal: true }, { name: 'wrong directory title', state: { title: 'Other journal' } },
  { name: 'journal section is not directory', state: { source: journalSrc.replace('#directory', '#journal') } },
  { name: 'wrong native modal frame', state: { iframeName: 'otherFrame' } },
  { name: 'foreign directory source', state: { source: 'https://foreign.invalid/src/journal/index.html#directory' } },
  { name: 'missing action', delayed: true }, { name: 'unconsumed action', residual: true }, { name: 'returned action', reappears: true },
  { name: 'stuck modal', stuckModal: true }, { name: 'intercepted media', interceptedMedia: true }, { name: 'stuck media', stuckMedia: true },
  { name: 'missing controls', state: { controls: false } }, { name: 'media on', state: { off: false } }, { name: 'permissions not denied', state: { denied: false } },
  { name: 'wrong room', state: { room: 'wrong-room' } }, { name: 'wrong spawn', state: { position: { x: 2256, y: 2256 } } },
  { name: 'wrong guide name', state: { name: 'Other [BOT]' } }, { name: 'wrong map frame', state: { location: 'other-frame' } },
  { name: 'lost frame', state: { frameLost: true } }, { name: 'resumed page', resumed: true }, { name: 'extra context page', extraPage: true },
];
it.each(invalid)('fresh bootstrap rejects $name without module execution, movement or retries', async options => {
  const f = fixture(options); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(15000); await expect(task).rejects.toThrow();
    expect(f.starts).toBe(0); expect(f.moves).toBe(0); expect(f.health.snapshot().healthy).toBe(false);
    expect(f.events.filter(row => row.name === 'welcome-click').length).toBeLessThanOrEqual(1);
    expect(f.events.filter(row => row.name === 'media-click').length).toBeLessThanOrEqual(1);
  } finally { f.close(); await task.catch(() => {}); }
});
it.each([
  { phase: 'welcome observation', delayed: true }, { phase: 'activation', clickDelay: 1000 },
  { phase: 'modal opening', modalDelay: 1000 }, { phase: 'modal closing', closeDelay: 1000 },
  { phase: 'action removal', residual: true, removalDelay: 1000 },
])('fatal during $phase prevents all later UI actions/start/ready despite native late completion', async options => {
  const f = fixture(options); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0);
    const before = f.events.filter(row => ['welcome-click', 'modal-close', 'media-click', 'module-start'].includes(row.name)).length;
    f.health.fail(Error(`fatal during ${options.phase}`));
    if (options.delayed) f.update({ welcome: 1 });
    await vi.advanceTimersByTimeAsync(1000); await expect(task).rejects.toThrow();
    expect(f.events.filter(row => ['welcome-click', 'modal-close', 'media-click', 'module-start'].includes(row.name))).toHaveLength(before);
    expect(f.starts).toBe(0); expect(f.health.snapshot().healthy).toBe(false); expect(f.moves).toBe(0);
  } finally { f.close(); await task.catch(() => {}); }
});
it('the production startup boundary closes owned resources at the unchanged120s cap when native welcome observation wedges', async () => {
  const f = fixture({ delayed: true, wedgedWelcome: true }); const task = f.launch(); void task.catch(() => {});
  const closed = f.health.failure.catch(() => runner.shutdownOwned({ state: f.health, close: async () => { f.events.push({ name: 'owned-close', at: Date.now() }); f.close(); } }));
  try {
    await vi.advanceTimersByTimeAsync(119999); expect(f.health.snapshot().failure).toBeNull(); expect(f.starts).toBe(0); expect(f.events.some(row => row.name === 'owned-close')).toBe(false);
    await vi.advanceTimersByTimeAsync(1); await expect(task).rejects.toThrow(/Browser startup timed out/); await closed;
    expect(f.health.snapshot().healthy).toBe(false); expect(f.events.filter(row => row.name === 'owned-close')).toHaveLength(1);
    expect(f.events.filter(row => row.name === 'media-click')).toHaveLength(0); expect(f.starts).toBe(0);
    expect(f.events.find(row => row.name === 'wait:welcome-visible')?.details.timeout).toBe(15000);
  } finally { f.close(); await task.catch(() => {}); }
});
it('refuses missing/forged fresh grants and does not apply the handshake to arbitrary existing contexts', async () => {
  const f = fixture();
  for (const fresh of [undefined, {}, { fresh: true }]) {
    await expect(session.bootstrapSession(f.page, { fresh })).rejects.toThrow(/fresh|owned/i);
  }
  expect(f.starts).toBe(0); expect(f.events.filter(row => row.name === 'welcome-click')).toHaveLength(0);
  expect(() => session.claimFreshBootstrap(f.context, f.page, f.profile)).toThrow(/fresh|owned/i);
});
it('a lifecycle grant is claimed once and cannot replay a completed fresh bootstrap', async () => {
  const f = fixture(); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0); await task;
    expect(() => session.claimFreshBootstrap(f.context, f.page, f.profile)).toThrow(/new owned/i);
    f.page.url = () => 'about:blank';
    await expect(session.bootstrapSession(f.page, { profile: f.profile, fresh: f.grant, join: async () => { throw Error('grant unexpectedly replayed'); } })).rejects.toThrow(/unused fresh owned/i);
    expect(f.starts).toBe(1);
    expect(f.events.find(row => row.name === 'fresh-context')?.details).toEqual({ permissions: [], viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', acceptDownloads: false });
  } finally { f.close(); await task.catch(() => {}); }
});
it('public startup position rejection remains fatal with original stack/cause and no retry', async () => {
  const original = new Error('native position rejected', { cause: 'original cause' }); original.name = 'AbortError'; original.stack = 'AbortError: native position rejected\n at browser iframe_api.js:12:3';
  const f = fixture({ positionError: original }); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0); await expect(task).rejects.toBe(original);
    expect(f.health.snapshot().failure.error).toMatchObject({ name: 'AbortError', stack: original.stack, cause: 'original cause' });
    expect(f.positionReads).toBe(1); expect(f.starts).toBe(0); expect(f.events.filter(row => row.name === 'media-click')).toHaveLength(0);
  } finally { f.close(); await task.catch(() => {}); }
});
it('the initial ready handoff rejects a known welcome reappearance after import instead of using the heartbeat exemption', async () => {
  const f = fixture({ returnAfterStart: true }); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0); await expect(task).rejects.toThrow(/welcome|popup/i);
    expect(f.starts).toBe(1); expect(f.health.snapshot().healthy).toBe(false);
    expect(f.events.filter(row => row.name === 'welcome-click')).toHaveLength(1); expect(f.events.filter(row => row.name === 'media-click')).toHaveLength(1);
  } finally { f.close(); await task.catch(() => {}); }
});
