import { approvedEditorCollections, editorCatalogHistoryMaps, historicalEditorWamBytes, editorMetadataHistoryPaths, historicalEditorMetadataBytes } from './helpers/editor-catalog-history';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TiledMap, TileLayer } from '../tools/maps/types';
function frozenOverworld(kind:'tmj'):TiledMap;
function frozenOverworld(kind:'json'):MapLayout;
function frozenOverworld(kind:'tmj'|'json'):TiledMap|MapLayout{
 const raw=readFileSync(`tests/fixtures/overworld-history/17d4-${kind==='tmj'?'native.tmj':'layout.json'}`);
 expect(createHash('sha256').update(raw).digest('hex')).toBe(kind==='tmj'?'87e88dd082910b789578188147e9b91b1f060c9d62309c158b785c2bf4cbbaad':'6e1ba3eaec7223e9b64bbd7aff48863bbfe2992a84ff199c7574857c781e533e');
 return JSON.parse(raw.toString());
}
const native = (): TiledMap => JSON.parse(readFileSync('maps/overworld.tmj', 'utf8'));
describe('stationary native Roadster display', () => {
 it('renders a complete fixed 5×5 native animation, not a decorative still or moving map actor', () => {
  const map = native(), layer = map.layers.find(l => l.name === 'roadster') as TileLayer | undefined;
  expect(layer, 'The plaza must contain the requested native Roadster animation').toBeDefined();
  const set = map.tilesets.find(s => s.name === 'roadster')!;
  expect(layer!.data.filter(Boolean)).toHaveLength(25);
  expect(set.tiles).toHaveLength(25);
  expect(set.tiles!.every(t => t.animation && t.animation.length >= 2)).toBe(true);
  expect(new Set(set.tiles!.map(t => t.animation!.reduce((n,f) => n+f.duration,0)))).toEqual(new Set([12800]));
 });
});

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { renderRoadster } from '../tools/art/roadster';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import { guardMap } from '../src/bots/map-guard';
import { ROUTES } from '../src/bots/venue';
import type { MapLayout } from '../tools/maps/types';
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const fixtureRoot = 'docs/qa/coastal-flight-2026-10-16/prototype';
const parse = createRequire(import.meta.url)(resolve(fixtureRoot, 'upstream/phaser/src/tilemaps/parsers/tiled/ParseTilesets.js'));

it('preserves the original sole-addition Roadster receipt against its immutable historical fixture', () => {
 const map = frozenOverworld('tmj');
 expect(map.layers.filter(l => l.name === 'roadster')).toHaveLength(1);
 expect(map.tilesets.filter(s => s.name === 'roadster')).toHaveLength(1);
 expect(map.layers.at(-1)?.name).toBe('roadster');
 expect(map.layers.at(-1)?.id).toBe(map.nextlayerid! - 1);
 map.layers.pop(); map.tilesets.pop(); map.nextlayerid!--;
 expect(sha(JSON.stringify(map))).toBe('0e2d4fff09d8476eed187ae8a25bfdbd72182a35846ad02b1f89a62fcd8647d1');
 const layout = frozenOverworld('json'); delete layout.animatedOverlays;
 expect(sha(JSON.stringify(layout, null, 2)+'\n')).toBe('4f80ae57e635a8eb1efe1ba7e44eaca109a750ec455f7db169259c725a31a351');
});

