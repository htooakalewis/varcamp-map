import {isDeepStrictEqual} from 'node:util';
import routes from '../../src/bots/lyra-routes.json';
import {EXPO_PLAZA,expoPlazaNative,isExpoPlaza} from './expo-plaza';
import type {TileCatalog} from '../art/catalog';
import type {MapLayout,Placement,TileRect,TiledMap} from './types';
/** Owner-provided brand assets: one closed forward source operation applied after the expo hall.
 * The ornate azure fountain (a 4x3 original sprite, `plaza-fountain`) stands in the west half of the
 * welcome reception court, mirroring the Roadster display across the central axis; six lamp posts
 * (`plaza-lamp`, 1x3) line both edge columns of the central road inside the expo hall. Every cell
 * stays off the audited guide graph (src/bots/lyra-routes.json), off every entry/exit/area/image and
 * off every existing prop. Avatar depth: the fountain's basin rows block and its top row (spout and
 * planter tops) is a walkable canopy whose north neighbour is the guide row, so no raised tile sits
 * directly north of a walkable cell; a lamp's lantern is above avatars and its pole and base both
 * block, so no woka can stand under the lantern. The native side is the same projection transaction
 * the expo hall uses: both ordinary art atlases are admitted after the expo family as the
 * `BRAND_ASSETS` reservation (tools/maps/native-ownership-context.ts). */
export const BRAND_ASSETS=Object.freeze({
 /** First brand placement; its presence marks a layout as post-brand. */
 marker:'plaza-fountain',
 fountain:{id:'plaza-fountain',sprite:'plaza-fountain',x:49,y:70,width:4,height:3} as Placement&TileRect,
 /** Lamp posts on the road's edge columns (the guide corridor is x63-64), evenly spaced on rows that
  * keep every lamp cell off the aisle (80-81) and the walkway (89): bases on 74, 79 and 84. */
 lampColumns:[62,65] as readonly number[],
 lampBases:[74,79,84] as readonly number[],
 lampSprite:'plaza-lamp',
});
const r=(x:number,y:number,width:number,height:number):TileRect=>({x,y,width,height});
/** Deterministic expansion: the fountain, then the lamps column by column, base by base. */
export function brandAssetPlacements():Placement[]{
 const out:Placement[]=[{...BRAND_ASSETS.fountain,layer:'props'}];
 for(const x of BRAND_ASSETS.lampColumns)for(const base of BRAND_ASSETS.lampBases)out.push({id:`plaza-lamp-${x}-${base}`,sprite:BRAND_ASSETS.lampSprite,layer:'props',...r(x,base-2,1,3)});
 return out;
}
export const isBrandAssets=(layout:MapLayout):boolean=>layout.placements.some(p=>p.id===BRAND_ASSETS.marker);
const cells=(p:TileRect)=>Array.from({length:p.width*p.height},(_,i)=>[p.x+i%p.width,p.y+Math.floor(i/p.width)] as const);
const overlaps=(a:TileRect,b:TileRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const isTail=(p:Placement)=>/-zodiac-threshold$|^plaza-garden-/.test(p.id);
/** Pure forward operation on the expo plaza. Protected controls, images, signs and every existing
 * placement are never touched; the court fountain stays inside the reception court above the hall
 * cap row and the lamps on the road's edge columns inside the hall band. */
export function applyBrandAssets(original:MapLayout):MapLayout{
 if(original.id!=='overworld'||original.width!==128||original.height!==128)throw Error('Closed 128² plaza source required');
 if(!isExpoPlaza(original))throw Error('Brand assets require the expo plaza');
 if(isBrandAssets(original))throw Error('Brand assets already applied');
 const l=structuredClone(original),ids=new Set(l.placements.map(p=>p.id)),added=brandAssetPlacements();
 const guide=new Set(routes.allowedCells.map(([x,y])=>`${x},${y}`)),{hall,road,capRow}=EXPO_PLAZA;
 const props=l.placements.filter(p=>!['terrain','atmosphere'].includes(p.layer)),controls:TileRect[]=[...l.entries,...l.exits,...l.areas,...(l.signs??[]),...(l.images??[])];
 for(const p of added){
  if(ids.has(p.id))throw Error(`Brand placement id already used: ${p.id}`);ids.add(p.id);
  const lamp=p.sprite===BRAND_ASSETS.lampSprite;
  for(const [x,y] of cells(p)){
   if(guide.has(`${x},${y}`))throw Error(`Brand ${p.id} covers a guide cell ${x},${y}`);
   if(lamp){if(x<road.x||x>=road.x+road.width||y<hall.y-2||y>=hall.y+hall.height)throw Error(`Brand ${p.id} leaves the hall road at ${x},${y}`);if(x===road.x+1||x===road.x+2)throw Error(`Brand ${p.id} covers the guide corridor at ${x},${y}`);}
   else if(y>=capRow||x>=road.x)throw Error(`Brand ${p.id} leaves the west reception court at ${x},${y}`);
  }
  for(const q of props)if(overlaps(p,q))throw Error(`Brand ${p.id} overlaps ${q.id}`);
  for(const c of controls)if(overlaps(p,c))throw Error(`Brand ${p.id} overlaps a protected control`);
 }
 // refinePlazaFloorGarden keeps thresholds and gardens last; the brand assets sit before that tail.
 const tail=l.placements.findIndex(isTail);
 l.placements.splice(tail<0?l.placements.length:tail,0,...added);
 for(const key of ['entries','exits','areas','inspectionZones','animatedOverlays','images','signs','standingSigns'] as const)if(!isDeepStrictEqual(l[key],original[key]))throw Error(`Brand operation changed protected ${key}`);
 if(!isDeepStrictEqual(l.placements.filter(p=>!added.some(a=>a.id===p.id)),original.placements))throw Error('Brand operation changed protected placements');
 return l;
}
/** Native side: the expo projection transaction (collision mask remapped through the shared
 * navigation-mask reservation, every painted layer rebuilt, the brand atlases admitted after the
 * expo family), so the result is exactly the projection of the brand source. */
export function brandAssetsNative(native:TiledMap,layout:MapLayout,catalog:TileCatalog):TiledMap{
 if(!isBrandAssets(layout))throw Error('Brand native requires the brand source');
 return expoPlazaNative(native,layout,catalog);
}
