import {advancePatrolOverlay,patrolInputSha,priorPatrolProvenance} from './plaza-patrol-provenance';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import recipe from '../../world/arrival-refresh.json';
import {arrivalRoadsterOverlay} from '../art/arrival-refresh';
import {buildMap} from './builder';
import {assertNativeSourceProjection,reconcileNativeProjection} from './native-projection';
import type {TileCatalog} from '../art/catalog';
import type {LayoutAnimatedOverlay,MapLayout,TiledMap,TileLayer} from './types';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const need=(ok:unknown,m:string)=>{if(!ok)throw Error('Arrival refresh: '+m);};
const canonical=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const originalCar=():LayoutAnimatedOverlay=>read('art/source/roadster-v2.json').overlay;
const inputRows=()=>Object.entries((recipe as typeof recipe&{producerInputs:Record<string,[string,string]>}).producerInputs);
/** A closed source-provenance transition keeps genuine historical layouts
 * projectable after the two explicitly reviewed producer modules advance. */
export function advanceArrivalOverlay(original:LayoutAnimatedOverlay):LayoutAnimatedOverlay{
 const o=structuredClone(original);
 for(const input of o.provenance?.inputs??[]){const pair=inputRows().find(([path])=>path===input.path)?.[1];if(!pair)continue;
  need(input.sha256===pair[0]||input.sha256===pair[1]||input.sha256===patrolInputSha(input.path,pair[1]),'unknown predecessor input: '+input.path);need(createHash('sha256').update(readFileSync(input.path)).digest('hex')===patrolInputSha(input.path,pair[1]),'reviewed producer changed: '+input.path);input.sha256=pair[1];
 }return advancePatrolOverlay(o);
}
export function advanceArrivalProvenance<T extends MapLayout>(original:T):T{
 const l=structuredClone(original);if(l.animatedOverlays)l.animatedOverlays=l.animatedOverlays.map(advanceArrivalOverlay);return l;
}
function priorProvenance(original:MapLayout,requireCurrent:boolean):MapLayout{
 const l=priorPatrolProvenance(original);for(const o of l.animatedOverlays??[])for(const input of o.provenance?.inputs??[]){const pair=inputRows().find(([path])=>path===input.path)?.[1];if(!pair)continue;need(input.sha256===pair[1]||!requireCurrent&&input.sha256===pair[0],'unknown current producer input: '+input.path);input.sha256=pair[0];}return l;
}
/** Mandatory checked inverse. The source pin prevents unrelated edits from
 * being legitimised by an inverse or by the native author. */
export function restoreArrivalRefresh(current:MapLayout):MapLayout{
 if(current.id!=='overworld')return structuredClone(current);
 const l=structuredClone(current),before=recipe.beforeImage.image,panels=recipe.afterImages;
 need(recipe.version===1&&panels.length===4&&recipe.removedPlacements.length===2,'closed recipe changed');
 need(!l.placements.some(p=>recipe.removedPlacements.some(r=>r.placement.id===p.id)),'removed road sign/pole restored');
 need(!l.images?.some(i=>i.name===before.name)&&isDeepStrictEqual(l.images?.slice(recipe.beforeImage.index,recipe.beforeImage.index+4),panels),'current logo panels missing/order/geometry/depth changed');
 need(l.images!.filter(i=>i.name.startsWith('Arrival /')).length===4,'duplicate/unknown arrival panels');
 need(!l.standingSigns?.some(s=>s.face===recipe.removedStandingSign.sign.face||s.supports.includes('arrival-crosspost-pole')),'removed standing sign restored');
 const car=l.animatedOverlays?.filter(o=>o.name==='roadster');need(car?.length===1&&isDeepStrictEqual(car[0],arrivalRoadsterOverlay(originalCar())),'complete car placement/animation changed');
 l.animatedOverlays![l.animatedOverlays!.indexOf(car![0])]=originalCar();
 l.images!.splice(recipe.beforeImage.index,4,structuredClone(before));
 for(const r of recipe.removedPlacements)l.placements.splice(r.index,0,structuredClone(r.placement)as MapLayout['placements'][number]);
 l.standingSigns!.splice(recipe.removedStandingSign.index,0,structuredClone(recipe.removedStandingSign.sign));
 const prior=priorProvenance(l,true);need(canonical(prior)===recipe.beforeLayoutSha256,'source is not the exact named arrival successor');return prior;
}
/** One finite source operation, accepting only the genuine before or after. */
export function applyArrivalRefresh(original:MapLayout):MapLayout{
 if(original.id!=='overworld')return structuredClone(original);
 if(canonical(priorProvenance(original,false))!==recipe.beforeLayoutSha256){restoreArrivalRefresh(original);return structuredClone(original);}
 const l=advanceArrivalProvenance(original);l.placements=l.placements.filter(p=>!recipe.removedPlacements.some(r=>r.placement.id===p.id));
 l.standingSigns=l.standingSigns!.filter(s=>s.face!==recipe.removedStandingSign.sign.face);
 l.images!.splice(recipe.beforeImage.index,1,...structuredClone(recipe.afterImages));
 l.animatedOverlays=l.animatedOverlays!.map(o=>o.name==='roadster'?arrivalRoadsterOverlay(o):o);
 restoreArrivalRefresh(l);return l;
}
export function assertArrivalRefresh(layout:MapLayout):void{if(layout.id==='overworld')restoreArrivalRefresh(layout);}
/** Genuine predecessor only: explicitly clear its pole cell and retire only
 * the replaced floor-image paint layer before the normal paint transaction. */
export function reconcileArrivalRefresh(native:TiledMap,layout:MapLayout,catalog:TileCatalog):TiledMap{
 assertArrivalRefresh(layout);const source=buildMap(layout,catalog).tmj;
 try{assertNativeSourceProjection(native,source);return structuredClone(native);}catch{/* Only the checked predecessor can continue. */}
 assertNativeSourceProjection(native,buildMap(advanceArrivalProvenance(restoreArrivalRefresh(layout)),catalog).tmj);
 const next=structuredClone(native),oldImage=next.layers.filter(l=>l.name===recipe.beforeImage.image.name);need(oldImage.length===1&&oldImage[0].type==='tilelayer','old floor-image layer missing/ambiguous');next.layers=next.layers.filter(l=>l!==oldImage[0]);
 const mask=next.layers.find(l=>l.name==='physical-collisions')as TileLayer;need(mask?.type==='tilelayer'&&mask.data[64*128+68]!==0,'original pole collision missing');mask.data[64*128+68]=0;
 return reconcileNativeProjection(next,source);
}
