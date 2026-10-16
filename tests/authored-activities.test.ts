import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import type { MapLayout, TileRect, TileLayer } from '../tools/maps/types';
const ids=['campus-exploration','nebula-arcade','zodiac-festival-park','shipyard-beach','orbit-maze','comet-maze','orbit-playground','constellation-shore','fa-ship','star-garden','moon-cafe','moon-grotto','stargazer-terrace'];
const newIds=ids.slice(6),tiles=loadTileCatalog();
function load(id:string):MapLayout {expect(existsSync(`world/layouts/${id}.json`),`${id} needs an independent authored map`).toBe(true);return JSON.parse(readFileSync(`world/layouts/${id}.json`,'utf8'));}
const cells=(r:TileRect,w:number)=>Array.from({length:r.width*r.height},(_,i)=>(r.y+Math.floor(i/r.width))*w+r.x+i%r.width);
function built(id:string){const l=load(id),{tmj,wam}=buildMap(l,tiles),mask=tmj.layers.find(a=>a.name==='physical-collisions') as TileLayer;const start=l.entries.find(e=>e.isDefault)!,q=[cells(start,l.width)[0]],seen=new Set(q);for(let h=0;h<q.length;h++){const c=q[h],x=c%l.width,y=Math.floor(c/l.width);for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=ny*l.width+nx;if(nx>=0&&ny>=0&&nx<l.width&&ny<l.height&&!mask.data[n]&&!seen.has(n)){seen.add(n);q.push(n);}}}return {l,tmj,wam,mask,seen};}
// Production regression: oversized mixed-activity campuses or missing independent layouts.
describe('authored outdoor activities',()=>{
 it.each(['campus-exploration','zodiac-festival-park','shipyard-beach'])('%s is a compact forty-eight tile branch',id=>{const {tmj}=built(id);expect([tmj.width,tmj.height]).toEqual([48,48]);});
 it.each(newIds)('%s owns a native activity map and arrival',id=>{const {l,wam}=built(id);expect(l.entries).toContainEqual(expect.objectContaining({name:'arrival',isDefault:true}));expect(wam.mapUrl).toBe(`${id}.tmj`);});
 // A collision or trigger regression must fail a physical walk, not only a source shape assertion.
 it.each(ids)('%s has clear connected entries, exits and interactive areas',id=>{const {l,mask,seen}=built(id);for(const r of [...l.entries,...l.exits,...l.areas.filter(a=>!a.properties.some(p=>p.type==='silent'))])for(const n of cells(r,l.width)){expect(mask.data[n],`${id}/${r.name} blocked ${n%l.width},${Math.floor(n/l.width)}`).toBe(0);expect(seen.has(n),`${id}/${r.name} unreachable ${n}`).toBe(true);}for(const entry of l.entries)for(const exit of l.exits)expect(cells(entry,l.width).some(n=>cells(exit,l.width).includes(n)),`${entry.name} overlaps ${exit.name}`).toBe(false);});
 it.each(ids)('%s has a signed physical plaza return',id=>{const {l}=built(id);expect(l.exits.some(e=>e.destination==='overworld')).toBe(true);expect(l.signs?.some(s=>s.text.includes('PLAZA'))).toBe(true);});

 // A direction mismatch returns guests to the center rather than the Exploration threshold.
 it.each(['campus-exploration','star-garden','moon-cafe','moon-grotto','stargazer-terrace'])('%s returns to the Exploration plaza direction', id => {
  const {l,tmj}=built(id),exit=l.exits.find(e=>e.destination==='overworld')!;
  expect(exit.entry).toBe('from-campus');
  expect(tmj.layers.find(layer=>layer.name===`exit-${exit.name}`)?.properties).toContainEqual({name:'exitUrl',type:'string',value:'overworld.wam#from-campus'});
 });
 it('branches festival, harbor and exploration into independent destinations',()=>{for(const [id,targets] of [['zodiac-festival-park',['nebula-arcade','orbit-playground']],['shipyard-beach',['fa-ship','constellation-shore']],['campus-exploration',['fire-district','earth-district','air-district','water-district','star-garden','moon-cafe','moon-grotto','stargazer-terrace']]] as const){const {l}=built(id);expect(l.exits.filter(e=>e.destination!=='overworld').map(e=>e.destination).sort()).toEqual([...targets].sort());}});
 it('moves the four-sigil telescope gate to Stargazer Terrace',()=>{expect(load('campus-exploration').areas.some(a=>a.id==='observatory-telescope')).toBe(false);const {l}=built('stargazer-terrace');expect(l.areas.some(a=>a.id==='observatory-telescope')).toBe(true);expect(l.exits.some(e=>e.destination==='hidden-observatory')).toBe(false);});
 it('gives FA SHIP a large navigable hull and clear named activity destinations',()=>{const {l,mask,seen}=built('fa-ship'),hull=l.inspectionZones.find(z=>z.name==='fa-ship')!;expect(hull.width).toBeGreaterThanOrEqual(36);expect(hull.height).toBeGreaterThanOrEqual(10);expect(hull.height).toBeLessThanOrEqual(16);for(const area of l.areas)for(const n of cells(area,l.width)){expect(mask.data[n],area.name).toBe(0);expect(seen.has(n),area.name).toBe(true);}for(const name of ['fa-ship-cockpit','fa-ship-cargo','fa-ship-lounge'])expect(l.areas.some(a=>a.name===name)).toBe(true);});
 it.each(['shipyard-beach','constellation-shore','fa-ship'])('%s blocks open sea and keeps boats moored',id=>{const {l,mask}=built(id);for(const [x,y] of [[0,0],[l.width-1,l.height-1],[0,l.height-2]])expect(mask.data[y*l.width+x],`open sea ${x},${y}`).not.toBe(0);expect(l.placements.some(p=>['water-blue','coast-sea','naval-water-0','naval-water-1','naval-water-2'].includes(p.sprite))).toBe(true);});
 it('preserves the full three-tile Orbit hint and Comet crystal sequence',()=>{const orbit=built('orbit-maze');const hint=JSON.parse(readFileSync('world/maze-route.json','utf8')).route as [number,number][];for(const [x,y] of hint)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)expect(orbit.mask.data[(y+dy)*orbit.l.width+x+dx],`Orbit hint ${x},${y}`).toBe(0);const comet=built('comet-maze');for(const name of ['comet-checkpoint-1','comet-checkpoint-2','comet-checkpoint-3','comet-finish']){const area=comet.l.areas.find(a=>a.name===name)!;expect(area).toBeDefined();expect(cells(area,comet.l.width).every(n=>comet.seen.has(n))).toBe(true);}expect(orbit.l.areas.some(a=>a.name==='npc-maze-keeper')).toBe(true);expect(load('shipyard-beach').areas.some(a=>a.name==='npc-dockmaster')).toBe(true);});

 it.each(['shipyard-beach','constellation-shore','fa-ship'])('%s keeps every unreplaced sea tile blocked', id => {
  const {l, mask}=built(id), surface=Array(l.width*l.height).fill('');
  for(const p of l.placements.filter(p=>p.layer==='terrain')) for(const n of cells(p,l.width)) surface[n]=p.sprite;
  for(let n=0;n<surface.length;n++) if(['water-blue','coast-sea','coast-shallows','naval-water-0','naval-water-1','naval-water-2'].includes(surface[n])) expect(mask.data[n],`open water ${n%l.width},${Math.floor(n/l.width)}`).not.toBe(0);
  for(const p of l.placements.filter(p=>p.sprite==='boat-wood')) for(const n of cells(p,l.width)) expect(['water-blue','coast-sea','coast-shallows','naval-water-0','naval-water-1','naval-water-2'],`boat ${p.id} belongs in the sea`).toContain(surface[n]);
 });
 it.each([
  ['orbit-maze','01ac55e05ddf62500363bb61048bfbab8ce798b0c26a92ff2275d6356db014b2'],
  ['comet-maze','9ed2bae0e197e59744005cee907e0b4652b9aac6275445dfc539b59aaaefcd43']
 ])('%s preserves the archived maze collision geometry exactly', (id, expected) => {
  const {mask}=built(id);
  expect(createHash('sha256').update(Buffer.from(mask.data.map(n=>n?1:0))).digest('hex')).toBe(expected);
 });
 it('keeps the four-tile ship gangway clear all the way onto deck',()=>{
  const {l,mask,seen}=built('fa-ship'),gangway=l.inspectionZones.find(z=>z.name==='safe-gangway')!;
  for(const n of cells(gangway,l.width)){expect(mask.data[n]).toBe(0);expect(seen.has(n)).toBe(true);}
 });
 it.each(ids)('%s keeps native text apart from furniture',id=>{const {l}=built(id);for(const s of l.signs??[])for(const p of l.placements.filter(p=>p.layer==='props'))expect(s.x<p.x+p.width&&s.x+s.width>p.x&&s.y<p.y+p.height&&s.y+s.height>p.y,`${s.name} covered by ${p.id}`).toBe(false);});
});
