import{stageCurrentWorldInputs}from'./helpers/current-interior-fixture';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect,it } from 'vitest';

// The parent build and CLI each may cold-decode three sponsor PNGs (3 × 5 s).
// Bound the CLI to 18 s and the complete fixture to 40 s including setup.
it('normal native build preserves later Tiled edits instead of repainting authored sources',()=>{
 const root=mkdtempSync(join(tmpdir(),'varcamp-native-edit-'));
 try{
  stageCurrentWorldInputs(process.cwd(),root);
  const tmj=JSON.parse(readFileSync(join(root,'maps/overworld.tmj'),'utf8'));
  tmj.properties.push({name:'team-authored-note',type:'string',value:'Manual Tiled change must survive'});
  const bytes=JSON.stringify(tmj);writeFileSync(join(root,'maps/overworld.tmj'),bytes);
  const sourceBodies=new Map(readdirSync(join(root,'maps')).filter(p=>/\.(tmj|wam)$/.test(p)).map(p=>[p,readFileSync(join(root,'maps',p))]));expect(sourceBodies.size).toBe(68);
  execFileSync(process.execPath,['--import',resolve('node_modules/tsx/dist/loader.mjs'),resolve('tools/maps/build.ts')],{cwd:root,stdio:'pipe',timeout:18_000});
  for(const[path,body]of sourceBodies)expect(readFileSync(join(root,'maps',path)).equals(body),path+' native source changed').toBe(true);
  expect(readFileSync(join(root,'maps/overworld.tmj'),'utf8')===bytes,'Manual Tiled change was overwritten').toBe(true);
  const preview=JSON.parse(readFileSync(join(root,'maps/preview/overworld.tmj'),'utf8'));
  expect(preview.properties.some((p:{name:string})=>p.name==='team-authored-note')).toBe(true);
  expect(preview.layers.some((l:{type:string})=>l.type==='imagelayer')).toBe(false);
  // Every layout image is a preview sponsor atlas; the registered arrival panels keep their historical reservation order and the expo booth marks are admitted after the fleet, so the roster is compared, not the order.
  const sponsorImages=preview.tilesets.filter((t:{image:string})=>t.image.includes('/sponsors/')).map((t:{image:string})=>t.image).sort();
  expect(sponsorImages).toEqual(tmj.tilesets.filter((t:{image:string})=>t.image.includes('/sponsors/')).map((t:{image:string})=>'../'+t.image).sort());
  for(const image of JSON.parse(readFileSync('world/layouts/overworld.json','utf8')).images as {image:string}[])expect(sponsorImages).toContain('../../'+image.image);
  expect(sponsorImages).toContain('../../assets/sponsors/varcamp-2026.png'); // historical reservation stays even after its paint retires
 }finally{rmSync(root,{recursive:true,force:true});}
},40_000);
