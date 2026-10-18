import { readyPeer, rendererPeer, rendererReceipt } from './helpers/renderer-peer.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { buildDedicatedController } from '../../tools/release';
import * as session from '../bots/browser-session.mjs';
import * as runner from '../bots/runner.mjs';
import { selectProfile } from '../bots/config.mjs';
const welcomeText = 'Open the welcome directory';
// Captured native parent subtree, not a fabricated parent title/name contract.
const modalHTML = readFileSync(new URL('./fixtures/native-directory-20261016.html', import.meta.url), 'utf8');
const iframeHTML = modalHTML.match(/<iframe[^>]*>/)![0];
const modalAttribute = (name: string) => iframeHTML.match(new RegExp(` ${name}="([^"]*)"`))?.[1] ?? null;
const journalSrc = modalAttribute('src')!;
let controllerBytes: Buffer;
beforeAll(async () => {
  const artifact = (await buildDedicatedController()).find(row => row.fileName === 'bots/lyra.js');
  if (!artifact) throw Error('Missing actual dedicated controller compilation');
  controllerBytes = Buffer.from(artifact.source);
  expect(controllerBytes.length).toBe(selectProfile().moduleBytes);
  expect(createHash('sha256').update(controllerBytes).digest('hex')).toBe(selectProfile().moduleSha256);
});
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
  const state = { welcome: options.delayed ? 0 : 1, modal: options.preexistingModal ?? false, frameModal: options.preexistingModal ?? false, media: options.media !== false,
    location: 'about:srcdoc', position: { x: 2032, y: 2128 }, room: profile.roomUrl, name: profile.botName, closed: false, frameLost: false, source: journalSrc, title: modalAttribute('title'), unknown: false, controls: true, microphone: 'visible', camera: 'visible', off: true, denied: true, permissionStates: null, iframeId: modalAttribute('id'), iframeName: modalAttribute('name'), parentTitle: false, modalCount: 1, closeCount: 1, associatedClose: true, connected: true, ...options.state };
  const waiters = new Set<any>(); let url = options.resumed ? profile.roomUrl : 'about:blank', starts = 0, moves = 0, positionReads = 0, issuedGrant, moduleRoute;
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
      if (options.modalDelay) setTimeout(() => update({ modal: true, frameModal: true }), options.modalDelay); else update({ modal: true, frameModal: true });
    },
  };
  const close = {
    async count() { return state.modal ? state.closeCount : 0; },
    async isVisible() { return state.modal; },
    async waitFor({ state: wanted, timeout = 15000 }) { await wait(() => wanted === 'visible' ? state.modal : !state.modal, timeout, `modal-${wanted}`); },
    async click() { record('modal-close');
      if (options.failedClose) throw Error('native close failed');
      if (!options.stuckModal) { if (options.closeDelay) setTimeout(() => update({ modal: false }), options.closeDelay); else update({ modal: false }); }
      if (!options.stuckFrame) { const delay = options.frameCloseDelay ?? options.closeDelay; if (delay) setTimeout(() => update({ frameModal: false }), delay); else update({ frameModal: false }); }
      if (options.residual && options.removalDelay !== undefined) setTimeout(() => update({ welcome: 0 }), options.removalDelay);
    },
  };
  const media = {
    async isVisible() { return state.media; },
    async click({ timeout }) { record('media-click', { timeout }); if (options.interceptedMedia || state.welcome) throw Error('native popup intercepts media'); if (!options.stuckMedia) update({ media: false }); },
    async waitFor({ state: wanted, timeout }) { await wait(() => wanted === 'hidden' && !state.media, timeout, 'media-hidden'); },
  };
  const modalFrame = {
    async count() { return state.frameModal ? state.modalCount : 0; },
    async waitFor({ state: wanted, timeout = 15000 }) { await wait(() => {
      if (state.frameModal && state.modalCount > 1) throw Error('ambiguous native modal iframe');
      return wanted === 'hidden' ? !state.frameModal : state.frameModal && state.iframeId === 'modalIframe';
    }, timeout, wanted === 'hidden' ? 'directory-hidden' : 'directory-source'); },
    async isVisible() { return state.modal; },
    async getAttribute(name) { return name === 'src' ? state.source : name === 'title' ? state.title : null; },
    async evaluate(fn) { return fn({ isConnected: state.connected, parentElement: { tagName: 'DIV' } }); },
    locator(selector) { if (selector !== '..') throw Error(`Unexpected modal relative selector ${selector}`);
      return { getByTestId(id) { if (id !== 'close-modal-button') throw Error('Unexpected associated modal control');
        return state.associatedClose ? { ...close, async waitFor(options) { if (options.state === 'hidden' && !state.frameModal) return; return close.waitFor(options); } } : { ...close, async count() { return 0; }, async waitFor() { throw Error('missing associated close'); }, async click() { throw Error('unrelated close forbidden'); } };
      } };
    },
  };
  const page: any = {
    context: () => context, url: () => url,
    async route(url, handler) { expect(url).toBe(profile.moduleUrl); record('module-route-installed'); moduleRoute = handler; },
    getByText(text) { if (text === welcomeText) return welcome;
      if (text === 'VarCamp Quest Journal') return { async waitFor({ state: wanted, timeout = 15000 }) { await wait(() => wanted === 'visible' && state.modal && state.parentTitle, timeout, 'directory-title'); }, async isVisible() { return state.modal && state.parentTitle; } };
      throw Error(`Unexpected fixture text ${text}`);
    },
    getByTestId(id) { if (id === 'close-modal-button') return close;
      if (!['microphone-button', 'camera-button'].includes(id)) throw Error(`Unexpected fixture device ${id}`);
      const mode = () => state.controls ? state[id === 'microphone-button' ? 'microphone' : 'camera'] : 'detached';
      return {
        async count() { record('device-count', { id, mode: mode() }); return mode() === 'detached' ? 0 : 1; },
        async isVisible() { record('device-visible', { id, mode: mode() }); return mode() === 'visible'; },
        async waitFor({ state: wanted, timeout = 15000 }) { record('device-wait', { id, wanted, mode: mode(), timeout }); await wait(() => wanted === 'visible' ? mode() === 'visible' : wanted === 'detached' ? mode() === 'detached' : wanted === 'attached' ? mode() !== 'detached' : wanted === 'hidden' ? mode() !== 'visible' : false, timeout, `${id}-${wanted}`); },
        async getAttribute() { record('device-class', { id, mode: mode() }); return mode() === 'detached' ? null : state.off ? 'bg-danger' : 'bg-success'; },
      };
    },
    getByRole(role, { name }) { if (role !== 'button' || name !== 'Continue without webcam and microphone') throw Error('Unexpected native media control'); return media; },
    locator(selector) {
      if (selector === 'iframe#modalIframe') return modalFrame;
      if (selector === 'iframe[name="modalIframe"][src$="#directory"]') return { async waitFor() { throw Error('captured native iframe has no name attribute'); } };
      return { async all() {
        if (selector === '.popupwrapper') return [...(state.welcome ? [{ async isVisible() { return true; }, async evaluate(fn) { return fn(knownWelcomeRoot()); } }] : []), ...(state.unknown ? [{ async isVisible() { return true; }, async evaluate() { return false; } }] : [])];
        if (selector === '[role="dialog"], [role="alertdialog"], [aria-modal]') return state.modal ? [{ async isVisible() { return true; } }] : [];
        throw Error(`Unexpected fixture selector ${selector}`);
      } };
    },
    async evaluate() { record('permissions'); return state.permissionStates ?? (state.denied ? ['denied', 'denied'] : ['prompt', 'denied']); },
  };
  const context: any = { pages: () => options.extraPage ? [page, {}] : [page], async newPage() { return page; } };
  const browser = { async newContext(settings) { record('fresh-context', settings); return context; } };
  vi.stubGlobal('document', { location: { get href() { return state.location; } }, scripts: [{ src: 'https://maps.3-1-133-135.sslip.io/varcamp-demo/assets/src-main-reviewed.js' }] });
  vi.stubGlobal('WA', { room: { get id() { return state.room; } }, player: { playerId: 7, get name() { return state.name; }, async getPosition() { positionReads++; if (options.positionError) throw options.positionError; return { ...state.position }; }, async moveTo() { moves++; throw Error('movement forbidden before controller start'); } } });
  const frame = { isDetached: () => state.frameLost, async evaluate(fn, value) {
    if (state.frameLost) throw Error('frame lost'); record('frame-read');
    if (value?.moduleUrl) {
      // Mock only Playwright's browser execution boundary. The real startModule
      // installs its route, fetches/verifies the actual compiled/pinned bytes and
      // fulfills the same body before this native import execution completes.
      expect(value).toBe(profile); expect(moduleRoute).toBeTypeOf('function');
      expect(String(fn)).toContain('module.default.run({ persona })');
      let fulfilled = false;
      const response = { url: () => profile.moduleUrl, status: () => 200, async body() { return controllerBytes; } };
      await moduleRoute({ request: () => ({ frame: () => frame }), async fetch(settings) { expect(settings).toEqual({ maxRedirects: 0, timeout: 15000 }); record('module-fetch'); return response; },
        async fulfill({ response: original, body }) { expect(original).toBe(response); expect(Buffer.from(body).equals(controllerBytes)).toBe(true); record('verified-bytes-fulfilled'); fulfilled = true; },
        async abort() { throw Error('Verified native module transport unexpectedly aborted'); } });
      expect(fulfilled).toBe(true); record('module-start'); starts++;
      update({ microphone: 'detached', ...(options.afterStart ?? {}), ...(options.returnAfterStart ? { welcome: 1 } : {}) });
      vi.stubGlobal('__lyraDevelopmentHealth', { started: true, stopped: null, playerId: 7 });
      const at=Date.now(); vi.stubGlobal('__varcampGuideEvidence', { state: 'progress', steps: options.progressSteps ?? 1,at,leaseDeadline:at+10000,operationBudgetMs:10000,persona:profile.persona,controllerGeneration:7,playerId:7,name:state.name,roomId:state.room });
      return { playerId: 7, name: state.name, roomId: state.room };
    }
    const result = await fn(value);
    if (starts) record('step-progress');
    if (starts && result?.evidence?.steps > 0) { record('observed-controller-progress'); if (options.revokeAfterProgress) health.fail(Error('lifecycle revoked during real progress observation')); }
    return result;
  } };
  const health = runner.createRunnerLifecycle({ profile });
  const launch = async (overrides: any = {}) => {
    const freshContext = await session.createFreshRunnerContext(browser);
    const fresh = session.claimFreshBootstrap(freshContext, page, profile); issuedGrant = fresh;
    const action = async () => {
      const result = await session.bootstrapSession(page, { profile, fresh, assertLive: health.assertLive,
        join: async () => { url = profile.roomUrl; record('joined'); }, find: async () => { record('frame-ready'); return frame; },
        ...overrides });
      health.observe(await session.controllerObserver(result.frame, profile, { assertLive: health.assertLive }).read()); health.setRendererEvidence(rendererReceipt()); await health.ready(result.identity); return result;
    };
    return runner.startupBoundary(health, action);
  };
  return { state, page, context, browser, frame, profile, health, events, update, launch,
    get grant() { return issuedGrant; }, get starts() { return starts; }, get moves() { return moves; }, get positionReads() { return positionReads; },
    close() { update({ closed: true }); },
  };
}
it('the captured native modal acknowledges startup without fabricated parent title text or iframe name', async () => {
  const f = fixture(); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(15000); await task;
    expect(f.starts).toBe(1); expect(f.health.snapshot().failure).toBeNull();
    expect(f.events.filter(row => row.name === 'modal-close')).toHaveLength(1);
    expect(f.state.frameModal).toBe(false); expect(f.state.modal).toBe(false);
  } finally { f.close(); await task.catch(() => {}); }
});
it('waits for asynchronously removed native iframe as well as its associated closed control before media', async () => {
  const f = fixture({ frameCloseDelay: 1000 }); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0);
    expect(f.state.modal).toBe(false); expect(f.state.frameModal).toBe(true);
    expect(f.events.filter(row => row.name === 'media-click')).toHaveLength(0); expect(f.starts).toBe(0);
    await vi.advanceTimersByTimeAsync(1000); await task;
    expect(f.starts).toBe(1); expect(f.state.frameModal).toBe(false);
  } finally { f.close(); await task.catch(() => {}); }
});
it('waits for the associated close when the native iframe disappears first', async () => {
  const f = fixture({ closeDelay: 1000, frameCloseDelay: 0 }); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0);
    expect(f.state.modal).toBe(true); expect(f.state.frameModal).toBe(false);
    expect(f.events.filter(row => row.name === 'media-click')).toHaveLength(0); expect(f.starts).toBe(0);
    await vi.advanceTimersByTimeAsync(1000); await task;
    expect(f.starts).toBe(1); expect(f.state.modal).toBe(false);
  } finally { f.close(); await task.catch(() => {}); }
});
it('waits for delayed native world registration before media or import although API/frame are already ready', async () => {
  const f = fixture({ delayed: true }); setTimeout(() => f.update({ welcome: 1 }), 1000);
  const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0); expect(f.events.some(row => row.name === 'frame-ready')).toBe(true);
    expect(f.events.filter(row => row.name === 'media-click')).toHaveLength(0); expect(f.starts).toBe(0);
    await vi.advanceTimersByTimeAsync(1000); const result = await task;
    expect(result.identity.name).toBe('Lyra[BOT]'); expect(f.starts).toBe(1); expect(f.health.snapshot().healthy).toBe(true);
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
  { name: 'name-only wrong-id modal frame', state: { iframeId: 'otherFrame', iframeName: 'modalIframe' } },
  { name: 'missing title attribute despite parent text decoy', state: { title: null, parentTitle: true } },
  { name: 'wrong title attribute despite parent text decoy', state: { title: 'Other title', parentTitle: true } },
  { name: 'duplicate native modal iframe', state: { modalCount: 2 } },
  { name: 'duplicate associated native close', state: { closeCount: 2 } },
  { name: 'unrelated close outside native container', state: { associatedClose: false } },
  { name: 'detached modal identity', state: { connected: false } },
  { name: 'wrong directory path', state: { source: journalSrc.replace('/src/journal/', '/other/') } },
  { name: 'failed normal close', failedClose: true },
  { name: 'foreign directory source', state: { source: 'https://foreign.invalid/src/journal/index.html#directory' } },
  { name: 'missing action', delayed: true }, { name: 'unconsumed action', residual: true }, { name: 'returned action', reappears: true },
  { name: 'stuck modal', stuckModal: true }, { name: 'stuck iframe after close', stuckFrame: true }, { name: 'intercepted media', interceptedMedia: true }, { name: 'stuck media', stuckMedia: true },
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
    await expect(session.bootstrapSession(f.page, { fresh, assertLive() {} })).rejects.toThrow(/fresh|owned/i);
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
    await expect(session.bootstrapSession(f.page, { profile: f.profile, fresh: f.grant, assertLive() {}, join: async () => { throw Error('grant unexpectedly replayed'); } })).rejects.toThrow(/unused fresh owned/i);
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

// The actual official disablePlayerProximityMeeting transition unmounts ONLY
// the microphone control. The native camera control stays visible and muted.
// This fixture changes that DOM state only inside the awaited controller start,
// and admission still uses the production progress observer and lifecycle.
it('official proximity shutdown after verified controller start/progress admits detached mic and visible muted camera at bootstrap and runtime', async () => {
  const f = fixture({ afterStart: { microphone: 'detached' } }); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0);
    const result = await task.catch(error => {
      console.error(JSON.stringify({ regression: 'official-proximity-mic-detached-after-verified-progress', error: error.message,
        controls: { microphone: f.state.microphone, camera: f.state.camera, off: f.state.off, permissions: f.state.denied ? ['denied', 'denied'] : ['prompt', 'denied'] },
        productionEvents: f.events.filter(row => ['module-start', 'observed-controller-progress', 'permissions', 'device-wait', 'device-class'].includes(row.name)),
      }));
      throw error;
    });
    expect(f.starts).toBe(1); expect(result.identity.name).toBe(f.profile.botName);
    expect(f.events.filter(row => row.name === 'observed-controller-progress').length).toBeGreaterThanOrEqual(1);
    expect(f.events.findIndex(row => row.name === 'permissions')).toBeLessThan(f.events.findIndex(row => row.name === 'module-start'));
    expect(f.state.microphone).toBe('detached'); expect(f.state.camera).toBe('visible');
    expect(f.health.snapshot().healthy).toBe(true);
    await expect(session.verifyRoomUI(f.page, { assertLive: f.health.assertLive })).resolves.toBeUndefined();
    expect(f.events.filter(row => row.name === 'permissions').length).toBeGreaterThanOrEqual(3);
    expect(f.events.filter(row => row.name === 'welcome-click')).toHaveLength(1);
    expect(f.events.filter(row => row.name === 'module-start')).toHaveLength(1);
  } finally { f.close(); await task.catch(() => {}); }
});

