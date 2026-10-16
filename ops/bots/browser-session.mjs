import { createHash } from 'node:crypto';
import { TERMINAL_PREFIX, failureRecord } from './evidence.mjs';
import { config, isMapFrame, verifyModule } from './config.mjs';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function denyMediaPermissions(cdp) {
  const { targetInfo } = await cdp.send('Target.getTargetInfo');
  if (!targetInfo.browserContextId) throw Error('Missing isolated browser context ID');
  // Browser.setPermission accepts W3C PermissionDescriptor names.
  for (const name of ['microphone', 'camera']) {
    await cdp.send('Browser.setPermission', { permission: { name }, setting: 'denied', origin: new URL(config.roomUrl).origin, browserContextId: targetInfo.browserContextId });
  }
}

export async function joinRoom(page, profile = config) {
  await page.goto(profile.roomUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.getByTestId('loginSceneNameInput').fill(profile.botName);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator(`#${profile.avatar}`).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('Turn off your microphone', { exact: true }).click();
  await page.getByText('Turn off your camera', { exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}

export async function findMapFrame(page) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      // Modal/NPC frames can also expose WA: select the known srcdoc map module first.
      const candidate = await frame.evaluate(() => ({
        location: document.location.href,
        scripts: Array.from(document.scripts, script => script.src),
        hasWA: typeof globalThis.WA === 'object' && typeof globalThis.WA.onInit === 'function',
      })).catch(() => null);
      if (!candidate?.hasWA || !isMapFrame({ ...candidate, initialized: true, roomId: config.roomUrl })) continue;
      const roomId = await frame.evaluate(async () => {
        await Promise.race([globalThis.WA.onInit(), new Promise((_, reject) => setTimeout(() => reject(Error('WA init timeout')), 10000))]);
        return globalThis.WA.room.id;
      });
      if (!isMapFrame({ ...candidate, initialized: true, roomId })) throw Error('Map script initialized in an unexpected room');
      return frame;
    }
    await delay(250);
  }
  throw Error('Initialized map-script iframe was not found');
}

export async function startModule(page, frame, fail, profile = config) {
  let verified = false;
  await page.route(config.moduleUrl, async route => {
    try {
      if (route.request().frame() !== frame) throw Error('Module requested outside the dedicated map frame');
      const response = await route.fetch({ maxRedirects: 0, timeout: 15000 });
      const body = verifyModule({ url: response.url(), status: response.status(), body: await response.body() });
      // Deliver those same verified HTTPS bytes, closing the fetch/import TOCTOU gap.
      verified = true; await route.fulfill({ response, body });
    } catch (error) {
      await route.abort().catch(() => {}); fail(error);
    }
  });
  const identity = await frame.evaluate(async ({ moduleUrl, roomUrl, botName, persona, terminalPrefix }) => {
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
  }, { ...profile, terminalPrefix: TERMINAL_PREFIX });
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

export async function checkDevices(page) {
  for (const id of ['microphone-button', 'camera-button']) {
    const control = page.getByTestId(id);
    await control.waitFor({ state: 'visible', timeout: 15000 });
    if (!/(^|\s)bg-danger(\s|$)/.test(await control.getAttribute('class') ?? '')) throw Error(`${id} is not off`);
  }
}

export async function dismissMediaPrompt(page) {
  const button = page.getByRole('button', { name: 'Continue without webcam and microphone', exact: true });
  if (await button.isVisible()) {
    await button.click({ timeout: 5000 });
    await button.waitFor({ state: 'hidden', timeout: 5000 });
  }
  if (await button.isVisible()) throw Error('No-media popup remains visible');
}

export async function verifyRoomUI(page) {
  await dismissMediaPrompt(page);
  await checkDevices(page);
  const permissions = await page.evaluate(async () => Promise.all(['microphone', 'camera'].map(async name =>
    (await navigator.permissions.query({ name })).state)));
  if (permissions.length !== 2 || permissions.some(state => state !== 'denied')) throw Error('Media permissions are not denied');
  if (await page.getByTestId('close-modal-button').isVisible()) throw Error('Unresolved directory modal');
  if (await page.getByRole('button', { name: 'Continue without webcam and microphone', exact: true }).isVisible()) throw Error('No-media popup returned');
  // Modal semantics are independent of popup text; a matching descendant never excuses them.
  for (const modal of await page.locator('[role="dialog"], [role="alertdialog"], [aria-modal]').all()) {
    if (await modal.isVisible()) throw Error('Unknown visible modal');
  }
  let knownPanels = 0;
  for (const popup of await page.locator('.popupwrapper').all()) {
    if (!await popup.isVisible()) continue;
    const known = await popup.evaluate(root => {
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
    });
    if (!known || ++knownPanels > 1) throw Error('Unknown or ambiguous visible popup');
  }
  const welcomeVisible = await page.getByText('Open the welcome directory', { exact: true }).isVisible();
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
export async function waitForControllerProgress(frame, profile = config) {
  await frame.waitForFunction(() => (globalThis.__varcampGuideEvidence?.steps ?? 0) > 0, undefined, { timeout: 5000 });
  return readIdentity(frame, profile);
}
// The same exported path is exercised with controlled page boundaries in source-only tests.
export async function bootstrapSession(page, { profile = config, fail = error => { throw error; }, assertLive = () => {},
  join = joinRoom, find = findMapFrame, start = startModule, progress = waitForControllerProgress } = {}) {
  await join(page, profile); assertLive();
  const frame = await find(page); assertLive();
  await settleWelcome(page); assertLive();
  await verifyRoomUI(page); assertLive();
  const identity = await start(page, frame, fail, profile); assertLive();
  await progress(frame, profile); assertLive();
  await verifyRoomUI(page); assertLive();
  return { identity, frame };
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
