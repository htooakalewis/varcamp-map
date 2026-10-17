import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { TileCatalog } from '../art/catalog';
import type { MapLayout, TileRect, TileLayer, TiledLayer, TiledMap, TiledTileset, WamFile } from './types';

const decodedSponsors = new Map<string, Buffer>();
const sharpEntry = createRequire(import.meta.url).resolve('sharp');
// A subprocess keeps the public authoring API synchronous while using the existing full decoder.
const decodeSponsor = `
  const chunks = [];
  process.stdin.on('data', chunk => chunks.push(chunk));
  process.stdin.on('end', async () => {
    try {
      await require(process.argv[1])(Buffer.concat(chunks), { failOn: 'warning', limitInputPixels: 192 * 64 }).raw().toBuffer();
    } catch { process.exitCode = 1; }
  });
`;

/** Shared author/release guard. Logos are editable assets, never atlas inputs or frozen hashes. */
export function readSponsorImage(image: string): Buffer {
  if (typeof image !== 'string' || !/^assets\/sponsors\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.png$/.test(image)) throw new Error(`Sponsor image path must be assets/sponsors/<name>.png: ${image}`);
  let source: string;
  try { source = realpathSync(image); } catch { throw new Error(`Sponsor image missing: ${image}`); }
  if (dirname(source) !== resolve(realpathSync('.'), 'assets/sponsors')) throw new Error(`Sponsor image outside asset directory: ${image}`);
  if (statSync(source).size > 2 * 1024 * 1024) throw new Error(`Sponsor PNG exceeds the 2 MiB native-image limit: ${image}`);
  const bytes = readFileSync(source);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.subarray(12, 16).toString() !== 'IHDR') throw new Error(`Sponsor image must be a PNG: ${image}`);
  if (bytes.readUInt32BE(16) !== 192 || bytes.readUInt32BE(20) !== 64) throw new Error(`Sponsor image must be native 192×64 pixels: ${image}`);
  if (!bytes.subarray(-12).equals(Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]))) throw new Error(`Sponsor PNG is incomplete (missing IEND): ${image}`);
  if (!decodedSponsors.get(source)?.equals(bytes)) {
    const result = spawnSync(process.execPath, ['-e', decodeSponsor, sharpEntry], { input: bytes, timeout: 5000, maxBuffer: 64 * 1024 });
    if (result.error || result.status !== 0) throw new Error(`Sponsor PNG could not be fully decoded: ${image}`);
    // Compare live bytes on every call: changing a same-path PNG always triggers fresh validation.
    if (decodedSponsors.size >= 16) decodedSponsors.delete(decodedSponsors.keys().next().value!);
    decodedSponsors.set(source, Buffer.from(bytes));
  }
  return bytes;
}

export function isSponsorTileset(tileset: TiledTileset): boolean {
  return Boolean(tileset.image?.includes('/sponsors/') || tileset.properties?.some(p => p.name === 'sponsorPanel' && p.value === true));
}

/** Native authored maps must keep the same engine-consumable 32px sheet geometry. */
export function readSponsorTileset(tileset: TiledTileset): { path: string; bytes: Buffer } {
  if (!tileset.image || !/^\.\.\/assets\/sponsors\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.png$/.test(tileset.image)) throw new Error(`Sponsor tileset image path must be ../assets/sponsors/<name>.png: ${tileset.image}`);
  if (tileset.source || tileset.tilewidth !== 32 || tileset.tileheight !== 32 || tileset.columns !== 6 || tileset.tilecount !== 12 || tileset.imagewidth !== 192 || tileset.imageheight !== 64 || (tileset.spacing ?? 0) !== 0 || (tileset.margin ?? 0) !== 0) throw new Error(`Sponsor tileset must embed a native 6×2 grid of 32px tiles: ${tileset.name}`);
  const path = tileset.image.slice(3);
  return { path, bytes: readSponsorImage(path) };
}

/** Deterministic, finite export. Ground is replace-painted; transparent scenery is stacked.
 * Collision is a separate invisible tile mask, so a canopy never acquires its trunk's mask
 * and a bridge replaces water without erasing unrelated furniture collisions.
 */
