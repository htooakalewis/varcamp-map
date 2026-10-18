// PRIVATE clean Canvas native candidate; no CPU profiler or browser-process session.
import { writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { RuntimeHealth, selectProfile } from './config.mjs';
import { failureRecord, TERMINAL_PREFIX, hasLiveControllerLease } from './evidence.mjs';
import { denyMediaPermissions, createFreshRunnerContext, claimFreshBootstrap, bootstrapSession, verifyRoomUI, joinRoom, controllerObserver } from './browser-session.mjs';
import { parseCandidateMode, createDiagnosticJoin, captureAppResponse, captureDiagnosticScriptResponses, createCandidateRendererObserver, validateCandidateRendererEvidence } from './candidate-render-policy.mjs';

export function createRunnerLifecycle({ profile = selectProfile(), save = async (_snapshot) => {}, log = (_event) => {} } = {}) {
  const health = new RuntimeHealth(profile); let terminal = false, first, queue = Promise.resolve(), scripts = [], artifacts = 'not-requested', rendererEvidence, lastReadySequence = 0;
  const secondaryFailures = [];
  const secondary = (error, phase) => { if (secondaryFailures.length < 16) secondaryFailures.push(failureRecord(error, { phase })); };
  let rejectFailure; const failure = new Promise((_, reject) => { rejectFailure = reject; }); void failure.catch(() => {});
  const snapshot = () => ({ ...health.snapshot(), failure: first ?? null, scripts, artifacts, rendererEvidence: rendererEvidence ?? null, secondaryFailures: [...secondaryFailures] });
  const flush = () => { queue = queue.catch(() => {}).then(() => save(snapshot())); return queue; };
  const fail = (error, context = {}) => {
    if (terminal) return; terminal = true;
    first = context.structured ?? failureRecord(error, { event: 'runner-terminal', persona: profile.persona, observedAt: Date.now(), ...context });
    health.fail(first.error?.message ?? 'Terminal browser/controller failure');
    // Latch and enqueue evidence before any optional artifacts or cleanup. Never throw from a listener.
    void flush().catch(() => {}); rejectFailure(error instanceof Error ? error : Error('Terminal browser/controller failure'));
    try { log({ event: 'failed', ...snapshot() }); } catch (error) { secondary(error, 'logger'); }
  };
  const assertLive = () => { if (terminal) throw Error('Runner is terminal'); };
  return { failure, fail, assertLive, snapshot, flush, secondary,
    observe(value) { assertLive(); health.observe(value); },
    setRendererEvidence(value) {
      assertLive(); validateCandidateRendererEvidence(value);
      if (rendererEvidence && value.sequence <= rendererEvidence.sequence) throw Error('Renderer observation did not advance');
      rendererEvidence = Object.freeze({ ...value, appAttestation: Object.freeze({ ...value.appAttestation }), observation: Object.freeze({ ...value.observation }) });
    },
    setScripts(value) { scripts = value; }, setArtifacts(value) { artifacts = value; },
    console(message) {
      if (!message.startsWith(TERMINAL_PREFIX)) return;
      try {
        if (message.length > 22000) throw Error('Oversize controller terminal evidence');
        const structured = JSON.parse(message.slice(TERMINAL_PREFIX.length));
        if (structured.event !== 'controller-terminal' || structured.persona !== profile.persona) throw Error('Invalid controller terminal evidence');
        const metadata = { event: 'controller-terminal', persona: profile.persona };
        for (const key of ['operation', 'phase']) {
          if (structured[key] !== undefined) {
            if (typeof structured[key] !== 'string' || !/^[a-z-]{1,40}$/.test(structured[key])) throw Error('Invalid controller operation metadata');
            metadata[key] = structured[key];
          }
        }
        for (const key of ['sequence', 'startedAt', 'settledAt', 'controllerGeneration', 'steps']) {
          if (structured[key] !== undefined) {
            if (!Number.isFinite(structured[key]) || structured[key] < 0) throw Error('Invalid controller receipt number');
            metadata[key] = structured[key];
          }
        }
        if (structured.attemptedCell !== undefined) {
          if (!Array.isArray(structured.attemptedCell) || structured.attemptedCell.length !== 2 || !structured.attemptedCell.every(Number.isInteger)) throw Error('Invalid attempted cell');
          metadata.attemptedCell = structured.attemptedCell;
        }
        if (typeof structured.summary === 'string') metadata.summary = failureRecord(structured.summary.slice(0, 256)).error;
        const boundedRecord = failureRecord(structured.error, metadata);
        boundedRecord.redacted ||= structured.redacted === true;
        boundedRecord.truncated ||= structured.truncated === true;
        boundedRecord.serializationFailed ||= structured.serializationFailed === true;
        fail('Controller stopped', { structured: boundedRecord });
      } catch (error) { fail(error, { source: 'controller-console-transport' }); }
    },
    async ready(identity) {
      assertLive();
      if (!rendererEvidence || rendererEvidence.sequence <= lastReadySequence || !hasLiveControllerLease(health.snapshot().controller)) throw Error('Current native/renderer observation required before readiness');
      const rendererAge = Date.now() - rendererEvidence.observation.endWallMs;
      if (rendererAge < 0 || rendererAge >= 15000) throw Error('Renderer observation stale or future');
      lastReadySequence = rendererEvidence.sequence; health.ready(identity); await flush(); assertLive();
      try { log({ event: 'ready', ...snapshot() }); } catch (error) { fail(error, { source: 'logger' }); }
    },
  };
}
const deadline = async (promise, milliseconds, label) => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`${label} timed out`)), milliseconds); })]); }
  finally { clearTimeout(timer); }
};
export async function startupBoundary(state, operation) {
  state.assertLive();
  try { return await Promise.race([deadline(operation(), 120000, 'Browser startup'), state.failure]); }
  catch (error) { state.fail(error, { source: 'startup' }); throw error; }
}
export async function heartbeatOnce({ state, probe, expected, schedule }) {
  try {
    state.assertLive(); const current = await probe(); state.assertLive();
    if (JSON.stringify(current) !== JSON.stringify(expected)) throw Error('Dedicated player identity changed');
    await state.ready(current); state.assertLive(); schedule();
  } catch (error) { state.fail(error, { source: 'heartbeat' }); }
}
// Export the same production probe for controlled host/page-boundary regressions.
export async function probeHeartbeat({ state, page, frame, profile = selectProfile(), provenance, rendererObserver, verifyUI = verifyRoomUI, observeController = controllerObserver }) {
  await Promise.race([deadline(verifyUI(page, { assertLive: state.assertLive }), 5000, 'Heartbeat UI probe'), state.failure]); state.assertLive();
  const observation = await Promise.race([observeController(frame, profile, { assertLive: state.assertLive }).read(), state.failure]); state.assertLive();
  state.observe(observation);
  const rendererEvidence = await Promise.race([rendererObserver.read(), state.failure]); state.assertLive();
  state.setRendererEvidence(rendererEvidence);
  const current = observation.identity;
  if (provenance) state.setScripts(provenance.snapshot());
  return current;
}
export async function shutdownOwned({ state, artifact, close, artifactTimeout = 1000 }) {
  await deadline(state.flush(), 1000, 'Failure evidence storage').catch(error => state.secondary(error, 'storage'));
  if (artifact) {
    try { await deadline(artifact(), artifactTimeout, 'Optional diagnostic artifact'); state.setArtifacts('complete'); }
    catch (error) { state.secondary(error, 'artifact'); state.setArtifacts('incomplete'); }
  }
  // Closure begins despite a hung artifact or storage. The outer process deadline covers all of this.
  const closing = Promise.resolve().then(close);
  void state.flush().catch(() => {});
  try { await closing; } catch (error) { state.secondary(error, 'close'); await state.flush().catch(() => {}); throw error; }
}

