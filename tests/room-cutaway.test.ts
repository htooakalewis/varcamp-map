import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import type { MapLayout } from '../tools/maps/types';

const baseline = JSON.parse(readFileSync('tests/fixtures/room-cutaway/before.json', 'utf8'));
const catalog = loadTileCatalog();
describe('open-sided room visibility', () => {
 it('rejects invalid drawing roles and terrain overrides', () => {
  const layout = JSON.parse(readFileSync('world/layouts/speaker-aries.json','utf8')) as MapLayout;
  const invalid = structuredClone(layout);
  invalid.placements[0].renderRole = 'unsupported' as any;
  expect(() => buildMap(invalid,catalog)).toThrow('invalid render role');
  layout.placements[0].renderRole = 'grounded';
  expect(() => buildMap(layout,catalog)).toThrow('scenery only');
 });
 it('retains an explicit elevated canopy above floorLayer', () => {
  const layout = JSON.parse(readFileSync('world/layouts/speaker-aries.json','utf8')) as MapLayout;
  layout.placements.find(p=>p.id==='primary-screen')!.renderRole='canopy';
  const {tmj}=buildMap(layout,catalog),floor=tmj.layers.findIndex(l=>l.name==='floorLayer');
  expect(tmj.layers.slice(floor+1).some(l=>l.type==='tilelayer'&&l.opacity!==0&&l.data[7*tmj.width+15])).toBe(true);
 });
 for (const [id, before] of Object.entries(baseline) as [string, any][]) {
  const layout = JSON.parse(readFileSync(`world/layouts/${id}.json`, 'utf8')) as MapLayout;
  it(`${id} retains collisions, furniture, identities and portals`, () => {
   const { tmj } = buildMap(layout, catalog);
   const collision = tmj.layers.find(l => l.name === 'physical-collisions')!;
   expect(collision.type === 'tilelayer' ? collision.data.flatMap((g, i) => g ? [i] : []) : []).toEqual(before.collisionCells);
   for (const key of ['entries', 'exits', 'areas', 'signs'] as const) expect(layout[key]).toEqual(before[key]);
   expect(layout.placements.map(({ renderRole: _, ...p }) => p)).toEqual(before.placements);
  });
  it(`${id} has no elevated artwork over reachable avatar positions`, () => {
   const { tmj } = buildMap(layout, catalog);
   const collision = tmj.layers.find(l => l.name === 'physical-collisions')!;
   if (collision.type !== 'tilelayer') throw Error('missing collision');
   const spawn = layout.entries.find(e => e.isDefault)!;
   const seen = new Set([spawn.y * tmj.width + spawn.x]), queue = [...seen];
   for (let h = 0; h < queue.length; h++) {
    const cell = queue[h], x = cell % tmj.width, y = Math.floor(cell / tmj.width);
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
     const n = ny * tmj.width + nx;
     if (nx < 0 || ny < 0 || nx >= tmj.width || ny >= tmj.height || collision.data[n] || seen.has(n)) continue;
     seen.add(n); queue.push(n);
    }
   }
   const floor = tmj.layers.findIndex(l => l.name === 'floorLayer');
   const occluders = tmj.layers.slice(floor+1).flatMap(l => l.type === 'tilelayer' && l.opacity !== 0 ? l.data.flatMap((gid, i) => gid && (seen.has(i) || seen.has(i+tmj.width)) ? [{layer:l.name, x:i%tmj.width, y:Math.floor(i/tmj.width), gid}] : []) : []);
   expect(occluders).toEqual([]);
  });
  it(`${id} uses cutaway trim for foreground walls and portal art`, () => {
   const foreground = layout.placements.filter(p => /^(south-.*wall|south-door|staff-front-|staff-door|foyer-glass-)/.test(p.id));
   expect(foreground.length).toBeGreaterThan(0);
   for (const p of foreground) expect(p.renderRole, p.id).toBe('cutaway');
  });
 }
});
