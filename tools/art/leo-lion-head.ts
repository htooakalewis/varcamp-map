import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import sharp from 'sharp';
import {LEO_LION_IMAGE,LEO_LION_SPRITE} from '../maps/leo-lion-head-definition';
import type {TileCatalog} from './catalog';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const need=(ok:unknown,m:string)=>{if(!ok)throw Error('Leo lion head: '+m);};
export const LEO_LION_METADATA='art/source/leo-lion-head.json';
export const LEO_LION_SOURCE_PATHS=['world/leo-lion-head.json','tools/art/leo-lion-head.ts','tools/maps/leo-lion-head-definition.ts','art/source/leo-lion-head/prompt.json','art/source/leo-lion-head/generated-master.png',LEO_LION_METADATA,LEO_LION_IMAGE];
/** Compile the generated ornament at native tile scale; the old building atlas stays exact. */
export async function renderLeoLionHead(){
 const recipe=read('world/leo-lion-head.json');need(recipe.master.path==='art/source/leo-lion-head/generated-master.png'&&recipe.image===LEO_LION_IMAGE,'asset identity changed');
 const master=readFileSync(recipe.master.path);need(sha(master)===recipe.master.sha256,'generated master changed');
 const {data,info}=await sharp(master).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,right=-1,top=info.height,bottom=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=192){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 need(left>0&&top>0&&right>left&&bottom>top&&right<info.width-1&&bottom<info.height-1,'complete transparent-margin lion head required');
 const crop={left,top,width:right-left+1,height:bottom-top+1},scale=Math.min(124/crop.width,94/crop.height),width=Math.round(crop.width*scale),height=Math.round(crop.height*scale);
 const pixels=await sharp(master).extract(crop).resize(width,height,{kernel:'nearest'}).ensureAlpha().raw().toBuffer(),atlas=Buffer.alloc(128*96*4),x=Math.floor((128-width)/2),y=Math.floor((96-height)/2);
 for(let p=0;p<pixels.length;p+=4)if(pixels[p+3]<192)pixels.fill(0,p,p+4);
 for(let py=0;py<height;py++)pixels.copy(atlas,((y+py)*128+x)*4,py*width*4,(py+1)*width*4);
 const png=await sharp(atlas,{raw:{width:128,height:96,channels:4}}).png().toBuffer();
 const metadata={version:1,master:recipe.master,operation:'Complete transparent lion-head ornament; uniform nearest-neighbor fit inside128x96; alpha below192 cleared; original building unchanged',crop,target:{x,y,width,height},image:{path:LEO_LION_IMAGE,width:128,height:96,sha256:sha(png)},sprite:LEO_LION_SPRITE};
 return{png,metadata};
}
export async function writeLeoLionHead(){const r=await renderLeoLionHead();writeFileSync(LEO_LION_IMAGE,r.png);writeFileSync(LEO_LION_METADATA,JSON.stringify(r.metadata,null,2)+'\n');return r;}
export async function checkLeoLionHeadArt(catalog:TileCatalog){
 const r=await renderLeoLionHead(),sources=read('art/sources.json').original.files;
 need(readFileSync(LEO_LION_IMAGE).equals(r.png)&&isDeepStrictEqual(read(LEO_LION_METADATA),r.metadata),'native ornament differs from generated master compiler');
 need(isDeepStrictEqual(catalog['leo-lion-head'],LEO_LION_SPRITE),'ornament scale, depth or collision definition changed');
 for(const path of LEO_LION_SOURCE_PATHS)need(sources.filter((f:any)=>f.path===path&&f.sha256===sha(readFileSync(path))).length===1,'asset registration changed: '+path);
}
