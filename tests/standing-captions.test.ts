import {VIBECODE_CAPTION_IMAGE} from '../tools/art/vibecode';
import{spawnSync}from'node:child_process';import{resolve}from'node:path';
import{mkdtempSync,mkdirSync,writeFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join,dirname}from'node:path';
import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{runInNewContext}from'node:vm';import ts from'typescript';import{describe,it,expect}from'vitest';import{buildMap}from'../tools/maps/builder';import{loadTileCatalog}from'../tools/art/catalog';
const json=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
function pinned(name:string){const raw=readFileSync(`tests/fixtures/standing-captions/${name}`);expect(createHash('sha256').update(raw).digest('hex')).toBe(json('tests/fixtures/standing-captions/provenance.json').files[name]);return raw.toString();}
type CaptionMap='constellation-shore'|'shipyard-beach';
// Fixed published epoch inputs, never reconstructed by undoing current features.
const captionEpoch5d={
 'constellation-shore':{
  layout:['tests/fixtures/standing-captions/before-constellation-shore.json','bb32c4a41536c81ac643da49a5923c46203abe9f01e9752bf82bf8f40fe2b8d3'],
  before:'before-constellation-shore.tmj',
  after:['tests/fixtures/standing-captions/after-constellation-shore-5d.tmj','aa46986b3791c2c50840a32d3a3d7aaddc1df3f0f683acd1f218ee85513764c7']},
 'shipyard-beach':{
  layout:['tests/fixtures/beach-ship/before-world--layouts--shipyard-beach.json','a049fb2e3ee0ef00a20a5e9d572de10328d18953dca7a607dc30b091c043a71d'],
  before:'before-shipyard-beach.tmj',
  after:['tests/fixtures/beach-ship/before-maps--shipyard-beach.tmj','2710cb17d4829ed5df199618c4f333f44d5d80dae0b6ad77da423144d2e23d9c']}
} as const;
function readEpoch5d(id:CaptionMap){
 const read=([path,hash]:readonly[string,string])=>{const raw=readFileSync(path);expect(createHash('sha256').update(raw).digest('hex'),path).toBe(hash);return JSON.parse(raw.toString());},row=captionEpoch5d[id];
 return{layout:read(row.layout),before:read(['tests/fixtures/standing-captions/'+row.before,json('tests/fixtures/standing-captions/provenance.json').beforeFiles[row.before]]),after:read(row.after),catalog:read(['tests/fixtures/plaza-groves/before-catalog.json','43104f9a7cb04d07b008b6ebe9dfd74a2e9d2e22ccd4bc542d22e044419f26ff'])};
}
// Execute the EXACT pinned layer-depth loop and actual TextUtils method. Scene objects
// only record the boundary; this is a source-unit oracle, not a live Phaser claim.
function actualDepths(map:any){
 const wrapper=pinned('GameMapFrontWrapper.ts.txt'),loop=wrapper.slice(wrapper.indexOf('let depth = -2;'),wrapper.indexOf('\n\n        let nbUnnamedTileArea'));
 const constant=Number(pinned('DepthIndexes.ts.txt').match(/DEPTH_OVERLAY_INDEX = ([\d_]+)/)![1].replaceAll('_',''));
 const records:any[]=[];const owner={gameMap:{flatLayers:map.layers},phaserLayers:[],createRenderableLayer:(l:any)=>{const row:any={name:l.name,depth:0,kind:'tile',order:records.length};for(const method of['setDepth','setScrollFactor','setAlpha','setVisible'])row[method]=(v:any)=>{if(method==='setDepth')row.depth=v;return row;};records.push(row);return row;}};
 runInNewContext(`(function(){${loop}}).call(owner)`,{owner,terrains:[],DEPTH_OVERLAY_INDEX:constant});
 const js=ts.transpileModule(pinned('TextUtils.ts.txt'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports:any={};runInNewContext(js,{exports,require:()=>({GameMapProperties:{FONT_FAMILY:'fontFamily'}})});
 for(const l of map.layers)for(const object of l.objects??[])if(object.text)exports.TextUtils.createTextFromITiledMapObject({add:{text:()=>{const row={name:object.name,kind:'text',depth:0,order:records.length,setAngle:()=>{}};records.push(row);return row;}}},object);
 return records;
}
describe('portable standing caption depth',()=>{
 it.each(['constellation-shore','shipyard-beach'] as const)('%s keeps every linked caption visible through the actual pinned depth path',async id=>{
  const layout=json(`world/layouts/${id}.json`);for(const [kind,map]of [['compiled',buildMap(layout,loadTileCatalog()).tmj],['native',json(`maps/${id}.tmj`)]]as const){assertNativeStandingCaptions(map,layout);await assertCurrentCaptionPixels(map,layout);if(kind==='native')expect(map.tilesets.find((t:any)=>t.name==='standing-captions').firstgid).toBe(readEpoch5d(id).after.tilesets.find((t:any)=>t.name==='standing-captions').firstgid);const rows=actualDepths(map);
  for(const link of layout.standingSigns.filter((s:any)=>s.text)){
   const caption=rows.find((r:any)=>r.name===`standing-caption-${link.text}`)??rows.find((r:any)=>r.name===link.text);
   const face=map.layers.findIndex((l:any)=>l.type==='tilelayer'&&l.name.startsWith('scenery-aboveAvatar-')&&l.data[layout.placements.find((p:any)=>p.id===link.face).y*map.width+layout.placements.find((p:any)=>p.id===link.face).x]);
   expect(caption,link.text).toBeDefined();expect(caption.depth,link.text).toBeGreaterThanOrEqual(rows.find((r:any)=>r.name===map.layers[face].name)!.depth);
   expect(caption.kind).toBe('tile');expect(caption.order).toBeGreaterThan(rows.find((r:any)=>r.name===map.layers[face].name)!.order);
  }}
 });
});

it('has a narrow forward caption authoring operation without weakening scenery refinement',async()=>{const module=await import('../tools/maps/solid-props');expect((module as any).refineStandingCaptions).toBeTypeOf('function');});

import{captionSpecs,renderCaptionMaster,readStandingCaptions,captionFamily,CAPTION_IMAGE,EXPO_CAPTION_IMAGE}from'../tools/art/standing-captions';
import{refineStandingCaptions,assertNativeStandingCaptions}from'../tools/maps/standing-captions';
import sharp from'sharp';
it('renders exact twelve caption strings with original pixel glyphs and safe transparent padding',async()=>{
 const specs=json('art/source/standing-captions.json').specs;expect(specs).toHaveLength(12);expect(['constellation-shore','shipyard-beach'].flatMap(id=>captionSpecs(json(`world/layouts/${id}.json`)))).toHaveLength(9);const master=renderCaptionMaster(specs);expect([master.width,master.height]).toEqual([512,192]);
 const pixels=await sharp(CAPTION_IMAGE).ensureAlpha().raw().toBuffer(),expected=await sharp(Buffer.from(master.svg)).ensureAlpha().raw().toBuffer();expect(pixels.equals(expected)).toBe(true);
 for(const row of master.rows){let ink=0;for(let y=0;y<32;y++)for(let x=0;x<row.sign.width*32;x++){const a=pixels[((row.atlasY*32+y)*512+row.atlasX*32+x)*4+3];if(a){ink++;expect(x).toBeGreaterThanOrEqual(row.sign.padding??0);expect(x).toBeLessThan(row.sign.width*32-(row.sign.padding??0));expect(y).toBeGreaterThanOrEqual(row.sign.padding??0);expect(y).toBeLessThan(32-(row.sign.padding??0));}}expect(ink,row.sign.text).toBeGreaterThan(0);}
});
it.each(['glyph','fit','padding','color','semantic'])('refuses %s caption drift',kind=>{const l=json('world/layouts/constellation-shore.json'),spec=captionSpecs(l)[0];if(kind==='glyph')spec.sign.text='☃';if(kind==='fit')spec.sign.text='A'.repeat(100);if(kind==='padding')spec.sign.padding=16;if(kind==='color')spec.sign.color='red';if(kind==='semantic'){l.signs.find((s:any)=>s.name===spec.sign.name).text='ALTERED';expect(()=>readStandingCaptions(l)).toThrow(/semantic/);}else expect(()=>renderCaptionMaster([spec])).toThrow();});
for(const id of ['constellation-shore','shipyard-beach']as const){
 it(`${id} historical5d forward-adds only validated captions and removes precisely six unsupported text objects`,()=>{
  const epoch=readEpoch5d(id),l=epoch.layout,old=epoch.before,intended=structuredClone(epoch.after),now=epoch.after,names=new Set(captionSpecs(l).map(s=>s.sign.name));expect(now).toEqual(refineStandingCaptions(old,intended,l));assertNativeStandingCaptions(now,l);
  expect(now.tilesets.slice(0,-1)).toEqual(old.tilesets);expect(now.layers.filter((l:any)=>l.name.startsWith('standing-caption-'))).toHaveLength(6);
  for(const row of old.layers){const actual=now.layers.find((l:any)=>l.name===row.name);expect(actual).toEqual(row.name==='wayfinding-text'?{...row,objects:row.objects.filter((o:any)=>!names.has(o.name))}:row);}
  expect(Object.fromEntries(Object.entries(now).filter(([k])=>!['layers','tilesets','nextlayerid'].includes(k)))).toEqual(Object.fromEntries(Object.entries(old).filter(([k])=>!['layers','tilesets','nextlayerid'].includes(k))));
 });
}
it.each(['unknown-atlas','collision','offset','localid','textsignature'])('refuses %s forward-caption mutation',kind=>{const epoch=readEpoch5d('constellation-shore'),l=epoch.layout,old=epoch.before,intended=buildMap(l,epoch.catalog).tmj,atlas=intended.tilesets.find(t=>t.name==='standing-captions')!,layer=intended.layers.find(l=>l.name.startsWith('standing-caption-'))as any;if(kind==='unknown-atlas')atlas.image='../assets/sponsors/demo-01.png';if(kind==='collision')atlas.tiles=[{id:0,properties:[{name:'collides',type:'bool',value:true}]}];if(kind==='offset')layer.offsetx=1;if(kind==='localid')layer.data[layer.data.findIndex(Boolean)]++;if(kind==='textsignature')old.layers.find((l:any)=>l.name==='wayfinding-text').objects[0].text.text='changed';expect(()=>refineStandingCaptions(old,intended,l)).toThrow();});
it.each([NaN,Infinity,0,-1])('rejects malformed standing caption size %s',fontSize=>{const spec=captionSpecs(json('world/layouts/constellation-shore.json'))[0];spec.sign.fontSize=fontSize;expect(()=>renderCaptionMaster([spec])).toThrow(/size/);});
it('keeps the shared beach sheet closed to the overworld: expo captions belong to their own family and files',()=>{
 const shared=captionFamily('shipyard-beach');expect(shared).toEqual({id:'shared',image:CAPTION_IMAGE,meta:'art/source/standing-captions.json',svg:'art/source/standing-captions.svg'});expect(captionFamily('constellation-shore')).toBe(shared);
 expect(captionFamily('overworld')).toEqual({id:'expo',image:EXPO_CAPTION_IMAGE,meta:'art/source/expo-captions.json',svg:'art/source/expo-captions.svg'});
 const meta=json(shared.meta);expect(meta.specs.map((s:any)=>s.map)).not.toContain('overworld');expect(meta.specs).toHaveLength(12);expect(meta.producerSha256).toBe(createHash('sha256').update(readFileSync('tools/art/standing-captions.ts')).digest('hex'));
 const forged=structuredClone(meta);forged.specs[0]={...forged.specs[0],map:'overworld'};const cwd=process.cwd(),dir=mkdtempSync(join(tmpdir(),'varcamp-caption-family-'));
 try{for(const file of [shared.meta,shared.svg,'art/source/hub-nameplates.json','tools/art/standing-captions.ts',CAPTION_IMAGE]){mkdirSync(join(dir,dirname(file)),{recursive:true});writeFileSync(join(dir,file),file===shared.meta?JSON.stringify(forged):readFileSync(file));}process.chdir(dir);expect(()=>readStandingCaptions(json(resolve(cwd,'world/layouts/constellation-shore.json')))).toThrow(/family/);}finally{process.chdir(cwd);rmSync(dir,{recursive:true,force:true});}
 const expo=readStandingCaptions(json('world/layouts/overworld.json'))!;expect(expo.image).toBe(VIBECODE_CAPTION_IMAGE);expect(expo.rows).toHaveLength(12);expect(expo.rows.every(r=>r.map==='overworld'&&/^expo-[ns]\d-nameplate$/.test(r.sign.name))).toBe(true);expect([expo.width,expo.height]).toEqual([512,128]);
});
it('enforces the approved six-row atlas rather than growing to512square',()=>{const spec=captionSpecs(json('world/layouts/constellation-shore.json'))[0];expect(()=>renderCaptionMaster(Array.from({length:7},(_,i)=>({...spec,map:'fixture',sign:{...spec.sign,name:`row-${i}`,text:'A',width:16}})))).toThrow(/512x192/);});

it('refuses stale caption PNG bytes in an isolated ordinary art fixture',()=>{
 const layout=json('world/layouts/constellation-shore.json'),cwd=process.cwd(),dir=mkdtempSync(join(tmpdir(),'varcamp-caption-'));
 try{for(const file of ['art/source/standing-captions.json','art/source/standing-captions.svg','art/source/hub-nameplates.json','tools/art/standing-captions.ts',CAPTION_IMAGE]){mkdirSync(join(dir,dirname(file)),{recursive:true});const bytes=readFileSync(file);writeFileSync(join(dir,file),file===CAPTION_IMAGE?Buffer.concat([bytes,Buffer.from([1])]):bytes);}process.chdir(dir);expect(()=>readStandingCaptions(layout)).toThrow(/artwork/);}finally{process.chdir(cwd);rmSync(dir,{recursive:true,force:true});}
});

it('keeps the public builder import synchronous for external CJS tools',()=>{const dir=mkdtempSync(join(tmpdir(),'caption-cjs-'));try{const file=join(dir,'probe.cts');writeFileSync(file,`const b=require(${JSON.stringify(resolve('tools/maps/builder.ts'))});console.log(typeof b.buildMap);`);const result=spawnSync(process.execPath,[resolve('node_modules/tsx/dist/cli.mjs'),file],{encoding:'utf8',timeout:10000});expect(result.status,result.stderr).toBe(0);expect(result.stdout.trim()).toBe('function');}finally{rmSync(dir,{recursive:true,force:true});}});

/** Observe actual tile pixels through native GIDs, not semantic text alone. */
async function assertCurrentCaptionPixels(map:any,layout:any){
 const resource=readStandingCaptions(layout)!;const atlas=map.tilesets.find((t:any)=>t.name==='standing-captions'),image=await sharp('maps/'+atlas.image).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(const row of resource.rows){const layer=map.layers.find((l:any)=>l.name==='standing-caption-'+row.sign.name),width=row.sign.width*32,height=row.sign.height*32,actual=Buffer.alloc(width*height*4),expected=Buffer.alloc(width*height*4);
  for(let y=0;y<row.sign.height;y++)for(let x=0;x<row.sign.width;x++){const gid=layer.data[(row.sign.y+y)*map.width+row.sign.x+x],tile=gid-atlas.firstgid;expect(tile).toBeGreaterThanOrEqual(0);expect(tile).toBeLessThan(atlas.tilecount);
   for(let py=0;py<32;py++){const from=((Math.floor(tile/atlas.columns)*32+py)*image.info.width+tile%atlas.columns*32)*4,to=((y*32+py)*width+x*32)*4;image.data.copy(actual,to,from,from+128);}
  }
  for(let y=0;y<height;y++){const from=((row.atlasY*32+y)*image.info.width+row.atlasX*32)*4;image.data.copy(expected,y*width*4,from,from+width*4);}
  expect(actual.equals(expected),row.sign.text+' actual native RGBA').toBe(true);expect(Array.from({length:actual.length/4},(_,i)=>actual[i*4+3]).some(Boolean),row.sign.text+' actual ink').toBe(true);
 }
}
it.each(['missing-plane','localid','semantic-text','semantic-face','ghost','depth','atlas','offset','visibility'])('rejects CURRENT %s caption drift on both actual native maps',kind=>{
 const variants=kind==='missing-plane'?['remove','duplicate']:kind==='depth'?['below','before-face']:kind==='atlas'?['image','collision','source-hash','animation']:kind==='visibility'?['hidden','partial-alpha']:['single'];
 for(const id of ['constellation-shore','shipyard-beach']as const)for(const variant of variants){const l=json(`world/layouts/${id}.json`),map=json(`maps/${id}.tmj`),layer=map.layers.find((x:any)=>x.name.startsWith('standing-caption-')),atlas=map.tilesets.find((x:any)=>x.name==='standing-captions');
  if(kind==='missing-plane'){if(variant==='remove')map.layers.splice(map.layers.indexOf(layer),1);else map.layers.push(structuredClone(layer));}
  if(kind==='localid')layer.data[layer.data.findIndex(Boolean)]++;
  if(kind==='semantic-text')layer.properties.find((p:any)=>p.name==='captionText').value='UNAPPROVED';
  if(kind==='semantic-face')layer.properties.find((p:any)=>p.name==='captionFace').value='unrelated-face';
  if(kind==='ghost'){const name=captionSpecs(l)[0].sign.name,original=readEpoch5d(id).before.layers.find((x:any)=>x.name==='wayfinding-text').objects.find((o:any)=>o.name===name);map.layers.find((x:any)=>x.name==='wayfinding-text').objects.push(structuredClone(original));}
  if(kind==='depth'){map.layers.splice(map.layers.indexOf(layer),1);const floor=map.layers.findIndex((x:any)=>x.name==='floorLayer');map.layers.splice(floor+(variant==='below'?0:1),0,layer);}
  if(kind==='atlas'){if(variant==='image')atlas.image='../assets/sponsors/demo-01.png';else if(variant==='collision')atlas.tiles=[{id:0,properties:[{name:'collides',type:'bool',value:true}]}];else if(variant==='source-hash')atlas.properties.find((p:any)=>p.name==='captionAtlasSha256').value='0'.repeat(64);else atlas.tiles=[{id:0,animation:[{tileid:0,duration:100}]}];}
  if(kind==='offset')layer.offsetx=1;
  if(kind==='visibility'){if(variant==='hidden')layer.visible=false;else layer.opacity=0.5;}
  expect(()=>assertNativeStandingCaptions(map,l),id+'/'+kind+'/'+variant).toThrow();
 }
});
