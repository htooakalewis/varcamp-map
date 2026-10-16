import { expect, it } from 'vitest';
import { createProgressStore, type StateDriver } from '../src/quests/store';
import { summarizeProgress } from '../src/quests/model';
const aries = 'varcamp2026.sign.aries' as const;
// Models the observed stock boundary: optimistic engine mutation, native storage
// rejection, then equality shortcut. Actual runtime evidence is recorded separately.
function guestDriver() {
  const raw: Record<string, unknown> = {}, durable: Record<string, boolean> = {};
  let unavailable = false, writes = 0;
  const driver: StateDriver = {
    read: key => raw[key],
    async save(key, value) {
      if (raw[key] === value) return;
      raw[key] = value;
      if (unavailable) throw new Error('quota unavailable');
      writes++; durable[key] = value;
    },
  };
  return { driver, raw, durable, quota: (value: boolean) => { unavailable = value; }, writes: () => writes };
}
it('keeps rejected optimistic writes and reloads out of confirmed progress, then really persists retry', async () => {
  const g = guestDriver(), store = createProgressStore(g.driver); store.load(); g.quota(true);
  await expect(store.saveFlag(aries)).rejects.toThrow('quota unavailable');
  expect(store.get().signs.aries).toBe(false); expect(store.load().signs.aries).toBe(false);
  expect(summarizeProgress(store.get()).badges).not.toContain('zodiac-explorer'); expect(g.durable[aries]).toBeUndefined();
  // Restoration also rejected after setting raw false; this must remain dirty.
  expect(g.raw[aries]).toBe(false);
  g.quota(false); await store.saveFlag(aries);
  expect(store.get().signs.aries).toBe(true); expect(g.durable[aries]).toBe(true);
  expect(createProgressStore(g.driver).load().signs.aries).toBe(true);
});
it('does not collect after a restoration rejection even if a later write would be accepted', async () => {
  const raw: Record<string, unknown> = {}; let step = 0;
  const store = createProgressStore({ read: key => raw[key], async save(key, value) {
    step++; raw[key] = value;
    if (step <= 3) throw Error('unavailable');
  } });
  await expect(store.saveFlag(aries)).rejects.toThrow('unavailable');
  await expect(store.saveFlag(aries)).rejects.toThrow('unavailable');
  expect(step).toBe(3); expect(store.get().signs.aries).toBe(false);
  await store.saveFlag(aries); expect(store.get().signs.aries).toBe(true); expect(step).toBe(5);
});
it('coalesces same-flag clicks and keeps other flag progress independent while pending', async () => {
  const g = guestDriver(); let release!: () => void; let calls = 0;
  const driver: StateDriver = { read: g.driver.read, save: async (key, value) => {
    calls++; if (key === aries) await new Promise<void>(resolve => { release = resolve; });
    await g.driver.save(key, value);
  } };
  const store = createProgressStore(driver), a = store.saveFlag(aries), b = store.saveFlag(aries);
  expect(a).toBe(b); expect(store.get().signs.aries).toBe(false);
  await store.saveFlag('varcamp2026.sigil.fire'); expect(store.get().elements.fire).toBe(true);
  expect(store.load().signs.aries).toBe(false); release(); await a;
  expect(calls).toBe(2); expect(store.get().signs.aries).toBe(true);
});
it('does not rewrite accepted duplicates or share progress between visitors', async () => {
  const a = guestDriver(), b = guestDriver(), first = createProgressStore(a.driver), second = createProgressStore(b.driver);
  await first.saveFlag(aries); await first.saveFlag(aries);
  expect(a.writes()).toBe(1); expect(second.load().signs.aries).toBe(false);
  const snapshot = first.get(); snapshot.signs.aries = false; expect(first.get().signs.aries).toBe(true);
});
it('persists discovery only after all four accepted sigils and explicit shrine interaction', async () => {
  const g = guestDriver(), store = createProgressStore(g.driver);
  await store.saveFlag('varcamp2026.observatoryDiscovered'); expect(g.writes()).toBe(0);
  for (const element of ['fire', 'earth', 'air', 'water'] as const) await store.saveFlag(`varcamp2026.sigil.${element}`);
  expect(store.get().observatoryDiscovered).toBe(false);
  await store.saveFlag('varcamp2026.observatoryDiscovered'); expect(summarizeProgress(store.get()).badges).toEqual(['stargazer']);
});
it('rejects unsupported runtime keys without persistence', async () => {
  const g = guestDriver(), store = createProgressStore(g.driver);
  await expect(store.saveFlag('varcamp2026.count' as never)).rejects.toThrow(); expect(g.writes()).toBe(0);
});