export function buildMap(layout: MapLayout, tiles: TileCatalog): { tmj: TiledMap; wam: WamFile } {
  const mapName = layout.id === 'overworld' ? 'VarCamp · Constellation Campus' : `VarCamp · ${layout.id.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ')}`;
  const size=layout.width*layout.height, layers:TiledLayer[]=[], tilesets:TiledTileset[]=[];
  const sources=JSON.parse(readFileSync('art/sources.json','utf8'));
  const refs=new Map<string,{firstgid:number;columns:number}>();
  let nextgid=1;
  const ids=new Set<string>();
  function bounds(r:TileRect,label:string):void {
    if(![r.x,r.y,r.width,r.height].every(Number.isInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>layout.width||r.y+r.height>layout.height) throw new Error(`${label}: invalid tile bounds`);
  }
  function layer(name:string,opacity=1):TileLayer { return {id:0,name,type:'tilelayer',width:layout.width,height:layout.height,data:Array(size).fill(0),visible:true,opacity,x:0,y:0}; }
  function sheet(key:string):{firstgid:number;columns:number} {
    const sprite=tiles[key];if(!sprite)throw new Error(`Unknown sprite: ${key}`);
    let ref=refs.get(sprite.sheet);if(ref)return ref;
    const png=readFileSync(sprite.sheet),width=png.readUInt32BE(16),height=png.readUInt32BE(20),columns=width/32;
    if(width%32||height%32)throw new Error(`${sprite.sheet}: not a 32px grid`);
    ref={firstgid:nextgid,columns};refs.set(sprite.sheet,ref);
    tilesets.push({firstgid:nextgid,name:`art-${tilesets.length}`,tilewidth:32,tileheight:32,columns,tilecount:columns*height/32,image:relative('maps',sprite.sheet),imagewidth:width,imageheight:height,properties:[{name:'tilesetCopyright',type:'string',value:`${sources[sprite.sourceId].attribution}; ${sources[sprite.sourceId].license}`}]});
    nextgid+=columns*height/32;return ref;
  }
  const terrain=layer('terrain'),groundMask=new Uint8Array(size),propMask=new Uint8Array(size);
  const stacks:{layers:TileLayer[];depth:Int16Array}[]=[{layers:[],depth:new Int16Array(size).fill(-1)},{layers:[],depth:new Int16Array(size).fill(-1)}];
  for(const p of layout.placements) {
    if(ids.has(p.id))throw new Error(`Duplicate placement ID: ${p.id}`);ids.add(p.id);bounds(p,p.id);
    const s=tiles[p.sprite];if(!s)throw new Error(`Unknown sprite: ${p.sprite}`);
    if(p.renderRole && !['grounded','canopy','cutaway'].includes(p.renderRole))throw new Error(`${p.id}: invalid render role`);
    if(p.layer==='terrain'&&p.renderRole)throw new Error(`${p.id}: render roles apply to scenery only`);
    if(p.width%s.rect.width||p.height%s.rect.height)throw new Error(`${p.id}: dimensions must be native sprite multiples`);
    if(p.layer==='terrain'&&s.level==='aboveAvatar')throw new Error(`${p.id}: foreground sprite cannot replace terrain`);
    const visual=p.renderRole==='cutaway'?tiles['floor-inlay']:s;
    const ref=sheet(p.renderRole==='cutaway'?'floor-inlay':p.sprite),mask=new Set(s.blockingCells.map(([x,y])=>y*s.rect.width+x));
    const level=p.renderRole==='canopy'?'aboveAvatar':p.renderRole?'belowAvatar':s.level;
    const cells:number[]=[];for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)cells.push((p.y+y)*layout.width+p.x+x);
    let target=terrain;
    if(p.layer!=='terrain') {
      const stack=stacks[level==='aboveAvatar'?1:0];
      const depth=1+Math.max(-1,...cells.map(i=>stack.depth[i]));
      while(stack.layers.length<=depth)stack.layers.push(layer(`scenery-${level}-${stack.layers.length}`));
      target=stack.layers[depth];for(const i of cells)stack.depth[i]=depth;
    }
    for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++) {
      const i=(p.y+y)*layout.width+p.x+x,dx=x%s.rect.width,dy=y%s.rect.height;
      // A cutaway keeps a thin floor-level sill, never a tall opaque wall/door plane.
      if(p.renderRole!=='cutaway'||y===p.height-1)target.data[i]=ref.firstgid+(visual.rect.y+y%visual.rect.height)*ref.columns+visual.rect.x+x%visual.rect.width;
      const collides=mask.has(dy*s.rect.width+dx)?1:0;
      if(p.layer==='terrain')groundMask[i]=collides;else if(collides)propMask[i]=1;
    }
  }
  // Reuse an existing PNG invisibly; navigation pixels are never part of scene appearance.
  const maskRef=sheet('floor-charcoal');
  const maskSheet=tilesets.find(t=>t.firstgid===maskRef.firstgid);
  if(!maskSheet || (maskSheet.tilecount??0)<2)throw new Error('Navigation-mask atlas must contain at least two tiles');
  const marker=nextgid,wall=nextgid+1;
  tilesets.push({...maskSheet,firstgid:nextgid,name:'navigation-mask',tiles:[{id:0,properties:[{name:'collides',type:'bool',value:false}]},{id:1,properties:[{name:'collides',type:'bool',value:true}]}]});
  nextgid += maskSheet.tilecount!;
  layers.push(terrain,...stacks[0].layers,{id:0,name:'floorLayer',type:'objectgroup',objects:[],visible:true,opacity:1},...stacks[1].layers);
  for (const overlay of layout.animatedOverlays ?? []) {
    bounds(overlay, `Animation ${overlay.name}`);
    const count = overlay.width * overlay.height;
    if (count >= 256 || overlay.carrierTileIds.length !== count || new Set(overlay.carrierTileIds).size !== count) throw new Error(`Animation ${overlay.name}: use fewer than 256 distinct carrier cells`);
    if (!/^assets\/tilesets\/original\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.png$/.test(overlay.image) || !sources[overlay.sourceId]) throw new Error(`Animation ${overlay.name}: registered original atlas required`);
    const source = realpathSync(overlay.image);
    if (dirname(source) !== resolve(realpathSync('.'), 'assets/tilesets/original')) throw new Error(`Animation ${overlay.name}: atlas outside original assets`);
    const png = readFileSync(source), width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    if (overlay.provenance) {
      const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
      for (const input of overlay.provenance.inputs) {
        if (!/^(?:art\/source|assets\/sponsors|tools\/(?:art|maps))\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:png|svg|json|ts)$/.test(input.path) || dirname(realpathSync(input.path)) !== resolve(realpathSync('.'), dirname(input.path))) throw new Error(`Animation ${overlay.name}: invalid input provenance path`);
        if (hash(readFileSync(input.path)) !== input.sha256) throw new Error(`Animation ${overlay.name}: input changed; regenerate flight art and its layout descriptor`);
      }
      if (hash(png) !== overlay.provenance.atlasSha256) throw new Error(`Animation ${overlay.name}: atlas changed; regenerate flight metadata`);
      const path = overlay.provenance.metadataPath;
      if (!/^art\/source\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(path) || dirname(realpathSync(path)) !== resolve(realpathSync('.'), 'art/source') || !isDeepStrictEqual(JSON.parse(readFileSync(path, 'utf8')).overlay, overlay)) throw new Error(`Animation ${overlay.name}: metadata changed; refresh the layout descriptor`);
    }
    if (!png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || !width || !height || width % 32 || height % 32 || width * height * 4 > 4 * 1024 * 1024) throw new Error(`Animation ${overlay.name}: bounded native 32px PNG required`);
    const columns = width / 32, tilecount = columns * height / 32, carriers = new Set(overlay.carrierTileIds), definitions = new Set<number>(), periods = new Set<number>();
    const validId = (id: number): boolean => Number.isInteger(id) && id >= 0 && id < tilecount;
    if (!overlay.carrierTileIds.every(validId) || overlay.animations.length !== count) throw new Error(`Animation ${overlay.name}: invalid carrier IDs`);
    for (const animation of overlay.animations) {
      if (!carriers.has(animation.id) || definitions.has(animation.id) || !animation.frames.length || animation.frames.some(f => !validId(f.tileid) || carriers.has(f.tileid) || !Number.isInteger(f.duration) || f.duration < 100)) throw new Error(`Animation ${overlay.name}: invalid frame metadata`);
      definitions.add(animation.id); periods.add(animation.frames.reduce((total, f) => total + f.duration, 0));
    }
    if (periods.size !== 1) throw new Error(`Animation ${overlay.name}: carrier clocks must have one period`);
    const firstgid = nextgid;
    tilesets.push({ firstgid, name: overlay.name, tilewidth: 32, tileheight: 32, columns, tilecount, image: relative('maps', overlay.image), imagewidth: width, imageheight: height, properties: [{name:'tilesetCopyright',type:'string',value:`${sources[overlay.sourceId].attribution}; ${sources[overlay.sourceId].license}`}], tiles: overlay.animations.map(a => ({id:a.id,animation:a.frames.map(f=>({...f})),properties:[{name:'collides',type:'bool',value:false}]})) });
    nextgid += tilecount;
    const animated = layer(overlay.name);
    for (let y = 0; y < overlay.height; y++) for (let x = 0; x < overlay.width; x++) animated.data[(overlay.y + y) * layout.width + overlay.x + x] = firstgid + overlay.carrierTileIds[y * overlay.width + x];
    layers.push(animated);
  }
  const collision=layer('physical-collisions',0);collision.data=Array.from(groundMask,(v,i)=>v||propMask[i]?wall:0);layers.push(collision);
  for (const image of layout.images ?? []) {
    bounds(image, `Sponsor ${image.name}`);
    if (image.width !== 6 || image.height !== 2) throw new Error(`Sponsor ${image.name}: native image footprint must be 6×2 tiles (192×64 pixels)`);
    readSponsorImage(image.image);
    const firstgid = nextgid;
    tilesets.push({ firstgid, name: image.name, tilewidth: 32, tileheight: 32, columns: 6, tilecount: 12, image: relative('maps', image.image), imagewidth: 192, imageheight: 64, properties: [{ name: 'sponsorPanel', type: 'bool', value: true }, { name: 'tilesetCopyright', type: 'string', value: 'Sponsor artwork: see credits/sponsors.json for original attribution and replacement terms.' }] });
    nextgid += 12;
    const panel = layer(image.name);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 6; x++) panel.data[(image.y + y) * layout.width + image.x + x] = firstgid + y * 6 + x;
    layers.push(panel);
  }
  for(const entry of layout.entries) {
    bounds(entry,entry.name);const l=layer(entry.name,0);
    l.properties=[{name:'startLayer',type:'bool',value:true},...(entry.isDefault?[{name:'start',type:'bool',value:true}]:[])];
    for(let y=entry.y;y<entry.y+entry.height;y++)for(let x=entry.x;x<entry.x+entry.width;x++)l.data[y*layout.width+x]=marker;
    layers.push(l);
  }
  for(const exit of layout.exits) {
    bounds(exit,exit.name);const l=layer(`exit-${exit.name}`,0);l.properties=[{name:'exitUrl',type:'string',value:`${exit.destination}.wam#${exit.entry}`}];
    for(let y=exit.y;y<exit.y+exit.height;y++)for(let x=exit.x;x<exit.x+exit.width;x++)l.data[y*layout.width+x]=marker;
    layers.push(l);
  }
  let objectId=1;
  layers.push({id:0,name:'wayfinding-text',type:'objectgroup',visible:true,opacity:1,objects:(layout.signs??[]).map(s=>{
    bounds(s,s.name);const padding=s.padding??0;if(!Number.isInteger(padding)||padding<0||padding*2>=s.width*32||padding*2>=s.height*32)throw new Error(`${s.name}: padding must be a nonnegative integer leaving a nonempty native text rectangle`);return {id:objectId++,name:s.name,x:s.x*32+padding,y:s.y*32+padding,width:s.width*32-padding*2,height:s.height*32-padding*2,rotation:0,visible:true,text:{text:s.text,color:s.color??'#f1d9a0',fontfamily:'Arial',pixelsize:s.fontSize??18,bold:false,wrap:true,halign:s.align??'left',valign:'top',backgroundcolor:s.name==='wheel-welcome-board'?'#101c2c':undefined,backgroundopacity:s.name==='wheel-welcome-board'?0.92:undefined}};
  })});
  layers.push({id:0,name:'inspection-zones',type:'objectgroup',visible:false,opacity:1,objects:layout.inspectionZones.map(z=>({id:objectId++,name:z.name,type:z.kind,x:z.x*32,y:z.y*32,width:z.width*32,height:z.height*32,visible:false}))});
  const names=new Set<string>();for(const [i,l] of layers.entries()){if(names.has(l.name))throw new Error(`Duplicate flattened layer name: ${l.name}`);names.add(l.name);l.id=i+1;}
  const tmj:TiledMap={type:'map',version:'1.10',tiledversion:'1.12.2',orientation:'orthogonal',renderorder:'right-down',infinite:false,width:layout.width,height:layout.height,tilewidth:32,tileheight:32,backgroundcolor:'#101c2c',layers,tilesets,nextlayerid:layers.length+1,nextobjectid:objectId,properties:[{name:'script',type:'string',value:'../src/main.ts'},{name:'worldMapId',type:'string',value:layout.id},{name:'mapName',type:'string',value:mapName},{name:'defaultCameraState',type:'bool',value:false},{name:'defaultMicrophoneState',type:'bool',value:false}]};
  const wam:WamFile={version:'2.1.0',mapUrl:`${layout.id}.tmj`,entities:{},areas:layout.areas.map((a,i)=>{bounds(a,a.name);return {id:a.id??`${layout.id}-area-${i}`,name:a.name,visible:true,x:a.x*32,y:a.y*32,width:a.width*32,height:a.height*32,properties:a.properties};}),entityCollections:[],metadata:{name:mapName}};
  return {tmj,wam};
}
