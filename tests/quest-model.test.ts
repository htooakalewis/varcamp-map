import { describe, expect, it } from 'vitest';
import { ELEMENT_IDS, SIGN_IDS } from '../src/world/catalog';
import { canEnterObservatory, normalizeProgress, summarizeProgress } from '../src/quests/model';

describe('private optional quest rules', () => {
  it('awards explorer only for twelve distinct true discoveries', () => {
    const raw: Record<string, unknown> = {};
    for (const sign of SIGN_IDS) {
      expect(summarizeProgress(normalizeProgress(raw)).badges).not.toContain('zodiac-explorer');
      raw[`varcamp2026.sign.${sign}`] = true;
    }
    const summary = summarizeProgress(normalizeProgress(raw));
    expect(summary.discoveredSigns).toEqual([...SIGN_IDS]);
    expect(summary.missingSigns).toEqual([]);
    expect(summary.badges).toEqual(['zodiac-explorer']);
    raw['varcamp2026.sign.aries'] = true;
    expect(summarizeProgress(normalizeProgress(raw)).discoveredSigns).toHaveLength(12);
  });
  it.each([1, 'true', [], {}, null, undefined, false])('rejects non-boolean truthy/corrupt flag %j', value => {
    const p = normalizeProgress({ 'varcamp2026.sign.aries': value, 'varcamp2026.sigil.fire': value, 'varcamp2026.mazeComplete': value, 'varcamp2026.observatoryDiscovered': value });
    expect(p.signs.aries).toBe(false); expect(p.elements.fire).toBe(false);
    expect(summarizeProgress(p).badges).toEqual([]); expect(canEnterObservatory(p)).toBe(false);
  });
  it('requires four confirmed sigils and explicit discovery for stargazer', () => {
    const raw: Record<string, unknown> = {};
    for (const element of ELEMENT_IDS) { expect(canEnterObservatory(normalizeProgress(raw))).toBe(false); raw[`varcamp2026.sigil.${element}`] = true; }
    expect(canEnterObservatory(normalizeProgress(raw))).toBe(true);
    expect(summarizeProgress(normalizeProgress(raw)).badges).toEqual([]);
    raw['varcamp2026.observatoryDiscovered'] = true;
    expect(summarizeProgress(normalizeProgress(raw))).toEqual({ discoveredSigns: [], missingSigns: [...SIGN_IDS], elements: ['fire', 'earth', 'air', 'water'], cometCheckpoints: [], badges: ['stargazer'] });
  });
  it('direct discovery without all sigils awards nothing', () => {
    expect(summarizeProgress(normalizeProgress({ 'varcamp2026.observatoryDiscovered': true, 'varcamp2026.sigil.fire': true })).badges).toEqual([]);
  });
  it('maze completion alone awards navigator independently', () => {
    expect(summarizeProgress(normalizeProgress({ 'varcamp2026.mazeComplete': true })).badges).toEqual(['maze-navigator']);
  });
});
