import { createHash } from 'node:crypto';
import { TERMINAL_PREFIX, failureRecord } from './evidence.mjs';
import { config, selectProfile, isMapFrame, verifyModule } from './config.mjs';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const noop = () => {};
const guarded = async (assertLive, action) => { assertLive(); const value = await action(); assertLive(); return value; };
const createdContexts = new WeakMap(), freshGrants = new WeakMap();

/** Only this runner lifecycle path creates the context that can issue a fresh bootstrap grant. */
export async function createFreshRunnerContext(browser) {
  const context = await browser.newContext({ permissions: [], viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', acceptDownloads: false });
  if (createdContexts.has(context)) throw Error('Refusing reused runner context');
  createdContexts.set(context, { claimed: false }); return context;
}
export function claimFreshBootstrap(context, page, profile = config) {
  const record = createdContexts.get(context);
  if (!record || record.claimed || page.context() !== context || context.pages().length !== 1 || context.pages()[0] !== page || page.url() !== 'about:blank' || selectProfile(profile?.persona) !== profile) throw Error('Require a new owned isolated context and one blank guide page');
  record.claimed = true;
  const grant = Object.freeze({}); freshGrants.set(grant, { context, page, profile }); return grant;
}

export async function denyMediaPermissions(cdp, { assertLive = noop } = {}) {
  const { targetInfo } = await guarded(assertLive, () => cdp.send('Target.getTargetInfo'));
  if (!targetInfo.browserContextId) throw Error('Missing isolated browser context ID');
  // Browser.setPermission accepts W3C PermissionDescriptor names.
  for (const name of ['microphone', 'camera']) {
    await guarded(assertLive, () => cdp.send('Browser.setPermission', { permission: { name }, setting: 'denied', origin: new URL(config.roomUrl).origin, browserContextId: targetInfo.browserContextId }));
  }
}

export async function joinRoom(page, profile = config, { assertLive = noop } = {}) {
  await guarded(assertLive, () => page.goto(profile.roomUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }));
  await guarded(assertLive, () => page.getByTestId('loginSceneNameInput').fill(profile.botName));
  await guarded(assertLive, () => page.getByRole('button', { name: 'Continue', exact: true }).click());
  await guarded(assertLive, () => page.locator(`#${profile.avatar}`).click());
  await guarded(assertLive, () => page.getByRole('button', { name: 'Continue', exact: true }).click());
  await guarded(assertLive, () => page.getByText('Turn off your microphone', { exact: true }).click());
  await guarded(assertLive, () => page.getByText('Turn off your camera', { exact: true }).click());
  await guarded(assertLive, () => page.getByRole('button', { name: 'Save', exact: true }).click());
}

export async function findMapFrame(page, { assertLive = noop } = {}) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    assertLive();
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      // Modal/NPC frames can also expose WA: select the known srcdoc map module first.
      const candidate = await frame.evaluate(() => ({
        location: document.location.href,
        scripts: Array.from(document.scripts, script => script.src),
        hasWA: typeof globalThis.WA === 'object' && typeof globalThis.WA.onInit === 'function',
      })).catch(() => null);
      assertLive();
      if (!candidate?.hasWA || !isMapFrame({ ...candidate, initialized: true, roomId: config.roomUrl })) continue;
      const roomId = await frame.evaluate(async () => {
        await Promise.race([globalThis.WA.onInit(), new Promise((_, reject) => setTimeout(() => reject(Error('WA init timeout')), 10000))]);
        return globalThis.WA.room.id;
      });
      assertLive();
      if (!isMapFrame({ ...candidate, initialized: true, roomId })) throw Error('Map script initialized in an unexpected room');
      return frame;
    }
    await guarded(assertLive, () => delay(250));
  }
  throw Error('Initialized map-script iframe was not found');
}

export async function startModule(page, frame, fail, profile = config, { assertLive = noop } = {}) {
  let verified = false;
  await guarded(assertLive, () => page.route(config.moduleUrl, async route => {
    assertLive();
    try {
      if (route.request().frame() !== frame) throw Error('Module requested outside the dedicated map frame');
      const response = await guarded(assertLive, () => route.fetch({ maxRedirects: 0, timeout: 15000 }));
      const body = verifyModule({ url: response.url(), status: response.status(), body: await guarded(assertLive, () => response.body()) });
      // Deliver those same verified HTTPS bytes, closing the fetch/import TOCTOU gap.
      verified = true; await guarded(assertLive, () => route.fulfill({ response, body }));
    } catch (error) {
      await route.abort().catch(() => {}); fail(error);
    }
  }));
  const identity = await guarded(assertLive, () => frame.evaluate(async ({ moduleUrl, roomUrl, botName, persona, terminalPrefix }) => {
    const wa = globalThis.WA;
    if (wa.room.id !== roomUrl || wa.player.name !== botName) throw Error('Dedicated player identity mismatch');
    const state = { started: false, stopped: null, playerId: wa.player.playerId };
    globalThis.__lyraDevelopmentHealth = state;
    const warn = console.warn.bind(console);
    console.warn = (...args) => {
      const message = args.map(String).join(' ');
      if (message.startsWith(terminalPrefix)) state.stopped = message;
      warn(...args);
    };
    const module = await import(moduleUrl);
    if (typeof module.default?.run !== 'function') throw Error('Expected default.run module');
    await module.default.run({ persona });
    if (state.stopped) throw Error(state.stopped);
    state.started = true;
    return { playerId: wa.player.playerId, name: wa.player.name, roomId: wa.room.id };
  }, { ...profile, terminalPrefix: TERMINAL_PREFIX }));
  if (!verified) throw Error('Module ran without a verified response');
  return identity;
}