it('mic detached before controller start cannot authorize the later proximity phase', async () => {
  const f = fixture({ state: { microphone: 'detached' } }); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(15000); await expect(task).rejects.toThrow();
    expect(f.starts).toBe(0); expect(f.health.snapshot().healthy).toBe(false);
    expect(f.events.filter(row => row.name === 'observed-controller-progress')).toHaveLength(0);
  } finally { f.close(); await task.catch(() => {}); }
});

it.each([
  { name: 'hidden-but-attached microphone', afterStart: { microphone: 'hidden' } },
  { name: 'returned visible microphone', afterStart: { microphone: 'visible' } },
  { name: 'detached camera', afterStart: { microphone: 'detached', camera: 'detached' } },
  { name: 'hidden camera', afterStart: { microphone: 'detached', camera: 'hidden' } },
  { name: 'active camera', afterStart: { microphone: 'detached', off: false } },
  { name: 'granted microphone permission', afterStart: { microphone: 'detached', permissionStates: ['granted', 'denied'] } },
  { name: 'granted camera permission', afterStart: { microphone: 'detached', permissionStates: ['denied', 'granted'] } },
  { name: 'wrong live identity', afterStart: { microphone: 'detached', name: 'Wrong [BOT]' } },
  { name: 'no actual controller progress', afterStart: { microphone: 'detached' }, progressSteps: 0 },
  { name: 'revoked lifecycle after real progress', afterStart: { microphone: 'detached' }, revokeAfterProgress: true },
])('post-start proximity admission rejects $name without ready, retries or grant replay', async options => {
  const f = fixture(options); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(15000); await expect(task).rejects.toThrow();
    expect(f.starts).toBe(1); expect(f.health.snapshot().healthy).toBe(false);
    expect(f.events.filter(row => row.name === 'welcome-click')).toHaveLength(1);
    expect(f.events.filter(row => row.name === 'module-start')).toHaveLength(1);
  } finally { f.close(); await task.catch(() => {}); }
});

