import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,cpSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect,it } from 'vitest';

// Each CLI may cold-decode three sponsor PNGs (3 × 5 s); bound each process
// to 18 s and allow 40 s for both processes plus fixture setup and cleanup.
it('explicit author export refuses to erase native changes after its recorded export',()=>{
 const root=mkdtempSync(join(tmpdir(),'varcamp-author-guard-'));
 try{
  mkdirSync(join(root,'world/layouts'),{recursive:true});mkdirSync(join(root,'art'));cpSync('art/sources.json',join(root,'art/sources.json'));cpSync('assets',join(root,'assets'),{recursive:true});
  cpSync('world/layouts/overworld.json',join(root,'world/layouts/overworld.json'));
  const args=['--import',resolve('node_modules/tsx/dist/loader.mjs'),resolve('tools/maps/author.ts'),'--initialize'];
  let missing=false;try{execFileSync(process.execPath,args,{cwd:root,stdio:'pipe',timeout:18_000});}catch{missing=true;}
  expect(missing,'authored export is not available').toBe(false);
  const path=join(root,'maps/overworld.tmj'),value=JSON.parse(readFileSync(path,'utf8'));value.properties.push({name:'team-edit',type:'string',value:'keep'});const edited=JSON.stringify(value);writeFileSync(path,edited);
  expect(()=>execFileSync(process.execPath,args.slice(0,-1),{cwd:root,stdio:'pipe',timeout:18_000})).toThrow();
  expect(readFileSync(path,'utf8')).toBe(edited);
 }finally{rmSync(root,{recursive:true,force:true});}
},40_000);
