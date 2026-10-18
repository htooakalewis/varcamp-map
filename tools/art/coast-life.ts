import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {renderNativeMotion} from './native-motion';
import type {NativeMotionSpec} from './native-motion';
import {assertCoastLifeHabitat} from '../maps/coast-life-habitat';
import {assertCoastAerialLayout,orderCoastAerialOverlays} from '../maps/coast-aerial';

const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const recipePath='art/source/coast-life-tracks.json';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
export async function renderCoastLife(){
 const recipe=read(recipePath);const results=[];
 for(const [map,rows]of Object.entries(recipe.maps)as [string,any[]][]){for(const row of rows){
  assertCoastLifeHabitat(read(`world/layouts/${map}.json`),row);
  const posePath=`art/source/coast-life-${row.poseGroup}-poses.png`,input=readFileSync(posePath);
  const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const [width,height]=row.poseSize;if(info.height!==height||info.width%width)throw Error(`Invalid original coast pose strip: ${posePath}`);
  const poses=[];for(let i=0;i<info.width/width;i++){const rgba=Buffer.alloc(width*height*4);for(let y=0;y<height;y++)data.copy(rgba,y*width*4,(y*info.width+i*width)*4,(y*info.width+(i+1)*width)*4);poses.push({width,height,rgba});}
  const image=`assets/tilesets/original/${row.name}.png`,metadataPath=`art/source/${row.name}.json`;
  const spec:NativeMotionSpec={name:row.name,image,sourceId:'original',level:row.level,rect:row.rect,stepMs:row.stepMs,periodMs:row.periodMs,poses,tracks:row.tracks};
  const result=await renderNativeMotion(spec);
  const inputs=[recipePath,posePath,'art/source/coast-life-assets.json','art/source/coast-life-generation.json','tools/art/coast-life.ts','tools/maps/coast-life-habitat.ts','tools/maps/coast-aerial.ts','tools/maps/animated-decoration.ts','tools/maps/animated-decoration-contract.json','tools/art/native-motion.ts','tools/maps/builder.ts','tools/maps/types.ts'];
  result.overlay.provenance={metadataPath,atlasSha256:sha(result.png),inputs:inputs.map(path=>({path,sha256:sha(readFileSync(path))}))};
  results.push({map,...result,metadata:{version:1,kind:row.kind,poseGroup:row.poseGroup,overlay:result.overlay,diagnostics:result.diagnostics}});
 }}
 return results;
}
export async function writeCoastLife(){
 const results=await renderCoastLife(),layouts=[];
 for(const map of new Set(results.map(r=>r.map))){const path=`world/layouts/${map}.json`,layout=read(path);layout.animatedOverlays=orderCoastAerialOverlays([...(layout.animatedOverlays??[]).filter((o:any)=>!o.name.startsWith('coast-life-')).map((o:any)=>o.name==='coastal-flight'?read('art/source/coastal-flight.json').overlay:o),...results.filter(r=>r.map===map).map(r=>r.overlay)]);assertCoastAerialLayout(layout);layouts.push({path,layout});}
 // Complete source policy preflight precedes every write.
 for(const r of results){await writeFile(r.overlay.image,r.png);await writeFile(r.overlay.provenance!.metadataPath,JSON.stringify(r.metadata,null,2)+'\n');}
 for(const{path,layout}of layouts)await writeFile(path,JSON.stringify(layout,null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await writeCoastLife();
