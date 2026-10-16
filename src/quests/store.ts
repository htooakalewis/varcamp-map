import { ELEMENT_IDS, SIGN_IDS } from '../world/catalog';
import { canEnterObservatory, canCompleteComet, COMET_CHECKPOINT_IDS, normalizeProgress, type FlagKey, type Progress } from './model';

/** Task8's WA driver must use {public:false,persist:true,scope:'world'}.
 * Resolution confirms API acceptance; refresh/transition verifies durability.
 */
export interface StateDriver {
  read(key: string): unknown;
  save(key: string, value: boolean): Promise<void>;
}
export interface ProgressStore {
  load(): Progress;
  get(): Progress;
  saveFlag(key: FlagKey): Promise<Progress>;
}
const FLAG_KEYS: readonly FlagKey[] = [
  ...SIGN_IDS.map(id => `varcamp2026.sign.${id}` as const),
  ...ELEMENT_IDS.map(id => `varcamp2026.sigil.${id}` as const),
  'varcamp2026.mazeComplete', 'varcamp2026.observatoryDiscovered',
  ...COMET_CHECKPOINT_IDS.map(id => `varcamp2026.comet.checkpoint.${id}` as const), 'varcamp2026.cometComplete',
];

export function createProgressStore(driver: StateDriver): ProgressStore {
  const confirmed: Record<string, boolean> = {};
  const pending = new Map<FlagKey, Promise<Progress>>();
  // Dirty means engine restoration has not been accepted, even if a rejected
  // restoration optimistically changed its raw cache to the desired value.
  const dirty = new Set<FlagKey>();
  let loaded = false;
  function load(): Progress {
    if (!loaded) {
      for (const key of FLAG_KEYS) confirmed[key] = driver.read(key) === true;
      loaded = true;
    }
    // Never reload a running store from the engine's optimistic cache.
    return normalizeProgress(confirmed);
  }
  function saveFlag(key: FlagKey): Promise<Progress> {
    if (!FLAG_KEYS.includes(key)) return Promise.reject(new Error('Unknown quest flag'));
    const existing = pending.get(key);
    if (existing) return existing;
    const progress = load();
    if (key === 'varcamp2026.observatoryDiscovered' && !canEnterObservatory(progress)) return Promise.resolve(progress);
    if (key === 'varcamp2026.cometComplete' && !canCompleteComet(progress)) return Promise.resolve(progress);
    if (confirmed[key] && !dirty.has(key)) return Promise.resolve(progress);
    const operation = (async () => {
      if (dirty.has(key)) {
        // A failed restoration must reject this attempt, before collecting.
        await driver.save(key, confirmed[key]);
        dirty.delete(key);
      }
      dirty.add(key);
      try {
        await driver.save(key, true);
        confirmed[key] = true;
        dirty.delete(key);
      } catch (error) {
        try {
          await driver.save(key, confirmed[key]);
          dirty.delete(key);
        } catch {
          // Preserve dirty status and the original collect error. The next
          // explicit retry first waits for accepted engine restoration.
        }
        throw error;
      }
      return load();
    })();
    const result = operation.finally(() => { pending.delete(key); });
    pending.set(key, result);
    return result;
  }
  return { load, get: load, saveFlag };
}
