import {preHallBuildingsLayout,preHallBuildingsNative} from './helpers/hall-buildings-history';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {beforeLeoJson} from './helpers/leo-lion-head-history';
import {assertCurrentNativeMap} from '../tools/maps/current-native';
import {loadTileCatalog} from '../tools/art/catalog';
import type {TiledMap,TileLayer} from '../tools/maps/types';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
it('draws the lion head only above the solid Leo roof, preserving every doorway and collision cell',()=>{
 const old=beforeLeoJson<TiledMap>('maps/overworld.tmj'),map=preHallBuildingsNative(read('maps/overworld.tmj')),layout=preHallBuildingsLayout(read('world/layouts/overworld.json')),catalog=loadTileCatalog(),set=map.tilesets.find(t=>t.name==='leo-lion-head')!;
 expect(map.tilesets.slice(0,97)).toEqual(old.tilesets);expect(map.tilesets).toHaveLength(98);expect(map.layers.map(l=>l.name)).toEqual(old.layers.map(l=>l.name));
 expect(map.layers.find(l=>l.name==='physical-collisions')).toEqual(old.layers.find(l=>l.name==='physical-collisions'));
 const floor=map.layers.findIndex(l=>l.name==='floorLayer'),mask=map.layers.find(l=>l.name==='physical-collisions') as TileLayer;let changed=0;
 for(const before of old.layers){const after=map.layers.find(l=>l.id===before.id)!;if(before.type!=='tilelayer'){expect(after).toEqual(before);continue;}
  expect({...after,data:[]}).toEqual({...before,data:[]});for(let i=0;i<before.data.length;i++){const gid=(after as TileLayer).data[i];if(gid===before.data[i])continue;changed++;
   expect(before.data[i]).toBe(0);expect(gid).toBeGreaterThanOrEqual(set.firstgid);expect(gid).toBeLessThan(set.firstgid+12);expect(map.layers.indexOf(after)).toBeGreaterThan(floor);expect(mask.data[i]).not.toBe(0);
   expect(i%128).toBeGreaterThanOrEqual(43);expect(i%128).toBeLessThan(47);expect(Math.floor(i/128)).toBeGreaterThanOrEqual(93);expect(Math.floor(i/128)).toBeLessThan(96);
  }
 }expect(changed).toBe(12);const prior=beforeLeoJson('world/layouts/overworld.json');for(const key of ['entries','exits','areas','standingSigns','signs','images'] as const)expect(layout[key]).toEqual(prior[key]);
 expect(()=>assertCurrentNativeMap('overworld',read('maps/overworld.tmj'),read('world/layouts/overworld.json'),read('maps/overworld.wam'),catalog)).not.toThrow();
});
it('rejects a missing lion head or an ornament moved onto the road',()=>{
 const map=read('maps/overworld.tmj'),layout=read('world/layouts/overworld.json'),wam=read('maps/overworld.wam'),catalog=loadTileCatalog();
 for(const kind of ['missing','road']){const l=structuredClone(layout);if(kind==='missing')l.placements=l.placements.filter((p:any)=>p.id!=='leo-lion-head');else l.placements.find((p:any)=>p.id==='leo-lion-head').x=51;
  expect(()=>assertCurrentNativeMap('overworld',map,l,wam,catalog)).toThrow(/Leo lion head|Hall buildings|Plaza crescent|Plaza landscape|Vibe Code branding/);
 }
});
