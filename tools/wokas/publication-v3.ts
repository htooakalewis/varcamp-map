import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {inflateSync} from 'node:zlib';
import {SIGN_IDS} from '../../src/world/catalog';

/** Bounded decode of a 96x128 8-bit RGBA, non-interlaced PNG into raw RGBA. */
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function decodeNativePng(bytes:Buffer):Buffer{
 const invalid=():never=>{throw Error('Zodiac Woka v3 publication: corrupt PNG stream');};
 if(bytes.length>1024*1024||bytes.length<33||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))invalid();
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
 const stride=96*4;let raw=Buffer.alloc(0);
 try{raw=inflateSync(Buffer.concat(compressed),{maxOutputLength:128*(stride+1)});}catch{invalid();}
 if(raw.length!==128*(stride+1))invalid();
 const rgba=Buffer.alloc(128*stride);
 const paeth=(a:number,b:number,c:number)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<128;y++){
  const filter=raw[y*(stride+1)];if(filter>4)invalid();
  for(let x=0;x<stride;x++){
   const left=x>=4?rgba[y*stride+x-4]:0,up=y?rgba[(y-1)*stride+x]:0,corner=y&&x>=4?rgba[(y-1)*stride+x-4]:0;
   const predictor=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,corner);
   rgba[y*stride+x]=(raw[y*(stride+1)+1+x]+predictor)&255;
  }
 }
 return rgba;
}

export const PIXEL_V3_SOURCE={renderer:'tools/wokas/pixel-v3.ts',design:'art/source/wokas-pixel-v3/native-design.json',method:'original hand-authored native RGBA pixel templates; no stock, generated or rescaled sprite pixels',license:'MIT'} as const;

/** The pixel v3 epoch keeps the existing 24 platform identities (varcamp-zodiac-v1-*)
 * and only moves resource URLs to wokas/varcamp-zodiac-v3. The manifest binds every
 * PNG body and decoded RGBA raster to the renderer and design that produced them.
 * Publishing this package binds no live URL and changes no live catalog. */
export function readPixelZodiacWokaPublication(root=process.cwd()):{fileName:string;source:Buffer}[]{
 const directory='wokas/varcamp-zodiac-v3',read=(file:string)=>readFileSync(resolve(root,'public',directory,file));
 const fail=(ok:unknown,message:string)=>{if(!ok)throw Error('Zodiac Woka v3 publication: '+message);};
 const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
 const identities=SIGN_IDS.flatMap(sign=>['male','female'].map(gender=>({sign,gender,file:`${sign}-${gender}.png`,id:`varcamp-zodiac-v1-${sign}-${gender}`})));
 const expected=[...identities.map(a=>a.file),'manifest.json','collection.template.json','README.md'].sort();
 const roster=readdirSync(resolve(root,'public',directory),{withFileTypes:true});
 fail(roster.every(e=>e.isFile())&&isDeepStrictEqual(roster.map(e=>e.name).sort(),expected),'closed27-file collection changed');
 const manifestBytes=read('manifest.json'),manifest=JSON.parse(manifestBytes.toString());
 fail(manifest.version===3&&manifest.status==='SOURCE_PACKAGE_NOT_LIVE_SELECTION','reviewed manifest required');
 fail(isDeepStrictEqual(manifest.format,{sheet:[96,128],frame:[32,32],rows:['down','left','right','up'],poseOrder:['stride-a','idle','stride-b'],footBaseline:30,walk:{rate:10,frames:[0,1,2,1]}}),'native format changed');
 const source=manifest.source??{};
 fail(source.renderer===PIXEL_V3_SOURCE.renderer&&source.design===PIXEL_V3_SOURCE.design&&source.method===PIXEL_V3_SOURCE.method&&source.license===PIXEL_V3_SOURCE.license&&isDeepStrictEqual(Object.keys(source).sort(),['design','designSha256','license','method','renderer','sha256']),'source lineage changed');
 fail(digest(readFileSync(resolve(root,source.renderer)))===source.sha256&&digest(readFileSync(resolve(root,source.design)))===source.designSha256,'source hash changed');
 fail(Array.isArray(manifest.assets)&&manifest.assets.length===24,'exact24 native bindings required');
 const files:{fileName:string;source:Buffer}[]=[];
 for(const[index,identity]of identities.entries()){
  const entry=manifest.assets[index];
  fail(entry&&isDeepStrictEqual(Object.keys(entry).sort(),['bytes','file','gender','id','rgbaSha256','sha256','sign'])&&entry.id===identity.id&&entry.file===identity.file&&entry.sign===identity.sign&&entry.gender===identity.gender,'unknown/duplicate native binding');
  const bytes=read(identity.file);
  fail(Number.isSafeInteger(entry.bytes)&&bytes.length===entry.bytes&&/^[a-f0-9]{64}$/.test(entry.sha256)&&digest(bytes)===entry.sha256,`stale PNG ${identity.file}`);
  fail(bytes.length>=33&&bytes.readUInt32BE(8)===13&&bytes.toString('ascii',12,16)==='IHDR'&&bytes.readUInt32BE(16)===96&&bytes.readUInt32BE(20)===128&&bytes[24]===8&&bytes[25]===6&&bytes[26]===0&&bytes[27]===0&&bytes[28]===0,`invalid native RGBA PNG ${identity.file}`);
  const rgba=decodeNativePng(bytes);
  fail(/^[a-f0-9]{64}$/.test(entry.rgbaSha256)&&digest(rgba)===entry.rgbaSha256,`RGBA raster changed ${identity.file}`);
  files.push({fileName:`${directory}/${identity.file}`,source:bytes});
 }
 const templateBytes=read('collection.template.json'),template=JSON.parse(templateBytes.toString());
 const textures=identities.map(({sign,gender,file,id})=>({id,name:`${sign[0].toUpperCase()+sign.slice(1)} · ${gender[0].toUpperCase()+gender.slice(1)}`,file}));
 fail(isDeepStrictEqual(template,{version:1,category:'woka',assetBaseUrl:null,collection:{name:'VarCamp Zodiac 2026',textures}}),'unbound exact full-character collection required');
 return[...files,{fileName:`${directory}/manifest.json`,source:manifestBytes},{fileName:`${directory}/collection.template.json`,source:templateBytes},{fileName:`${directory}/README.md`,source:read('README.md')}];
}
