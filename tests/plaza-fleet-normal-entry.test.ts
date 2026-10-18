import {expect,it,vi} from 'vitest';
// Exercise the real normal entry with an opted-out source registry. Every
// other physical art input remains the actual candidate body.
vi.mock('node:fs',async original=>{
 const fs=await original<typeof import('node:fs')>();
 return{...fs,readFileSync:(path:unknown,...args:unknown[])=>{
  const bytes=Reflect.apply(fs.readFileSync,fs,[path,...args]);
  if(path!=='art/sources.json')return bytes;
  const sources=JSON.parse(String(bytes));
  sources['plaza-original-drones'].files=sources['plaza-original-drones'].files.filter((f:{path:string})=>!f.path.includes('plaza-fleet'));
  return typeof bytes==='string'?JSON.stringify(sources):Buffer.from(JSON.stringify(sources));
 }};
});
import {checkArt} from '../tools/art/check';

it('normal art validation requires the new fleet family even when every registry row is absent',async()=>{
 const errors=await checkArt();
 expect(errors.some(e=>/Fleet.*required registration/.test(e))).toBe(true);
},60000);
