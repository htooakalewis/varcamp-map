import {isDeepStrictEqual} from 'node:util';
import routes from '../../src/bots/lyra-routes.json';
import {buildMap} from './builder';
import {EXPO_STICKERS,expoCaption,expoLogoImage,expoSticker,withExpoCaption} from './expo-fixtures';
import {reconcileNativeProjection} from './native-projection';
import type {ExpoCaption,ExpoMarkId,ExpoSticker} from './expo-fixtures';
import type {TileCatalog} from '../art/catalog';
import type {LayoutImage,MapLayout,Placement,TileRect,TiledMap,TileLayer} from './types';
/** Expo hall: one closed forward source operation applied after the welcome-sign
 * retirement. The band under the welcome reception (rows 74-89, x40-87) becomes one
 * rectangular exhibition hall on a single floor-charcoal floor: two mirrored blocks
 * (west x40-58, east x69-87) either side of the central road (x60-67, the main aisle),
 * each block holding two rows of three identical 5x4 stalls facing a shared two-row
 * aisle (rows 80-81). Row 89 is the clear south walkway. The audited guide graph runs on
 * the road, the aisle and the walkway only. Every stall carries its fixtures from the expo
 * epoch (tools/maps/expo-fixtures.ts): the registered 4x2 booth mark as a floor inlay on
 * the carpet reserve, three sticker decals along the back wall and a nameplate caption on
 * the back-wall cap row (fascia over blocking posts), rendered by the overworld's own
 * standing-captions atlas. The remaining walls, poster, chair, counter and balloons use
 * atlases the overworld native context already reserves. */
export const EXPO_PLAZA=Object.freeze({
 /** First expo placement; its presence marks a layout as post-expo. */
 marker:'expo-hall-floor-west',
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
 /** Hall floor rectangle (terrain); the reception rows <=73 and the pavilion rows >=90 keep their terrain. */
 hall:{x:40,y:74,width:48,height:16} as TileRect,
 /** Central road columns (path-stone) left untouched inside the hall rectangle. */
 road:{x:60,width:8},
 /** Stall fronts open onto this two-row aisle; the south walkway is one clear row. */
 aisle:{y:80,height:2},walkway:{y:89},
 /** Wall caps of the north back walls rise one row above the hall floor; nothing else leaves it. */
 capRow:73,
 floor:'floor-charcoal',carpet:{sponsor:'floor-cosmic',hub:'floor-wood'} as Record<'sponsor'|'hub',string>,
 /** Registered 4x2 booth mark per stall (tools/maps/native-ownership-context.ts EXPO_MARKS). The expo
  * family admits every mark at most once and registers no 4x2 VarCamp mark, so the INFO DESK (n6) and
  * the YOUR LOGO HERE (s6) stalls carry a nameplate over an empty carpet reserve. */
 marks:{n1:'demo-01-compact',n2:'demo-02-compact',n3:'demo-03-compact',n4:'demo-04',n5:'demo-05',s1:'hub-01',s2:'hub-02',s3:'hub-03',s4:'hub-04',s5:'hub-05'} as Readonly<Record<string,ExpoMarkId|undefined>>,
 /** Nameplate fit policy: the narrowest width whose 18px glyphs fit. Three tiles sit centred on the
  * five-column back wall, four tiles take the columns beside the poster, five tiles the whole wall
  * (that stall hangs no poster). */
 nameplateWidths:[3,4,5] as readonly number[],
 /** Three sticker decals per stall, rotating through the six sticker sprites by stall index. */
 stickers:EXPO_STICKERS as readonly ExpoSticker[],
});
export interface ExpoBooth{
 id:string;block:'west'|'east';row:'north'|'south';kind:'sponsor'|'hub';name:string;
 /** Position in EXPO_BOOTHS: n1-n6 are 0-5, s1-s6 are 6-11. */index:number;
 /** Registered 4x2 mark inlaid on the logo reserve, if the stall has one. */mark?:ExpoMarkId;
 /** 5x4 carpeted interior. */interior:TileRect;
 /** Carpet-only 4x2 rectangle just inside the sticker row, carrying the logo inlay. */logo:TileRect;
 /** 2x2 desk-cream counter; its blocking front row is the counter line. */counter:TileRect;
 /** 1x2 chair-presentation behind the counter on the interior side. */chair:TileRect;
 /** Three sticker decals on the interior row next to the back wall, and their sprites. */stickers:[number,number][];stickerSprites:[ExpoSticker,ExpoSticker,ExpoSticker];
 /** Two balloon bunches on the front corners of the counter line. */balloons:TileRect[];
 /** Framed poster on the back-wall column over the presenter's chair (omitted when the nameplate needs the whole wall). */poster:TileRect;
 /** Back-wall cells (cap row + face row) and the x of both side-wall columns. */backWall:TileRect;sides:[number,number];
}
const r=(x:number,y:number,width:number,height:number):TileRect=>({x,y,width,height});
const NAMES={north:['DEMO ORBIT','DEMO NOVA','DEMO ATLAS','DEMO VECTOR','DEMO LUMEN','INFO DESK'],south:['CODE CIRCLE','DESIGN GUILD','DATA CLUB','GAME JAM','OPEN SOURCE','YOUR LOGO HERE']};
/** Geometry of one stall. West stalls put the logo on the left and the chair on the right;
 * east stalls are their mirror image about the road centre (x63.5), so a visitor walking
 * either aisle sees six identical fronts per block. North stalls: cap row 73, wall face 74,
 * interior 75-78, counter line 79. South stalls: counter line 82, interior 83-86, cap 87,
 * wall face 88 (the wall-navy sprite is cap-over-face, so the south back wall ends on 88). */
