import {isDeepStrictEqual} from 'node:util';
import routes from '../../src/bots/lyra-routes.json';
import {buildMap} from './builder';
import {reconcileNativeProjection} from './native-projection';
import type {TileCatalog} from '../art/catalog';
import type {MapLayout,Placement,TileRect,TiledMap,TileLayer} from './types';
/** Expo plaza: one closed forward source operation applied after the welcome-sign
 * retirement. The two plaza-grove gardens under the reception (rows 74-90, x36-92)
 * become ten expo booths. Every booth uses atlases already reserved by the current
 * overworld native context; the audited guide corridors stay prop-free and act as
 * the open gaps between booths. Sponsor marks and pixel captions are not part of
 * this operation: both need atlases outside the frozen native reservation roster. */
export const EXPO_PLAZA=Object.freeze({
 /** First expo placement; its presence marks a layout as post-expo. */
 marker:'expo-a1-floor-0',
 /** Garden groups of refinePlazaFloorGarden whose only grass was paved by the expo. */
 retiredGardens:['inner-2','inner-3'] as readonly string[],
 /** Grove furniture, trees, flowers, lily pads, both ponds and the three lawn strips of the two south gardens. */
 retiredPlacements:[
  'inner-garden-southwest-tree-0','inner-garden-southwest-tree-1','inner-garden-southwest-tree-2','inner-garden-southwest-flower','inner-garden-southwest-bench','inner-garden-southwest-tea-table',
  'inner-garden-southeast-tree-0','inner-garden-southeast-tree-1','inner-garden-southeast-tree-2','inner-garden-southeast-flower','inner-garden-southeast-bench','inner-garden-southeast-tea-table',
  'water-garden-west-bench','water-garden-east-bench','water-garden-west-lily','water-garden-east-lily','water-garden-west','water-garden-east',
  'inner-garden-southwest-lawn','inner-garden-southeast-lawn-east','inner-garden-southeast-lawn-south',
  ...['inner-2','inner-3'].flatMap(g=>[0,1,2,3,4,5].map(i=>`plaza-garden-${g}-${i}`)),
 ] as readonly string[],
 /** Inside-court cell range per row (the gold ring is the boundary); rows outside are untouched. */
 court:{73:[38,89],74:[39,88],75:[39,88],76:[40,87],77:[40,87],78:[41,86],79:[41,86],80:[42,86],81:[43,86],82:[43,86],83:[45,82],84:[46,81],85:[47,80],86:[48,79],87:[50,77],88:[52,75]} as Record<number,[number,number]>,
});
export interface ExpoBooth{id:string;name:string;kind:'sponsor'|'hub';floor:TileRect[];walls:TileRect[];glass:TileRect[];sills:TileRect[];counter:{x:number;y:number};chair?:{x:number;y:number};palm?:{x:number;y:number};stickers:[number,number][];}
const r=(x:number,y:number,width:number,height:number):TileRect=>({x,y,width,height});
/** Row A faces south (aisle rows 80-81); Row B faces north into the same aisle. */
export const EXPO_BOOTHS:readonly ExpoBooth[]=Object.freeze([
 {id:'a1',name:'DEMO ORBIT',kind:'sponsor',floor:[r(40,73,6,5),r(41,78,5,2)],walls:[r(39,73,7,2)],glass:[],sills:[],counter:{x:41,y:78},chair:{x:41,y:76},palm:{x:43,y:75},stickers:[[40,75],[40,76],[40,77]]},
 {id:'a2',name:'DEMO NOVA',kind:'sponsor',floor:[r(46,73,6,7)],walls:[r(46,73,6,2),r(46,75,1,4)],glass:[],sills:[],counter:{x:47,y:78},chair:{x:47,y:76},stickers:[[49,75],[50,75],[51,75]]},
 {id:'a3',name:'CODE CIRCLE',kind:'hub',floor:[r(53,73,5,7)],walls:[r(56,73,2,2)],glass:[r(53,73,3,2)],sills:[],counter:{x:53,y:78},chair:{x:53,y:76},stickers:[[55,75],[56,75],[57,75]]},
 {id:'a4',name:'DESIGN GUILD',kind:'hub',floor:[r(71,74,5,6)],walls:[r(74,74,1,2)],glass:[r(71,74,3,2)],sills:[],counter:{x:71,y:78},chair:{x:71,y:76},stickers:[[74,76],[75,76],[75,77]]},
 {id:'a5',name:'DEMO ATLAS',kind:'sponsor',floor:[r(77,74,7,6)],walls:[r(77,74,7,2),r(83,76,1,4)],glass:[],sills:[],counter:{x:77,y:78},chair:{x:77,y:76},stickers:[[80,76],[81,76],[82,76]]},
 {id:'a6',name:'DEMO VECTOR',kind:'sponsor',floor:[r(84,73,5,3),r(84,76,4,2),r(84,78,3,2)],walls:[r(84,73,5,2)],glass:[],sills:[],counter:{x:84,y:78},chair:{x:84,y:76},stickers:[[86,75],[87,75],[88,75]]},
 {id:'b1',name:'DATA CLUB',kind:'hub',floor:[r(46,82,5,3),r(47,85,4,1)],walls:[r(46,82,1,2)],glass:[],sills:[r(47,84,4,2)],counter:{x:49,y:82},stickers:[[47,84],[48,84],[47,83]]},
 {id:'b2',name:'GAME JAM',kind:'hub',floor:[r(52,82,4,7)],walls:[r(55,87,1,2)],glass:[r(52,87,3,2)],sills:[],counter:{x:52,y:82},chair:{x:52,y:84},stickers:[[55,84],[55,85],[55,86]]},
 {id:'b3',name:'DEMO LUMEN',kind:'sponsor',floor:[r(71,82,5,7)],walls:[r(71,87,5,2)],glass:[],sills:[],counter:{x:71,y:82},chair:{x:71,y:84},stickers:[[75,84],[75,85],[75,86]]},
 {id:'b4',name:'OPEN SOURCE',kind:'hub',floor:[r(77,82,5,3),r(77,85,4,1)],walls:[r(81,82,1,2)],glass:[],sills:[r(77,84,4,2)],counter:{x:77,y:82},stickers:[[79,84],[80,84],[80,83]]},
]);
const SIGILS=['sigil-fire','sigil-earth','sigil-air','sigil-water'];
/** Deterministic expansion; terrain floors first so the walls' bases sit on booth floor. */
export function expoPlacements():Placement[]{
 const out:Placement[]=[];
 for(const [i,b] of EXPO_BOOTHS.entries()){
  const prefix=`expo-${b.id}`,floor=b.kind==='sponsor'?'floor-cosmic':'floor-wood';
  b.floor.forEach((f,n)=>out.push({id:`${prefix}-floor-${n}`,sprite:floor,layer:'terrain',...f}));
  b.walls.forEach((w,n)=>out.push({id:`${prefix}-wall-${n}`,sprite:'wall-navy',layer:'props',...w}));
  b.glass.forEach((g,n)=>out.push({id:`${prefix}-glass-${n}`,sprite:'glass-partition',layer:'props',...g}));
  b.sills.forEach((s,n)=>out.push({id:`${prefix}-sill-${n}`,sprite:'wall-navy',layer:'props',renderRole:'cutaway',...s}));
  out.push({id:`${prefix}-counter`,sprite:b.kind==='sponsor'?'desk-cream':'table-workshop',layer:'props',x:b.counter.x,y:b.counter.y,width:2,height:2});
  if(b.chair)out.push({id:`${prefix}-chair`,sprite:'chair-presentation',layer:'props',x:b.chair.x,y:b.chair.y,width:1,height:2});
  if(b.palm)out.push({id:`${prefix}-palm`,sprite:'plant-palm',layer:'props',x:b.palm.x,y:b.palm.y,width:3,height:3});
  b.stickers.forEach(([x,y],n)=>out.push({id:`${prefix}-sticker-${n}`,sprite:SIGILS[(i+n)%4],layer:'props',x,y,width:1,height:1}));
 }
 return out;
}
export const isExpoPlaza=(layout:MapLayout):boolean=>layout.placements.some(p=>p.id===EXPO_PLAZA.marker);
const cells=(p:TileRect)=>Array.from({length:p.width*p.height},(_,i)=>[p.x+i%p.width,p.y+Math.floor(i/p.width)] as const);
/** Pure forward operation on the retired-sign plaza. Protected controls, images and
 * standing signs are never touched; every expo cell stays inside the court and off
 * the audited guide graph (floors are terrain and may underlie a guide cell). */
