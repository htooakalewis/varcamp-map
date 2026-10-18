// TEST ONLY synthetic controller and renderer evidence. Never live admission.
import { APP } from '../../bots/candidate-render-policy.mjs';
export function rendererReceipt(sequence = 1) {
  const now = Date.now();
  return { schemaVersion: 1, requestedMode: 'canvas', appAttestation: { ...APP }, sequence, observation: { startWallMs: now, startMonoMs: sequence * 1000, endWallMs: now, endMonoMs: sequence * 1000, backend: 'canvas2d', canvasWidth: 720, canvasHeight: 500, clientWidth: 1440, clientHeight: 1000, dpr: 1, viewportWidth: 1440, viewportHeight: 1000, sameCanvas: true, nativeInitialized: true } };
}
export function controllerPeer(identity) { const now = Date.now(); return { identity, outcome: 'progress', evidence: { steps: 1, at: now, operationBudgetMs: 10000, leaseDeadline: now + 10000 } }; }
export async function readyPeer(state, identity) { state.observe(controllerPeer(identity)); state.setRendererEvidence(rendererReceipt()); await state.ready(identity); }
export function rendererPeer() { let sequence = 0; return { read: async () => rendererReceipt(++sequence) }; }
