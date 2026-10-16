import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect,it } from 'vitest';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import type { MapLayout } from '../tools/maps/types';

// The parent build and CLI each may cold-decode three sponsor PNGs (3 × 5 s).
// Bound the CLI to 18 s and the complete fixture to 40 s including setup.
it('normal native build preserves later Tiled edits instead of repainting authored sources',()=>{
 const root=mkdtempSync(join(tmpdir(),'varcamp-native-edit-'));
 try{
  mkdirSync(join(root,'world/layouts'),{recursive:true});mkdirSync(join(root,'maps'));mkdirSync(join(root,'art'));
  cpSync('art/sources.json',join(root,'art/sources.json'));cpSync('assets',join(root,'assets'),{recursive:true});
  const l=JSON.parse(readFileSync('world/layouts/overworld.json','utf8')) as MapLayout;
  writeFileSync(join(root,'world/layouts/overworld.json'),JSON.stringify(l));
  const {tmj,wam}=buildMap(l,loadTileCatalog());
  tmj.properties!.push({name:'team-authored-note',type:'string',value:'Manual Tiled change must survive'});
  const bytes=JSON.stringify(tmj);writeFileSync(join(root,'maps/overworld.tmj'),bytes);writeFileSync(join(root,'maps/overworld.wam'),JSON.stringify(wam));
  execFileSync(process.execPath,['--import',resolve('node_modules/tsx/dist/loader.mjs'),resolve('tools/maps/build.ts')],{cwd:root,stdio:'pipe',timeout:18_000});
  expect(readFileSync(join(root,'maps/overworld.tmj'),'utf8')===bytes,'Manual Tiled change was overwritten').toBe(true);
  const preview=JSON.parse(readFileSync(join(root,'maps/preview/overworld.tmj'),'utf8'));
  expect(preview.properties.some((p:{name:string})=>p.name==='team-authored-note')).toBe(true);
  expect(preview.layers.some((l:{type:string})=>l.type==='imagelayer')).toBe(false);
  expect(preview.tilesets.filter((t:{image:string})=>t.image.includes('/sponsors/')).map((t:{image:string})=>t.image)).toEqual(['../../assets/sponsors/demo-01.png','../../assets/sponsors/demo-02.png','../../assets/sponsors/demo-03.png']);
 }finally{rmSync(root,{recursive:true,force:true});}
},40_000);
