import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import type {Sprite} from './catalog';
const source='art/source/plaza-original/garden-generated-master.png';
const image='assets/tilesets/original/plaza-garden.png';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
// Transparent gutters belong to the generated sheet. These technical crop bounds contain one subject each.
const bands=[[34,385,[[32,323],[358,611],[644,929],[949,1220]]],[442,687,[[31,321],[348,607],[644,921],[933,1233]]],[727,953,[[40,315],[343,626],[649,930],[956,1226]]],[989,1193,[[39,315],[343,626],[646,926],[972,1202]]]] as const;
const definitions=[
 {id:'tree-round',cell:0,x:0,y:0,w:2,h:3,tree:true},{id:'tree-birch',cell:1,x:2,y:0,w:2,h:3,tree:true},
 {id:'tree-flowering',cell:2,x:4,y:0,w:2,h:3,tree:true},{id:'tree-evergreen',cell:3,x:6,y:0,w:2,h:3,tree:true},
 {id:'shrub',cell:4,x:0,y:3,w:2,h:1},{id:'blueberry',cell:5,x:2,y:3,w:2,h:1},{id:'lavender',cell:6,x:4,y:3,w:2,h:1},
 {id:'fern',cell:7,x:6,y:3,w:1,h:1},{id:'hosta',cell:8,x:7,y:3,w:1,h:1},
 {id:'flower-bed',cell:9,x:0,y:4,w:2,h:2},{id:'tulips',cell:10,x:2,y:4,w:2,h:2},{id:'wildflowers',cell:11,x:4,y:4,w:2,h:2},
 {id:'grass-tuft',cell:12,x:6,y:4,w:1,h:1},{id:'clover',cell:13,x:7,y:4,w:1,h:1},
 {id:'moss-stones',cell:14,x:6,y:5,w:1,h:1},{id:'mushrooms',cell:15,x:7,y:5,w:1,h:1},
 {id:'plant-tree',cell:3,x:0,y:6,w:1,h:2,tree:true},
] as const;
export function plazaGardenSprites():Record<string,Sprite>{
 const sprites:Record<string,Sprite>={};
 for(const d of definitions){const tree='tree'in d&&d.tree;
  const blockingCells:[number,number][]=tree?Array.from({length:d.w},(_,i)=>[i,d.h-1]):[];
  const upperCells:[number,number][]=tree?Array.from({length:d.w*(d.h-1)},(_,i)=>[i%d.w,Math.floor(i/d.w)]):[];
  sprites[`plaza-${d.id}`]={sheet:image,rect:{x:d.x,y:d.y,width:d.w,height:d.h},blockingCells,upperCells,level:'belowAvatar',sourceId:'plaza-original-garden'};
 }return sprites;
}
/** Retained original raster subjects, alpha-tight technical crops and uniform nearest-native fitting. */
export async function renderPlazaGarden(){
 const master=readFileSync(source),{data,info}=await sharp(master).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(info.width!==1254||info.height!==1254)throw Error('Original garden master dimensions changed');
 const atlas=Buffer.alloc(256*256*4),sprites=plazaGardenSprites(),crops=[];
 for(const d of definitions){
  const row=bands[Math.floor(d.cell/4)],col=row[2][d.cell%4];let left:number=col[1],right:number=col[0],top:number=row[1],bottom:number=row[0];
  for(let y=row[0];y<=row[1];y++)for(let x=col[0];x<=col[1];x++)if(data[(y*info.width+x)*4+3]>=192){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  const crop={left,top,width:right-left+1,height:bottom-top+1},scale=Math.min((d.w*32-4)/crop.width,(d.h*32-4)/crop.height);
  const width=Math.max(1,Math.round(crop.width*scale)),height=Math.max(1,Math.round(crop.height*scale));
  const x=d.x*32+Math.floor((d.w*32-width)/2),y=(d.y+d.h)*32-height-2;
  const pixels=await sharp(master).extract(crop).resize(width,height,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
  for(let py=0;py<height;py++)pixels.copy(atlas,((y+py)*256+x)*4,py*width*4,(py+1)*width*4);
  crops.push({id:d.id,sourceCell:d.cell,crop,target:{x,y,width,height},footprint:sprites[`plaza-${d.id}`].rect});
 }
 const png=await sharp(atlas,{raw:{width:256,height:256,channels:4}}).png().toBuffer();
 return {png,sprites,metadata:{version:1,source:{path:source,sha256:sha(master)},operation:'alpha-tight subject bounds; aspect-preserving nearest-neighbor fit; original RGBA retained',crops,atlas:{path:image,width:256,height:256,sha256:sha(png)}}};
}
export async function writePlazaGarden(){const r=await renderPlazaGarden();writeFileSync(image,r.png);writeFileSync('art/source/plaza-garden.json',JSON.stringify(r.metadata,null,2)+'\n');return r;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await writePlazaGarden();
