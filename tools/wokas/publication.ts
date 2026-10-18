import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {SIGN_IDS} from '../../src/world/catalog';
import {inflateSync} from 'node:zlib';

const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function verifyNativePngStream(bytes:Buffer):Buffer{
 const invalid=()=>{throw Error('Zodiac Woka publication: corrupt PNG stream');};
 if(bytes.length>1024*1024)invalid();
 const compressed:Buffer[]=[];let offset=8,ended=false,idatEnded=false;
 while(offset<bytes.length){
  if(offset+12>bytes.length)invalid();
  const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),end=offset+12+length;
  if(end>bytes.length||!/^[A-Za-z]{4}$/.test(type))invalid();
  let crc=0xffffffff;for(let i=offset+4;i<end-4;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);
  if(((crc^0xffffffff)>>>0)!==bytes.readUInt32BE(end-4))invalid();
  if(offset===8&&type!=='IHDR'||offset!==8&&type==='IHDR')invalid();
  if(type==='IDAT'){if(idatEnded)invalid();compressed.push(bytes.subarray(offset+8,end-4));}
  else if(compressed.length)idatEnded=true;
  if(type==='IEND'){if(length!==0||end!==bytes.length||!compressed.length)invalid();ended=true;break;}
  if(!['IHDR','IDAT'].includes(type)&&type[0]===type[0].toUpperCase())invalid();
  offset=end;
 }
 if(!ended)invalid();
 let raw:Buffer;try{raw=inflateSync(Buffer.concat(compressed),{maxOutputLength:128*(96*4+1)});}catch{invalid();return Buffer.alloc(0);}
 if(raw.length!==128*(96*4+1))invalid();
 for(let row=0;row<128;row++)if(raw[row*(96*4+1)]>4)invalid();
 // PNG filters operate on bytes, with four bytes per RGBA pixel. Decode the
 // bounded raster so v2 binds actual pixels as well as the compressed body.
 const rgba=Buffer.alloc(96*128*4),stride=96*4;
 const paeth=(a:number,b:number,c:number)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<128;y++)for(let x=0;x<stride;x++){
  const filter=raw[y*(stride+1)],left=x>=4?rgba[y*stride+x-4]:0,up=y?rgba[(y-1)*stride+x]:0,corner=y&&x>=4?rgba[(y-1)*stride+x-4]:0;
  const predictor=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,corner);
  rgba[y*stride+x]=(raw[y*(stride+1)+1+x]+predictor)&255;
 }
 return rgba;
}

/** Validate the whole portable collection before returning any publishable body.
 * Binding the actual HTTPS host and adding the live catalog are separate operations.
 */
export function readZodiacWokaPublication(root = process.cwd()): {fileName:string;source:Buffer}[] {
 const directory='wokas/varcamp-zodiac-v1';
 const read=(file:string)=>readFileSync(resolve(root,'public',directory,file));
 const fail=(ok:unknown,message:string)=>{if(!ok)throw Error('Zodiac Woka publication: '+message);};
 const names=SIGN_IDS.flatMap(sign=>['male','female'].map(gender=>`${sign}-${gender}.png`));
 const expected=[...names,'manifest.json','collection.template.json','README.md'].sort();
 const roster=readdirSync(resolve(root,'public',directory),{withFileTypes:true});
 fail(roster.every(e=>e.isFile())&&isDeepStrictEqual(roster.map(e=>e.name).sort(),expected),'closed27-file collection changed');
 const manifestBytes=read('manifest.json'),manifest=JSON.parse(manifestBytes.toString());
 fail(manifest.version===1&&isDeepStrictEqual(manifest.format,{sheet:[96,128],frame:[32,32],rows:['down','left','right','up'],footBaseline:30,maxSubjectSize:28}),'native format changed');
 fail(Array.isArray(manifest.assets)&&manifest.assets.length===24,'exact24 native images required');
 const assets=new Map<string,Buffer>();
 for(const entry of manifest.assets){
  fail(typeof entry.file==='string'&&names.includes(entry.file)&&!assets.has(entry.file),'unknown/duplicate native image');
  const bytes=read(entry.file);
  fail(bytes.length===entry.bytes&&/^[a-f0-9]{64}$/.test(entry.sha256)&&createHash('sha256').update(bytes).digest('hex')===entry.sha256,`stale PNG ${entry.file}`);
  fail(bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.readUInt32BE(8)===13&&bytes.toString('ascii',12,16)==='IHDR'&&bytes.readUInt32BE(16)===96&&bytes.readUInt32BE(20)===128&&bytes[24]===8&&bytes[25]===6&&bytes[26]===0&&bytes[27]===0&&bytes[28]===0,`invalid native RGBA PNG ${entry.file}`);
  verifyNativePngStream(bytes);
  assets.set(entry.file,bytes);
 }
 fail(assets.size===24&&names.every(name=>assets.has(name)),'incomplete native image roster');
 const templateBytes=read('collection.template.json'),template=JSON.parse(templateBytes.toString());
 fail(template.version===1&&template.category==='woka'&&template.assetBaseUrl===null&&template.collection?.name==='VarCamp Zodiac 2026','unbound full-character collection required');
 const textures=template.collection.textures;
 fail(Array.isArray(textures)&&textures.length===24,'exact24 character bindings required');
 const ids=new Set<string>();
 for(const texture of textures){
  fail(typeof texture.file==='string'&&assets.has(texture.file)&&texture.id===`varcamp-zodiac-v1-${texture.file.slice(0,-4)}`&&!ids.has(texture.id)&&typeof texture.name==='string'&&texture.name.length>0&&!('url'in texture),'unknown/duplicate/bound character');
  ids.add(texture.id);
 }
 return [...names.map(name=>({fileName:`${directory}/${name}`,source:assets.get(name)!})),{fileName:`${directory}/manifest.json`,source:manifestBytes},{fileName:`${directory}/collection.template.json`,source:templateBytes},{fileName:`${directory}/README.md`,source:read('README.md')}];
}

