import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import sharp from 'sharp';
import type {Sprite,TileCatalog} from './catalog';
export const HALL_EXTERIOR_IMAGE='assets/tilesets/original/hall-exteriors.png';
export const HALL_EXTERIOR_METADATA='art/source/hall-exteriors.json';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const need=(ok:unknown,message:string)=>{if(!ok)throw Error('Hall exteriors: '+message);};
export function hallExteriorSprites():Record<string,Sprite>{
 const blockingCells:[number,number][]=[];for(let y=0;y<6;y++)for(const x of[0,1,6,7])blockingCells.push([x,y]);
 return Object.fromEntries(['solar','lunar'].map((id,i)=>['hall-exterior-'+id,{sheet:HALL_EXTERIOR_IMAGE,rect:{x:i*8,y:0,width:8,height:6},blockingCells:structuredClone(blockingCells),level:'aboveAvatar',sourceId:'hall-exteriors'}]));
}
/** Whole subjects remain uniform; the exact lower passage is a native alpha aperture. */
export async function renderHallExteriors(){
 const recipe=JSON.parse(readFileSync('world/hall-exteriors.json','utf8'));
 need(recipe.version===1&&isDeepStrictEqual(recipe.buildings.map((r:{id:string})=>r.id),['solar','lunar']),'exact two-hall recipe required');
 need(isDeepStrictEqual(recipe.atlas,{path:HALL_EXTERIOR_IMAGE,width:512,height:192,columns:16,cellWidth:256,cellHeight:192})&&recipe.alphaThreshold===192,'native atlas recipe changed');
 const glyphPath='art/source/hub-nameplates.json',glyphRaw=readFileSync(glyphPath);need(sha(glyphRaw)===recipe.nameplates.glyphsSha256,'native glyph source changed');
 const glyphs=JSON.parse(glyphRaw.toString()).glyphs as Record<string,string[]>;
 const atlas=Buffer.alloc(512*192*4),subjects=[];
 for(const[i,row]of recipe.buildings.entries()){
  const path=`art/source/hall-exteriors/${row.id}-generated-master.png`;need(row.master.path===path,'master identity changed');
  const master=readFileSync(path);need(sha(master)===row.master.sha256,'retained master hash changed: '+row.id);
  const {data,info}=await sharp(master).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,right=-1,top=info.height,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=192){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  need(right>=left&&bottom>=top&&left>0&&right<info.width-1&&top>0&&bottom<info.height-1,'complete transparent-margin subject required: '+row.id);
  const crop={left,top,width:right-left+1,height:bottom-top+1},scale=Math.min(256/crop.width,192/crop.height),width=Math.round(crop.width*scale),height=Math.round(crop.height*scale),x=i*256+Math.floor((256-width)/2),y=192-height;
  const pixels=await sharp(master).extract(crop).resize(width,height,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
  for(let p=0;p<pixels.length;p+=4)if(pixels[p+3]<192)pixels.fill(0,p,p+4);
  for(let py=0;py<height;py++)pixels.copy(atlas,((y+py)*512+x)*4,py*width*4,(py+1)*width*4);
  // Portal row3 and its two approach rows: no painted pillar/roof may hide a WOKA here.
  for(let py=96;py<192;py++)atlas.fill(0,(py*512+i*256+64)*4,(py*512+i*256+192)*4);
  const pixel=(px:number,py:number,rgb:number[])=>{const p=(py*512+i*256+px)*4;for(let k=0;k<3;k++)atlas[p+k]=rgb[k];atlas[p+3]=255;};
  // The left-pier plaque preserves the whole central hero motif and stays outside the passage.
  for(let py=112;py<152;py++)for(let px=1;px<63;px++)pixel(px,py,py===112||py===151||px===1||px===62?(i===0?[219,186,99]:[169,198,224]):[17,37,54]);
  const text=row.id==='solar'?'SOLAR HALL':'LUNAR HALL';
  for(const[lineNo,lineText]of[row.id.toUpperCase(),'HALL'].entries()){
   const textX=Math.floor((64-(lineText.length*12-2))/2);
   for(const[n,c]of[...lineText].entries()){need(Array.isArray(glyphs[c]),'native title glyph missing');for(const[gy,line]of glyphs[c].entries())for(let gx=0;gx<5;gx++)if(line[gx]==='1')for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++)pixel(textX+n*12+gx*2+sx,116+lineNo*18+gy*2+sy,[255,231,172]);}
  }
  subjects.push({id:row.id,master:row.master,crop,target:{x,y,width,height},passage:{x:i*256+64,y:96,width:128,height:96},blockingCells:24,title:text});
 }
 const png=await sharp(atlas,{raw:{width:512,height:192,channels:4}}).png().toBuffer();
 return{png,sprites:hallExteriorSprites(),metadata:{version:1,recipe:{path:'world/hall-exteriors.json',sha256:sha(readFileSync('world/hall-exteriors.json'))},glyphs:{path:glyphPath,sha256:sha(glyphRaw)},operation:'alpha-tight complete subjects; uniform nearest-neighbor fit to256x192; centered at south edge; alpha below192 cleared; four-wide lower passage cleared; existing bitmap glyph nameplates; no original asset overwritten',subjects,atlas:{path:HALL_EXTERIOR_IMAGE,width:512,height:192,columns:16,tilecount:96,sha256:sha(png)}}};
}
export async function writeHallExteriorArt(){const r=await renderHallExteriors();writeFileSync(HALL_EXTERIOR_IMAGE,r.png);writeFileSync(HALL_EXTERIOR_METADATA,JSON.stringify(r.metadata,null,2)+'\n');return r;}
export async function checkHallExteriorArt(catalog:TileCatalog,sources:Record<string,any>):Promise<string[]>{
 try{
  const source=sources['hall-exteriors'];need(source&&Array.isArray(source.files),'source registry family missing');
  const expected=['world/hall-exteriors.json','tools/art/hall-exteriors.ts','art/source/hall-exteriors/prompts.json','art/source/hall-exteriors/solar-generated-master.png','art/source/hall-exteriors/lunar-generated-master.png',HALL_EXTERIOR_METADATA,HALL_EXTERIOR_IMAGE];
  need(isDeepStrictEqual(source.files.map((f:{path:string})=>f.path),expected),'closed source family roster/order changed');
  const r=await renderHallExteriors();need(readFileSync(HALL_EXTERIOR_IMAGE).equals(r.png),'native PNG differs from complete-subject compiler');need(isDeepStrictEqual(JSON.parse(readFileSync(HALL_EXTERIOR_METADATA,'utf8')),r.metadata),'compiler metadata changed');
  need(isDeepStrictEqual(Object.keys(catalog).filter(id=>id.startsWith('hall-exterior-')).sort(),Object.keys(r.sprites).sort()),'exact two catalog members required');
  for(const[id,sprite]of Object.entries(r.sprites))need(isDeepStrictEqual(catalog[id],sprite),'native geometry/depth/collision changed: '+id);
  return [];
 }catch(error){return[String(error)];}
}
