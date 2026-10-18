import {expect,it}from'vitest';
import {build}from'vite';
import {assertSelfContainedController}from'../tools/release';
it('normal release emits the entire actual controller in one attested default.run artifact without transitive imports',async()=>{
 const result=await build({configFile:'buildmap.vite.config.ts',logLevel:'silent',build:{write:false,emptyOutDir:false}});const outputs=Array.isArray(result)?result:[result];const files=outputs.flatMap(x=>'output'in x?x.output:[]);const controller=files.find(x=>x.fileName==='bots/lyra.js');expect(controller).toBeDefined();if(!controller)throw Error('Missing actual controller');const code=controller.type==='chunk'?controller.code:typeof controller.source==='string'?controller.source:Buffer.from(controller.source).toString('utf8');assertSelfContainedController(code);const module=await import(/* @vite-ignore */'data:text/javascript;base64,'+Buffer.from(code).toString('base64'));expect(Object.keys(module).sort()).toEqual(['default','writeDiagnostic']);expect(typeof module.writeDiagnostic).toBe('function');expect(Object.keys(module.default)).toEqual(['run']);expect(typeof module.default.run).toBe('function');expect(files.some(x=>x.fileName==='src/guides/index.html')).toBe(true);
},30000);

it('rejects controller external/dynamic imports and wrong default contracts before emission',()=>{
 const diagnostic='function writeDiagnostic(){}';
 for(const code of ['import x from "external";export default {run(){}}','export default {run:()=>import("external")}','export default {stop(){}}','export default {run:7}','export default {run(){},extra:1}','export const other=1;export default {run(){}}'])expect(()=>assertSelfContainedController(diagnostic+code+';export {writeDiagnostic};')).toThrow(/controller/i);
 expect(()=>assertSelfContainedController('const entry={run:async function(){}};function diagnostic(){}export {entry as default,diagnostic as writeDiagnostic};')).not.toThrow();
});