it('leaves all WAMs, the other32 native maps/previews and independently replaceable sponsors byte-exact', () => {
 const inventory = json('publication/source-manifest.json').sourceInventory;
 const revisions = new Map(['2026-10-16-shared-guides','2026-10-17-return-approaches','2026-10-17-beach-composition','2026-10-17-beach-ci-closure','2026-10-17-solid-props'].flatMap(id=>json(`publication/revisions/${id}.json`).revisions).map((r: {path:string;toSha256:string}) => [r.path,r.toSha256]));
 for (const [path, baseline] of Object.entries(inventory)) if ((/^maps\//.test(path) && !['maps/overworld.tmj','maps/preview/overworld.tmj'].includes(path)) || path.startsWith('assets/sponsors/')) expect(sha(readFileSync(path)),path).toBe(revisions.get(path) ?? baseline);
});
it('fits the arrival view without touching any743 guide cell, spawn, entrance, scenery or sponsor panel', () => {
 const overlay = json('art/source/roadster.json').overlay;
 expect(overlay).toMatchObject({x:73,y:60,width:5,height:5});
 const inside = (x:number,y:number) => x>=73&&x<78&&y>=60&&y<65;
 expect(ROUTES.allowedCells).toHaveLength(743);
 expect(sha(JSON.stringify(ROUTES.allowedCells))).toBe('9cb8feee067d6e436f1255396c8fa26246dd2fc52f2749ce5765e46e30c9514f');
 expect(ROUTES.allowedCells.filter(([x,y])=>inside(x,y))).toEqual([]);
 const layout = json('world/layouts/overworld.json') as MapLayout;
 for(const r of [...layout.entries,...layout.exits,...layout.areas,...layout.placements.filter(p=>p.layer==='props'),...(layout.images??[])]) expect(r.x<78&&r.x+r.width>73&&r.y<65&&r.y+r.height>60,'name' in r?r.name:r.id).toBe(false);
 for(const e of layout.entries.filter(e=>['welcome','start'].includes(e.name)))for(let y=e.y;y<e.y+e.height;y++)for(let x=e.x;x<e.x+e.width;x++){
  expect(73).toBeGreaterThanOrEqual(x+.5-14);expect(73+142/32).toBeLessThanOrEqual(x+.5+14);
  expect(60).toBeGreaterThanOrEqual(y+.5-7);expect(65).toBeLessThanOrEqual(y+.5+6);
 }
});
it('accepts the re-audited native map but still fails closed on moved animation or collision changes', async () => {
 await expect(guardMap(native())).resolves.toBeUndefined();
 const changed=native(), layer=changed.layers.find(l=>l.name==='roadster') as TileLayer;
 const i=layer.data.findIndex(Boolean);layer.data[i+1]=layer.data[i];layer.data[i]=0;
 await expect(guardMap(changed)).rejects.toThrow(/signature mismatch/);
 const collision=native(), mask=collision.layers.find(l=>l.name==='physical-collisions') as TileLayer;
 mask.data[65*128+63]=mask.data.find(Boolean)!;
 await expect(guardMap(collision)).rejects.toThrow(/signature mismatch/);
});
it('compiles the original generated1254px sheet without clipping and rejects stale source receipts', async () => {
 const {png,metadata,frames}=await renderRoadster();
 expect(metadata.source.sha256).toBe('08b8e46661d57bb4f44ea0e09bdee91debc3311440d1d2406a949e164bd86cd0');
 expect(png).toEqual(readFileSync('assets/tilesets/original/roadster.png'));
 expect(metadata).toEqual(json('art/source/roadster.json'));
 expect(metadata.crops.map(p=>[p.cell.left,p.cell.top])).toEqual([0,313,627,940].flatMap(y=>[0,313,627,940].map(x=>[x,y])));
 expect(new Set(frames.map(sha)).size).toBe(16);
 for(const frame of frames){
  const alpha=new Set<number>();let clipped=false,outsideView=false;
  for(let pixel=0;pixel<160*160;pixel++){
   const a=frame[pixel*4+3],x=pixel%160,y=Math.floor(pixel/160);alpha.add(a);
   if(a){clipped ||= x===0||x===159||y===0||y===159;outsideView ||= x>=144;}
  }
  expect(alpha).toEqual(new Set([0,255]));
  expect({clipped,outsideView},'all visible pixels fit the frame and left-column arrival band').toEqual({clipped:false,outsideView:false});
 }

 const overlay=structuredClone(metadata.overlay);overlay.provenance!.inputs[0].sha256='0'.repeat(64);
 expect(()=>buildMap({id:'overworld',width:128,height:128,placements:[],entries:[],exits:[],areas:[],inspectionZones:[],animatedOverlays:[overlay]},loadTileCatalog())).toThrow(/input changed/);
});
it('resolves every complete pose and loop through the pinned deployed Phaser parser without tile seams or world travel',async()=>{
 for(const entry of json(`${fixtureRoot}/source-manifest.json`))expect(sha(readFileSync(`${fixtureRoot}/${entry.path}`))).toBe(entry.sha256);
 const {png,frames,metadata}=await renderRoadster(), map=native(), set=map.tilesets.find(s=>s.name==='roadster')!;
 const engine=parse(structuredClone(map)).tilesets.find((s:{firstgid:number})=>s.firstgid===set.firstgid);
 const layer=map.layers.find(l=>l.name==='roadster') as TileLayer,atlas=await sharp(png).ensureAlpha().raw().toBuffer();
 const starts=[0,3000,3600,4100,4800,6000,6500,6850,7200,7550,7900,8250,8600,9100,9900,10500,12800];
 for(const [phase,time]of starts.entries()){
  const out=Buffer.alloc(160*160*4);
  for(let y=0;y<5;y++)for(let x=0;x<5;x++){
   const gid=engine.getAnimatedTileId(layer.data[(60+y)*128+73+x],time);
   expect(gid).not.toBeNull();const tile=gid-set.firstgid,sx=tile%set.columns!*32,sy=Math.floor(tile/set.columns!)*32;
   for(let row=0;row<32;row++)atlas.copy(out,((y*32+row)*160+x*32)*4,((sy+row)*metadata.atlas.width+sx)*4,((sy+row)*metadata.atlas.width+sx+32)*4);
  }
  expect(out.equals(frames[phase%16]),`native pose ${phase} at${time}ms`).toBe(true);
 }
 expect(set.tiles!.every(t=>t.properties?.some(p=>p.name==='collides'&&p.value===false))).toBe(true);
});

it('proves all33 editor registrations against independent raw and semantic8dc WAM receipts', () => {
 expect(editorCatalogHistoryMaps).toHaveLength(33);
 for (const id of editorCatalogHistoryMaps) expect(JSON.parse(historicalEditorWamBytes(id).toString()).entityCollections).toEqual([]);
});
it('refuses entity, area, vendor, mapUrl and collection drift outside catalog registration', () => {
 const raw=readFileSync('maps/overworld.wam','utf8');
 // This candidate changes only the root array, so negatives cannot pass merely
 // because JSON.stringify changed unrelated historical whitespace.
 const candidate=raw.replace(/"entityCollections": \[[\s\S]*?\]/, '"entityCollections": '+JSON.stringify(approvedEditorCollections));
 expect(()=>historicalEditorWamBytes('overworld',candidate)).not.toThrow();
 const changes=[
  candidate.replace('"entities": {}','"entities": {"unexpected": {"name": "existing entity drift"}}'),
  candidate.replace('welcome-directory','changed-directory'),
  candidate.replace('"version":','"vendor": {"keep": true},\n  "version":'),
  candidate.replace('overworld.tmj','changed.tmj'),
  candidate.replace('OfficeCollection.json','UnapprovedCollection.json'),
  candidate.replace(JSON.stringify(approvedEditorCollections),JSON.stringify([...approvedEditorCollections,{url:'https://example.invalid/extra.json',type:'file'}])),
 ];
 for(const changed of changes){expect(changed).not.toBe(candidate);expect(()=>historicalEditorWamBytes('overworld',changed)).toThrow();}
});

it('proves all four editor builder metadata changes before historical composition and refuses unrelated drift', () => {
 expect(editorMetadataHistoryPaths).toHaveLength(4);
 for(const path of editorMetadataHistoryPaths){
  const raw=readFileSync(path==='world/layouts/overworld.json'?'tests/fixtures/overworld-history/pre-return-layout.json':path==='world/layouts/shipyard-beach.json'?'tests/fixtures/beach-composition/before-shipyard-beach.json':path.startsWith('art/source/')?`tests/fixtures/solid-props/before-${path.endsWith('/roadster.json')?'roadster':'coastal-flight'}-metadata.json`:path,'utf8');
  if(path==='world/layouts/overworld.json')expect(sha(raw)).toBe('49d0f002a11c0966550eb9025c2c3ce0e7f023605960ea6c91341decce506093');
  if(path==='world/layouts/shipyard-beach.json')expect(sha(raw)).toBe('dc9b379a2955e015c684baf6720fd59d30d8e25533c0ee9bfcacae46be043ac4');
  expect(()=>historicalEditorMetadataBytes(path,raw)).not.toThrow();
  const changed=raw.replace('"sha256":','"unexpected":true,"sha256":');
  expect(changed).not.toBe(raw);
  expect(()=>historicalEditorMetadataBytes(path,changed)).toThrow(/Metadata changed outside/);
 }
});