export async function readIdentity(frame, profile = config) {
  return frame.evaluate(({ botName, roomUrl }) => {
    const state = globalThis.__lyraDevelopmentHealth;
    if (['terminal', 'failed'].includes(globalThis.__varcampGuideEvidence?.state)) throw Error('Controller is terminal');
    if (!state?.started || state.stopped) throw Error(state?.stopped ?? 'Controller not started');
    const wa = globalThis.WA;
    if (wa.player.playerId !== state.playerId || wa.player.name !== botName || wa.room.id !== roomUrl) throw Error('Dedicated player identity changed');
    return { playerId: wa.player.playerId, name: wa.player.name, roomId: wa.room.id };
  }, profile);
}

export async function checkDevices(page, { assertLive = noop } = {}) {
  for (const id of ['microphone-button', 'camera-button']) {
    const control = page.getByTestId(id);
    await guarded(assertLive, () => control.waitFor({ state: 'visible', timeout: 15000 }));
    if (!/(^|\s)bg-danger(\s|$)/.test(await guarded(assertLive, () => control.getAttribute('class')) ?? '')) throw Error(`${id} is not off`);
  }
}
export async function dismissMediaPrompt(page, { assertLive = noop, beforeMedia = async () => {} } = {}) {
  await guarded(assertLive, beforeMedia);
  const button = page.getByRole('button', { name: 'Continue without webcam and microphone', exact: true });
  if (await guarded(assertLive, () => button.isVisible())) {
    await guarded(assertLive, beforeMedia);
    await guarded(assertLive, () => button.click({ timeout: 5000 }));
    await guarded(assertLive, () => button.waitFor({ state: 'hidden', timeout: 5000 }));
  }
  if (await guarded(assertLive, () => button.isVisible())) throw Error('No-media popup remains visible');
}
async function assertNoModal(page, assertLive) {
  if (await guarded(assertLive, () => page.getByTestId('close-modal-button').isVisible())) throw Error('Unexpected visible directory modal');
  for (const modal of await guarded(assertLive, () => page.locator('[role="dialog"], [role="alertdialog"], [aria-modal]').all())) {
    if (await guarded(assertLive, () => modal.isVisible())) throw Error('Unknown visible modal');
  }
}
async function assertWelcomeAbsent(page, assertLive) {
  if (await guarded(assertLive, () => page.getByText('Open the welcome directory', { exact: true }).isVisible())) throw Error('Consumed welcome action returned or remains');
  await assertNoModal(page, assertLive);
}
export async function verifyRoomUI(page, { assertLive = noop, initial = false } = {}) {
  await dismissMediaPrompt(page, { assertLive, beforeMedia: initial ? () => assertWelcomeAbsent(page, assertLive) : async () => {} });
  await checkDevices(page, { assertLive });
  const permissions = await guarded(assertLive, () => page.evaluate(async () => Promise.all(['microphone', 'camera'].map(async name =>
    (await navigator.permissions.query({ name })).state))));
  if (permissions.length !== 2 || permissions.some(state => state !== 'denied')) throw Error('Media permissions are not denied');
  await assertNoModal(page, assertLive);
  if (await guarded(assertLive, () => page.getByRole('button', { name: 'Continue without webcam and microphone', exact: true }).isVisible())) throw Error('No-media popup returned');
  let knownPanels = 0;
  for (const popup of await guarded(assertLive, () => page.locator('.popupwrapper').all())) {
    if (!await guarded(assertLive, () => popup.isVisible())) continue;
    if (initial) throw Error('Initial welcome action or unknown popup remains');
    const known = await guarded(assertLive, () => popup.evaluate(root => {
      // The observed action div remains clickable after the native directory closes.
      // Inspect only its wrapper, with the exact four-DIV chain and complete normalized text.
      const required = [
        ['popupwrapper', 'popupwrapper-0'], ['popup-container'],
        ['flex', 'items-center', 'p-4', 'px-10', 'pointer-events-auto', 'justify-center', 'grow'],
        ['text-center', 'leading-6', 'responsive-message'],
      ];
      let element = root;
      for (let depth = 0; depth < required.length; depth++) {
        if (!element || element.tagName !== 'DIV' ||
            (element.textContent ?? '').replace(/\s+/gu, ' ').trim() !== 'Open the welcome directory') return false;
        const classes = new Set((element.getAttribute('class') ?? '').split(/\s+/u));
        if (required[depth].some(name => !classes.has(name))) return false;
        if (['role', 'aria-modal', 'contenteditable', 'tabindex', 'aria-controls', 'aria-haspopup'].some(name => element.getAttribute(name) !== null)) return false;
        if (element.children.length !== (depth === required.length - 1 ? 0 : 1)) return false;
        element = element.children[0];
      }
      return true;
    }));
    if (!known || ++knownPanels > 1) throw Error('Unknown or ambiguous visible popup');
  }
  const welcomeVisible = await guarded(assertLive, () => page.getByText('Open the welcome directory', { exact: true }).isVisible());
  if (welcomeVisible !== (knownPanels === 1)) throw Error('Unclassified welcome action panel');
}
export async function settleWelcome(page) {
  const welcome = page.getByText('Open the welcome directory', { exact: true });
  const close = page.getByTestId('close-modal-button');
  if (await close.isVisible()) throw Error('Unexpected visible modal before UI settlement');
  if (await welcome.isVisible()) {
    await welcome.click(); await close.waitFor({ state: 'visible' });
    await close.click(); await close.waitFor({ state: 'hidden' });
  } else if (await close.isVisible()) throw Error('Unexpected visible modal before UI settlement');
}
export async function waitForControllerProgress(frame, profile = config, { assertLive = noop } = {}) {
  await guarded(assertLive, () => frame.waitForFunction(() => (globalThis.__varcampGuideEvidence?.steps ?? 0) > 0, undefined, { timeout: 5000 }));
  return guarded(assertLive, () => readIdentity(frame, profile));
}
async function readFreshJoin(frame, profile, assertLive, original) {
  assertLive();
  if (frame.isDetached()) throw Error('Fresh guide frame lost');
  const observed = await guarded(assertLive, () => frame.evaluate(async () => {
    const position = await globalThis.WA.player.getPosition();
    return { location: document.location.href, scripts: Array.from(document.scripts, script => script.src),
      roomId: globalThis.WA.room.id, name: globalThis.WA.player.name, playerId: globalThis.WA.player.playerId, position };
  }));
  const p = observed.position;
  if (!isMapFrame({ ...observed, initialized: true }) || observed.roomId !== profile.roomUrl || observed.name !== profile.botName || !Number.isFinite(observed.playerId)) throw Error('Fresh guide room/frame/identity mismatch');
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || ![[63,65],[64,65],[63,66],[64,66]].some(([x,y]) => Math.floor(p.x / 32) === x && Math.floor(p.y / 32) === y)) throw Error('Fresh guide outside reviewed welcome spawn');
  if (original && (observed.playerId !== original.playerId || p.x !== original.position.x || p.y !== original.position.y)) throw Error('Fresh guide moved or changed identity during settlement');
  return observed;
}
async function settleFreshWelcome(page, assertLive) {
  const welcome = page.getByText('Open the welcome directory', { exact: true });
  await assertNoModal(page, assertLive);
  await guarded(assertLive, () => welcome.waitFor({ state: 'visible', timeout: 15000 }));
  if (!await guarded(assertLive, () => welcome.isVisible())) throw Error('Fresh welcome action not observed');
  await assertNoModal(page, assertLive);
  await guarded(assertLive, () => welcome.click({ timeout: 15000 }));
  const consumedAfterActivation = !await guarded(assertLive, () => welcome.isVisible());
  // Removal may still be pending. Close the positively identified directory before waiting for it.
  const directory = page.locator('iframe#modalIframe');
  await guarded(assertLive, () => directory.waitFor({ state: 'visible', timeout: 15000 }));
  if (await guarded(assertLive, () => directory.count()) !== 1 || await guarded(assertLive, () => directory.getAttribute('title')) !== 'VarCamp Quest Journal') throw Error('Unexpected directory modal identity');
  if (!await guarded(assertLive, () => directory.evaluate(element => element.isConnected && element.parentElement?.tagName === 'DIV'))) throw Error('Detached or unexpected directory modal container');
  const src = await guarded(assertLive, () => directory.getAttribute('src'));
  let source; try { source = new URL(src); } catch { throw Error('Invalid directory modal source'); }
  if (source.origin !== 'https://maps.3-1-133-135.sslip.io' || source.pathname !== '/varcamp-demo/src/journal/index.html' || source.hash !== '#directory') throw Error('Unexpected directory modal source');
  const associatedClose = directory.locator('..').getByTestId('close-modal-button');
  const close = page.getByTestId('close-modal-button');
  if (await guarded(assertLive, () => associatedClose.count()) !== 1 || await guarded(assertLive, () => close.count()) !== 1) throw Error('Require unique associated directory close control');
  await guarded(assertLive, () => close.waitFor({ state: 'visible', timeout: 15000 }));
  await guarded(assertLive, () => close.click({ timeout: 15000 }));
  await guarded(assertLive, () => close.waitFor({ state: 'hidden', timeout: 15000 }));
  await guarded(assertLive, () => directory.waitFor({ state: 'hidden', timeout: 15000 }));
  await guarded(assertLive, () => welcome.waitFor({ state: 'hidden', timeout: 15000 }));
  await assertWelcomeAbsent(page, assertLive);
  return { consumedAfterActivation, consumedAfterClose: true };
}
/** Only a single lifecycle-issued grant can enter this fixed fresh-world handshake. */
export async function bootstrapSession(page, { profile = config, fresh, fail = error => { throw error; }, assertLive = noop,
  join = joinRoom, find = findMapFrame, start = startModule, progress = waitForControllerProgress } = {}) {
  assertLive(); const owned = freshGrants.get(fresh);
  if (!owned || owned.page !== page || owned.profile !== profile || page.context() !== owned.context || owned.context.pages().length !== 1 || owned.context.pages()[0] !== page || page.url() !== 'about:blank') throw Error('Require an unused fresh owned guide bootstrap grant');
  freshGrants.delete(fresh);
  await guarded(assertLive, () => join(page, profile, { assertLive }));
  const frame = await guarded(assertLive, () => find(page, { assertLive }));
  const original = await readFreshJoin(frame, profile, assertLive);
  const welcome = await settleFreshWelcome(page, assertLive);
  await readFreshJoin(frame, profile, assertLive, original);
  await verifyRoomUI(page, { assertLive, initial: true });
  await readFreshJoin(frame, profile, assertLive, original);
  await assertWelcomeAbsent(page, assertLive);
  const identity = await guarded(assertLive, () => start(page, frame, fail, profile, { assertLive }));
  await guarded(assertLive, () => progress(frame, profile, { assertLive }));
  await verifyRoomUI(page, { assertLive, initial: true });
  return { identity, frame, welcome };
}

