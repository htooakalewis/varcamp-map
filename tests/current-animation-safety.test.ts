import{mkdtempSync,readFileSync,rmSync,writeFileSync}from'node:fs';
import{tmpdir}from'node:os';
import{resolve}from'node:path';
import{createHash}from'node:crypto';
import sharp from'sharp';
import{expect,it}from'vitest';
import{assertCurrentNativeMap}from'../tools/maps/current-native';
import{stageCurrentWorldInputs}from'./helpers/current-interior-fixture';
import{WORLD_CATALOG}from'../src/world/catalog';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
it('every current decoration is lower, an actual owned-upper projection, or one of five safe airborne birds',()=>{
 const invalid:string[]=[],upper:string[]=[],airborne:string[]=[];let count=0;
 for(const id of Object.keys(WORLD_CATALOG))for(const o of read(`world/layouts/${id}.json`).animatedOverlays??[]){count++;if(o.level==='belowAvatar')continue;const meta=o.provenance?read(o.provenance.metadataPath):{};if(o.level==='aboveScenery'&&o.name.includes('gull'))airborne.push(o.name);else if(o.level==='aboveAvatar'&&meta.partition==='opaqueOwnerUpper'&&meta.depthReceipt?.owner)upper.push(o.name);else invalid.push(`${id}/${o.name}/${o.level}`);}
 expect(count).toBe(137);expect(upper).toHaveLength(2);expect(airborne).toHaveLength(5);expect(invalid).toEqual([]);
});
it('current plaza entry rejects coherent omission of the required Roadster',()=>{
 const id='overworld',map=read(`maps/${id}.tmj`),layout=read(`world/layouts/${id}.json`);map.layers=map.layers.filter((l:any)=>l.name!=='roadster');layout.animatedOverlays=layout.animatedOverlays.filter((o:any)=>o.name!=='roadster');
 expect(()=>assertCurrentNativeMap(id,map,layout,read(`maps/${id}.wam`),read('art/tile-catalog.json'))).toThrow(/animation safety/i);
});
it('current boundary rejects native upper pixels outside actual owning alpha255 art even when all output hashes are coherently rebound',async()=>{
 const project=process.cwd(),fixture=mkdtempSync(resolve(tmpdir(),'varcamp-upper-alpha-'));
 try{
  stageCurrentWorldInputs(project,fixture);const id='fa-ship-interior',name='world-ambient-fa-ship-interior-steam-1-upper',layout=read(resolve(fixture,`world/layouts/${id}.json`)),map=read(resolve(fixture,`maps/${id}.tmj`)),o=layout.animatedOverlays.find((o:any)=>o.name===name),set=map.tilesets.find((s:any)=>s.name===name),layer=map.layers.find((l:any)=>l.name===name),gid=layer.data[(o.y+1)*map.width+o.x],tile=set.tiles.find((t:any)=>t.id===gid-set.firstgid).animation[0].tileid;
  const pngPath=resolve(fixture,o.image),raw=await sharp(pngPath).ensureAlpha().raw().toBuffer({resolveWithObject:true}),offset=(Math.floor(tile/set.columns)*32*raw.info.width+tile%set.columns*32)*4;raw.data.set([255,0,0,255],offset);const png=await sharp(raw.data,{raw:{width:raw.info.width,height:raw.info.height,channels:4}}).png().toBuffer();writeFileSync(pngPath,png);o.provenance.atlasSha256=sha(png);const metaPath=resolve(fixture,o.provenance.metadataPath),meta=read(metaPath);meta.overlay=o;writeFileSync(metaPath,JSON.stringify(meta));writeFileSync(resolve(fixture,`world/layouts/${id}.json`),JSON.stringify(layout));
  // Async image work finishes before the temporary cwd; actual guard is sync.
  process.chdir(fixture);expect(()=>assertCurrentNativeMap(id,map,layout,read(`maps/${id}.wam`),read('art/tile-catalog.json'))).toThrow(/animation safety/i);
 }finally{process.chdir(project);rmSync(fixture,{recursive:true,force:true});}
},15000);
