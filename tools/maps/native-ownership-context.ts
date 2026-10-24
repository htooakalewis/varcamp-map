import{isDeepStrictEqual}from'node:util';
import registered from'../../art/source/native-ownership-context.json';
import{WORLD_CATALOG}from'../../src/world/catalog';
import contract from'./animated-decoration-contract.json';
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
// The first new production reservation family. Names/images are independent
// authority; candidate-native bodies and allocation maxima are never inputs.
const fleetNames=['plaza-fleet-camera','plaza-fleet-delivery','plaza-fleet-survey'];
/** The second reviewed reservation family: the expo epoch. Exactly these atlases may
 * join the overworld after the fleet, each at most once, in current source order, with
 * the identity/geometry registered here: twelve booth marks (two 6×2 panels, ten 4×2
 * compact marks) as embedded sponsor tilesets named below, the booth sticker sheet and
 * the overworld's own `standing-captions` atlas rendered into the expo caption image.
 * Registered DATA stays closed; nothing else may be appended on any current map. */
export const EXPO_MARKS=Object.freeze({
 'demo-01':{name:'Expo / Demo Orbit',columns:6},
 'demo-03':{name:'Expo / Demo Atlas',columns:6},
 'demo-01-compact':{name:'Expo / Demo Orbit Compact',columns:4},
 'demo-02-compact':{name:'Expo / Demo Nova Compact',columns:4},
 'demo-03-compact':{name:'Expo / Demo Atlas Compact',columns:4},
 'demo-04':{name:'Expo / Demo Vector',columns:4},
 'demo-05':{name:'Expo / Demo Lumen',columns:4},
 'hub-01':{name:'Expo / Code Circle',columns:4},
 'hub-02':{name:'Expo / Design Guild',columns:4},
 'hub-03':{name:'Expo / Data Club',columns:4},
 'hub-04':{name:'Expo / Game Jam',columns:4},
 'hub-05':{name:'Expo / Open Source',columns:4},
}as Record<string,{name:string;columns:6|4}>);
export const EXPO_STICKER_ATLAS=Object.freeze({name:'booth-stickers',image:'../assets/tilesets/original/booth-stickers.png',imagewidth:192,imageheight:32,columns:6,tilecount:6});
export const EXPO_CAPTION_ATLAS=Object.freeze({name:'standing-captions',image:'../assets/tilesets/original/expo-captions.png',imagewidth:512,columns:16,maxImageHeight:192});
const expoMarkByName=new Map(Object.entries(EXPO_MARKS).map(([file,mark])=>[mark.name,{...mark,image:`../assets/sponsors/${file}.png`}]));
const expoMarkImages=new Set([...expoMarkByName.values()].map(mark=>mark.image));
/** Expo family membership is decided by registered name/image identity only: a mark by its
 * registered name, or by its PNG when that PNG is not a registered pre-epoch atlas (the
 * arrival inlays), the sticker sheet by its PNG, and any overworld `standing-captions` role. */