export async function initializeCandidate({ page, profile, fresh, state, provenance, appCapture, own, bootstrap = bootstrapSession, observe = controllerObserver, makeRenderer = createCandidateRendererObserver }) {
  const result = await bootstrap(page, { profile, fresh, fail: state.fail, assertLive: state.assertLive, join: createDiagnosticJoin('canvas', joinRoom) });
  await Promise.race([deadline(provenance.settle(), 1000, 'Executing response settlement'), state.failure]); state.assertLive();
  state.setScripts(provenance.snapshot()); state.observe(await observe(result.frame, profile, { assertLive: state.assertLive }).read()); state.assertLive();
  const assertInitialized = () => { state.assertLive(); const c = state.snapshot().controller;
    if (!c || c.identity.roomId !== profile.roomUrl || c.identity.name !== profile.botName || !Number.isInteger(c.identity.playerId) || !Number.isInteger(c.evidence?.steps) || c.evidence.steps < 1 || !hasLiveControllerLease(c)) throw Error('Current native initialization is unproved'); };
  const rendererObserver = makeRenderer(page, { assertLive: state.assertLive, assertInitialized, appCapture }); own({ rendererObserver });
  const rendererEvidence = await Promise.race([rendererObserver.read(), state.failure]); state.assertLive(); state.setRendererEvidence(rendererEvidence);
  await state.ready(result.identity); state.assertLive(); return { ...result, rendererObserver };
}

