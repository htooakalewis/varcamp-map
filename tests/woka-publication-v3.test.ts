import {cpSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {afterEach,beforeEach,expect,it} from 'vitest';
import {readPixelZodiacWokaPublication} from '../tools/wokas/publication-v3';
const assetRoot='public/wokas/varcamp-zodiac-v3';let root:string;
const at=(name:string)=>resolve(root,assetRoot,name),sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const json=(name:string)=>JSON.parse(readFileSync(at(name),'utf8'));
const save=(name:string,value:unknown)=>writeFileSync(at(name),JSON.stringify(value));
const read=()=>readPixelZodiacWokaPublication(root);
beforeEach(()=>{root=mkdtempSync(resolve(tmpdir(),'varcamp-pixel-v3-publication-'));cpSync(assetRoot,resolve(root,assetRoot),{recursive:true});for(const file of ['tools/wokas/pixel-v3.ts','art/source/wokas-pixel-v3/native-design.json']){mkdirSync(dirname(resolve(root,file)),{recursive:true});cpSync(file,resolve(root,file));}});
afterEach(()=>rmSync(root,{recursive:true,force:true}));
it('publishes exactly 27 v3 bodies at stable paths with the existing 24 character IDs',()=>{
 const files=read();expect(files.map(f=>f.fileName).sort()).toEqual(readdirSync(at('.')).map(name=>`wokas/varcamp-zodiac-v3/${name}`).sort());expect(files).toHaveLength(27);
 for(const file of files){expect(Buffer.isBuffer(file.source)).toBe(true);expect(file.source.equals(readFileSync(resolve(root,'public',file.fileName)))).toBe(true);}
 expect(json('manifest.json').assets.map((a:{id:string})=>a.id)).toEqual(json('collection.template.json').collection.textures.map((a:{id:string})=>a.id));
 expect(json('manifest.json').assets.every((a:{id:string})=>a.id.startsWith('varcamp-zodiac-v1-'))).toBe(true);
});
it.each(['missing','extra','stale','format','duplicate-asset','misbound-sign','misbound-id','source-renderer','source-design','source-path','rgba','template-id','template-bound','template-extra','status'])('refuses %s v3 input with its own causal error',mode=>{
 let cause:RegExp=/Zodiac Woka v3/;
 if(mode==='missing'){unlinkSync(at('aries-male.png'));cause=/closed27/;}
 if(mode==='extra'){writeFileSync(at('unreviewed.png'),'extra');cause=/closed27/;}
 if(mode==='stale'){writeFileSync(at('aries-male.png'),'stale');cause=/stale PNG/;}
 if(mode==='source-renderer'||mode==='source-design'){writeFileSync(resolve(root,mode==='source-renderer'?'tools/wokas/pixel-v3.ts':'art/source/wokas-pixel-v3/native-design.json'),'changed');cause=/source hash/;}
 if(['format','duplicate-asset','misbound-sign','misbound-id','rgba','status','source-path'].includes(mode)){
  const m=json('manifest.json');if(mode==='format')m.format.poseOrder.reverse();if(mode==='duplicate-asset')m.assets[1]=m.assets[0];if(mode==='misbound-sign')m.assets[0].sign='libra';if(mode==='misbound-id')m.assets[0].id='varcamp-zodiac-v3-aries-male';if(mode==='rgba')m.assets[0].rgbaSha256='0'.repeat(64);if(mode==='status')m.status='LIVE';if(mode==='source-path')m.source.renderer='tools/wokas/readable-v2.ts';save('manifest.json',m);
  cause=mode==='format'?/native format/:mode==='rgba'?/RGBA/:mode==='status'?/reviewed manifest/:mode==='source-path'?/source lineage/:/binding/;
 }
 if(mode.startsWith('template-')){const t=json('collection.template.json');if(mode==='template-id')t.collection.textures[0].id='wrong';if(mode==='template-bound')t.assetBaseUrl='https://example.com';if(mode==='template-extra')t.extra=true;save('collection.template.json',t);cause=/unbound.*collection/;}
 expect(()=>read()).toThrow(cause);
});
// Mutate CRC-valid native streams and repin only their local manifest rows:
// failures must come from bounded PNG/RGBA verification, not a stale outer hash.
const table=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function chunk(type:string,data:Buffer){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);let crc=0xffffffff;for(const v of b.subarray(4,-4))crc=table[(crc^v)&255]^(crc>>>8);b.writeUInt32BE((crc^0xffffffff)>>>0,b.length-4);return b;}
it.each(['truncated','bad-crc','bad-filter','oversized-inflate','rgba-pixel'])('rejects %s even when the PNG file digest is recomputed',mode=>{
 let bytes=readFileSync(at('aries-male.png')),cause=/corrupt PNG/;
 if(mode==='truncated')bytes=bytes.subarray(0,-10);
 if(mode==='bad-crc')bytes[100]^=255;
 if(['bad-filter','oversized-inflate','rgba-pixel'].includes(mode)){
  const raw=Buffer.alloc(128*(96*4+1)+(mode==='oversized-inflate'?1:0));if(mode==='bad-filter')raw[0]=5;if(mode==='rgba-pixel'){raw[4]=255;cause=/RGBA/;}
  bytes=Buffer.concat([bytes.subarray(0,33),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
 }
 writeFileSync(at('aries-male.png'),bytes);const m=json('manifest.json');m.assets[0].bytes=bytes.length;m.assets[0].sha256=sha(bytes);save('manifest.json',m);expect(()=>read()).toThrow(cause);
});
