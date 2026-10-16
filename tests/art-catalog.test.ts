import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SIGN_IDS } from '../src/world/catalog';
import { loadTileCatalog } from '../tools/art/catalog';

// Catches missing room furniture/art families, invalid atlas crops and collisions in passages.
describe('usable native-scale art kit', () => {
  it('provides every zodiac and the required functional sprite families', () => {
    const catalog = loadTileCatalog();
    for (const id of ['floor-wood', 'wall-navy', 'door-open', 'desk-coding', 'screen-wide', 'sofa-cream', 'plant-palm', 'tree-round', 'telescope', 'quest-shrine', 'forge-aries', 'balance-libra', 'table-circular', 'glass-pod', 'bench-curved', 'lounge-crescent', 'sigil-fire', 'sigil-earth', 'sigil-air', 'sigil-water', ...SIGN_IDS.flatMap(sign => [`glyph-${sign}`, `constellation-${sign}`])]) expect(catalog[id], id).toBeDefined();
  });
  it('keeps each crop on the native 32px grid inside a real PNG', () => {
    const catalog = loadTileCatalog();
    expect(Object.keys(catalog).length).toBeGreaterThan(50);
    for (const [id, sprite] of Object.entries(catalog)) {
      expect(existsSync(sprite.sheet), id).toBe(true);
      const png = readFileSync(sprite.sheet);
      expect(png.subarray(1, 4).toString(), id).toBe('PNG');
      const {x,y,width,height} = sprite.rect;
      for (const n of [x,y,width,height]) expect(Number.isInteger(n), id).toBe(true);
      expect(Math.min(x,y), id).toBeGreaterThanOrEqual(0);
      expect(Math.min(width,height), id).toBeGreaterThan(0);
      expect((x+width)*32, id).toBeLessThanOrEqual(png.readUInt32BE(16));
      expect((y+height)*32, id).toBeLessThanOrEqual(png.readUInt32BE(20));
      for (const [cx,cy] of sprite.blockingCells) {
        expect(Number.isInteger(cx) && Number.isInteger(cy), id).toBe(true);
        expect(cx >= 0 && cx < width && cy >= 0 && cy < height, id).toBe(true);
      }
      expect(['belowAvatar','aboveAvatar']).toContain(sprite.level);
    }
  });
  it('resolves provenance and retained license for every sprite', () => {
    const catalog = loadTileCatalog();
    expect(Object.keys(catalog).length).toBeGreaterThan(0);
    const sources = JSON.parse(readFileSync('art/sources.json','utf8'));
    for (const sprite of Object.values(catalog)) {
      const source = sources[sprite.sourceId];
      expect(source.attribution.length).toBeGreaterThan(0);
      expect(source.url).toMatch(/^https:/);
      expect(source.license.length).toBeGreaterThan(0);
      expect(existsSync(source.licenseFile)).toBe(true);
      expect(source.changes.length).toBeGreaterThan(0);
    }
  });
  it('leaves door apertures and upper foliage walkable', () => {
    const c = loadTileCatalog();
    expect(c['door-open']).toBeDefined();
    expect(c['door-open']?.blockingCells).toEqual([[0,1],[3,1]]);
    expect(c['plant-palm']?.blockingCells).toEqual([[1,2]]);
    expect(c['tree-round']?.blockingCells).toEqual([[0,2],[1,2]]);
    expect(c['screen-wide']?.blockingCells).toEqual([]);
    expect(c['rune-threshold']?.blockingCells).toEqual([]);
  });
});

import { createArtSample } from '../tools/art/samples';
for (const sign of ['aries','libra'] as const) {
  it(`${sign} sample keeps a two-tile entrance-to-front aisle and access to speaker/audience positions`, () => {
    const sample = createArtSample(sign), c = loadTileCatalog();
    const ids = sample.placements.map(p => p.id);
    for (const id of ['door-open', 'rune-threshold']) expect(ids, id).toContain(id);
    const blocked = new Set<string>();
    for (const p of sample.placements) {
      const s = c[p.id];
      expect(s, p.id).toBeDefined();
      expect(p.x >= 0 && p.y >= 0 && p.x+s.rect.width <= sample.width && p.y+s.rect.height <= sample.height, p.id).toBe(true);
      for (const [x,y] of s.blockingCells) blocked.add(`${p.x+x},${p.y+y}`);
    }
    // Two adjacent walkable columns prevent a table/prop/chair narrowing the main aisle.
    for (let y=4; y<18; y++) for (const x of [11,12]) expect(blocked.has(`${x},${y}`), `${sign} aisle ${x},${y}`).toBe(false);
    const seen = new Set(['11,17']), queue = [[11,17]];
    while (queue.length) {
      const [x,y] = queue.shift()!;
      for (const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        const key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= sample.width || ny >= sample.height || seen.has(key) || blocked.has(key)) continue;
        seen.add(key); queue.push([nx,ny]);
      }
    }
    expect(blocked.has('11,17')).toBe(false);
    expect(sample.destinations.length).toBeGreaterThan(3);
    for (const [x,y] of sample.destinations) expect(seen.has(`${x},${y}`), `${sign} activity ${x},${y}`).toBe(true);
  });
}

import { checkArt } from '../tools/art/check';
it('art check rejects invalid crop bounds rather than repairing them silently', async () => {
  const c = structuredClone(loadTileCatalog());
  c['floor-wood'].rect.x = 1000;
  expect(await checkArt(c)).toContain('floor-wood: rectangle exceeds PNG bounds');
});
it('art check rejects collision outside the sprite footprint', async () => {
  const c = structuredClone(loadTileCatalog());
  c['plant-palm'].blockingCells.push([3,2]);
  expect(await checkArt(c)).toContain('plant-palm: invalid blocking cell 3,2');
});
