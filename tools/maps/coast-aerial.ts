import{createHash}from'node:crypto';
import{isDeepStrictEqual}from'node:util';
import type{LayoutAnimatedOverlay,MapLayout,TiledMap}from'./types';
import type{TileCatalog}from'../art/catalog';
import{assertAnimatedDecorationSource,assertNativeAnimationSafety}from'./animated-decoration';

/** Original aircraft pixels stay native. This upper-middle beach band (rows
 * 11-13) is mostly shore, not sea:16 naval-water +8 curved-water +7 curved-land
 * +113 sand cells;38 blocked and106 walkable,47 existing prop footprint cells.
 * Avatar foreground (belowAvatar) is therefore
 * mandatory: the aircraft passes under attendees, never over them. No
 * entry/exit/activity/sign is crossed. */
export const COASTAL_FLIGHT_RECT={x:0,y:11,width:48,height:3}as const;
const aerialRoles={
 'shipyard-beach':['coastal-flight','coast-life-harbor-gull-north','coast-life-harbor-gull-south'],
 'constellation-shore':['coast-life-shore-gull-north','coast-life-shore-gull-south'],
}as const;
// Genuine pre-correction source/native DATA for rows11-13, not hashes from a
// candidate being checked: shipyard terrain, props and physical mask unchanged.
const band={terrain:'aa78aaa63915225a254013ae027e78c3674a537c0f73b4cdbfd8c78a02806c8f',blocked:'c65f15f5761c6a9c90f315be481b7f3b7d4d8911d2fbf1d983643124292b2bd4',props:'6beea084522b08b7aac90871021fa9a38717a35323187d937311960bf5223afb'};
const bandCells=(rows:number)=>({from:COASTAL_FLIGHT_RECT.y*48,to:(COASTAL_FLIGHT_RECT.y+rows)*48});
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
 need(sha(terrain.slice(bandCells(3).from,bandCells(3).to))===band.terrain,'genuine flight-band terrain changed');
 const propCells=new Set<number>();
 for(const p of layout.placements.filter(p=>p.layer!=='terrain'&&p.sprite!=='beach-sea-veil'))for(let y=Math.max(rect.y,p.y);y<Math.min(rect.y+3,p.y+p.height);y++)for(let x=p.x;x<p.x+p.width;x++)propCells.add(y*48+x);
 need(sha([...propCells].sort((a,b)=>a-b).map(i=>[i%48,Math.floor(i/48)]))===band.props,'genuine flight-band prop footprint changed');
 const overlap=(p:{x:number;y:number;width:number;height:number})=>p.x<48&&p.x+p.width>0&&p.y<rect.y+3&&p.y+p.height>rect.y;
 need(![...layout.entries,...layout.exits,...layout.areas,...layout.signs??[]].some(overlap),'aircraft crosses an entry/exit/activity/sign footprint');
}
/** Current boundary also binds physical DATA and avatar depth; full native
 * envelopes/atlas/frame/order parity remains owned by native-projection.ts. */
export function assertNativeCoastAerial(map:TiledMap,layout:MapLayout,catalog:TileCatalog):void{
 assertCoastAerialLayout(layout);const required=roles(layout.id);if(!required.length)return;
 assertNativeAnimationSafety(map,layout,catalog);
 if(layout.id==='shipyard-beach'){
  const masks=map.layers.filter(l=>l.name==='physical-collisions');need(masks.length===1&&masks[0].type==='tilelayer','physical mask is missing');
  if(masks[0].type==='tilelayer')need(sha(masks[0].data.slice(bandCells(3).from,bandCells(3).to).map(Boolean))===band.blocked,'genuine flight-band physical mask changed');
 }
}
