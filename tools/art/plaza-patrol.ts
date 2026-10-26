import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import sharp from 'sharp';
import {renderNativeMotion} from './native-motion';
import type {NativeMotionPose,NativeMotionTrack} from './native-motion';
import {PATROL_IDS} from '../maps/patrol-roles';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const need=(ok:unknown,message:string)=>{if(!ok)throw Error('Plaza patrol: '+message);};
export const PATROL_RECIPE='art/source/plaza-patrol-recipe.json';
export async function renderPlazaPatrol(){
 const recipe=read(PATROL_RECIPE);
 need(recipe.version===1&&recipe.stepMs===200&&recipe.periodMs===32000&&recipe.source==='art/source/plaza-fleet-camera-poses.png','closed native patrol source/clock changed');
 need(isDeepStrictEqual(recipe.routes.map((r:any)=>r.id),PATROL_IDS),'six named patrol routes required');
 const source=readFileSync(recipe.source);need(sha(source)===recipe.sourceSha256,'approved camera poses changed');
 const poses:NativeMotionPose[]=[];
 for(let i=0;i<12;i++)poses.push({width:24,height:24,rgba:await sharp(source).extract({left:i%4*32+4,top:Math.floor(i/4)*32+4,width:24,height:24}).ensureAlpha().raw().toBuffer()});
 const resources=[];const phases=recipe.periodMs/recipe.stepMs;
 for(const [index,r] of recipe.routes.entries()){
  const {x,y,width,height}=r.rect;
  need([x,y,width,height].every(Number.isSafeInteger)&&x>=0&&y>=0&&width>=3&&height>=3&&width*height<256&&x+width<=128&&y+height<=128,'bounded native lane required');
  need(Number.isSafeInteger(r.phaseOffset)&&r.phaseOffset>=0&&r.phaseOffset<phases,'invalid phase offset');
  const track:NativeMotionTrack={id:r.id,samples:Array.from({length:phases},(_,phase)=>{
   const angle=2*Math.PI*((phase+r.phaseOffset)%phases)/phases,directionSign=index%2?-1:1;
   const dx=-Math.sin(angle),dy=directionSign*Math.cos(angle),direction=Math.abs(dx*(width*32-48))>Math.abs(dy*(height*32-48))?dx>0?1:3:dy>0?0:2;
   return{x:Math.round(width*16-12+(width*32-48)/2*Math.cos(angle)),y:Math.round(height*16-12+directionSign*(height*32-48)/2*Math.sin(angle)),pose:phase%3*4+direction};
  })};
  const result=await renderNativeMotion({name:r.id,image:`assets/tilesets/original/${r.id}.png`,sourceId:'plaza-original-drones',level:'aboveScenery',rect:r.rect,stepMs:recipe.stepMs,periodMs:recipe.periodMs,poses,tracks:[track]});
  const metadataPath=`art/source/${r.id}.json`;
  result.overlay.provenance={metadataPath,atlasSha256:sha(result.png),inputs:[PATROL_RECIPE,recipe.source,'tools/art/plaza-patrol.ts','tools/art/native-motion.ts','tools/maps/patrol-roles.ts'].map(path=>({path,sha256:sha(readFileSync(path))}))};
  const metadata={version:1,source:{path:recipe.source,sha256:sha(source)},route:r,track,overlay:result.overlay,diagnostics:result.diagnostics};
  resources.push({...result,metadataPath,metadata});
 }
 need(resources.reduce((sum,r)=>sum+r.diagnostics.decodedRgbaBytes,0)<=16*1024*1024,'total decoded patrol atlas budget exceeded');
 return{resources,metadata:{version:1,recipe:{path:PATROL_RECIPE,sha256:sha(readFileSync(PATROL_RECIPE))},existingAircraft:5,addedAircraft:6,totalAircraft:11,resources:resources.map(r=>({metadataPath:r.metadataPath,overlay:r.overlay,diagnostics:r.diagnostics}))}};
}
export async function checkPlazaPatrolArt():Promise<string[]>{
 try{
  const result=await renderPlazaPatrol(),sources=read('art/sources.json')['plaza-original-drones'].files;
  need(isDeepStrictEqual(read('art/source/plaza-patrol.json'),result.metadata),'patrol summary differs from producer');
  for(const r of result.resources){need(readFileSync(r.overlay.image).equals(r.png),'patrol pixels differ: '+r.overlay.name);need(isDeepStrictEqual(read(r.metadataPath),r.metadata),'patrol metadata differs: '+r.overlay.name);}
  for(const path of [PATROL_RECIPE,'tools/art/plaza-patrol.ts','art/source/plaza-patrol.json',...result.resources.flatMap(r=>[r.overlay.image,r.metadataPath])])need(sources.filter((f:any)=>f.path===path&&f.sha256===sha(readFileSync(path))).length===1,'patrol source registration missing/changed: '+path);
  return[];
 }catch(error){return[String(error)];}
}
export async function writePlazaPatrol(){const r=await renderPlazaPatrol();for(const a of r.resources){writeFileSync(a.overlay.image,a.png);writeFileSync(a.metadataPath,JSON.stringify(a.metadata,null,2)+'\n');}writeFileSync('art/source/plaza-patrol.json',JSON.stringify(r.metadata,null,2)+'\n');return r;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await writePlazaPatrol();
