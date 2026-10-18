import{cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync,symlinkSync,existsSync}from'node:fs';
import{resolve}from'node:path';
import{tmpdir}from'node:os';
import{createHash}from'node:crypto';
import{spawnSync}from'node:child_process';
import{beforeAll,beforeEach,afterEach,afterAll,expect,it}from'vitest';
import sharp from'sharp';
import{checkArt}from'../tools/art/check';
import{checkWorldAmbientArt}from'../tools/art/world-ambient-check';
import{renderRoadster}from'../tools/art/roadster';
import{renderCoastalFlight}from'../tools/art/coastal-flight';
import{renderPlazaIdentity}from'../tools/art/plaza-generated';
import{renderPlazaGarden}from'../tools/art/plaza-garden';
import{renderPlazaBuildings,renderPlazaGrass}from'../tools/art/plaza-buildings';
import{renderPlazaPots}from'../tools/art/plaza-pots';
import{renderPlazaDrones}from'../tools/art/plaza-drones';
import{renderCoastLifeAssets}from'../tools/art/coast-life-assets';
import{renderCoastLife}from'../tools/art/coast-life';
import{renderInteriorReferenceMotion}from'../tools/art/interior-reference-motion';
import{renderWorldAmbientAssets}from'../tools/art/world-ambient-assets';
import{renderWorldAmbient}from'../tools/art/world-ambient';
const project=process.cwd(),sha=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const stable=(v:any):any=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=(v:unknown)=>sha(JSON.stringify(stable(v))),read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
let fixture:string;const originals=new Map<string,Buffer>();
beforeAll(()=>{fixture=mkdtempSync(resolve(tmpdir(),'varcamp-ambient-art-check-'));for(const dir of ['art','assets','world','tools','tests/fixtures'])cpSync(resolve(project,dir),resolve(fixture,dir),{recursive:true});symlinkSync(resolve(project,'node_modules'),resolve(fixture,'node_modules'),'dir');});
beforeEach(()=>process.chdir(fixture));
afterEach(()=>{for(const[path,bytes]of originals)writeFileSync(path,bytes);originals.clear();process.chdir(project);});
afterAll(()=>{process.chdir(project);rmSync(fixture,{recursive:true,force:true});});
const remember=(p:string)=>{if(!originals.has(p))originals.set(p,readFileSync(p));};
function refreshRegistry(path:string){remember('art/sources.json');const source=read('art/sources.json'),row=source.original.files.find((r:any)=>r.path===path),value={path,sha256:sha(readFileSync(path))};if(row)Object.assign(row,value);else source.original.files.push(value);writeFileSync('art/sources.json',JSON.stringify(source,null,2)+'\n');}
async function corruptPng(path:string){remember(path);const{data,info}=await sharp(readFileSync(path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});const i=data.findIndex((_,i)=>i%4===3&&data[i]>0)-3;if(i<0)throw Error('Expected actual painted PNG');data[i]=(data[i]+1)%256;writeFileSync(path,await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer());refreshRegistry(path);}
async function expectProducerFailure(path:string){const bytes=readFileSync(path),errors=await checkWorldAmbientArt();expect(errors.some(e=>e.includes('world-ambient:')&&e.includes(path)),errors.join('\n')).toBe(true);expect(readFileSync(path).equals(bytes)).toBe(true);}

