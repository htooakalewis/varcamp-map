import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import sharp from 'sharp';
import {renderRoadster,ROADSTER_V2_METADATA_PATH} from './roadster';
import type {LayoutAnimatedOverlay} from '../maps/types';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const need=(ok:unknown,m:string)=>{if(!ok)throw Error('Arrival refresh art: '+m);};
export const ARRIVAL_RECIPE='art/source/arrival-refresh.json';
export const ARRIVAL_ROADSTER_METADATA='art/source/arrival-roadster.json';
export const ARRIVAL_LOGO_PATHS=['nw','ne','sw','se'].map(k=>'assets/sponsors/varcamp-arrival-'+k+'.png');
/** Place the retained animation; do not change its original compiler or clocks. */
export function arrivalRoadsterOverlay(base:LayoutAnimatedOverlay):LayoutAnimatedOverlay{
 const r=read(ARRIVAL_RECIPE);need(r.version===1&&isDeepStrictEqual(r.roadster,{before:{x:73,y:60},after:{x:74,y:54},metadataPath:ARRIVAL_ROADSTER_METADATA}),'closed car placement recipe changed');
 need(base.name==='roadster'&&base.x===73&&base.y===60&&base.width===5&&base.height===5&&base.level==='belowAvatar'&&base.provenance?.metadataPath===ROADSTER_V2_METADATA_PATH,'original car descriptor changed');
 const next=structuredClone(base);Object.assign(next,r.roadster.after);next.provenance!.metadataPath=ARRIVAL_ROADSTER_METADATA;
 next.provenance!.inputs.push(...[ARRIVAL_RECIPE,'tools/art/arrival-refresh.ts'].map(path=>({path,sha256:sha(readFileSync(path))})));
 return next;
}
/** Pure native SVG export into the existing6x2sponsor-panel contract. */
export async function renderArrivalRefresh(){
 const r=read(ARRIVAL_RECIPE);need(r.version===1&&isDeepStrictEqual(r.panel,{width:384,height:128})&&isDeepStrictEqual(r.raster,{x:4,y:21,width:376,height:85}),'closed native logo geometry changed');
 need(r.source.path==='art/source/varcamp-horizontal.svg'&&r.source.sha256==='05f5ea29e8635156bf4ed74f9e39a6067bb2121ac266db514d7918703924250f','original booth lockup identity changed');
 const svg=readFileSync(r.source.path);need(sha(svg)===r.source.sha256,'retained booth SVG changed');
 need(isDeepStrictEqual(r.colours,{flame:'#f96216',wordmark:'#ffffff'}),'booth brand colours changed');
 // The retained organiser SVG is white; the existing booth treatment colours
 // only its first (flame) path, preserving the master and white wordmark.
 need((svg.toString().match(/<path class="cls-1"/g)??[]).length===2,'closed flame/wordmark path roster changed');
 const coloured=svg.toString().replace('<path class="cls-1"','<path class="cls-1" style="fill:#f96216"');
 const lockup=await sharp(Buffer.from(coloured)).resize(376,85,{fit:'inside'}).png().toBuffer();
 const panel=await sharp({create:{width:384,height:128,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:lockup,left:4,top:21}]).png().toBuffer();
 const logos=[];for(const[i,path]of ARRIVAL_LOGO_PATHS.entries())logos.push({path,png:await sharp(panel).extract({left:i%2*192,top:Math.floor(i/2)*64,width:192,height:64}).png().toBuffer()});
 const base=await renderRoadster();need(readFileSync(base.metadata.overlay.image).equals(base.png),'retained car atlas changed');
 need(isDeepStrictEqual(read(ROADSTER_V2_METADATA_PATH),base.metadata),'original car metadata changed');
 const overlay=arrivalRoadsterOverlay(base.metadata.overlay),metadata={version:1,operation:'placement-only arrival successor; original pad, phases, pixels, atlas and clocks retained',base:{path:ROADSTER_V2_METADATA_PATH,sha256:sha(readFileSync(ROADSTER_V2_METADATA_PATH))},overlay};
 return{panel,logos,roadster:{overlay,metadata}};
}
export async function checkArrivalRefreshArt():Promise<string[]>{
 try{
  const r=await renderArrivalRefresh(),sources=read('art/sources.json'),sponsors=read('art/sponsors.json');
  const files=sources['varcamp-organiser']?.files;need(Array.isArray(files),'organiser source registry missing');
  for(const path of ['art/source/varcamp-horizontal.svg',...ARRIVAL_LOGO_PATHS])need(files.filter((f:any)=>f.path===path&&f.sha256===sha(readFileSync(path))).length===1,'required organiser source/hash missing: '+path);
  for(const row of r.logos){need(readFileSync(row.path).equals(row.png),'native SVG quadrant changed: '+row.path);const records=sponsors.assets.filter((a:any)=>a.image===row.path);need(records.length===1&&records[0].source==='art/source/varcamp-horizontal.svg'&&isDeepStrictEqual(records[0].size,{width:192,height:64,tileWidth:6,tileHeight:2}),'sponsor registration changed: '+row.path);}
  need(isDeepStrictEqual(read(ARRIVAL_ROADSTER_METADATA),r.roadster.metadata),'placement-only car metadata changed');return [];
 }catch(e){return[String(e)];}
}
