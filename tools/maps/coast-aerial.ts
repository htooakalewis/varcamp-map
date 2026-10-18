import{createHash}from'node:crypto';
import{isDeepStrictEqual}from'node:util';
import type{LayoutAnimatedOverlay,MapLayout,TiledMap}from'./types';
import type{TileCatalog}from'../art/catalog';
import{assertAnimatedDecorationSource,assertNativeAnimationSafety}from'./animated-decoration';

/** Original aircraft pixels stay native. This peripheral sky band is not
 * wholly sea:132 naval-water +10 curved-water +2 curved-land cells;142 blocked
 * and2 walkable,5 existing prop footprint cells. Avatar foreground is required
 * independently of that measured terrain. No entry/exit/activity is crossed. */
export const COASTAL_FLIGHT_RECT={x:0,y:0,width:48,height:3}as const;
const aerialRoles={
 'shipyard-beach':['coastal-flight','coast-life-harbor-gull-north','coast-life-harbor-gull-south'],
 'constellation-shore':['coast-life-shore-gull-north','coast-life-shore-gull-south'],
}as const;
// Genuine pre-correction source/native DATA, not hashes from a candidate being
// checked: shipyard native042fe019… / original curved terrain unchanged.
const topBand={terrain:'54977ca61ffda76d9a721e292f0c9c037bc344abea1e908cfbec16d59db0869d',blocked:'f7232e945f365611a73a52f207b6fda8e668d765ed3abdbef33db70231ee1681',props:'69198a02ca71654f38fb37dd9490a8d9d172707720686e8820f3a82b2eef671b'};
const sha=(data:unknown)=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
const need=(ok:unknown,message:string):void=>{if(!ok)throw Error('Coast aerial '+message);};
const roles=(id:string):readonly string[]=>aerialRoles[id as keyof typeof aerialRoles]??[];
const isAerial=(o:LayoutAnimatedOverlay)=>o.name==='coastal-flight'||o.name.startsWith('coast-life-')&&o.name.includes('-gull-');
/** One stable authoring policy; no finished native layer reorder. */
export function orderCoastAerialOverlays(overlays:readonly LayoutAnimatedOverlay[]):LayoutAnimatedOverlay[]{
 return[...overlays.filter(o=>!isAerial(o)),...overlays.filter(isAerial)];
}
/** Source-bound mandatory roles. Removing all descriptors cannot disable it. */
export function assertCoastAerialLayout(layout:MapLayout):void{
 const required=roles(layout.id);if(!required.length)return;
 assertAnimatedDecorationSource(layout);
 const overlays=layout.animatedOverlays??[],aerial=overlays.filter(isAerial);
 need(isDeepStrictEqual(aerial.map(o=>o.name),required),'required role roster/order changed');
 need(isDeepStrictEqual(overlays.map(o=>o.name),orderCoastAerialOverlays(overlays).map(o=>o.name)),'aquatic-before-aerial source order changed');
 if(layout.id!=='shipyard-beach')return;
 need(layout.width===48&&layout.height===48,'registered aircraft map dimensions changed');
 const flight=aerial[0],rect={x:flight.x,y:flight.y,width:flight.width,height:flight.height};
 need(isDeepStrictEqual(rect,COASTAL_FLIGHT_RECT),'peripheral aircraft band changed');
 const terrain=Array(layout.width*layout.height).fill('')as string[];
 for(const p of layout.placements.filter(p=>p.layer==='terrain'))for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++)terrain[y*layout.width+x]=p.sprite;
 need(sha(terrain.slice(0,144))===topBand.terrain,'genuine top-band terrain changed');
 const propCells=new Set<number>();
 for(const p of layout.placements.filter(p=>p.layer!=='terrain'&&p.sprite!=='beach-sea-veil'))for(let y=Math.max(0,p.y);y<Math.min(3,p.y+p.height);y++)for(let x=p.x;x<p.x+p.width;x++)propCells.add(y*48+x);
 need(sha([...propCells].sort((a,b)=>a-b).map(i=>[i%48,Math.floor(i/48)]))===topBand.props,'genuine top-band prop footprint changed');
 const overlap=(p:{x:number;y:number;width:number;height:number})=>p.x<48&&p.x+p.width>0&&p.y<3&&p.y+p.height>0;
 need(![...layout.entries,...layout.exits,...layout.areas].some(overlap),'aircraft crosses an entry/exit/activity footprint');
}
/** Current boundary also binds physical DATA and avatar depth; full native
 * envelopes/atlas/frame/order parity remains owned by native-projection.ts. */
export function assertNativeCoastAerial(map:TiledMap,layout:MapLayout,catalog:TileCatalog):void{
 assertCoastAerialLayout(layout);const required=roles(layout.id);if(!required.length)return;
 assertNativeAnimationSafety(map,layout,catalog);
 if(layout.id==='shipyard-beach'){
  const masks=map.layers.filter(l=>l.name==='physical-collisions');need(masks.length===1&&masks[0].type==='tilelayer','physical mask is missing');
  if(masks[0].type==='tilelayer')need(sha(masks[0].data.slice(0,144).map(Boolean))===topBand.blocked,'genuine top-band physical mask changed');
 }
}
