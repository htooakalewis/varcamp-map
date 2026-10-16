import { config, isMapFrame, verifyModule } from './config.mjs';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function joinRoom(page) {
  await page.goto(config.roomUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.getByTestId('loginSceneNameInput').fill(config.botName);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('#woka-female4').click();
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

export async function startModule(page, frame, fail) {
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
  const identity = await frame.evaluate(async ({ moduleUrl, roomUrl, botName }) => {
    const wa = globalThis.WA;
    if (wa.room.id !== roomUrl || wa.player.name !== botName) throw Error('Dedicated player identity mismatch');
    const state = { started: false, stopped: null, playerId: wa.player.playerId };
    globalThis.__lyraDevelopmentHealth = state;
    const warn = console.warn.bind(console);
    console.warn = (...args) => {
      const message = args.map(String).join(' ');
      if (message.startsWith('Lyra stopped:')) state.stopped = message;
      warn(...args);
    };
    const module = await import(moduleUrl);
    if (typeof module.default?.run !== 'function') throw Error('Expected default.run module');
    await module.default.run({});
    if (state.stopped) throw Error(state.stopped);
    state.started = true;
    return { playerId: wa.player.playerId, name: wa.player.name, roomId: wa.room.id };
  }, config);
  if (!verified) throw Error('Module ran without a verified response');
  return identity;
}

export async function readIdentity(frame) {
  return frame.evaluate(() => {
    const state = globalThis.__lyraDevelopmentHealth;
    if (!state?.started || state.stopped) throw Error(state?.stopped ?? 'Controller not started');
    return { playerId: globalThis.WA.player.playerId, name: globalThis.WA.player.name, roomId: globalThis.WA.room.id };
  });
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
  if (await button.isVisible()) await button.click({ timeout: 5000 });
}
