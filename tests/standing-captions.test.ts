import{spawnSync}from'node:child_process';import{resolve}from'node:path';
import{mkdtempSync,mkdirSync,writeFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join,dirname}from'node:path';
import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{runInNewContext}from'node:vm';import ts from'typescript';import{describe,it,expect}from'vitest';import{buildMap}from'../tools/maps/builder';import{loadTileCatalog}from'../tools/art/catalog';
const json=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
function pinned(name:string){const raw=readFileSync(`tests/fixtures/standing-captions/${name}`);expect(createHash('sha256').update(raw).digest('hex')).toBe(json('tests/fixtures/standing-captions/provenance.json').files[name]);return raw.toString();}
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
 it.each(['constellation-shore','shipyard-beach'])('%s keeps every linked caption visible through the actual pinned depth path',id=>{
  const layout=json(`world/layouts/${id}.json`);for(const map of [buildMap(layout,loadTileCatalog()).tmj,json(`maps/${id}.tmj`)]){const rows=actualDepths(map);
  for(const link of layout.standingSigns.filter((s:any)=>s.text)){
   const caption=rows.find((r:any)=>r.name===`standing-caption-${link.text}`)??rows.find((r:any)=>r.name===link.text);
   const face=map.layers.findIndex((l:any)=>l.type==='tilelayer'&&l.name.startsWith('scenery-aboveAvatar-')&&l.data[layout.placements.find((p:any)=>p.id===link.face).y*map.width+layout.placements.find((p:any)=>p.id===link.face).x]);
   expect(caption,link.text).toBeDefined();expect(caption.depth,link.text).toBeGreaterThanOrEqual(rows.find((r:any)=>r.name===map.layers[face].name)!.depth);
   expect(caption.kind).toBe('tile');expect(caption.order).toBeGreaterThan(rows.find((r:any)=>r.name===map.layers[face].name)!.order);
  }}
 });
});

it('has a narrow forward caption authoring operation without weakening scenery refinement',async()=>{const module=await import('../tools/maps/solid-props');expect((module as any).refineStandingCaptions).toBeTypeOf('function');});

