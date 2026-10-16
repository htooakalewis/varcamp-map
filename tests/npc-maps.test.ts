import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { composeZodiacWheel } from '../tools/maps/zodiac-wheel';
import { addNpcGuides } from '../tools/maps/npc-guides';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import type { MapLayout } from '../tools/maps/types';

it('renders reachable guide characters on the plaza, both mazes and beach without introducing collision', () => {
 const layouts = addNpcGuides(composeZodiacWheel(readdirSync('world/layouts').filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`world/layouts/${f}`, 'utf8')) as MapLayout)));
 const tiles = loadTileCatalog();
 for (const [map, npc] of [['overworld','guide'],['orbit-maze','maze-keeper'],['comet-maze','maze-keeper'],['shipyard-beach','dockmaster']]) {
  const layout = layouts.find(l => l.id === map)!;
  const character = layout.placements.find(p => p.id === `npc-character-${npc}`);
  expect(character, `visible character in ${map}`).toBeDefined();
  expect(tiles[character!.sprite].blockingCells).toEqual([]);
  const area = layout.areas.find(a => a.name === `npc-${npc}`)!; expect(area).toBeDefined();
  const { tmj } = buildMap(layout, tiles); const mask = tmj.layers.find(l => l.name === 'physical-collisions');
  if (mask?.type !== 'tilelayer') throw Error('missing collision mask');
  const entry = layout.entries.find(e => e.isDefault)!; const start = entry.y * layout.width + entry.x;
  const queue = [start], seen = new Set(queue);
  for (let head = 0; head < queue.length; head++) for (const next of [queue[head]-layout.width,queue[head]+layout.width,queue[head]-1,queue[head]+1]) if (next >= 0 && next < layout.width*layout.height && Math.abs(next%layout.width-queue[head]%layout.width)<=1 && !mask.data[next] && !seen.has(next)) { seen.add(next); queue.push(next); }
  for (let y=area.y;y<area.y+area.height;y++) for(let x=area.x;x<area.x+area.width;x++) expect(seen.has(y*layout.width+x), `${map} conversation reachable`).toBe(true);
 }
// The composite fixture builds four scenes. Its cold hub validates three sponsor PNGs
// in separate bounded decoder processes (5 s each), plus collision/export traversal.
}, 20_000);

it('adds readable guide names once without mutating the authored furniture or conversation zones',()=>{
 const input=composeZodiacWheel(readdirSync('world/layouts').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`world/layouts/${f}`,'utf8')) as MapLayout));
 const before=structuredClone(input),once=addNpcGuides(input),twice=addNpcGuides(once);
 expect(input).toEqual(before);
 for(const [map,npc] of [['overworld','guide'],['orbit-maze','maze-keeper'],['comet-maze','maze-keeper'],['shipyard-beach','dockmaster']]){
  const layout=twice.find(l=>l.id===map)!;
  expect(layout.placements.filter(p=>p.id===`npc-character-${npc}`)).toHaveLength(1);
  const labels=layout.signs!.filter(s=>s.name===`npc-name-${npc}`);expect(labels).toHaveLength(1);
  const label=labels[0];expect(label.text).toMatch(/Lyra|Aster|Nova/);
  for(const p of layout.placements.filter(p=>p.layer==='props'))expect(label.x<p.x+p.width&&label.x+label.width>p.x&&label.y<p.y+p.height&&label.y+label.height>p.y,`${map} name covered by ${p.id}`).toBe(false);
  for(const s of layout.signs!.filter(s=>s!==label))expect(label.x<s.x+s.width&&label.x+label.width>s.x&&label.y<s.y+s.height&&label.y+label.height>s.y,`${map} name covers ${s.name}`).toBe(false);
  const existing=before.find(l=>l.id===map)!;
  expect(layout.placements.filter(p=>!p.id.startsWith('npc-character-'))).toEqual(existing.placements);
  expect(layout.areas.filter(a=>a.name!==`npc-${npc}`)).toEqual(existing.areas.filter(a=>a.name!==`npc-${npc}`));
 }
});