/** The readable v2 epoch retains the existing24 platform identities. Its reviewed
 * manifest and source lineage are fixed; no live URLs are bound by publishing. */
export function readReadableZodiacWokaPublication(root=process.cwd()):{fileName:string;source:Buffer}[]{
 const directory='wokas/varcamp-zodiac-v2',read=(file:string)=>readFileSync(resolve(root,'public',directory,file));
 const fail=(ok:unknown,message:string)=>{if(!ok)throw Error('Zodiac Woka v2 publication: '+message);};
 const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
 const identities=SIGN_IDS.flatMap(sign=>['male','female'].map(gender=>({sign,gender,file:`${sign}-${gender}.png`,id:`varcamp-zodiac-v1-${sign}-${gender}`})));
 const expected=[...identities.map(a=>a.file),'manifest.json','collection.template.json','README.md'].sort();
 const roster=readdirSync(resolve(root,'public',directory),{withFileTypes:true});
 fail(roster.every(e=>e.isFile())&&isDeepStrictEqual(roster.map(e=>e.name).sort(),expected),'closed27-file collection changed');
 const manifestBytes=read('manifest.json'),manifest=JSON.parse(manifestBytes.toString());
 fail(manifest.version===2&&isDeepStrictEqual(manifest.format,{sheet:[96,128],frame:[32,32],rows:['down','left','right','up'],poseOrder:['stride-a','idle','stride-b'],footBaseline:30,walk:{rate:10,frames:[0,1,2,1]}}),'native format changed');
 const source={renderer:'tools/wokas/readable-v2.ts',sha256:'d67b952a814a358786c93853601c8706181582c8f386255a85f30a73a320a928',design:'art/source/wokas-readable-v2/native-design.json',designSha256:'cfb6fe9409a444a579d84f8e3ee85e357ee32d7258d73a58014a43c68d17424b',method:'original hand-authored native RGBA pixels; no cropped/rescaled generated walk sheets',license:'MIT'};
 fail(isDeepStrictEqual(manifest.source,source),'source lineage changed');
 fail(digest(readFileSync(resolve(root,source.renderer)))===source.sha256&&digest(readFileSync(resolve(root,source.design)))===source.designSha256,'source hash changed');
 fail(Array.isArray(manifest.assets)&&manifest.assets.length===24,'exact24 native bindings required');
 const files:{fileName:string;source:Buffer}[]=[];
 for(const[index,identity]of identities.entries()){
  const entry=manifest.assets[index];
  fail(entry&&isDeepStrictEqual(Object.keys(entry).sort(),['id','file','sign','gender','bytes','sha256','rgbaSha256'].sort())&&entry.id===identity.id&&entry.file===identity.file&&entry.sign===identity.sign&&entry.gender===identity.gender,'unknown/duplicate native binding');
  const bytes=read(identity.file);
  fail(Number.isSafeInteger(entry.bytes)&&bytes.length===entry.bytes&&/^[a-f0-9]{64}$/.test(entry.sha256)&&digest(bytes)===entry.sha256,`stale PNG ${identity.file}`);
  fail(bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.readUInt32BE(8)===13&&bytes.toString('ascii',12,16)==='IHDR'&&bytes.readUInt32BE(16)===96&&bytes.readUInt32BE(20)===128&&bytes[24]===8&&bytes[25]===6&&bytes[26]===0&&bytes[27]===0&&bytes[28]===0,`invalid native RGBA PNG ${identity.file}`);
  const rgba=verifyNativePngStream(bytes);
  fail(/^[a-f0-9]{64}$/.test(entry.rgbaSha256)&&digest(rgba)===entry.rgbaSha256,`RGBA raster changed ${identity.file}`);
  files.push({fileName:`${directory}/${identity.file}`,source:bytes});
 }
 const templateBytes=read('collection.template.json'),template=JSON.parse(templateBytes.toString());
 const textures=identities.map(({sign,gender,file,id})=>({id,name:`${sign[0].toUpperCase()+sign.slice(1)} · ${gender[0].toUpperCase()+gender.slice(1)}`,file}));
 fail(isDeepStrictEqual(template,{version:1,category:'woka',assetBaseUrl:null,collection:{name:'VarCamp Zodiac 2026',textures}}),'unbound exact full-character collection required');
 fail(digest(manifestBytes)==='64e68770c18f964e582d842a46fa695213efe5dd727b0894998aacb3624d5a49','reviewed manifest changed');
 return[...files,{fileName:`${directory}/manifest.json`,source:manifestBytes},{fileName:`${directory}/collection.template.json`,source:templateBytes},{fileName:`${directory}/README.md`,source:read('README.md')}];
}
