import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import { validateMap } from '../tools/maps/validate';
import { WORLD_CATALOG } from '../src/world/catalog';
import type { MapLayout, TileLayer, TiledMap } from '../tools/maps/types';
const source=()=>JSON.parse(readFileSync('world/layouts/overworld.json','utf8')) as MapLayout;
const native=()=>JSON.parse(readFileSync('maps/overworld.tmj','utf8')) as TiledMap;
const historicalSource=()=>JSON.parse(readFileSync('tests/fixtures/solid-props/before-overworld.json','utf8')) as MapLayout;
const historicalNative=()=>JSON.parse(readFileSync('tests/fixtures/solid-props/before-overworld.tmj','utf8')) as TiledMap;
const corrections={'from-festival':[9,63],'from-arcade':[9,63],'from-maze':[63,9]} as const;
function move(map:TiledMap,name:string,x:number,y:number){
 const layer=map.layers.find(l=>l.name===name) as TileLayer;const marker=layer.data.find(Boolean)!;layer.data.fill(0);
 for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)layer.data[(y+dy)*map.width+x+dx]=marker;
}
function assertCurrentDelta(layout:MapLayout,map:TiledMap):void {
 const raw=readFileSync('tests/fixtures/overworld-history/return-navigation-delta.json');
 if(createHash('sha256').update(raw).digest('hex')!=='43434728294eb83e862750df1fa73dc9a07cee76b9ae4a2d44da7fae6b6e399c')throw Error('Unapproved current navigation delta receipt');
 const receipt=JSON.parse(raw.toString());
 const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 const names=receipt.changes.map((c:{name:string})=>c.name) as string[];
 const authored={...layout,entries:layout.entries.map(e=>names.includes(e.name)?Object.fromEntries(Object.entries(e).filter(([k])=>k!=='x'&&k!=='y')):e)};
 const nativeProjection={...map,layers:map.layers.map(l=>names.includes(l.name)?Object.fromEntries(Object.entries(l).filter(([k])=>k!=='data')):l)};
 const refuse=()=>{throw Error('Unapproved current navigation delta');};
 if(hash(authored)!==receipt.unchangedLayoutProjectionSha256||hash(nativeProjection)!==receipt.unchangedNativeProjectionSha256)refuse();
 for(const change of receipt.changes){
  if(JSON.stringify(layout.entries.find(e=>e.name===change.name))!==JSON.stringify(change.after))refuse();
  const layer=map.layers.find(l=>l.name===change.name) as TileLayer|undefined;
  if(!layer||layer.type!=='tilelayer'||layer.opacity!==0||JSON.stringify(layer.data.flatMap((gid,index)=>gid?[{index,gid}]:[]))!==JSON.stringify(change.nativeCells))refuse();
 }
 if(validateMap(map,WORLD_CATALOG).length)refuse();
}
describe('overworld return approach contract',()=>{
 it('places all three affected public/legacy aliases at the approved clear approaches',()=>{
  for(const[name,[x,y]]of Object.entries(corrections))expect(source().entries.find(e=>e.name===name)).toMatchObject({x,y,width:2,height:2});
 });
 it('retains exact published navigation-only receipts independently of later props',()=>{
  // NEW release receipts, not replacements for any immutable historical proof.
  // Exact old→new allowed-field evidence is retained with the implementation review.
  const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  expect(sha(historicalSource())).toBe('66cacf454c873b51930538f12663e13fafdf0cc2f65c5103dcceac53ae79fa01');
  expect(sha(historicalNative())).toBe('8067c8c9d9de0d2509ea870c2a4e37f3d757b5626a99ead6adde06b497752a3c');
  assertCurrentDelta(historicalSource(),historicalNative());
  expect(source().entries).toEqual(historicalSource().entries);
  for(const layer of historicalNative().layers.filter(l=>l.properties?.some(p=>p.name==='startLayer'||p.name==='exitUrl')))expect(native().layers.find(l=>l.name===layer.name)).toEqual(layer);
 });
 it('validates every emitted arrival cell in author and native build paths',()=>{
  expect(validateMap(buildMap(source(),loadTileCatalog()).tmj,WORLD_CATALOG)).toEqual([]);
  expect(validateMap(native(),WORLD_CATALOG)).toEqual([]);
 });
 it('refuses the old reachable-but-misaligned festival and maze anchors',()=>{
  for(const[name,x,y]of [['from-festival',5,68],['from-maze',68,5]]as const){
   const map=native();move(map,name,x,y);expect(validateMap(map,WORLD_CATALOG).some(i=>i.code==='RETURN_APPROACH'&&i.location===name)).toBe(true);
  }
 });
 it('refuses legacy alias drift and unclassified public return aliases',()=>{
  const map=native();move(map,'from-arcade',10,63);expect(validateMap(map,WORLD_CATALOG).some(i=>i.code==='RETURN_FAMILY')).toBe(true);
  const extra=structuredClone(map.layers.find(l=>l.name==='from-arcade')!);extra.name='from-unclassified';map.layers.push(extra);
  expect(validateMap(map,WORLD_CATALOG).some(i=>i.code==='RETURN_ALIAS_SET')).toBe(true);
 });
 it('requires each gate to retain its authoritative functional destination',()=>{
  for(const value of [undefined,'solar-hall.wam#solar-entry']){
   const map=native(),gate=map.layers.find(l=>l.name==='exit-festival')!;
   gate.properties=gate.properties?.filter(p=>p.name!=='exitUrl');
   if(value!==undefined)gate.properties!.push({name:'exitUrl',type:'string',value});
   expect(validateMap(map,WORLD_CATALOG).some(i=>i.code==='RETURN_DESTINATION'&&i.location==='exit-festival')).toBe(true);
  }
 });
 it('checks all four random spawn cells rather than one representative',()=>{
  const map=native();for(const[name,[x,y]]of Object.entries(corrections))move(map,name,x,y);
  const collision=map.layers.find(l=>l.name==='physical-collisions') as TileLayer;const wall=collision.data.find(Boolean)!;collision.data[64*map.width+8]=wall;
  expect(validateMap(map,WORLD_CATALOG).some(i=>i.code==='RETURN_APPROACH'&&i.location==='from-festival'&&i.message.includes('9,64'))).toBe(true);
 });
 it.each(['scenery','layer-order','collision','metadata','role'])('rejects %s tampering outside the exact new navigation delta',kind=>{
  const layout=historicalSource(),map=historicalNative();
  if(kind==='scenery'){const l=map.layers.find(l=>l.name==='scenery-belowAvatar-0')as TileLayer;l.data[l.data.findIndex(Boolean)]=0;}
  if(kind==='layer-order'){const l=map.layers.find(l=>l.name==='scenery-belowAvatar-2')!;map.layers=map.layers.filter(x=>x!==l);map.layers.push(l);}
  if(kind==='collision'){const l=map.layers.find(l=>l.name==='physical-collisions')as TileLayer;l.data[70*map.width+70]=l.data.find(Boolean)!;}
  if(kind==='metadata')map.nextobjectid!++;
  if(kind==='role')layout.placements.find(p=>p.id==='aries-building')!.renderRole='canopy';
  expect(()=>assertCurrentDelta(layout,map)).toThrow(/Unapproved current navigation delta/);
 });

});