/** Hash only selected response bodies delivered during this page session, never refetch. */
export function captureScriptResponses(page, { now = Date.now, maxBytes = 8 * 1024 * 1024, maxResponses = 8 } = {}) {
  const captured = [], pending = new Set(); let selected = 0;
  const kindOf = url => /\/iframe_api\.js(?:[?#]|$)/.test(url) ? 'iframe-sdk' :
    /\/GameManager-[\w-]+\.js(?:[?#]|$)/.test(url) ? 'GameManager' : /\/(?:src-main|index)-[\w-]+\.js(?:[?#]|$)/.test(url) ? 'main' : null;
  const listener = response => {
    const kind = kindOf(response.url()); if (!kind || selected++ >= maxResponses) return;
    const source = failureRecord(response.url());
    let frame; try { frame = failureRecord(response.frame().url()); } catch { frame = { error: 'missing:frame-unavailable', redacted: false }; }
    const row = { kind, url: source.error, observedAt: now(), frame: frame.error, redacted: source.redacted || frame.redacted, origin: 'captured-response-body', status: response.status(), sha256: null, size: null, capture: 'pending' };
    captured.push(row);
    const work = (async () => {
      try {
        const length = Number((await response.allHeaders())['content-length']);
        if (length > maxBytes) { row.capture = 'missing:response-too-large'; return; }
        const body = await response.body();
        if (body.length > maxBytes) { row.capture = 'missing:response-too-large'; return; }
        row.sha256 = createHash('sha256').update(body).digest('hex'); row.size = body.length; row.capture = 'captured';
      } catch { row.capture = 'missing:body-unavailable'; }
    })(); pending.add(work); void work.finally(() => pending.delete(work));
  };
  page.on('response', listener);
  return {
    snapshot: () => ['iframe-sdk', 'main', 'GameManager'].flatMap(kind => {
      const rows = captured.filter(row => row.kind === kind);
      return rows.length ? rows.map(row => ({ ...row })) : [{ kind, capture: 'missing:not-observed', sha256: null, origin: 'no-captured-response' }];
    }),
    async settle() { await Promise.allSettled([...pending]); },
    detach() { page.off('response', listener); },
  };
}
