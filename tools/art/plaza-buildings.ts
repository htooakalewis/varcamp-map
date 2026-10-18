import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import type {Sprite} from './catalog';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export function plazaBuildingSprites():Record<string,Sprite>{
 const blockingCells:[number,number][]=[];for(let y=1;y<=8;y++)for(let x=1;x<=10;x++)blockingCells.push([x,y]);for(let y=9;y<=10;y++)for(const x of [1,2,3,4,7,8,9,10])blockingCells.push([x,y]);
 return Object.fromEntries(Array.from({length:4},(_,i)=>[`plaza-building-0${i+1}`,{sheet:'assets/tilesets/original/plaza-buildings.png',rect:{x:i%2*12,y:Math.floor(i/2)*12,width:12,height:12},blockingCells:structuredClone(blockingCells),level:'aboveAvatar',sourceId:'plaza-original-buildings'}]));
}
export function plazaGrassSprites():Record<string,Sprite>{return Object.fromEntries(Array.from({length:4},(_,i)=>[`plaza-grass-0${i+1}`,{sheet:'assets/tilesets/original/plaza-grass.png',rect:{x:i%2,y:Math.floor(i/2),width:1,height:1},blockingCells:[],level:'belowAvatar',sourceId:'plaza-original-garden'}]));}
export async function renderPlazaBuildings(){
 const source='art/source/plaza-original/buildings-cleaned-master.png',master=readFileSync(source),{data,info}=await sharp(master).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(info.width!==1254||info.height!==1254)throw Error('Reviewed 2×2 building master dimensions changed');
 const atlas=Buffer.alloc(768*768*4),crops=[],sprites=plazaBuildingSprites();let retainedForegroundPixels=0,clearedMattePixels=0;const foreground=createHash('sha256');
 for(let i=0;i<4;i++){
  const cell={left:i%2*627,top:Math.floor(i/2)*627,width:627,height:627};let left=cell.left+627,right=cell.left,top=cell.top+627,bottom=cell.top;
  for(let y=cell.top;y<cell.top+627;y++)for(let x=cell.left;x<cell.left+627;x++)if(data[(y*1254+x)*4+3]>=192){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  const crop={left,top,width:right-left+1,height:bottom-top+1},scale=Math.min(384/crop.width,384/crop.height),width=Math.round(crop.width*scale),height=Math.round(crop.height*scale);
  const x=i%2*384+Math.floor((384-width)/2),y=Math.floor(i/2)*384+384-height;
  const pixels=await sharp(master).extract(crop).resize(width,height,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
  for(let p=0;p<pixels.length;p+=4){if(pixels[p+3]<192){pixels.fill(0,p,p+4);clearedMattePixels++;}else{foreground.update(pixels.subarray(p,p+4));retainedForegroundPixels++;}}
  for(let py=0;py<height;py++)pixels.copy(atlas,((y+py)*768+x)*4,py*width*4,(py+1)*width*4);
  crops.push({cell,crop,target:{x,y,width,height},doorCells:[[5,11],[6,11]],blockingCells:96});
 }
 const png=await sharp(atlas,{raw:{width:768,height:768,channels:4}}).png().toBuffer();
 return{png,sprites,metadata:{version:1,source:{path:source,sha256:sha(master)},priorMaster:{path:'art/source/plaza-original/buildings-generated-master.png',sha256:sha(readFileSync('art/source/plaza-original/buildings-generated-master.png'))},alphaThreshold:192,operation:'alpha-tight whole-subject crops; uniform nearest-neighbor fit; centered south edge; below192alpha becomes RGBA0000; every selected foreground RGBA retained',normalization:{retainedForegroundPixels,clearedMattePixels,foregroundRgbaSha256:foreground.digest('hex')},crops,atlas:{path:'assets/tilesets/original/plaza-buildings.png',width:768,height:768,sha256:sha(png)}}};
}
export async function renderPlazaGrass(){
 const source='art/source/plaza-original/grass-generated-master.png',master=readFileSync(source),m=await sharp(master).metadata();
 if(m.width!==1254||m.height!==1254)throw Error('Reviewed 2×2 original grass master dimensions changed');
 const png=await sharp(master).removeAlpha().resize(64,64,{kernel:'nearest'}).png().toBuffer();
 const sprites=plazaGrassSprites();
 return{png,sprites,metadata:{version:1,source:{path:source,sha256:sha(master)},operation:'2×2 original texture cells; uniform nearest-neighbor native export',atlas:{path:'assets/tilesets/original/plaza-grass.png',width:64,height:64,sha256:sha(png)}}};
}
export async function writePlazaBuildings(){const b=await renderPlazaBuildings(),g=await renderPlazaGrass();writeFileSync(b.metadata.atlas.path,b.png);writeFileSync('art/source/plaza-buildings.json',JSON.stringify(b.metadata,null,2)+'\n');writeFileSync(g.metadata.atlas.path,g.png);writeFileSync('art/source/plaza-grass.json',JSON.stringify(g.metadata,null,2)+'\n');return{b,g};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await writePlazaBuildings();
