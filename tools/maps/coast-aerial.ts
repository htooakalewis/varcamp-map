import{createHash}from'node:crypto';
import{isDeepStrictEqual}from'node:util';
import type{LayoutAnimatedOverlay,MapLayout,TiledMap}from'./types';
import type{TileCatalog}from'../art/catalog';
import{assertAnimatedDecorationSource,assertNativeAnimationSafety}from'./animated-decoration';

/** Original aircraft pixels stay native. This spawn-strip band (rows5-7, just
 * under the shoreline) is mixed:36 naval-water +26 curved-water +35 curved-land
 * +47 sand cells;64 blocked and80 walkable,54 existing prop footprint cells. It
 * crosses the shipyard-entry rows6-7. By the2026-10-24 owner decision the
 * aircraft is purely visual and drawn above every tile, object and attendee
 * (contract role 'aircraft'), so that entry overlap is accepted; no sign is
 * crossed. */
export const COASTAL_FLIGHT_RECT={x:0,y:5,width:48,height:3}as const;
const aerialRoles={
 'shipyard-beach':['coastal-flight','coast-life-harbor-gull-north','coast-life-harbor-gull-south'],
 'constellation-shore':['coast-life-shore-gull-north','coast-life-shore-gull-south'],
}as const;
// Genuine pre-correction source/native DATA for rows5-7, not hashes from a
// candidate being checked: shipyard terrain, props and physical mask unchanged.
const band={terrain:'421a5004204b5aaf9df4cf3ea8c7d9c979f1e9e80e3b86bfa61c856ba8ad3d0b',blocked:'8a7b430a8d7ee98e954c79c336ef85559e9b3b68007f00c2c805ce18b73f5f66',props:'295a20b3aea18fe0a8ffc37803895ba7fe8930ab830c6a016d0b694d300961d2'};
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
 // The2026-10-24 owner decision supersedes the former entry/exit/activity ban for
 // the aircraft only (it draws above everything); standing labels stay clear.
 need(!(layout.signs??[]).some(overlap),'aircraft crosses a sign footprint');
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
