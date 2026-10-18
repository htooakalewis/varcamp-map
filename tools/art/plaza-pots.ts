import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import type {Sprite} from './catalog';
const source='art/source/plaza-original/pots-generated-master.png',image='assets/tilesets/original/plaza-pots.png';
const definitions=[{id:'plant-grass',x:0,height:2,bounds:{left:120,top:0,width:500,height:635}},{id:'plant-flower',x:1,height:1,bounds:{left:700,top:200,width:500,height:435}},{id:'potted-fern',x:2,height:2,bounds:{left:80,top:638,width:620,height:601}},{id:'potted-lavender',x:3,height:1,bounds:{left:720,top:700,width:500,height:539}}];
export function plazaPotSprites():Record<string,Sprite>{return Object.fromEntries(definitions.map(d=>[`plaza-${d.id}`,{sheet:image,rect:{x:d.x,y:0,width:1,height:d.height},blockingCells:[[0,d.height-1]],upperCells:d.height===2?[[0,0]]:[],level:'belowAvatar',sourceId:'plaza-original-garden'}]));}
export async function renderPlazaPots(){
 const master=readFileSync(source),{data,info}=await sharp(master).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(info.width!==1270||info.height!==1239)throw Error('Original potted-vegetation master dimensions changed');
 const atlas=Buffer.alloc(128*64*4),crops=[];
 for(const d of definitions){let left=d.bounds.left+d.bounds.width,right=d.bounds.left,top=d.bounds.top+d.bounds.height,bottom=d.bounds.top;
  for(let y=d.bounds.top;y<d.bounds.top+d.bounds.height;y++)for(let x=d.bounds.left;x<d.bounds.left+d.bounds.width;x++)if(data[(y*info.width+x)*4+3]>=192){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  const crop={left,top,width:right-left+1,height:bottom-top+1},scale=Math.min(28/crop.width,(d.height*32-4)/crop.height),width=Math.round(crop.width*scale),height=Math.round(crop.height*scale),x=d.x*32+Math.floor((32-width)/2),y=d.height*32-height-2;
  const rgba=await sharp(master).extract(crop).resize(width,height,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
  for(let py=0;py<height;py++)rgba.copy(atlas,((y+py)*128+x)*4,py*width*4,(py+1)*width*4);crops.push({id:d.id,crop,target:{x,y,width,height}});
 }
 const png=await sharp(atlas,{raw:{width:128,height:64,channels:4}}).png().toBuffer(),sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 return{png,sprites:plazaPotSprites(),metadata:{version:1,source:{path:source,sha256:sha(master)},operation:'whole-subject alpha-tight crops; uniform nearest native fit; original RGBA retained',crops,atlas:{path:image,width:128,height:64,sha256:sha(png)}}};
}
export async function writePlazaPots(){const r=await renderPlazaPots();writeFileSync(image,r.png);writeFileSync('art/source/plaza-pots.json',JSON.stringify(r.metadata,null,2)+'\n');return r;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await writePlazaPots();
