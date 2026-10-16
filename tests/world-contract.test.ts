import { describe, expect, it } from 'vitest';
import { ELEMENT_IDS, SIGN_IDS, WORLD_CATALOG } from '../src/world/catalog';
import { previewDestination, roomDestination } from '../src/navigation';

describe('world destinations', () => {
  // Removing a destination/sign/element makes a contracted venue unreachable.
  it('provides all 33 maps, twelve unique zodiac signs and four elements', () => {
    expect(Object.keys(WORLD_CATALOG)).toHaveLength(33);
    expect(Object.keys(WORLD_CATALOG).sort()).toEqual(['air-district', 'campus-exploration', 'comet-maze', 'constellation-shore', 'fa-ship', 'moon-cafe', 'moon-grotto', 'orbit-playground', 'star-garden', 'stargazer-terrace', 'earth-district', 'fire-district', 'hidden-observatory', 'lunar-hall', 'nebula-arcade', 'orbit-maze', 'overworld', 'shipyard-beach', 'solar-hall', 'water-district', 'zodiac-festival-park', ...SIGN_IDS.map(sign => `speaker-${sign}`)].sort());
    expect(new Set(SIGN_IDS).size).toBe(12);
    expect([...SIGN_IDS].sort()).toEqual(['aquarius', 'aries', 'cancer', 'capricorn', 'gemini', 'leo', 'libra', 'pisces', 'sagittarius', 'scorpio', 'taurus', 'virgo']);
    expect(ELEMENT_IDS).toEqual(['fire', 'earth', 'air', 'water']);
  });
  it('routes a district return within the deployed WAM world', () => {
    expect(roomDestination('https://front.test/~/varcamp/maps/fire-district.wam', 'overworld', 'from-fire')).toBe('https://front.test/~/varcamp/maps/overworld.wam#from-fire');
  });
  it('restarts the current maze at its named entry, discarding stale query and hash', () => {
    expect(roomDestination('https://front.test/~/varcamp/maps/orbit-maze.wam?old=1#finish', 'orbit-maze', 'maze-entry')).toBe('https://front.test/~/varcamp/maps/orbit-maze.wam#maze-entry');
  });
  it('uses the catalog arrival when no entry is specified', () => {
    expect(roomDestination('https://front.test/~/varcamp/maps/overworld.wam', 'solar-hall')).toBe('https://front.test/~/varcamp/maps/solar-hall.wam#solar-entry');
  });
  it('rejects an unknown named entry', () => {
    expect(() => roomDestination('https://front.test/~/varcamp/maps/fire-district.wam', 'overworld', 'wrong-door')).toThrow(/entry/i);
  });
  it('rejects preview URLs and unknown map IDs at the production boundary', () => {
    expect(() => roomDestination('https://front.test/_/global/maps.test/overworld.tmj', 'overworld')).toThrow(/world|WAM/i);
    expect(() => roomDestination('https://front.test/~/varcamp/maps/overworld.wam', 'missing' as 'overworld')).toThrow(/map/i);
  });
  it('routes TMJ previews separately without implying production persistence', () => {
    expect(previewDestination('https://maps.test/base/maps/fire-district.tmj', 'overworld', 'from-fire')).toBe('https://maps.test/base/maps/overworld.tmj#from-fire');
    expect(() => previewDestination('https://maps.test/base/maps/overworld.tmj', 'overworld', 'missing')).toThrow(/entry/i);
  });
});