function booth(block:'west'|'east',row:'north'|'south',i:number):ExpoBooth{
 const x0=block==='west'?41+6*i:70+6*i,m=block==='west'?(c:number)=>x0+c:(c:number)=>x0+4-c;
 const north=row==='north',y=north?75:83,slot=block==='west'?i:i+3,id=`${north?'n':'s'}${slot+1}`,kind=north?'sponsor':'hub',index=(north?0:6)+slot;
 return {
  id,block,row,kind,name:NAMES[row][slot],index,mark:EXPO_PLAZA.marks[id],interior:r(x0,y,5,4),
  logo:r(Math.min(m(0),m(3)),north?76:84,4,2),counter:r(Math.min(m(2),m(3)),north?78:82,2,2),chair:r(m(4),north?76:84,1,2),
  stickers:[[x0,north?75:86],[x0+2,north?75:86],[x0+4,north?75:86]],stickerSprites:[0,1,2].map(j=>EXPO_PLAZA.stickers[(index+j)%EXPO_PLAZA.stickers.length]) as [ExpoSticker,ExpoSticker,ExpoSticker],
  balloons:[r(x0,north?78:82,1,2),r(x0+4,north?78:82,1,2)],
  poster:r(m(4),north?73:87,1,2),backWall:r(x0,north?73:87,5,2),sides:[x0-1,x0+5],
 };
}
export const EXPO_BOOTHS:readonly ExpoBooth[]=Object.freeze((['north','south'] as const).flatMap(row=>(['west','east'] as const).flatMap(block=>[0,1,2].map(i=>booth(block,row,i)))));
/** Nameplate of one stall on its back-wall cap row, at the narrowest fitting width of the fit
 * policy: three tiles centred, four tiles on the columns beside the poster, five tiles across. */
export function boothNameplate(b:ExpoBooth):ExpoCaption{
 const {x,y}=b.backWall,posterLeft=b.poster.x===x;
 for(const width of EXPO_PLAZA.nameplateWidths){
  const nx=width===5?x:width===4?(posterLeft?x+1:x):x+1;
  try{return expoCaption(`expo-${b.id}-nameplate`,b.name,nx,y,width);}catch(error){if(!/does not fit/.test(String(error)))throw error;}
 }
 throw Error(`Expo nameplate does not fit the back wall: ${b.name}`);
}
export interface ExpoFixtures{placements:Placement[];images:LayoutImage[];captions:ExpoCaption[];}
/** Deterministic expansion; hall floor and carpets first, then per block-row the walls (with their
 * terrain seals) and the identical stall furniture. The nameplate assemblies (fascia, posts, text)
 * and the logo inlays are returned separately because they enter other layout collections. */
