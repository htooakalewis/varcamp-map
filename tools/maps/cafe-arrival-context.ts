import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import refresh from '../../art/source/cafe-arrival-refresh.json';
import type {TiledLayer,TiledTileset,TiledMap} from './types';

const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
type Owner={id:number;name:string;type:string;bodySha256:string;source?:string;producer?:string};
type Change={beforeSha256:string|null;after:TiledLayer};
function changes(id:string):Change[]{
 if(!isDeepStrictEqual(Object.keys(refresh.maps).sort(),['campus-exploration','moon-cafe']))throw Error('Café/arrival closed map roster changed');
 const rows=(refresh.maps as unknown as Record<string,{layers:Change[]}>)[id];
 if(!rows)return [];
 const wanted=id==='moon-cafe'?['physical-collisions','wayfinding-text','Moon Café / VarCamp']:id==='campus-exploration'?['start']:[];
 if(refresh.schema!=='varcamp-cafe-arrival-refresh-v1'||!isDeepStrictEqual(rows.layers.map(r=>r.after.name).sort(),wanted.slice().sort()))throw Error('Café/arrival closed native ownership changed');
 return rows.layers;
}
/** Forward-only author transaction: retain all other owners, accept only their
 * exact prior bodies, and retire only the witnessed obsolete scenery layer. */
export function authorCafeArrivalContext(map:TiledMap):void{
 const id=String(map.properties?.find(p=>p.name==='worldMapId')?.value);
 const rows=changes(id);if(!rows.length)return;
 for(const row of rows){
  const at=map.layers.findIndex(l=>l.name===row.after.name),old=map.layers[at];
  if(old&&sha(old)===sha(row.after))continue;
  if(old?sha(old)!==row.beforeSha256:row.beforeSha256!==null)throw Error('Café/arrival protected author input changed: '+row.after.name);
  if(at<0)map.layers.push(structuredClone(row.after));else map.layers[at]=structuredClone(row.after);
 }
 const retired=(refresh.maps as any)[id].retiredPaint as {name:string;sha256:string}[];
 for(const row of retired){const at=map.layers.findIndex(l=>l.name===row.name);if(at<0)continue;if(sha(map.layers[at])!==row.sha256)throw Error('Café/arrival retired scenery changed');map.layers.splice(at,1);}
 map.nextlayerid=Math.max(map.nextlayerid??1,...map.layers.map(l=>l.id+1));
}
/** Additive successor to the frozen original owners: only café furniture/text
 * and the Court's literal default-entry alias belong to this reviewed change. */
export function cafeArrivalOwners(id:string,original:Owner[]):Owner[]{
 const owners=structuredClone(original);
 for(const row of changes(id)){
  const old=owners.find(o=>o.name===row.after.name);
  if(row.beforeSha256!==null&&old?.bodySha256!==row.beforeSha256)throw Error('Café/arrival prior owner changed');
  if(row.beforeSha256===null&&old)throw Error('Café/arrival new owner already exists');
  const next={...old,id:row.after.id,name:row.after.name,type:row.after.type,bodySha256:sha(row.after),source:'art/source/cafe-arrival-refresh.json'};
  if(old)owners[owners.indexOf(old)]=next;else owners.push(next);
 }
 return owners;
}
export function cafeArrivalProtectedLayers(id:string,original:TiledLayer[]):TiledLayer[]{
 return original.map(layer=>{
  const row=changes(id).find(r=>r.after.name===layer.name);
  if(!row)return layer;
  if(sha(layer)!==row.beforeSha256)throw Error('Café/arrival prior nonfloor owner changed');
  return structuredClone(row.after);
 });
}
export function cafeArrivalAtlases(id:string):TiledTileset[]{
 if(id!=='moon-cafe')return [];
 const sets=refresh.maps['moon-cafe'].atlases as TiledTileset[];
 if(!isDeepStrictEqual(sets.map(s=>s.image),['../assets/tilesets/original/hub-buildings.png','../assets/sponsors/varcamp-2026.png']))throw Error('Café closed atlas extension changed');
 return structuredClone(sets);
}
