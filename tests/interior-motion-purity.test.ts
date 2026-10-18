import {readFileSync,writeFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
vi.mock('node:fs',async original=>({...await original<typeof import('node:fs')>(),writeFileSync:vi.fn(()=>{throw Error('unexpected write during pure rendering');})}));
it('imports and renders every interior motion artifact without any filesystem writes',async()=>{
 const module=await import('../tools/art/interior-reference-motion');
 expect(writeFileSync).not.toHaveBeenCalled();
 expect(module.renderInteriorReferenceMotion).toBeTypeOf('function');
 const result=await module.renderInteriorReferenceMotion();
 expect(result.layouts.size).toBe(14);expect(result.records).toHaveLength(46);
 expect(result.artifacts.size).toBe(52);
 for(const[path,bytes]of result.artifacts){
  if(path.endsWith('.png'))expect(bytes,`${path}: refactor changed native artwork`).toEqual(readFileSync(path));
  else expect(()=>JSON.parse(bytes.toString())).not.toThrow();
 }
 expect(writeFileSync).not.toHaveBeenCalled();
});
