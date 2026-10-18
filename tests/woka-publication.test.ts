import {cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {afterEach,beforeEach,expect,it} from 'vitest';
import {readZodiacWokaPublication} from '../tools/wokas/publication';

const assetRoot='public/wokas/varcamp-zodiac-v1';
let root:string;
const at=(name:string)=>resolve(root,assetRoot,name);
const json=(name:string)=>JSON.parse(readFileSync(at(name),'utf8'));
beforeEach(()=>{root=mkdtempSync(resolve(tmpdir(),'varcamp-woka-publication-'));cpSync(assetRoot,resolve(root,assetRoot),{recursive:true});});
afterEach(()=>rmSync(root,{recursive:true,force:true}));
it('publishes all24 exact native PNGs and portable metadata at stable versioned paths',()=>{
 const files=readZodiacWokaPublication(root);expect(files).toHaveLength(27);
 expect(files.filter(f=>f.fileName.endsWith('.png'))).toHaveLength(24);
 for(const f of files){expect(f.fileName).toMatch(/^wokas\/varcamp-zodiac-v1\/[a-zA-Z0-9.-]+$/);expect(f.source).toEqual(readFileSync(at(f.fileName.split('/').at(-1)!)));}
 expect(files.some(f=>f.fileName.endsWith('/collection.template.json'))).toBe(true);
});
it.each(['missing','extra','stale','bad-native-format','truncated-png','corrupt-idat','duplicate-id','bound-template'])('refuses %s before any caller emits bytes',(mode)=>{
 if(mode==='missing')unlinkSync(at('aries-male.png'));
 if(mode==='extra')writeFileSync(at('unreviewed.png'),'extra');
 if(mode==='stale')writeFileSync(at('aries-male.png'),Buffer.from('wrong-body'));
 if(['bad-native-format','truncated-png','corrupt-idat'].includes(mode)){
  let bytes=readFileSync(at('aries-male.png'));
  if(mode==='bad-native-format')bytes.writeUInt32BE(95,16);
  if(mode==='truncated-png')bytes=bytes.subarray(0,bytes.length-20);
  if(mode==='corrupt-idat')bytes[100]^=255;
  writeFileSync(at('aries-male.png'),bytes);
  const manifest=json('manifest.json'),entry=manifest.assets.find((a:{file:string})=>a.file==='aries-male.png');entry.bytes=bytes.length;entry.sha256=createHash('sha256').update(bytes).digest('hex');writeFileSync(at('manifest.json'),JSON.stringify(manifest));
 }
 if(mode==='duplicate-id'||mode==='bound-template'){
  const template=json('collection.template.json');
  if(mode==='duplicate-id')template.collection.textures[1].id=template.collection.textures[0].id;
  else template.assetBaseUrl='https://example.com/';
  writeFileSync(at('collection.template.json'),JSON.stringify(template));
 }
 expect(()=>readZodiacWokaPublication(root)).toThrow();
});
