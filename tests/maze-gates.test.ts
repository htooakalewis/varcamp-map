import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {buildMap} from '../tools/maps/builder';
import {loadTileCatalog} from '../tools/art/catalog';
import {assertCurrentNativeMap} from '../tools/maps/current-native';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const bytes=readFileSync('tests/fixtures/maze-gates/before.json.gz');
expect(createHash('sha256').update(bytes).digest('hex')).toBe('21c78da230741c5b61082f51c321e37688255ccbb24aaf9ea9733dded4f738e5');
const before=JSON.parse(gunzipSync(bytes).toString()),old=(p:string)=>JSON.parse(before.components[p]);
const ids=['orbit-maze','comet-maze','campus-exploration'];
function scene(id:string){const layout=read(`world/layouts/${id}.json`),map=read(`maps/${id}.tmj`),wam=read(`maps/${id}.wam`),catalog=loadTileCatalog(),source=buildMap(layout,catalog).tmj;return{layout,map,wam,catalog,source};}
const mask=(map:any)=>map.layers.find((l:any)=>l.name==='physical-collisions').data.map((g:number)=>!!g);
describe('Coherent mazes and physical destination entrances',()=>{
 it.each(['orbit-maze','comet-maze'])('%s retains every collision and the original puzzle route',id=>{
  const s=scene(id);expect(mask(s.source)).toEqual(mask(old(`maps/${id}.tmj`)));expect(mask(s.map)).toEqual(mask(s.source));
  const floor=Array(s.layout.width*s.layout.height).fill('');
  for(const p of s.layout.placements.filter((p:any)=>p.layer==='terrain'))for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++)floor[y*s.layout.width+x]=p.sprite;
  const sample=id==='orbit-maze'?[[10,10],[16,10],[22,10]]:[[6,6],[10,6],[15,6]];
  expect(new Set(sample.map(([x,y])=>floor[y*s.layout.width+x])).size).toBe(1);
  expect(s.layout.placements.some((p:any)=>p.id==='maze-entry-lintel')).toBe(true);
 });
 it.each(ids)('%s preserves saved areas, named entries, exits and native tile scale',id=>{
  const s=scene(id),l=old(`world/layouts/${id}.json`);for(const key of ['entries','exits','areas'])expect(s.layout[key]).toEqual(l[key]);
  expect(readFileSync(`maps/${id}.wam`,'utf8')).toBe(before.components[`maps/${id}.wam`]);
  expect([s.map.tilewidth,s.map.tileheight]).toEqual([32,32]);
  expect(()=>assertCurrentNativeMap(id,s.map,s.layout,s.wam,s.catalog)).not.toThrow();
 });
 it.each(ids)('%s rejects changed collision, wayfinding and atlas ownership',id=>{
  const s=scene(id),guard=(map:any)=>assertCurrentNativeMap(id,map,s.layout,s.wam,s.catalog);
  for(const mutate of [
   (m:any)=>{const l=m.layers.find((l:any)=>l.name==='physical-collisions');const i=l.data.findIndex((g:number)=>g===0);l.data[i]=l.data.find((g:number)=>g!==0);},
   (m:any)=>{m.layers.find((l:any)=>l.name==='wayfinding-text').objects[0].text.text='Unreviewed gate';},
   (m:any)=>{m.tilesets.at(-1).firstgid++;},
  ]){const map=structuredClone(s.map);mutate(map);expect(()=>guard(map)).toThrow();}
 });
 it('gives each of the eight Court doors a solid themed front and clear approach',()=>{
  const {layout,source}=scene('campus-exploration'),solid=mask(source);
  for(const e of layout.exits.filter((e:any)=>e.name!=='plaza-return')){
   expect(layout.placements.some((p:any)=>p.id===e.name+'-entrance-emblem'),e.name).toBe(true);
   for(let x=e.x;x<e.x+e.width;x++)for(let y=e.y;y<=e.y+3;y++)expect(solid[y*48+x],`${e.name} opening ${x},${y}`).toBe(false);
   for(const x of [e.x-3,e.x-2,e.x+3,e.x+4])expect(solid[e.y*48+x],e.name+' visible jamb').toBe(true);
  }
  expect(layout.signs.filter((s:any)=>['directory-board','arrival-routes'].includes(s.name))).toHaveLength(1);
 });
 it.each(ids)('%s keeps its instruction labels compact and outside furniture',id=>{
  const {layout}=scene(id);for(const sign of layout.signs){expect(sign.width,sign.name).toBeLessThanOrEqual(12);for(const p of layout.placements.filter((p:any)=>p.layer==='props'))expect(sign.x<p.x+p.width&&sign.x+sign.width>p.x&&sign.y<p.y+p.height&&sign.y+sign.height>p.y,`${sign.name}/${p.id}`).toBe(false);}
 });
});