export function expoFixtures():ExpoFixtures{
 const out:Placement[]=[],images:LayoutImage[]=[],captions:ExpoCaption[]=[],add=(id:string,sprite:string,rect:TileRect,extra:Partial<Placement>={})=>out.push({id,sprite,layer:'props',...rect,...extra});
 const {hall,road,floor,carpet,capRow}=EXPO_PLAZA;
 out.push({id:'expo-hall-floor-west',sprite:floor,layer:'terrain',...r(hall.x,hall.y,road.x-hall.x,hall.height)});
 out.push({id:'expo-hall-floor-east',sprite:floor,layer:'terrain',...r(road.x+road.width,hall.y,hall.x+hall.width-road.x-road.width,hall.height)});
 for(const b of EXPO_BOOTHS)out.push({id:`expo-${b.id}-carpet`,sprite:carpet[b.kind],layer:'terrain',...b.interior});
 for(const row of ['north','south'] as const)for(const block of ['west','east'] as const){
  const stalls=EXPO_BOOTHS.filter(b=>b.row===row&&b.block===block),north=row==='north',wallY=north?capRow:83,prefix=`expo-${block}-${row}`;
  // Side walls: three stacked cap/face sprites from the back wall to the row before the counter line.
  // The wall-navy cap cell is opaque but does not block, so a blocking wall-charcoal terrain cell is
  // painted under every interior cap (never on the reception cap row 73) to keep the partitions solid.
  const columns=[...new Set(stalls.flatMap(b=>b.sides))].sort((a,b)=>a-b);
  for(const x of columns){
   add(`${prefix}-side-${x}`,'wall-navy',r(x,wallY,1,6));
   for(const y of north?[75,77]:[83,85,87])add(`${prefix}-seal-${x}-${y}`,'wall-charcoal',r(x,y,1,1),{layer:'terrain'});
  }
  for(const b of stalls){
   const p=`expo-${b.id}`,w=b.backWall,caption=boothNameplate(b),poster=caption.sign.width<w.width;
   if(!north)add(`${p}-seal-cap`,'wall-charcoal',r(w.x,w.y,5,1),{layer:'terrain'});
   // Back wall: the nameplate fascia and posts stand on their columns; the others are wall-navy. The poster
   // column is a grounded wall segment so the framed poster can hang on it without a second raised plane.
   for(let x=w.x;x<w.x+w.width;x++){
    if(x>=caption.face.x&&x<caption.face.x+caption.face.width)continue;
    add(`${p}-wall-${x-w.x}`,'wall-navy',r(x,w.y,1,2),poster&&x===b.poster.x?{renderRole:'grounded'}:{});
   }
   if(poster)add(`${p}-poster`,'poster-night-city',b.poster);
   b.stickers.forEach(([x,y],n)=>out.push(expoSticker(`${p}-sticker-${n}`,b.stickerSprites[n],x,y)));
   add(`${p}-chair`,'chair-presentation',b.chair);add(`${p}-counter`,'desk-cream',b.counter);
   b.balloons.forEach((rect,n)=>add(`${p}-balloons-${n}`,'balloons-party',rect));
   if(b.mark)images.push(expoLogoImage(b.mark,b.logo.x,b.logo.y));
   captions.push(caption);
  }
 }
 return {placements:out,images,captions};
}
/** Every placement the operation adds, nameplate fascias and posts included. */
export function expoPlacements():Placement[]{const f=expoFixtures();return [...f.placements,...f.captions.flatMap(c=>[c.face,...c.supports])];}
export const isExpoPlaza=(layout:MapLayout):boolean=>layout.placements.some(p=>p.id===EXPO_PLAZA.marker);
const cells=(p:TileRect)=>Array.from({length:p.width*p.height},(_,i)=>[p.x+i%p.width,p.y+Math.floor(i/p.width)] as const);
const overlaps=(a:TileRect,b:TileRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const isTail=(p:Placement)=>/-zodiac-threshold$|^plaza-garden-/.test(p.id);
/** Pure forward operation on the retired-sign plaza. Protected controls, the arrival images
 * and the existing signs are never touched; every expo cell stays inside the hall (terrain)
 * or on its cap row (props), off the road and off the audited guide graph. Logo inlays sit
 * on carpet reserves no prop covers, before the VarCamp floor identity that
 * refinePlazaFloorGarden keeps last. */
export function applyExpoPlaza(original:MapLayout):MapLayout{
 if(original.id!=='overworld'||original.width!==128||original.height!==128)throw Error('Closed 128² plaza source required');
 if(isExpoPlaza(original))throw Error('Expo plaza already applied');
 let l=structuredClone(original);const ids=new Set(l.placements.map(p=>p.id));
 for(const id of EXPO_PLAZA.retiredPlacements)if(l.placements.filter(p=>p.id===id).length!==1)throw Error(`Expo retires missing/ambiguous placement ${id}`);
 l.placements=l.placements.filter(p=>!EXPO_PLAZA.retiredPlacements.includes(p.id));
 const guide=new Set(routes.allowedCells.map(([x,y])=>`${x},${y}`)),{placements:added,images,captions}=expoFixtures(),{hall,road,capRow,aisle,walkway}=EXPO_PLAZA;
 const all=[...added,...captions.flatMap(c=>[c.face,...c.supports])];
 for(const p of all){
  if(ids.has(p.id))throw Error(`Expo placement id already used: ${p.id}`);ids.add(p.id);
  for(const [x,y] of cells(p)){
   const top=p.layer==='terrain'?hall.y:capRow;
   if(x<hall.x||x>=hall.x+hall.width||y<top||y>=hall.y+hall.height)throw Error(`Expo ${p.id} leaves the hall at ${x},${y}`);
   if(x>=road.x&&x<road.x+road.width)throw Error(`Expo ${p.id} covers the road at ${x},${y}`);
   if(p.layer!=='terrain'&&(guide.has(`${x},${y}`)||(y>=aisle.y&&y<aisle.y+aisle.height)||y===walkway.y))throw Error(`Expo ${p.id} covers an aisle/guide cell ${x},${y}`);
  }
 }
 const names=new Set((l.images??[]).map(i=>i.name)),props=[...l.placements,...all].filter(p=>!['terrain','atmosphere'].includes(p.layer));
 for(const image of images){
  if(names.has(image.name))throw Error(`Expo image name already used: ${image.name}`);names.add(image.name);
  const stall=EXPO_BOOTHS.find(b=>isDeepStrictEqual(b.logo,{x:image.x,y:image.y,width:image.width,height:image.height}));
  if(!stall||image.standing!==false)throw Error(`Expo image ${image.name} is not a stall's carpet reserve`);
  for(const [x,y] of cells(image))if(guide.has(`${x},${y}`))throw Error(`Expo ${image.name} covers a guide cell ${x},${y}`);
  for(const p of props)if(overlaps(p,image))throw Error(`Expo ${image.name} is covered by ${p.id}`);
 }
 // refinePlazaFloorGarden re-appends thresholds and gardens last; the expo sits before that tail.
 const tail=l.placements.findIndex(isTail);
 l.placements.splice(tail<0?l.placements.length:tail,0,...added);
 for(const caption of captions)l=withExpoCaption(l,caption);
 l.placements=[...l.placements.filter(p=>!isTail(p)),...l.placements.filter(isTail)];
 const floor=(l.images??[]).findIndex(i=>i.name==='VarCamp 2026 Floor');
 if(floor<0||floor!==l.images!.length-1)throw Error('Expo requires the VarCamp floor identity as the last image');
 l.images!.splice(floor,0,...images);
 for(const key of ['entries','exits','areas','inspectionZones','animatedOverlays'] as const)if(!isDeepStrictEqual(l[key],original[key]))throw Error(`Expo operation changed protected ${key}`);
 const addedNames=new Set(images.map(i=>i.name)),captionNames=new Set(captions.map(c=>c.sign.name)),captionFaces=new Set(captions.map(c=>c.standingSign.face));
 if(!isDeepStrictEqual(l.images!.filter(i=>!addedNames.has(i.name)),original.images))throw Error('Expo operation changed protected images');
 if(!isDeepStrictEqual(l.signs!.filter(s=>!captionNames.has(s.name)),original.signs??[]))throw Error('Expo operation changed protected signs');
 if(!isDeepStrictEqual(l.standingSigns!.filter(s=>!captionFaces.has(s.face)),original.standingSigns??[]))throw Error('Expo operation changed protected standingSigns');
 return l;
}
const one=<T>(rows:T[],what:string):T=>{if(rows.length!==1)throw Error(`Expo native ${what} missing/ambiguous`);return rows[0];};
/** Native side of the same operation. The projection transaction rebuilds every painted
 * layer and admits the expo reservation family (booth marks, sticker sheet, caption atlas)
 * after the fleet; the invisible collision mask is remapped through the shared
 * navigation-mask reservation first, so the result is exactly the projection of the expo
 * source. */
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