it('retains the exact independently reviewed126-path registration epoch and its original70-row oracle',()=>{
 const raw=readFileSync('tests/fixtures/ambient-art-publication/source-registry-before-aerial.json');expect(sha(raw)).toBe('bb557c5266bfd5b082119616918125e206f0514b3fa73a6e8e2d2f18de488d41');const source=JSON.parse(raw.toString()),{original,...other}=source,{files,...originalMetadata}=original;
 expect(digest({other,originalMetadata})).toBe('746cd49c975ddbcaf4fe23df14130dcfc104a955fd7c235d83c0c1aa36944c1a');
 const oldPins:Record<string,string>={'art/source/rolling-breaker-east.json':'9d0e357b78e684827d73633c8c96e3594a75bc9e3817dba15108cff924326bc1','art/source/rolling-breaker-west.json':'7ed945c5006eee8c03bd6dc874afb30c0741e38d6381b7eea629a8465196e4ab','art/source/rolling-breaker.json':'669b168b595c8f89dd686e6f8b851a4df7e26edd77862ec7270066fb1e5c71e6','art/source/ship-interior.json':'835b51dc4aeea4eea269107639064370ef7f24aef27b90ffa8030a1432fd69b5'};
 expect(digest(files.slice(0,70).map((r:any)=>oldPins[r.path]?{...r,sha256:oldPins[r.path]}:r))).toBe('57ad0e57c9aa182d966e3e5215bc9d940d21cc6499d60a2aa84203540ffc40b1');
 const added=files.slice(70);expect(added).toHaveLength(126);expect(new Set(files.map((r:any)=>r.path)).size).toBe(196);expect(added.every((r:any)=>r.path.includes('world-ambient-')||r.path==='art/source/world-ambient.json')).toBe(true);
 expect(added.some((r:any)=>/native-ownership-context|layer-ownership|world-ambient-plants\.json/.test(r.path))).toBe(false);
 expect(added.some((r:any)=>r.path==='assets/tilesets/original/world-ambient-plants.png')).toBe(true);
});
/** Descriptor authority comes from actual pure producer outputs, never a JSON
 * prefix, current source-registry contents or a caller acceptance flag. */