it('caller phase flags and claimed progress never authorize detached mic on an unadmitted page', async () => {
  const f = fixture({ state: { microphone: 'detached' }, media: false });
  const work = session.verifyRoomUI(f.page, { assertLive: f.health.assertLive, initial: false, phase: 'post-controller', started: true, progress: true, proximityDisabled: true } as any); void work.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(15000); await expect(work).rejects.toThrow();
    expect(f.starts).toBe(0); expect(f.events.filter(row => row.name === 'observed-controller-progress')).toHaveLength(0);
  } finally { f.close(); await work.catch(() => {}); }
});

it.each(['start', 'progress'])('an injected %s callback cannot mint a post-controller UI capability', async seam => {
  const f = fixture(); let calls = 0;
  const task = f.launch({ [seam]: async () => { calls++; return { playerId: 7, name: f.profile.botName, roomId: f.profile.roomUrl }; } }); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(15000); await expect(task).rejects.toThrow();
    expect(calls).toBe(0); expect(f.starts).toBe(0); expect(f.health.snapshot().healthy).toBe(false);
  } finally { f.close(); await task.catch(() => {}); }
});

it('a failed bootstrap keeps its original owner authority even when controls later look like pre-start again', async () => {
  const f = fixture({ afterStart: { microphone: 'hidden' } }); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(15000); await expect(task).rejects.toThrow();
    f.update({ microphone: 'visible', camera: 'visible' }); const before = f.events.length;
    await expect(session.verifyRoomUI(f.page, { assertLive() {} })).rejects.toThrow();
    expect(f.events).toHaveLength(before); expect(f.starts).toBe(1);
  } finally { f.close(); await task.catch(() => {}); }
});

