import {readFileSync} from 'node:fs';
import{createHash}from'node:crypto';
import {expect,it} from 'vitest';
import {assertNativeWorldAmbient,WORLD_AMBIENT_IDS} from '../tools/maps/world-ambient';
import {assertNativeCoastLife} from '../tools/maps/coast-life';
import {assertNativePlaza} from '../tools/maps/plaza-native';
import {authorWorldAmbientMap} from '../tools/maps/author-world-ambient';
import{buildMap}from'../tools/maps/builder';
import{validateAmbientOwnership}from'../tools/maps/world-ambient-ownership';
import{reconcileNativeProjection}from'../tools/maps/native-projection';
import type {MapLayout,TiledMap,TileLayer} from '../tools/maps/types';
import context from'../art/source/native-ownership-context.json';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const catalog=()=>read('art/tile-catalog.json');
const datum=(id:string)=>({map:read(`maps/${id}.tmj`)as TiledMap,layout:read(`world/layouts/${id}.json`)as MapLayout,catalog:catalog()});
const cases=[['fa-ship-interior','world-ambient-',assertNativeWorldAmbient],['shipyard-beach','coast-life-',assertNativeCoastLife],['constellation-shore','coast-life-',assertNativeCoastLife],['overworld','plaza-drone-',assertNativePlaza]]as const;
for(const[id,prefix,guard]of cases){
 it(`${id}: accepts actual current source/native control`,()=>{const d=datum(id);expect(()=>guard(d.map,d.layout,d.catalog)).not.toThrow();});
 for(const field of ['visible','opacity','x','y','offsetx','offsety','width','height','properties','duplicate','unknown','order','scenery-depth']as const)it(`${id}: rejects native ${field} drift without changing source or pixels`,()=>{
  const d=datum(id),layer=d.map.layers.find(l=>l.name.startsWith(prefix))as TileLayer;
  if(field==='visible')layer.visible=false;if(field==='opacity')layer.opacity=0;if(field==='x')layer.x=1;if(field==='y')layer.y=1;if(field==='offsetx')layer.offsetx=32;if(field==='offsety')layer.offsety=32;if(field==='width')layer.width--;if(field==='height')layer.height--;if(field==='properties')layer.properties=[{name:'unexpected-effect-policy',type:'string',value:'mutant'}];
  if(field==='duplicate')d.map.layers.push({...structuredClone(layer),id:d.map.nextlayerid!++});
  if(field==='unknown')d.map.layers.push({...structuredClone(layer),id:d.map.nextlayerid!++,name:'unknown-native-projection'});
  if(field==='order'){const above=d.map.layers.filter(l=>l.type==='tilelayer'&&d.map.layers.indexOf(l)>d.map.layers.findIndex(l=>l.name==='floorLayer')&&l.name!=='physical-collisions'&&!l.properties?.some(p=>['start','startLayer','exitUrl'].includes(p.name)));const a=d.map.layers.indexOf(above[0]),b=d.map.layers.indexOf(above[1]);[d.map.layers[a],d.map.layers[b]]=[d.map.layers[b],d.map.layers[a]];}
  if(field==='scenery-depth'){const i=d.map.layers.findIndex(l=>l.name.startsWith('scenery-aboveAvatar-'));d.map.layers.splice(d.map.layers.findIndex(l=>l.name==='floorLayer'),0,d.map.layers.splice(i,1)[0]);}
  expect(()=>guard(d.map,d.layout,d.catalog)).toThrow();
 });
}
const staleMaps=['campus-exploration','comet-maze','earth-district','hidden-observatory','moon-cafe','orbit-maze','water-district'];
it.each(staleMaps)('%s rejects a malformed current atlas with restored four-column dimensions',id=>{const d=datum(id),set=d.map.tilesets.find(t=>t.image==='../assets/tilesets/original/world-ambient-plants.png')!;Object.assign(set,{columns:4,tilecount:12,imagewidth:128});expect(()=>assertNativeWorldAmbient(d.map,d.layout,d.catalog)).toThrow();});
it.each(staleMaps)('%s authors a genuine three-column owned atlas replacement from the old epoch',id=>{const d=datum(id),row=context.maps[id as keyof typeof context.maps],raw=readFileSync(`tests/fixtures/native-context/${id}-pre-epoch.tmj`);expect(createHash('sha256').update(raw).digest('hex')).toBe(row.source.sha256);expect(raw.length).toBe(row.source.bytes);d.map=JSON.parse(raw.toString())as TiledMap;const set=d.map.tilesets.find(t=>t.image==='../assets/tilesets/original/world-ambient-plants.png')!;expect([set.columns,set.tilecount,set.imagewidth]).toEqual([4,12,128]);expect(()=>assertNativeWorldAmbient(d.map,d.layout,d.catalog)).toThrow();const result=authorWorldAmbientMap(d.map,d.layout,d.catalog),next=result.map.tilesets.find(t=>t.image===set.image)!;expect(next.columns).toBe(3);expect(next.imagewidth).toBe(96);expect(next.tilecount).toBe(9);expect(next.firstgid).toBe(row.nextAtlasGid);});
it('refuses to discard a protected control reference to a retired owned atlas',()=>{const d=datum('campus-exploration'),raw=readFileSync('tests/fixtures/native-context/campus-exploration-pre-epoch.tmj');expect(createHash('sha256').update(raw).digest('hex')).toBe(context.maps['campus-exploration'].source.sha256);d.map=JSON.parse(raw.toString())as TiledMap;const intended=buildMap(d.layout,d.catalog).tmj;d.map.layers=validateAmbientOwnership(d.map,d.layout,d.catalog,intended,true);expect(()=>reconcileNativeProjection(d.map,intended)).not.toThrow();const set=d.map.tilesets.find(t=>t.image==='../assets/tilesets/original/world-ambient-plants.png')!,control=d.map.layers.find(l=>l.type==='tilelayer'&&l.properties?.some(p=>p.name==='startLayer'))as TileLayer;expect(control).toBeDefined();control.data[0]=set.firstgid;expect(()=>reconcileNativeProjection(d.map,intended)).toThrow(/retired owned atlas has protected references/);});
it.each(['shipyard-beach','constellation-shore','fa-ship'])('%s binds its registered water clocks and audio DATA, with no observed-map override',id=>{const d=datum(id),guard=id==='fa-ship'?assertNativeWorldAmbient:assertNativeCoastLife;const water=d.map.tilesets.find(t=>t.image==='../assets/tilesets/lpc-water/water.png')!;water.tiles![0].animation![0].duration++;expect(()=>guard(d.map,d.layout,d.catalog)).toThrow();});
it.each(['shipyard-beach','constellation-shore','fa-ship'])('%s rejects extra historical terrain property DATA',id=>{const d=datum(id),guard=id==='fa-ship'?assertNativeWorldAmbient:assertNativeCoastLife;d.map.layers.find(l=>l.name==='terrain')!.properties!.push({name:'unregistered-audio-permission',type:'bool',value:true});expect(()=>guard(d.map,d.layout,d.catalog)).toThrow();});
it('requires explicit source below-avatar depth for both same-image breaker roles',()=>{const d=datum('shipyard-beach'),parts=d.layout.animatedOverlays!.filter(o=>o.name.startsWith('rolling-breaker-'));expect(parts).toHaveLength(2);expect(new Set(parts.map(o=>o.image)).size).toBe(1);for(const part of parts)expect(part.level).toBe('belowAvatar');});
it('retains genuine controls on all seventeen ambient maps',()=>{for(const id of WORLD_AMBIENT_IDS){const d=datum(id);expect(()=>assertNativeWorldAmbient(d.map,d.layout,d.catalog)).not.toThrow();}});