export function applyExpoPlaza(original:MapLayout):MapLayout{
 if(original.id!=='overworld'||original.width!==128||original.height!==128)throw Error('Closed 128² plaza source required');
 if(isExpoPlaza(original))throw Error('Expo plaza already applied');
 const l=structuredClone(original),ids=new Set(l.placements.map(p=>p.id));
 for(const id of EXPO_PLAZA.retiredPlacements)if(l.placements.filter(p=>p.id===id).length!==1)throw Error(`Expo retires missing/ambiguous placement ${id}`);
 l.placements=l.placements.filter(p=>!EXPO_PLAZA.retiredPlacements.includes(p.id));
 const guide=new Set(routes.allowedCells.map(([x,y])=>`${x},${y}`)),added=expoPlacements();
 for(const p of added){
  if(ids.has(p.id))throw Error(`Expo placement id already used: ${p.id}`);ids.add(p.id);
  for(const [x,y] of cells(p)){
   const range=EXPO_PLAZA.court[y];if(!range||x<range[0]||x>range[1])throw Error(`Expo ${p.id} leaves the court at ${x},${y}`);
   if(p.layer!=='terrain'&&guide.has(`${x},${y}`))throw Error(`Expo ${p.id} covers guide cell ${x},${y}`);
  }
 }
 // refinePlazaFloorGarden re-appends thresholds and gardens last; the expo sits before that tail.
 const tail=l.placements.findIndex(p=>/-zodiac-threshold$|^plaza-garden-/.test(p.id));
 l.placements.splice(tail<0?l.placements.length:tail,0,...added);
 for(const key of ['entries','exits','areas','signs','inspectionZones','images','standingSigns','animatedOverlays'] as const)if(!isDeepStrictEqual(l[key],original[key]))throw Error(`Expo operation changed protected ${key}`);
 return l;
}
const one=<T>(rows:T[],what:string):T=>{if(rows.length!==1)throw Error(`Expo native ${what} missing/ambiguous`);return rows[0];};
/** Native side of the same operation. The projection transaction rebuilds every painted
 * layer; the invisible collision mask is remapped through the shared navigation-mask
 * reservation first, so the result is exactly the projection of the expo source. */
export function expoPlazaNative(native:TiledMap,layout:MapLayout,catalog:TileCatalog):TiledMap{
 if(!isExpoPlaza(layout))throw Error('Expo native requires the expo source');
 const intended=buildMap(layout,catalog).tmj,result=structuredClone(native);
 const mask=(m:TiledMap)=>one(m.tilesets.filter(t=>t.name==='navigation-mask'),'navigation mask');
 const collisions=(m:TiledMap)=>one(m.layers.filter(l=>l.name==='physical-collisions'&&l.type==='tilelayer'),'collision layer') as TileLayer;
 const from=mask(intended),to=mask(result);
 if(!isDeepStrictEqual({...from,firstgid:0},{...to,firstgid:0}))throw Error('Expo native navigation mask body changed');
 collisions(result).data=collisions(intended).data.map(g=>{if(!g)return 0;if(g<from.firstgid||g>=from.firstgid+from.tilecount!)throw Error('Expo collision cell outside the navigation mask');return to.firstgid+g-from.firstgid;});
 return reconcileNativeProjection(result,intended);
}