it('an already-revoked lifecycle is recorded before the first bootstrap check and cannot be replaced', async () => {
  const f = fixture({ media: false });
  const context = await session.createFreshRunnerContext(f.browser);
  const fresh = session.claimFreshBootstrap(context, f.page, f.profile);
  f.health.fail(Error('revoked before first bootstrap check'));
  await expect(session.bootstrapSession(f.page, { profile: f.profile, fresh, assertLive: f.health.assertLive })).rejects.toThrow(/terminal|revoked/);
  const before = f.events.length;
  await expect(session.verifyRoomUI(f.page, { assertLive() {} })).rejects.toThrow();
  expect(f.events).toHaveLength(before); expect(f.starts).toBe(0);
});

it('post-controller observation refuses a replacement lifecycle guard and retains the owner tombstone', async () => {
  const f = fixture(); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0); await task;
    const before = f.events.length;
    await expect(session.verifyRoomUI(f.page, { assertLive() {} })).rejects.toThrow();
    await expect(session.verifyRoomUI(f.page, { assertLive: f.health.assertLive })).rejects.toThrow();
    expect(f.events).toHaveLength(before);
  } finally { f.close(); await task.catch(() => {}); }
});

it('post-controller observation checks the original live authority before a replacement guard can hide revocation', async () => {
  const f = fixture(); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0); await task;
    f.health.fail(Error('original lifecycle revoked')); const before = f.events.length;
    await expect(session.verifyRoomUI(f.page, { assertLive() {} })).rejects.toThrow(/revoked|terminal/);
    expect(f.events).toHaveLength(before);
  } finally { f.close(); await task.catch(() => {}); }
});

