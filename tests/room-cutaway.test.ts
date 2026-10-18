import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import type { MapLayout } from '../tools/maps/types';

const baseline = JSON.parse(readFileSync('tests/fixtures/room-cutaway/before.json', 'utf8'));
const catalog = loadTileCatalog();
// Preserve the original migration proof on its exact pre-refresh source inputs.
// Current interiors are separately checked for depth, routes and functional preservation.
const historical = JSON.parse(readFileSync('tests/fixtures/interior-reference/historical-layouts.json','utf8')); 
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
  it(`${id} historical cutaway input retains collisions, furniture, identities and portals`, () => {
   const original: MapLayout = historical[id] ?? layout;
   const { tmj } = buildMap(original, catalog);
   const collision = tmj.layers.find(l => l.name === 'physical-collisions')!;
   expect(collision.type === 'tilelayer' ? collision.data.flatMap((g, i) => g ? [i] : []) : []).toEqual(before.collisionCells);
   for (const key of ['entries', 'exits', 'areas', 'signs'] as const) expect(original[key]).toEqual(before[key]);
   expect(original.placements.map(({ renderRole: _, ...p }) => p)).toEqual(before.placements);
  });
  it(`${id} historical cutaway has no elevated artwork over reachable avatar positions`, () => {
   const original:MapLayout=historical[id]??layout;
   const { tmj } = buildMap(original, catalog);
   const collision = tmj.layers.find(l => l.name === 'physical-collisions')!;
   if (collision.type !== 'tilelayer') throw Error('missing collision');
   const spawn = (historical[id]??layout).entries.find((e:any) => e.isDefault)!;
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

// Current source permits ONLY the independently approved nine-palm upper foliage.
// Every other occluder, including any newly added leaf outside these54cells, fails.
import{assertNativeReferenceInterior}from'../tools/maps/reference-interiors';
import palmBaseline from'./fixtures/interior-original-palms/before.json';
const currentPalmMaps:Record<string,number>={'lunar-hall':12,'solar-hall':12,'speaker-leo':12,'speaker-taurus':18};
it('permits exactly54 approved current leaf cells and no protected-route or unrelated upper artwork',()=>{
 let total=0;
 for(const id of Object.keys(historical)){
  const layout=JSON.parse(readFileSync(`world/layouts/${id}.json`,'utf8')),map=JSON.parse(readFileSync(`maps/${id}.tmj`,'utf8')),wam=JSON.parse(readFileSync(`maps/${id}.wam`,'utf8'));
  expect(()=>assertNativeReferenceInterior(map,layout,catalog,wam)).not.toThrow();
  const collision=map.layers.find((l:any)=>l.name==='physical-collisions').data,spawn=layout.entries.find((e:any)=>e.isDefault),seen=new Set<number>([spawn.y*map.width+spawn.x]),queue=[...seen];
  for(let h=0;h<queue.length;h++){const i=queue[h],x=i%map.width,y=Math.floor(i/map.width);for(const[xx,yy]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const j=yy*map.width+xx;if(xx>=0&&yy>=0&&xx<map.width&&yy<map.height&&!collision[j]&&!seen.has(j)){seen.add(j);queue.push(j);}}}
  const floor=map.layers.findIndex((l:any)=>l.name==='floorLayer'),hits=map.layers.slice(floor+1).flatMap((l:any)=>l.type==='tilelayer'&&l.visible!==false&&l.opacity!==0?l.data.flatMap((gid:number,i:number)=>gid&&(seen.has(i)||seen.has(i+map.width))?[i]:[]):[]);
  const targets=palmBaseline.targets.filter(t=>t.map===id),expected=targets.flatMap(p=>Array.from({length:6},(_,n)=>(p.y+Math.floor(n/3))*map.width+p.x+n%3));
  expect(hits.slice().sort((a:number,b:number)=>a-b),id).toEqual(expected.slice().sort((a:number,b:number)=>a-b));expect(hits,id).toHaveLength(currentPalmMaps[id]??0);total+=hits.length;
  const protectedRects=[...layout.entries,...layout.exits,...layout.inspectionZones.filter((z:any)=>/aisle|route/.test(z.name)),...layout.areas.filter((z:any)=>z.id?.startsWith('beacon-'))];
  for(const i of hits)expect(protectedRects.some((r:any)=>i%map.width>=r.x&&Math.floor(i/map.width)>=r.y&&i%map.width<r.x+r.width&&Math.floor(i/map.width)<r.y+r.height),id+' protected route').toBe(false);
 }
 expect(total).toBe(54);
});
