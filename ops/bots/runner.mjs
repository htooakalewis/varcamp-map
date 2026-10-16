import { writeFile, rename } from 'node:fs/promises';
import { config, RuntimeHealth } from './config.mjs';
import { joinRoom, findMapFrame, startModule, readIdentity, checkDevices, dismissMediaPrompt } from './browser-session.mjs';

// This is the only production module that loads browser dependencies.
const { chromium } = await import('playwright-core');
const health = new RuntimeHealth();
let browser, context, stopping = false, timer;
let rejectFailure;
const failure = new Promise((_, reject) => { rejectFailure = reject; });
void failure.catch(() => {});
const fail = error => {
  if (stopping) return;
  health.fail(error.message ?? String(error)); rejectFailure(error instanceof Error ? error : Error(String(error)));
};
const saveHealth = async () => {
  await writeFile('/tmp/lyra-health.next', JSON.stringify(health.snapshot()), { mode: 0o600 });
  await rename('/tmp/lyra-health.next', '/tmp/lyra-health.json');
};
const bounded = (promise, milliseconds, label) => {
  let timeout;
  return Promise.race([promise, failure, new Promise((_, reject) => {
    timeout = setTimeout(() => reject(Error(`${label} timed out`)), milliseconds);
  })]).finally(() => clearTimeout(timeout));
};
const shutdownSignal = signal => { stopping = true; health.fail(signal); rejectFailure(Error(signal)); };
process.once('SIGTERM', () => shutdownSignal('SIGTERM'));
process.once('SIGINT', () => shutdownSignal('SIGINT'));
process.on('unhandledRejection', fail);

try {
  await saveHealth();
  const identity = await bounded((async () => {
    browser = await chromium.launch({ headless: true, chromiumSandbox: true, args: ['--mute-audio'], timeout: 30000 });
    browser.on('disconnected', () => fail(Error('Browser disconnected')));
    context = await browser.newContext({ permissions: [], viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', acceptDownloads: false });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', fail);
    page.on('crash', () => fail(Error('Browser page crashed')));
    page.on('close', () => fail(Error('Browser page closed')));
    page.on('console', message => { if (message.text().startsWith('Lyra stopped:')) fail(Error(message.text())); });
    const cdp = await context.newCDPSession(page);
    const { targetInfo } = await cdp.send('Target.getTargetInfo');
    if (!targetInfo.browserContextId) throw Error('Missing isolated browser context ID');
    for (const name of ['audioCapture', 'videoCapture']) {
      await cdp.send('Browser.setPermission', { permission: { name }, setting: 'denied', origin: new URL(config.roomUrl).origin, browserContextId: targetInfo.browserContextId });
    }
    await joinRoom(page);
    const frame = await findMapFrame(page);
    const identity = await startModule(page, frame, fail);
    // Handle the observed optional proximity prompt through its normal no-media button.
    await dismissMediaPrompt(page);
    await checkDevices(page);
    health.ready(identity); await saveHealth();
    console.log(JSON.stringify({ event: 'ready', ...health.snapshot() }));
    // Sequential probes avoid overlapping writes and detect stopped controllers, room changes,
    // navigation, lost frames and media-toggle changes. They never command visitor movement.
    const heartbeat = async () => {
      try {
        await dismissMediaPrompt(page);
        const current = await bounded(readIdentity(frame), 5000, 'Identity probe');
        if (JSON.stringify(current) !== JSON.stringify(identity)) throw Error('Dedicated player identity changed');
        await checkDevices(page);
        health.ready(current); await saveHealth();
        if (!stopping) timer = setTimeout(heartbeat, 3000);
      } catch (error) { fail(error); }
    };
    timer = setTimeout(heartbeat, 3000);
    return identity;
  })(), 120000, 'Browser startup');
  if (!identity) throw Error('Missing dedicated player identity');
  await failure;
} catch (error) {
  health.fail(error.message ?? String(error));
  console.error(JSON.stringify({ event: stopping ? 'stopped' : 'failed', ...health.snapshot() }));
  if (!stopping) process.exitCode = 1;
} finally {
  stopping = true; clearTimeout(timer);
  await saveHealth().catch(() => {});
  // Bound cleanup even if Chromium itself is wedged; Docker init reaps the process tree.
  const forcedExit = setTimeout(() => process.exit(process.exitCode ?? 1), 10000);
  try { await context?.close(); await browser?.close(); }
  catch (error) { console.error(`Browser cleanup failed: ${error.message}`); process.exitCode = 1; }
  clearTimeout(forcedExit);
  process.exit(process.exitCode ?? 0);
}
