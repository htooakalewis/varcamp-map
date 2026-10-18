import{isDeepStrictEqual}from'node:util';
import registered from'../../art/source/native-ownership-context.json';
import{WORLD_CATALOG}from'../../src/world/catalog';
import type{TiledMap,TiledLayer,TiledTileset}from'./types';

interface ContextRow{
 atlases:TiledTileset[];
 nextAtlasGid:number;
 retired:{firstgid:number;tilecount:number;name:string;image:string;ownedReferences:{layer:string;indices:number[]}[];protectedReferences:unknown[]}[];
 protectedLayers:TiledLayer[];
 protectedNonfloorOrder:string[];
}
const rows=registered.maps as unknown as Record<string,ContextRow>;
const need=(ok:unknown,message:string):void=>{if(!ok)throw Error('Native context '+message);};
// The sole new production reservation family. Names/images are independent
// authority; candidate-native bodies and allocation maxima are never inputs.
const fleetNames=['plaza-fleet-camera','plaza-fleet-delivery','plaza-fleet-survey'];
const identities=(map:TiledMap)=>map.properties?.filter(p=>p.name==='worldMapId').map(p=>String(p.value))??[];
// Domain identity comes from the independently declared current34 roster, not
// presence of a context DATA row or an art/animation marker on the input map.
const domain=Object.keys(WORLD_CATALOG).filter(id=>!id.startsWith('speaker-')&&id!=='solar-hall'&&id!=='lunar-hall').sort();

/** Exact independent pre-epoch reservations and protected native bodies. The
 * current source projection separately owns every tile layer and floorLayer.
 * WAM organizer entities/areas are outside this native ownership boundary. */
function context(actual:TiledMap,source:TiledMap):ContextRow|undefined{
 const actualIds=identities(actual),sourceIds=identities(source);
 if(![...actualIds,...sourceIds].some(id=>domain.includes(id)))return;
 need(registered.schema==='varcamp-native-ownership-context-v1','schema changed');
 need(domain.length===20&&isDeepStrictEqual(Object.keys(rows).sort(),domain),'closed twenty-map roster changed');
 need(actualIds.length===1&&sourceIds.length===1&&actualIds[0]===sourceIds[0]&&Object.hasOwn(rows,actualIds[0]),'current identity missing or contradictory');
 return rows[actualIds[0]];
}
function protectedContext(actual:TiledMap,row:ContextRow):void{
 need(isDeepStrictEqual(actual.layers.filter(l=>l.type!=='tilelayer'&&l.name!=='floorLayer'),row.protectedLayers),'protected nonfloor layer bodies/roster changed');
 need(isDeepStrictEqual(actual.layers.filter(l=>l.type!=='tilelayer').map(l=>l.name),row.protectedNonfloorOrder),'protected nonfloor order changed');
}
function currentAtlases(row:ContextRow,source:TiledMap):TiledTileset[]{
 const retired=new Set(row.retired.map(t=>t.firstgid));
 const expected=structuredClone(row.atlases.filter(t=>!retired.has(t.firstgid)));
 let next=row.nextAtlasGid;
 for(const old of row.retired){
  // This exact historical interval is unavailable forever. The replacement's
  // semantic body comes from the current PNG/source builder, never a mutable
  // native atlas or its observed allocation maximum.
  need(old.protectedReferences.length===0&&old.ownedReferences.length>0,'retired historical ownership proof missing');
  const sets=source.tilesets.filter(t=>t.image===old.image);need(sets.length===1,'source replacement atlas missing/ambiguous');
  const set=sets[0];need(set.imagewidth===96&&set.imageheight===96&&set.columns===3&&set.tilecount===9&&set.tilewidth===32&&set.tileheight===32,'retired plant epoch cannot be a current replacement');
  expected.push({...structuredClone(set),name:old.name,firstgid:next});next+=set.tilecount!;
 }
 const fleet=source.tilesets.filter(set=>fleetNames.includes(set.name??''));
 if(identities(source)[0]==='overworld'){
  need(isDeepStrictEqual(fleet.map(set=>set.name),fleetNames),'closed plaza fleet source atlas roster/order changed');
  for(const set of fleet){
   need(set.image===`../assets/tilesets/original/${set.name}.png`&&set.tilewidth===32&&set.tileheight===32&&set.imagewidth===512&&set.columns===16&&Number.isSafeInteger(set.imageheight)&&set.imageheight!>0&&set.imageheight!%32===0&&Number.isSafeInteger(set.tilecount)&&set.tilecount===set.imageheight!/32*16&&set.tilecount!<=1024,'plaza fleet source atlas identity/geometry changed');
   expected.push({...structuredClone(set),firstgid:next});next+=set.tilecount!;
  }
 }else need(fleet.length===0,'plaza fleet source atlas requires overworld identity');
 return expected;
}
/** Mandatory final current context: complete atlas roster/order/bodies/ranges,
 * including unused historical reservations and all protected native owners. */
export function assertNativeOwnershipContext(actual:TiledMap,source:TiledMap):void{
 const row=context(actual,source);if(!row)return;
 protectedContext(actual,row);
 need(isDeepStrictEqual(actual.tilesets,currentAtlases(row,source)),'historical atlas bodies/roster/reservations changed');
}
/** Explicit finite author migration. Only the exact independently registered
 * pre-epoch context or already-valid current context can enter a transaction.
 * The final current release gate never admits the pre-epoch representation. */
export function assertNativeAuthoringContext(actual:TiledMap,source:TiledMap):void{
 const row=context(actual,source);if(!row)return;
 protectedContext(actual,row);
 // Required current source closure is validated even for a genuine historical
 // native input; old reservations do not opt the new source family out.
 const expected=currentAtlases(row,source);
 if(isDeepStrictEqual(actual.tilesets,row.atlases))return;
 need(isDeepStrictEqual(actual.tilesets,expected),'author input atlas ownership is neither exact registered nor current');
}
