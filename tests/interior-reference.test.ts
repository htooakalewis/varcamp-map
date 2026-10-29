import {beforeExpoChairCatalog} from '../tools/maps/expo-chair-physics';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import type { MapLayout } from '../tools/maps/types';

const before=JSON.parse(readFileSync('tests/fixtures/interior-reference/before-functions.json','utf8'));
const oldCatalog=JSON.parse(readFileSync('tests/fixtures/interior-reference/before-catalog.json','utf8'));
const names=Object.keys(before);
const load=(name:string):MapLayout=>JSON.parse(readFileSync(`world/layouts/${name}.json`,'utf8'));
describe('reference-furnished zodiac interiors',()=>{
 it('preserves every original catalog row',()=>{
  const now=beforeExpoChairCatalog(loadTileCatalog());for(const[key,row]of Object.entries(oldCatalog))expect(now[key],key).toEqual(row);
 });
 for(const name of names){
  it(`${name}: keeps exact footprint, entries, returns, meeting roles and inspection routes`,()=>{
   const layout=load(name);for(const[key,value]of Object.entries(before[name])){
    if(name.startsWith('speaker-')&&key==='areas'){
     const sign=name.slice(8);
     expect(layout.areas.map(a=>a.id)).toEqual([`meeting-${sign}`,`beacon-${sign}`,`${sign}-audience`]);
     expect(layout.areas.find(a=>a.id===`beacon-${sign}`)).toEqual((value as MapLayout['areas']).find(a=>a.id===`beacon-${sign}`));
    }else expect(layout[key as keyof MapLayout],`${name}: ${key}`).toEqual(value);
   }
  });
  it(`${name}: has a furnished lounge with original PNG props and natural plant/cabinet clusters`,()=>{
   const layout=load(name),props=layout.placements.filter(p=>p.sprite.startsWith('interior-ref-'));
   expect(props.length).toBeGreaterThanOrEqual(6);
   for(const term of ['plant','cabinet','sofa'])expect(props.some(p=>p.sprite.includes(term)),`${name}: missing ${term}`).toBe(true);
   const catalog=loadTileCatalog();for(const p of props)expect(catalog[p.sprite]?.sourceId).toBe('interior-reference');
  });
  it(`${name}: exports gentle nonstatic native animation with no foreground walkable occlusion`,()=>{
   const layout=load(name);expect(layout.animatedOverlays?.length??0).toBeGreaterThanOrEqual(2);
   expect(layout.animatedOverlays!.length).toBeLessThanOrEqual(name.endsWith('-hall')?8:4);
   const {tmj}=buildMap(layout,loadTileCatalog()),floor=tmj.layers.findIndex(l=>l.name==='floorLayer');
   for(const overlay of layout.animatedOverlays!){
    const tileset=tmj.tilesets.find(t=>t.name===overlay.name)!;expect(tileset?.tiles?.length).toBeGreaterThan(0);
    expect(tileset.tiles!.some(tile=>new Set(tile.animation!.map(f=>f.tileid)).size>=2),'some real pixels move; transparent carrier cells may stay quiet').toBe(true);
    for(const tile of tileset.tiles!)for(const f of tile.animation!)expect(f.duration).toBeGreaterThanOrEqual(250);
    expect(tmj.layers.findIndex(l=>l.name===overlay.name),`${name}: ${overlay.name} must be floor-safe`).toBeLessThan(floor);
   }
  });
  it(`${name}: saved native source has bold English title and the authored animation layers`,()=>{
   const layout=load(name),tmj=JSON.parse(readFileSync(`maps/${name}.tmj`,'utf8'));
   const title=tmj.layers.flatMap((l:any)=>l.type==='objectgroup'?l.objects:[]).find((o:any)=>o.name==='scene-title');
   expect(title.text.bold).toBe(true);expect(title.text.text).toMatch(/[A-Z]/);
   const floor=tmj.layers.findIndex((l:any)=>l.name==='floorLayer');
   for(const overlay of layout.animatedOverlays??[])expect(tmj.layers.findIndex((l:any)=>l.name===overlay.name)).toBeGreaterThanOrEqual(0);
   for(const overlay of layout.animatedOverlays??[])expect(tmj.layers.findIndex((l:any)=>l.name===overlay.name)).toBeLessThan(floor);
  });
 }
});