function expoMember(set:TiledTileset,row:ContextRow,overworld:boolean):'mark'|'stickers'|'captions'|undefined{
 if(expoMarkByName.has(set.name??''))return'mark';
 if(expoMarkImages.has(set.image??'')&&!row.atlases.some(a=>a.name===set.name&&a.image===set.image))return'mark';
 if(set.image===EXPO_STICKER_ATLAS.image)return'stickers';
 if(set.name===EXPO_CAPTION_ATLAS.name&&(overworld||set.image===EXPO_CAPTION_ATLAS.image))return'captions';
 return undefined;
}
function expoAtlases(source:TiledMap,row:ContextRow,start:number):TiledTileset[]{
 const members=source.tilesets.filter(set=>expoMember(set,row,true)),seen=new Set<string>(),result:TiledTileset[]=[];let next=start;
 for(const set of members){
  const kind=expoMember(set,row,true)!,key=kind==='mark'?set.name!:kind;need(!seen.has(key),'expo source atlas duplicated: '+key);seen.add(key);
  need(set.tilewidth===32&&set.tileheight===32&&!set.source&&(set.spacing??0)===0&&(set.margin??0)===0,'expo source atlas grid changed: '+key);
  if(kind==='mark'){
   const mark=expoMarkByName.get(set.name!);
   need(mark&&set.image===mark.image&&set.columns===mark.columns&&set.tilecount===mark.columns*2&&set.imagewidth===mark.columns*32&&set.imageheight===64&&set.properties?.some(p=>p.name==='sponsorPanel'&&p.value===true)===true&&!set.tiles,'expo mark identity/geometry leaves its registered reservation: '+key);
   result.push({...structuredClone(set),firstgid:next});
  }else if(kind==='stickers'){
   need(/^art-\d+$/.test(set.name??'')&&set.columns===EXPO_STICKER_ATLAS.columns&&set.tilecount===EXPO_STICKER_ATLAS.tilecount&&set.imagewidth===EXPO_STICKER_ATLAS.imagewidth&&set.imageheight===EXPO_STICKER_ATLAS.imageheight&&!set.tiles,'expo sticker sheet identity/geometry changed');
   result.push({...structuredClone(set),firstgid:next,name:EXPO_STICKER_ATLAS.name});
  }else{
   need(set.image===EXPO_CAPTION_ATLAS.image&&set.columns===EXPO_CAPTION_ATLAS.columns&&set.imagewidth===EXPO_CAPTION_ATLAS.imagewidth&&Number.isSafeInteger(set.imageheight)&&set.imageheight!>0&&set.imageheight!%32===0&&set.imageheight!<=EXPO_CAPTION_ATLAS.maxImageHeight&&set.tilecount===set.imageheight!/32*16&&!set.tiles&&set.properties?.some(p=>p.name==='captionAtlasSha256'&&/^[0-9a-f]{64}$/.test(String(p.value)))===true,'expo caption atlas identity/geometry leaves its registered reservation');
   result.push({...structuredClone(set),firstgid:next});
  }
  next+=set.tilecount!;
 }
 return result;
}
// Closed current decoration roster: a registered role atlas body is owned by its
// source producer (verified by the domain guards), never by the native candidate.
const roleNames=(id:string):string[]=>((contract.maps as Record<string,{name:string}[]>)[id]??[]).map(r=>r.name);
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
function currentAtlases(row:ContextRow,source:TiledMap,epoch:{expo:boolean}={expo:true}):TiledTileset[]{
 const retired=new Set(row.retired.map(t=>t.firstgid));
 const expected=structuredClone(row.atlases.filter(t=>!retired.has(t.firstgid)));
 let next=row.nextAtlasGid;
 // A registered role atlas keeps its exact historical GID reservation while its
 // body comes from the current source producer; it may never grow past it.
 for(const name of roleNames(identities(source)[0])){
  const index=expected.findIndex(t=>t.name===name);if(index<0)continue;
  const sets=source.tilesets.filter(t=>t.name===name);need(sets.length<=1,'source role atlas ambiguous: '+name);if(!sets.length)continue;// an omitted role keeps its registered body; the roster guards report it
  const set=sets[0],old=expected[index];
  need(set.image===old.image&&set.image!.startsWith('../assets/tilesets/original/')&&set.tilewidth===32&&set.tileheight===32&&set.imagewidth===512&&set.columns===16&&Number.isSafeInteger(set.imageheight)&&set.imageheight!>0&&set.imageheight!%32===0&&Number.isSafeInteger(set.tilecount)&&set.tilecount===set.imageheight!/32*16&&set.tilecount!<=old.tilecount!,'role source atlas identity/geometry leaves its registered reservation: '+name);
  expected[index]={...structuredClone(set),firstgid:old.firstgid};
 }
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
  // Expo epoch: admitted only here, only after every fleet reservation.
  const expo=expoAtlases(source,row,next);if(epoch.expo)expected.push(...expo);
 }else{need(fleet.length===0,'plaza fleet source atlas requires overworld identity');need(!source.tilesets.some(set=>expoMember(set,row,false)),'expo source atlas requires overworld identity');}
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
 if(isDeepStrictEqual(actual.tilesets,expected))return;
 // Expo epoch entry: the exact pre-expo current context (every registered and
 // fleet reservation, no expo member) is the only other admitted author input.
 need(isDeepStrictEqual(actual.tilesets,currentAtlases(row,source,{expo:false})),'author input atlas ownership is neither exact registered nor current');
}
