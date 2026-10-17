import {assertVisual} from './helpers/physical-prop-contracts';
import { historicalEditorWamBytes } from './helpers/editor-catalog-history';
import { readFileSync, mkdtempSync, cpSync, mkdirSync, writeFileSync, symlinkSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import { validateMap } from '../tools/maps/validate';
import { WORLD_CATALOG } from '../src/world/catalog';
import type { MapLayout, TiledMap, TiledLayer } from '../tools/maps/types';
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const json=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const layout=()=>json('world/layouts/shipyard-beach.json') as MapLayout;
const native=()=>json('maps/shipyard-beach.tmj') as TiledMap;
// Preview is a derived artifact: only these four URL adaptations are allowed.
// Exact equality catches omitted maps:build before receipt checks can accept an
// older, still historically reviewed preview beside newly authorized native art.
function assertDerivedBeachPreview(preview:TiledMap):void {
 const expected=structuredClone(native());
 for(const p of expected.properties??[])if(p.name==='script')p.value='../'+p.value;
 for(const set of expected.tilesets)if(set.image)set.image='../'+set.image;
 const exits=(layers:TiledLayer[]):void=>{for(const layer of layers){if(layer.type==='group')exits(layer.layers);for(const p of layer.properties??[]){if(p.name==='exitUrl')p.value=String(p.value).replace('.wam#','.tmj#');if(p.name==='playAudio')p.value='../'+String(p.value);}}};
 exits(expected.layers);
 expect(preview,'Beach preview must derive exactly from the current native map; refresh maps:build before testing or freezing receipts').toEqual(expected);
}
describe('relaxed native beach with retained harbor contracts',()=>{
 it('preserves every existing native entrance/exit ID, GID, property and WAM byte',()=>{
  const map=native(),contract=json('tests/fixtures/beach-semantic-contract.json');
  for(const [name,expected] of Object.entries(contract.portalLayerSha256))expect(hash(JSON.stringify((name==='shipyard-entry'?json('tests/fixtures/beach-ship/before-maps--shipyard-beach.tmj'):map).layers.find((l:any)=>l.name===name))),name).toBe(expected);
  expect(map.properties).toEqual(contract.mapProperties);expect(hash(historicalEditorWamBytes('shipyard-beach'))).toBe(contract.wamSha256);
 });
 it('keeps the proposed layout authoritative and all native layers valid',()=>{
  const source=layout(),{tmj}=buildMap(source,loadTileCatalog());expect(validateMap(native(),WORLD_CATALOG)).toEqual([]);expect(validateMap(tmj,WORLD_CATALOG)).toEqual([]);
  const catalog=loadTileCatalog(),recliners=source.placements.filter(p=>['beach-seat-west-a','beach-seat-west-b','beach-seat-arrival-a','beach-seat-arrival-b','beach-seat-bar-a','beach-seat-bar-b'].includes(p.id));expect(recliners.map(p=>p.id).sort()).toEqual(['beach-seat-west-a','beach-seat-west-b','beach-seat-arrival-a','beach-seat-arrival-b','beach-seat-bar-a','beach-seat-bar-b'].sort());
  for(const p of recliners)assertVisual(catalog[p.sprite],catalog['beach-recliner']);
  expect(source.placements.some(p=>{const s=catalog[p.sprite],old=catalog['coast-deck-chair'];return s.sheet===old.sheet&&JSON.stringify(s.rect)===JSON.stringify(old.rect)&&s.sourceId===old.sourceId;})).toBe(false);
  expect(source.animatedOverlays!.filter(o=>o.name.startsWith('beach-surf'))).toHaveLength(7);
 });
 it('retains gentle four-frame native surf and an exact bounded loop',()=>{
  for(const set of native().tilesets.filter(s=>s.name?.startsWith('beach-surf')===true))for(const tile of set.tiles??[]){
   expect(tile.animation).toHaveLength(4);expect(new Set(tile.animation!.map(f=>f.tileid)).size).toBe(4);expect(tile.animation!.reduce((n,f)=>n+f.duration,0)).toBe(2080);
   expect(tile.properties).toContainEqual({name:'collides',type:'bool',value:false});
  }
 });
 it('exports pixel-identical SVG masters with intrinsic water-overlay alpha',async()=>{
  for(const name of ['beach-lounge','beach-surf']){
   const svg=await sharp(`art/source/${name}.svg`).ensureAlpha().raw().toBuffer();const png=await sharp(`assets/tilesets/original/${name}.png`).ensureAlpha().raw().toBuffer();expect(png.equals(svg),name).toBe(true);
  }
  const veil=await sharp('assets/tilesets/original/beach-lounge.png').extract({left:256,top:128,width:32,height:32}).ensureAlpha().raw().toBuffer();expect(veil[3]).toBeGreaterThan(180);expect(veil[3]).toBeLessThan(200);
 });
 it('moves actual surf pixels under the pinned Phaser parser and rejects a stopped animation',async()=>{
  const parse=createRequire(import.meta.url)(resolve('docs/qa/coastal-flight-2026-10-16/prototype/upstream/phaser/src/tilemaps/parsers/tiled/ParseTilesets.js'));
  const map=native(),atlas=await sharp('assets/tilesets/original/beach-surf.png').ensureAlpha().raw().toBuffer();
  const sample=(input:TiledMap,time:number)=>{
   const engine=parse(structuredClone(input)),chunks:Buffer[]=[];
   for(const layer of input.layers.filter(l=>l.name.startsWith('beach-surf'))){
    if(layer.type!=='tilelayer')throw Error('expected native surf tile layer');
    const set=input.tilesets.find(t=>t.name===layer.name)!;const e=engine.tilesets.find((t:{firstgid:number})=>t.firstgid===set.firstgid)!;
    for(const v of layer.data.filter(Boolean)){
     const gid=e.getAnimatedTileId(v,time);if(gid===null)throw Error('pinned engine failed to resolve animation');const local=gid-set.firstgid,sx=local%32*32,sy=Math.floor(local/32)*32;
     for(let y=0;y<32;y++)chunks.push(atlas.subarray(((sy+y)*1024+sx)*4,((sy+y)*1024+sx+32)*4));
    }
   }
   return hash(Buffer.concat(chunks));
  };
  const frames=[0,520,960,1480,2080].map(t=>sample(map,t));expect(new Set(frames.slice(0,4)).size).toBe(4);expect(frames[4]).toBe(frames[0]);
  const stopped=structuredClone(map);for(const set of stopped.tilesets.filter(t=>t.name?.startsWith('beach-surf')===true))for(const tile of set.tiles??[])delete tile.animation;
  expect(sample(stopped,0)).toBe(sample(stopped,960));
 });

 it('refreshes existing surf metadata from changed descriptors without changing native GIDs or semantic layers',()=>{
  const temp=mkdtempSync(resolve(tmpdir(),'beach-reconcile-'));
  try{
   for(const dir of ['assets','art','tools'])cpSync(dir,resolve(temp,dir),{recursive:true});
   mkdirSync(resolve(temp,'world/layouts'),{recursive:true});mkdirSync(resolve(temp,'maps'));
   // The isolated tool copy must include its actual shared configuration dependency.
   cpSync('world/editor-collections.json',resolve(temp,'world/editor-collections.json'));
   expect(readFileSync(resolve(temp,'world/editor-collections.json'))).toEqual(readFileSync('world/editor-collections.json'));
   const before=native();writeFileSync(resolve(temp,'maps/shipyard-beach.tmj'),JSON.stringify(before));writeFileSync(resolve(temp,'package.json'),'{"type":"module"}');symlinkSync(realpathSync('node_modules'),resolve(temp,'node_modules'));
   const source=layout(),overlay=source.animatedOverlays!.find(o=>o.name==='beach-surf-west')!;
   for(const animation of overlay.animations)animation.frames[0].duration+=80;
   for(const sign of source.signs??[])source.placements.push({id:`probe-veil-${sign.name}`,sprite:'beach-sea-veil',x:sign.x,y:sign.y,width:1,height:1,layer:'architecture'});
   writeFileSync(resolve(temp,'world/layouts/shipyard-beach.json'),JSON.stringify(source));
   const run=()=>{const result=spawnSync(process.execPath,['--import','tsx','tools/maps/refine-beach.mjs'],{cwd:temp,encoding:'utf8'});expect(result.status,result.stderr).toBe(0);};run();
   const after=JSON.parse(readFileSync(resolve(temp,'maps/shipyard-beach.tmj'),'utf8')) as TiledMap;
   const normalized=JSON.parse(readFileSync(resolve(temp,'world/layouts/shipyard-beach.json'),'utf8')) as MapLayout;expect(normalized.placements.some(p=>p.id.startsWith('probe-veil-'))).toBe(false);expect(normalized.signs).toEqual(source.signs);
   const original=before.tilesets.find(t=>t.name===overlay.name)!,updated=after.tilesets.find(t=>t.name===overlay.name)!;
   expect(updated.tiles![0].animation![0].duration).toBe(600);expect(updated.firstgid).toBe(original.firstgid);
   for(const layer of before.layers.filter(l=>l.name.startsWith('exit-')||l.properties?.some(p=>p.name==='startLayer')))expect(after.layers.find(l=>l.name===layer.name)).toEqual(layer);
   expect(after.properties).toEqual(before.properties);const bytes=readFileSync(resolve(temp,'maps/shipyard-beach.tmj'),'utf8');run();expect(readFileSync(resolve(temp,'maps/shipyard-beach.tmj'),'utf8')).toBe(bytes);
  }finally{rmSync(temp,{recursive:true,force:true});}
 });

 it('keeps the reviewed live art delta scoped to beach scenery while preserving historic retirement and native journeys',()=>{
  // The immutable art receipt predates the separately checked current beach composition.
  const raw=readFileSync('tests/fixtures/beach-composition/before-shipyard-beach.tmj');
  expect(hash(raw)).toBe('3566cffbcf2321bd3ac0d375f3802171dd04c38d384a633f8ef6f7aaceea13ac');
  const map=JSON.parse(raw.toString()) as TiledMap,source=layout(),baseline=json('tests/fixtures/beach-retirement/retired-native.tmj') as TiledMap,receipt=json('tests/fixtures/beach-refinement-receipt.json');
  expect(hash(JSON.stringify(baseline))).toBe(receipt.baselineNativeSha256);expect(hash(JSON.stringify(map))).toBe(receipt.nativeSha256);
  expect(hash(historicalEditorWamBytes('shipyard-beach'))).toBe(receipt.wamFileSha256);
  const visual=(name:string)=>name==='terrain'||name.startsWith('scenery-')||name==='physical-collisions'||name.startsWith('beach-surf-');
  const {layers:oldLayers,tilesets:oldTilesets,nextlayerid:oldNext,...oldFields}=baseline;
  const {layers:newLayers,tilesets:newTilesets,nextlayerid:newNext,...newFields}=map;
  expect(newFields).toEqual(oldFields);expect(newTilesets.slice(0,oldTilesets.length)).toEqual(oldTilesets);
  for(const set of newTilesets.slice(oldTilesets.length))expect(set.image).toMatch(/^\.\.\/assets\/tilesets\/original\/beach-(lounge|surf)\.png$/);
  for(const layer of oldLayers){const updated=newLayers.find(l=>l.name===layer.name);if(!visual(layer.name))expect(updated,layer.name).toEqual(layer);if(updated)expect(updated.id,layer.name).toBe(layer.id);}
  for(const layer of newLayers.filter(l=>!oldLayers.some(old=>old.name===l.name)))expect(visual(layer.name),layer.name).toBe(true);
  expect(hash(JSON.stringify(source.placements.filter(p=>p.id.startsWith('lpc-'))))).toBe(receipt.shipPlacementsSha256);
  const mask=newLayers.find(l=>l.name==='physical-collisions');if(mask?.type!=='tilelayer')throw Error('missing native collisions');expect(hash(JSON.stringify(mask.data))).toBe(receipt.nativeCollisionSha256);
  const start=source.entries.find(e=>e.isDefault)!,queue=[start.y*map.width+start.x],seen=new Set(queue);
  for(let head=0;head<queue.length;head++){const n=queue[head],x=n%map.width,y=Math.floor(n/map.width);for(const [xx,yy]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const i=yy*map.width+xx;if(xx>=0&&yy>=0&&xx<map.width&&yy<map.height&&!mask.data[i]&&!seen.has(i)){seen.add(i);queue.push(i);}}}
  for(const r of [...source.entries,...source.exits,...source.areas])for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)expect(seen.has(y*map.width+x),`${r.name} native reachability`).toBe(true);
  for(const [x,y]of[[0,0],[0,47],[47,47],[20,46]])expect(mask.data[y*map.width+x],'sea must stay blocked').not.toBe(0);
  for(const set of newTilesets.filter(t=>t.image?.endsWith('/guides.png')))for(const layer of newLayers)if(layer.type==='tilelayer')expect(layer.data.filter(g=>g>=set.firstgid&&g<set.firstgid+set.tilecount!)).toEqual([]);
  expect(newLayers.flatMap(l=>l.type==='objectgroup'?l.objects:[]).filter(o=>o.name.startsWith('npc-name-'))).toEqual([]);
 });

 it('keeps the current beach preview exactly derived from native art, collisions, IDs and controls',()=>{
  assertDerivedBeachPreview(json('maps/preview/shipyard-beach.tmj') as TiledMap);
 });
 it('rejects the actual stale committed beach preview even though its historical receipt was valid',()=>{
  const stale='tests/fixtures/beach-retirement/stale-preview.tmj';
  expect(hash(readFileSync(stale))).toBe('a7d2c0dd5c40a87b14e2363a36bf7abde61491146b94a48dbe0d42277ae938a1');
  expect(()=>assertDerivedBeachPreview(json(stale) as TiledMap)).toThrow(/Beach preview must derive exactly/);
 });

});