it('a different page cannot borrow the admitted page phase even with the same context, controls and guard', async () => {
  const f = fixture(); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0); await task;
    const otherPage = { ...f.page };
    const work = session.verifyRoomUI(otherPage, { assertLive: f.health.assertLive }); void work.catch(() => {});
    await vi.advanceTimersByTimeAsync(15000); await expect(work).rejects.toThrow();
    expect(f.starts).toBe(1);
  } finally { f.close(); await task.catch(() => {}); }
});

it.each(['native room', 'native name', 'frame', 'context'])('runtime phase refuses changed $0 and cannot recover by restoring DOM state', async changed => {
  const f = fixture(); const task = f.launch(); void task.catch(() => {});
  try {
    await vi.advanceTimersByTimeAsync(0); await task;
    const originalContext = f.page.context;
    if (changed === 'native room') f.update({ room: 'other-room' });
    if (changed === 'native name') f.update({ name: 'Other [BOT]' });
    if (changed === 'frame') f.update({ frameLost: true });
    if (changed === 'context') f.page.context = () => ({ pages: () => [f.page] });
    const uiActions = () => f.events.filter(row => ['device-wait', 'device-count', 'device-class', 'permissions', 'media-click'].includes(row.name)).length;
    const before = uiActions();
    await expect(session.verifyRoomUI(f.page, { assertLive: f.health.assertLive })).rejects.toThrow();
    expect(uiActions()).toBe(before);
    f.update({ room: f.profile.roomUrl, name: f.profile.botName, frameLost: false }); f.page.context = originalContext;
    await expect(session.verifyRoomUI(f.page, { assertLive: f.health.assertLive })).rejects.toThrow();
    expect(uiActions()).toBe(before);
  } finally { f.close(); await task.catch(() => {}); }
});