export async function main() {
  const rendererMode = parseCandidateMode(process.argv.slice(2));
  const { chromium } = await import('playwright-core');
  const profile = selectProfile(process.env.VARCAMP_BOT_PERSONA ?? 'lyra');
  const save = async snapshot => {
    await writeFile('/tmp/lyra-health.next', JSON.stringify(snapshot), { mode: 0o600 });
    await rename('/tmp/lyra-health.next', '/tmp/lyra-health.json');
  };
  const state = createRunnerLifecycle({ profile, save, log: value => console.log(JSON.stringify(value)) });
  let browser, context, timer, provenance, appCapture, rendererObserver, stopping = false;
  const signal = name => { stopping = true; state.fail(Error(name), { source: 'operator' }); };
  process.once('SIGTERM', () => signal('SIGTERM')); process.once('SIGINT', () => signal('SIGINT'));
  process.on('unhandledRejection', state.fail);
  try {
    await state.flush();
    const { identity, frame, page } = await startupBoundary(state, async () => {
      browser = await chromium.launch({ headless: true, chromiumSandbox: true, args: ['--mute-audio'], timeout: 30000 }); state.assertLive();
      browser.on('disconnected', () => state.fail(Error('Browser disconnected'), { source: 'browser' }));
      context = await createFreshRunnerContext(browser); state.assertLive();
      const page = await context.newPage(); state.assertLive(); page.setDefaultTimeout(15000);
      const fresh = claimFreshBootstrap(context, page, profile);
      appCapture = captureAppResponse(page, { assertLive: state.assertLive, fail: state.fail });
      provenance = captureDiagnosticScriptResponses(page, { mode: rendererMode, assertLive: state.assertLive });
      page.on('pageerror', error => { state.setScripts(provenance.snapshot()); state.fail(error, { source: 'pageerror' }); });
      page.on('crash', () => state.fail(Error('Browser page crashed'), { source: 'page' }));
      page.on('close', () => state.fail(Error('Browser page closed'), { source: 'page' }));
      page.on('console', message => { state.setScripts(provenance.snapshot()); state.console(message.text()); });
      const cdp = await context.newCDPSession(page); state.assertLive();
      await denyMediaPermissions(cdp, { assertLive: state.assertLive }); state.assertLive();
      const result = await initializeCandidate({ page, profile, fresh, state, provenance, appCapture, own: value => { rendererObserver = value.rendererObserver; } });
      return { ...result, page };
    });
    const heartbeat = () => heartbeatOnce({ state, expected: identity, schedule: () => { timer = setTimeout(heartbeat, 3000); }, probe: () => probeHeartbeat({ state, page, frame, profile, provenance, rendererObserver }) });
    state.assertLive(); timer = setTimeout(heartbeat, 3000); await state.failure;
  } catch (error) { state.fail(error, { source: 'runner' }); if (!stopping) process.exitCode = 1; }
  finally {
    clearTimeout(timer); if (provenance) state.setScripts(provenance.snapshot());
    const forcedExit = setTimeout(() => process.exit(process.exitCode ?? 1), 10000);
    try { await shutdownOwned({ state, close: async () => { appCapture?.detach(); rendererObserver?.close(); provenance?.detach(); await context?.close(); await browser?.close(); } }); }
    catch { process.exitCode = 1; }
    clearTimeout(forcedExit); process.exit(process.exitCode ?? 0);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