async function generatedDescriptors():Promise<Map<string,unknown>>{
 const outputs=new Map<string,unknown>();const add=(path:string,value:unknown)=>{if(outputs.has(path))throw Error('Duplicate native descriptor owner: '+path);outputs.set(path,value);};
 add('art/source/roadster.json',(await renderRoadster()).metadata);add('art/source/coastal-flight.json',(await renderCoastalFlight()).metadata);
 add('art/source/plaza-generated.json',(await renderPlazaIdentity()).metadata);add('art/source/plaza-garden.json',(await renderPlazaGarden()).metadata);
 add('art/source/plaza-buildings.json',(await renderPlazaBuildings()).metadata);add('art/source/plaza-grass.json',(await renderPlazaGrass()).metadata);add('art/source/plaza-pots.json',(await renderPlazaPots()).metadata);
 const drones=await renderPlazaDrones();add('art/source/plaza-drones.json',drones.metadata);for(const r of drones.resources)add(r.metadataPath,{version:1,source:drones.metadata.source,overlay:r.overlay,diagnostics:r.diagnostics});
 add('art/source/coast-life-assets.json',(await renderCoastLifeAssets()).metadata);for(const r of await renderCoastLife())add(r.overlay.provenance!.metadataPath,r.metadata);
 const interior=await renderInteriorReferenceMotion();for(const[path,body]of interior.artifacts)if(path.endsWith('.json'))add(path,JSON.parse(body.toString()));
 add('art/source/world-ambient-assets.json',(await renderWorldAmbientAssets()).metadata);for(const r of await renderWorldAmbient())add(r.overlay.provenance!.metadataPath,r.metadata);
 return outputs;
}
it('binds every current registry path and preserves static artwork while validating genuine generated descriptors',async()=>{
 const before=read('tests/fixtures/ambient-art-publication/source-registry-before-aerial.json'),current=read('art/sources.json');
 const{original:beforeOriginal,...beforeOther}=before,{original:currentOriginal,...currentOther}=current,{files:beforeFiles,...beforeMetadata}=beforeOriginal,{files:currentFiles,...currentMetadata}=currentOriginal;
 expect(currentOther).toEqual(beforeOther);expect(currentMetadata).toEqual(beforeMetadata);expect(currentFiles.map((r:any)=>r.path)).toEqual(beforeFiles.map((r:any)=>r.path));expect(currentFiles).toHaveLength(196);
 const generated=await generatedDescriptors(),reviewedRecipeDeltas:Record<string,string>={'art/source/coast-life-tracks.json':'f14d2a1703e20f072da35c9b80aec50df830007b6661d4d538045d65f08f150d','art/source/world-ambient.json':'c4c7651c3b7e31d7e5762ee0ede695209080ee9d76ed8f9ce27a44d404a596ad'};
 for(let i=0;i<currentFiles.length;i++){
  const row=currentFiles[i],old=beforeFiles[i],bytes=readFileSync(row.path);expect(Object.keys(row).sort()).toEqual(Object.keys(old).sort());expect(row.sha256,row.path+' actual registered bytes').toBe(sha(bytes));
  if(generated.has(row.path))expect(JSON.parse(bytes.toString()),row.path+' genuine current producer').toEqual(generated.get(row.path));
  else if(Object.hasOwn(reviewedRecipeDeltas,row.path))expect(row.sha256,row.path+' exact separately reviewed recipe').toBe(reviewedRecipeDeltas[row.path]);
  else expect(row,row.path+' unchanged static/master/source').toEqual(old);
 }
},30000);
it('normal art check accepts the actual closed ambient publication without repairing any output',async()=>{const before=readFileSync('assets/tilesets/original/world-ambient-plants.png');expect(await checkArt()).toEqual([]);expect(readFileSync('assets/tilesets/original/world-ambient-plants.png').equals(before)).toBe(true);},30000);
it.each(['assets/tilesets/original/world-ambient-plants.png','art/source/world-ambient-lamp-poses.png','assets/tilesets/original/world-ambient-fa-ship-interior-steam-1.png','art/source/world-ambient-fa-ship-interior-steam-1-poses.png','art/source/world-ambient-fa-ship-interior-steam-1-upper-poses.png'])('rejects coherent registry hash refresh over corrupted native/source PNG %s',async path=>{await corruptPng(path);await expectProducerFailure(path);},30000);
it.each(['art/source/world-ambient-assets.json','art/source/world-ambient-fa-ship-interior-steam-1.json'])('rejects complete metadata drift despite matching registry hash %s',async path=>{remember(path);const data=read(path);data.unregisteredMetadata='not the producer';writeFileSync(path,JSON.stringify(data,null,2)+'\n');refreshRegistry(path);await expectProducerFailure(path);},30000);
it('rejects a removed logical recipe instead of validating only remaining output',async()=>{const path='art/source/world-ambient.json';remember(path);const data=read(path);data.maps[0].effects=[];writeFileSync(path,JSON.stringify(data,null,2)+'\n');refreshRegistry(path);const errors=await checkWorldAmbientArt();expect(errors.some(e=>/world-ambient:.*closed/.test(e)),errors.join('\n')).toBe(true);},30000);
it('rejects a missing approved master instead of making ambient checks optional',async()=>{const path='art/source/world-ambient-fx-master.png';remember(path);rmSync(path);const errors=await checkWorldAmbientArt();expect(errors.some(e=>e.includes('world-ambient:')&&e.includes(path)),errors.join('\n')).toBe(true);expect(existsSync(path)).toBe(false);},30000);
it('rejects a missing publication registry row even while every produced byte remains correct',async()=>{remember('art/sources.json');const source=read('art/sources.json'),path='assets/tilesets/original/world-ambient-fa-ship-interior-steam-1.png';source.original.files=source.original.files.filter((r:any)=>r.path!==path);writeFileSync('art/sources.json',JSON.stringify(source,null,2)+'\n');const errors=await checkWorldAmbientArt();expect(errors.some(e=>e.includes('world-ambient:')&&e.includes(path)&&e.includes('registration')),errors.join('\n')).toBe(true);},30000);
it('actual normal CLI rejects omitted layout overlays without modifying the descriptor',()=>{const path='world/layouts/moon-cafe.json';remember(path);const layout=read(path);layout.animatedOverlays=layout.animatedOverlays.filter((o:any)=>!o.name.startsWith('world-ambient-'));writeFileSync(path,JSON.stringify(layout,null,2)+'\n');const before=readFileSync(path);const result=spawnSync(process.execPath,['--import','tsx',resolve(project,'tools/art/check.ts')],{cwd:fixture,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});expect(result.status).not.toBe(0);expect(result.stderr).toContain(`world-ambient: ${path}`);expect(readFileSync(path).equals(before)).toBe(true);},30000);
