import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import sharp from 'sharp';
import {SIGN_IDS} from '../../src/world/catalog';
import {plazaBuildingSprites} from './plaza-buildings';
import type {Sprite,TileCatalog} from './catalog';
export const ZODIAC_EXTERIOR_IMAGE='assets/tilesets/original/zodiac-exteriors.png';
export const ZODIAC_EXTERIOR_METADATA='art/source/zodiac-exteriors.json';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const need=(ok:unknown,message:string)=>{if(!ok)throw Error('Zodiac exteriors: '+message);};
export function zodiacExteriorSprites():Record<string,Sprite>{
 const base=plazaBuildingSprites()['plaza-building-01'];
 return Object.fromEntries(SIGN_IDS.map((sign,i)=>['zodiac-building-'+sign,{...structuredClone(base),sheet:ZODIAC_EXTERIOR_IMAGE,rect:{x:i%4*12,y:Math.floor(i/4)*12,width:12,height:12},sourceId:'zodiac-exteriors'}]));
}
/** Pure full-subject compiler. Old masters and the four-building atlas are never edited. */
export async function renderZodiacExteriors(){
 const recipe=JSON.parse(readFileSync('world/zodiac-exteriors.json','utf8'));
 need(recipe.version===1&&isDeepStrictEqual(recipe.buildings.map((r:{sign:string})=>r.sign),SIGN_IDS),'exact twelve-sign recipe required');
 need(isDeepStrictEqual(recipe.atlas,{path:ZODIAC_EXTERIOR_IMAGE,width:1536,height:1152,columns:48,cellSize:384})&&recipe.alphaThreshold===192,'native atlas recipe changed');
 const atlas=Buffer.alloc(1536*1152*4),subjects=[];
 for(const [i,row] of recipe.buildings.entries()){
  const path=`art/source/zodiac-exteriors/${row.sign}-generated-master.png`;need(row.master.path===path,'master identity changed');
  const master=readFileSync(path);need(sha(master)===row.master.sha256,'retained master hash changed: '+row.sign);
  const {data,info}=await sharp(master).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,right=-1,top=info.height,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=192){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  need(right>=left&&bottom>=top&&left>0&&right<info.width-1&&top>0&&bottom<info.height-1,'complete transparent-margin subject required: '+row.sign);
  const crop={left,top,width:right-left+1,height:bottom-top+1},scale=Math.min(384/crop.width,384/crop.height),width=Math.round(crop.width*scale),height=Math.round(crop.height*scale),x=i%4*384+Math.floor((384-width)/2),y=Math.floor(i/4)*384+384-height;
  const pixels=await sharp(master).extract(crop).resize(width,height,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
  for(let p=0;p<pixels.length;p+=4)if(pixels[p+3]<192)pixels.fill(0,p,p+4);
  for(let py=0;py<height;py++)pixels.copy(atlas,((y+py)*1536+x)*4,py*width*4,(py+1)*width*4);
  subjects.push({sign:row.sign,master:row.master,crop,target:{x,y,width,height},doorCells:[[5,11],[6,11]],blockingCells:96});
 }
 const png=await sharp(atlas,{raw:{width:1536,height:1152,channels:4}}).png().toBuffer();
 return{png,sprites:zodiacExteriorSprites(),metadata:{version:1,recipe:{path:'world/zodiac-exteriors.json',sha256:sha(readFileSync('world/zodiac-exteriors.json'))},operation:'alpha-tight complete subjects; uniform nearest-neighbor fit to384px; centered at south edge; alpha below192 cleared; no original asset overwritten',subjects,atlas:{path:ZODIAC_EXTERIOR_IMAGE,width:1536,height:1152,columns:48,tilecount:1728,sha256:sha(png)}}};
}
export async function writeZodiacExteriorArt(){const r=await renderZodiacExteriors();writeFileSync(ZODIAC_EXTERIOR_IMAGE,r.png);writeFileSync(ZODIAC_EXTERIOR_METADATA,JSON.stringify(r.metadata,null,2)+'\n');return r;}
/** Mandatory current family: deleting every marker cannot turn the checker off. */
export async function checkZodiacExteriorArt(catalog:TileCatalog,sources:Record<string,any>):Promise<string[]>{
 try{
  const r=await renderZodiacExteriors(),source=sources['zodiac-exteriors'];need(source&&Array.isArray(source.files),'source registry family missing');
  const expected=['world/zodiac-exteriors.json','tools/art/zodiac-exteriors.ts','art/source/zodiac-exteriors/prompts.json',...SIGN_IDS.map(s=>`art/source/zodiac-exteriors/${s}-generated-master.png`),ZODIAC_EXTERIOR_METADATA,ZODIAC_EXTERIOR_IMAGE];
  need(isDeepStrictEqual(source.files.map((f:{path:string})=>f.path),expected),'closed source family roster/order changed');
  need(readFileSync(ZODIAC_EXTERIOR_IMAGE).equals(r.png),'native PNG differs from complete-subject compiler');
  need(isDeepStrictEqual(JSON.parse(readFileSync(ZODIAC_EXTERIOR_METADATA,'utf8')),r.metadata),'compiler metadata changed');
  const ids=Object.keys(catalog).filter(id=>id.startsWith('zodiac-building-')).sort();need(isDeepStrictEqual(ids,Object.keys(r.sprites).sort()),'exact twelve catalog members required');
  for(const[id,sprite]of Object.entries(r.sprites))need(isDeepStrictEqual(catalog[id],sprite),'native geometry/depth/collision changed: '+id);
  return [];
 }catch(error){return[String(error)];}
}
