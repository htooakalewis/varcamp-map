import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,cpSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve,dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect,it } from 'vitest';
import type { MapLayout } from '../tools/maps/types';

// Each CLI may cold-decode three sponsor PNGs (3 × 5 s); bound each process
// to 18 s and allow 40 s for both processes plus fixture setup and cleanup.
it('explicit author export refuses to erase native changes after its recorded export',()=>{
 const root=mkdtempSync(join(tmpdir(),'varcamp-author-guard-'));
 try{
  mkdirSync(join(root,'world/layouts'),{recursive:true});mkdirSync(join(root,'art'));cpSync('art/sources.json',join(root,'art/sources.json'));cpSync('assets',join(root,'assets'),{recursive:true});
  cpSync('world/layouts/overworld.json',join(root,'world/layouts/overworld.json'));
  // The overworld's expo booth nameplates compile through its own caption family (descriptor, SVG master, glyph font and producer).
  for(const file of ['art/source/expo-captions.json','art/source/expo-captions.svg','art/source/hub-nameplates.json','tools/art/standing-captions.ts']){mkdirSync(dirname(join(root,file)),{recursive:true});cpSync(file,join(root,file));}
  const layout=JSON.parse(readFileSync('world/layouts/overworld.json','utf8')) as MapLayout;
  // The isolated authoring directory owns every file the overlay receipt validates.
  for(const overlay of layout.animatedOverlays??[])if(overlay.provenance){
   for(const file of [overlay.provenance.metadataPath,...overlay.provenance.inputs.map(input=>input.path)]){
    mkdirSync(dirname(join(root,file)),{recursive:true});cpSync(file,join(root,file));
   }
  }
  const args=['--import',resolve('node_modules/tsx/dist/loader.mjs'),resolve('tools/maps/author.ts'),'--initialize'];
  const initialized=execFileSync(process.execPath,args,{cwd:root,stdio:'pipe',encoding:'utf8',timeout:18_000});
  expect(initialized).toContain('Authored 1 native TMJ/WAM pairs');
  const path=join(root,'maps/overworld.tmj'),value=JSON.parse(readFileSync(path,'utf8'));value.properties.push({name:'team-edit',type:'string',value:'keep'});const edited=JSON.stringify(value);writeFileSync(path,edited);
  expect(()=>execFileSync(process.execPath,args.slice(0,-1),{cwd:root,stdio:'pipe',timeout:18_000})).toThrow(/Native Tiled\/WAM edit would be overwritten/);
  expect(readFileSync(path,'utf8')).toBe(edited);
 }finally{rmSync(root,{recursive:true,force:true});}
},40_000);
