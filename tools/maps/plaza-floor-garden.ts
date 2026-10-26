import {isDeepStrictEqual} from 'node:util';
import {SIGN_IDS} from '../../src/world/catalog';
import routes from '../../world/plaza-guide-before-spacing.json';
import {EXPO_PLAZA,isExpoPlaza} from './expo-plaza';
import type {MapLayout,Placement,TileRect} from './types';
const cells=(r:TileRect)=>Array.from({length:r.width*r.height},(_,i)=>[r.x+i%r.width,r.y+Math.floor(i/r.width)] as const);
/** One deterministic forward source operation. Entrances, activities and room labels are never redrawn. */
export function refinePlazaFloorGarden(original:MapLayout):MapLayout{
 if(original.id!=='overworld'||original.width!==128||original.height!==128)throw Error('Closed 128² plaza source required');
 const l=structuredClone(original),removed=(id:string)=>/^standing-sponsor-|^sponsor-frame-|^sponsor-trim-|^reception-post-brand-|^varcamp-nameplate$|^plaza-garden-/.test(id)||SIGN_IDS.some(s=>id===`${s}-zodiac-emblem`||id===`${s}-zodiac-threshold`);
 l.placements=l.placements.filter(p=>!removed(p.id));
 l.standingSigns=l.standingSigns?.filter(s=>s.face!=='varcamp-nameplate'&&s.faceKind!=='image');
 l.images=(l.images??[]).filter(p=>p.name!=='VarCamp 2026 Floor').map(p=>({...p,standing:false}));
 l.images.push({name:'VarCamp 2026 Floor',image:'assets/sponsors/varcamp-2026.png',x:60,y:60,width:6,height:2,standing:false});
 const swaps:Record<string,string>={'tree-round':'plaza-tree-round','tree-flowering':'plaza-tree-flowering','tree-evergreen':'plaza-tree-evergreen','plant-tree':'plaza-plant-tree','flower-bed':'plaza-flower-bed','plant-grass':'plaza-plant-grass','plant-flower':'plaza-plant-flower'};
 for(const p of l.placements){
  if(p.sprite==='ground-grass')p.sprite=`plaza-grass-0${1+(p.x*3+p.y*7)%4}`;
  if(swaps[p.sprite]){p.sprite=swaps[p.sprite];delete p.renderRole;}
  const sign=SIGN_IDS.find(s=>p.id===`${s}-building`);
  if(sign)p.sprite=`plaza-building-0${1+SIGN_IDS.indexOf(sign)%4}`;
 }
 for(const sign of SIGN_IDS){const p=l.placements.find(p=>p.id===`${sign}-building`);if(!p)throw Error(`Missing existing ${sign} building`);l.placements.push({id:`${sign}-zodiac-threshold`,sprite:`zodiac-emblem-${sign}`,x:p.x+4,y:p.y+12,width:4,height:4,layer:'props'});}
 const protectedCells=new Set<string>(),occupied=new Set<string>(),ground=new Map<string,string>();
 for(const p of l.placements)if(p.layer==='terrain')for(const [x,y] of cells(p))ground.set(`${x},${y}`,p.sprite);
 for(const r of [...l.entries,...l.exits,...l.areas,...(l.signs??[]),...(l.images??[])])for(const [x,y] of cells(r))protectedCells.add(`${x},${y}`);
 for(const [x,y] of routes.allowedCells)protectedCells.add(`${x},${y}`);
 for(const p of l.placements)if(!['terrain','atmosphere'].includes(p.layer))for(const [x,y] of cells(p))occupied.add(`${x},${y}`);
 const groups:{id:string;x:number;y:number;radius:number}[]=[];
 for(const sign of SIGN_IDS){const b=l.placements.find(p=>p.id===`${sign}-building`)!;groups.push({id:sign,x:b.x+6,y:b.y+6,radius:14});}
 for(let i=0;i<8;i++){const a=i*Math.PI/4;groups.push({id:`outer-${i}`,x:Math.round(64+53*Math.cos(a)),y:Math.round(64+53*Math.sin(a)),radius:9});}
 for(const [i,[x,y]] of [[47,52],[82,52],[47,75],[82,75]].entries())groups.push({id:`inner-${i}`,x,y,radius:8});
 const dimensions:Record<string,[number,number]>={'plaza-tree-birch':[2,3],'plaza-tree-round':[2,3],'plaza-shrub':[2,1],'plaza-blueberry':[2,1],'plaza-lavender':[2,1],'plaza-fern':[1,1],'plaza-hosta':[1,1],'plaza-grass-tuft':[1,1],'plaza-clover':[1,1],'plaza-moss-stones':[1,1],'plaza-mushrooms':[1,1]};
 // The expo plaza paved the two south inner gardens; after that closed operation they are not regrown.
 const retired=isExpoPlaza(l)?new Set(EXPO_PLAZA.retiredGardens):new Set<string>();
 for(const [gi,g] of groups.entries()){
  if(retired.has(g.id))continue;
  const requested=[gi%2?'plaza-tree-birch':'plaza-tree-round','plaza-shrub',gi%2?'plaza-blueberry':'plaza-lavender','plaza-fern','plaza-grass-tuft',gi%3?'plaza-clover':'plaza-mushrooms'];
  const candidates=[];for(let y=Math.max(2,g.y-g.radius);y<Math.min(125,g.y+g.radius);y++)for(let x=Math.max(2,g.x-g.radius);x<Math.min(125,g.x+g.radius);x++)candidates.push({x,y,d:(x-g.x)**2+(y-g.y)**2});
  candidates.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);
  for(const [i,sprite] of requested.entries()){
   const [width,height]=dimensions[sprite],at=candidates.find(c=>cells({...c,width,height}).every(([x,y])=>ground.get(`${x},${y}`)?.startsWith('plaza-grass-')&&!protectedCells.has(`${x},${y}`)&&!occupied.has(`${x},${y}`)));
   if(!at)throw Error(`Garden ${g.id} has no safe native footprint for ${sprite}`);
   const p:Placement={id:`plaza-garden-${g.id}-${i}`,sprite,x:at.x,y:at.y,width,height,layer:'props'};
   l.placements.push(p);for(const [x,y] of cells(p))occupied.add(`${x},${y}`);
  }
 }
 for(const key of ['entries','exits','areas','signs','inspectionZones'] as const)if(!isDeepStrictEqual(l[key],original[key]))throw Error(`Plaza operation changed protected ${key}`);
 return l;
}
