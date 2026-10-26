import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import sharp from 'sharp';
import {renderNativeMotion,type NativeMotionPose} from './native-motion';
import {FOUNTAIN_MOTION_IDS,FOUNTAIN_OWNER,FOUNTAIN_SOURCE_SHA} from '../maps/fountain-motion-roles';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const need=(ok:unknown,m:string)=>{if(!ok)throw Error('Fountain motion: '+m);};
/** Reuse the approved native water poses. The fixed gold/plants are never
 * repainted: only opaque blue water pixels can receive moving highlights. */
export async function renderFountainMotion(){
 const path=FOUNTAIN_OWNER.visual.sheet,bytes=readFileSync(path);need(sha(bytes)===FOUNTAIN_SOURCE_SHA,'owner image changed');
 const base=await sharp(bytes).ensureAlpha().raw().toBuffer(),assets=read('art/source/world-ambient-assets.json');
 const inputs=['art/source/world-ambient-assets.json','art/source/world-ambient-cascade-poses.png','art/source/world-ambient-ripples-poses.png','tools/art/fountain-motion.ts','tools/art/native-motion.ts','tools/maps/fountain-motion-roles.ts'];
 const poses:Record<string,NativeMotionPose[]>={};
 for(const name of ['cascade','ripples']){
  const row=assets.groups[name],png=readFileSync(row.path);need(sha(png)===row.sha256,'approved water poses changed');poses[name]=[];
  for(let i=0;i<4;i++)poses[name].push({width:row.width,height:row.height,rgba:await sharp(png).extract({left:i*row.width,top:0,width:row.width,height:row.height}).ensureAlpha().raw().toBuffer()});
 }
 const upperSupport=Buffer.alloc(128*96);for(let y=0;y<32;y++)for(let x=0;x<128;x++)if(base[(y*128+x)*4+3]===255)upperSupport[y*128+x]=1;
 const lower:NativeMotionPose[]=[],upper:NativeMotionPose[]=[];
 for(let phase=0;phase<12;phase++){
  const low=Buffer.alloc(128*96*4),high=Buffer.alloc(low.length);
  const add=(kind:string,x:number,y:number,offset:number)=>{
   const p=poses[kind][(Math.floor(phase/3)+offset)%4];
   for(let py=0;py<p.height;py++)for(let px=0;px<p.width;px++){
    const dx=x+px,dy=y+py;if(dx<0||dx>=128||dy<0||dy>=96)continue;
    const s=(py*p.width+px)*4,d=(dy*128+dx)*4;
    if(!p.rgba[s+3]||base[d+3]!==255||base[d+2]<=base[d]+20||base[d+1]<=base[d]+12)continue;
    const target=dy<32?high:low;p.rgba.copy(target,d,s,s+4);
   }
  };
  // A flowing central jet, three short cascades and offset basin ripples.
  const drift=phase%3-1;
  add('cascade',58,5+drift,0);add('cascade',57,30+drift,1);
  add('cascade',36,39+drift,2);add('cascade',80,39+drift,0);
  add('ripples',29,48,0);add('ripples',66,48,2);add('ripples',48,59,1);
  lower.push({width:128,height:96,rgba:low});upper.push({width:128,height:96,rgba:high});
 }
 const resources=[];
 for(const [index,name] of FOUNTAIN_MOTION_IDS.entries()){
  const frames=index===0?lower:upper,level=index===0?'belowAvatar':'aboveAvatar',tracks=[{id:name,samples:frames.map((_,pose)=>({x:0,y:0,pose}))}];
  const r=await renderNativeMotion({name,image:`assets/tilesets/original/${name}.png`,sourceId:'original',level,rect:{x:49,y:59,width:4,height:3},stepMs:120,periodMs:1440,poses:frames,tracks});
  const metadataPath=`art/source/${name}.json`;
  r.overlay.provenance={metadataPath,atlasSha256:sha(r.png),inputs:inputs.map(path=>({path,sha256:sha(readFileSync(path))}))};
  const metadata={version:1,effect:{name:FOUNTAIN_MOTION_IDS[0],kind:'cascade',anchor:'plaza-fountain',clip:{x:49,y:59,width:4,height:3}},componentNames:FOUNTAIN_MOTION_IDS,overlay:r.overlay,partition:index===0?'belowOwnerUpper':'opaqueOwnerUpper',depthReceipt:{policy:'opaque-owner-upper-v1',owner:FOUNTAIN_OWNER,sheetSha256:FOUNTAIN_SOURCE_SHA,opaqueUpperSupport:upperSupport.toString('base64')},diagnostics:r.diagnostics};
  resources.push({...r,metadataPath,metadata});
 }
 return{resources};
}
export async function writeFountainMotion(){const r=await renderFountainMotion();for(const a of r.resources){writeFileSync(a.overlay.image,a.png);writeFileSync(a.metadataPath,JSON.stringify(a.metadata,null,2)+'\n');}return r;}
export async function checkFountainMotionArt(){
 const result=await renderFountainMotion(),sources=read('art/sources.json').original.files;
 for(const r of result.resources){
  need(readFileSync(r.overlay.image).equals(r.png),'native water pixels differ from producer');
  need(isDeepStrictEqual(read(r.metadataPath),r.metadata),'water metadata differs from producer');
  for(const path of [r.overlay.image,r.metadataPath])need(sources.filter((f:any)=>f.path===path&&f.sha256===sha(readFileSync(path))).length===1,'water asset registration changed');
 }
}