import{captionSpecs,renderCaptionMaster,readStandingCaptions,CAPTION_IMAGE}from'../tools/art/standing-captions';
import{refineStandingCaptions,assertNativeStandingCaptions}from'../tools/maps/standing-captions';
import sharp from'sharp';
it('renders exact twelve caption strings with original pixel glyphs and safe transparent padding',async()=>{
 const specs=['constellation-shore','shipyard-beach'].flatMap(id=>captionSpecs(json(`world/layouts/${id}.json`)));expect(specs).toHaveLength(12);const master=renderCaptionMaster(specs);expect([master.width,master.height]).toEqual([512,192]);
 const pixels=await sharp(CAPTION_IMAGE).ensureAlpha().raw().toBuffer(),expected=await sharp(Buffer.from(master.svg)).ensureAlpha().raw().toBuffer();expect(pixels.equals(expected)).toBe(true);
 for(const row of master.rows){let ink=0;for(let y=0;y<32;y++)for(let x=0;x<row.sign.width*32;x++){const a=pixels[((row.atlasY*32+y)*512+row.atlasX*32+x)*4+3];if(a){ink++;expect(x).toBeGreaterThanOrEqual(row.sign.padding??0);expect(x).toBeLessThan(row.sign.width*32-(row.sign.padding??0));expect(y).toBeGreaterThanOrEqual(row.sign.padding??0);expect(y).toBeLessThan(32-(row.sign.padding??0));}}expect(ink,row.sign.text).toBeGreaterThan(0);}
});
it.each(['glyph','fit','padding','color','semantic'])('refuses %s caption drift',kind=>{const l=json('world/layouts/constellation-shore.json'),spec=captionSpecs(l)[0];if(kind==='glyph')spec.sign.text='☃';if(kind==='fit')spec.sign.text='A'.repeat(100);if(kind==='padding')spec.sign.padding=16;if(kind==='color')spec.sign.color='red';if(kind==='semantic'){l.signs.find((s:any)=>s.name===spec.sign.name).text='ALTERED';expect(()=>readStandingCaptions(l)).toThrow(/semantic/);}else expect(()=>renderCaptionMaster([spec])).toThrow();});
for(const id of ['constellation-shore','shipyard-beach']){
 it(`${id} forward-adds only validated captions and removes precisely six unsupported text objects`,()=>{
  const l=json(`world/layouts/${id}.json`),old=json(`tests/fixtures/standing-captions/before-${id}.tmj`),intended=buildMap(l,loadTileCatalog()).tmj,now=json(`maps/${id}.tmj`),names=new Set(captionSpecs(l).map(s=>s.sign.name));expect(now).toEqual(refineStandingCaptions(old,intended,l));assertNativeStandingCaptions(now,l);
  expect(now.tilesets.slice(0,-1)).toEqual(old.tilesets);expect(now.layers.filter((l:any)=>l.name.startsWith('standing-caption-'))).toHaveLength(6);
  for(const row of old.layers){const actual=now.layers.find((l:any)=>l.name===row.name);expect(actual).toEqual(row.name==='wayfinding-text'?{...row,objects:row.objects.filter((o:any)=>!names.has(o.name))}:row);}
  expect(Object.fromEntries(Object.entries(now).filter(([k])=>!['layers','tilesets','nextlayerid'].includes(k)))).toEqual(Object.fromEntries(Object.entries(old).filter(([k])=>!['layers','tilesets','nextlayerid'].includes(k))));
 });
}
it.each(['unknown-atlas','collision','offset','localid','textsignature'])('refuses %s forward-caption mutation',kind=>{const l=json('world/layouts/constellation-shore.json'),old=json('tests/fixtures/standing-captions/before-constellation-shore.tmj'),intended=buildMap(l,loadTileCatalog()).tmj,atlas=intended.tilesets.find(t=>t.name==='standing-captions')!,layer=intended.layers.find(l=>l.name.startsWith('standing-caption-'))as any;if(kind==='unknown-atlas')atlas.image='../assets/sponsors/demo-01.png';if(kind==='collision')atlas.tiles=[{id:0,properties:[{name:'collides',type:'bool',value:true}]}];if(kind==='offset')layer.offsetx=1;if(kind==='localid')layer.data[layer.data.findIndex(Boolean)]++;if(kind==='textsignature')old.layers.find((l:any)=>l.name==='wayfinding-text').objects[0].text.text='changed';expect(()=>refineStandingCaptions(old,intended,l)).toThrow();});
it.each([NaN,Infinity,0,-1])('rejects malformed standing caption size %s',fontSize=>{const spec=captionSpecs(json('world/layouts/constellation-shore.json'))[0];spec.sign.fontSize=fontSize;expect(()=>renderCaptionMaster([spec])).toThrow(/size/);});
it('enforces the approved six-row atlas rather than growing to512square',()=>{const spec=captionSpecs(json('world/layouts/constellation-shore.json'))[0];expect(()=>renderCaptionMaster(Array.from({length:7},(_,i)=>({...spec,map:'fixture',sign:{...spec.sign,name:`row-${i}`,text:'A',width:16}})))).toThrow(/512x192/);});

it('refuses stale caption PNG bytes in an isolated ordinary art fixture',()=>{
 const layout=json('world/layouts/constellation-shore.json'),cwd=process.cwd(),dir=mkdtempSync(join(tmpdir(),'varcamp-caption-'));
 try{for(const file of ['art/source/standing-captions.json','art/source/standing-captions.svg','art/source/hub-nameplates.json','tools/art/standing-captions.ts',CAPTION_IMAGE]){mkdirSync(join(dir,dirname(file)),{recursive:true});const bytes=readFileSync(file);writeFileSync(join(dir,file),file===CAPTION_IMAGE?Buffer.concat([bytes,Buffer.from([1])]):bytes);}process.chdir(dir);expect(()=>readStandingCaptions(layout)).toThrow(/artwork/);}finally{process.chdir(cwd);rmSync(dir,{recursive:true,force:true});}
});

it('keeps the public builder import synchronous for external CJS tools',()=>{const dir=mkdtempSync(join(tmpdir(),'caption-cjs-'));try{const file=join(dir,'probe.cts');writeFileSync(file,`const b=require(${JSON.stringify(resolve('tools/maps/builder.ts'))});console.log(typeof b.buildMap);`);const result=spawnSync(process.execPath,[resolve('node_modules/tsx/dist/cli.mjs'),file],{encoding:'utf8',timeout:10000});expect(result.status,result.stderr).toBe(0);expect(result.stdout.trim()).toBe('function');}finally{rmSync(dir,{recursive:true,force:true});}});
