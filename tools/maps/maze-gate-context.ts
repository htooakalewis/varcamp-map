import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import refresh from '../../art/source/maze-gate-refresh.json';
import type {TiledLayer,TiledTileset,TiledMap} from './types';

const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
type Owner={id:number;name:string;type:string;bodySha256:string;source?:string;producer?:string};
type Change={beforeSha256:string|null;after:TiledLayer};
function changes(id:string):Change[]{
 if(!isDeepStrictEqual(Object.keys(refresh.maps).sort(),['campus-exploration','comet-maze','orbit-maze']))throw Error('Maze/gates closed map roster changed');
 const rows=(refresh.maps as unknown as Record<string,{layers:Change[]}>)[id];
 if(!rows)return [];
 const wanted=id==='campus-exploration'?['physical-collisions','wayfinding-text','Exploration / VarCamp']:['wayfinding-text',id==='orbit-maze'?'Orbit / VarCamp':'Comet / VarCamp'];
 if(refresh.schema!=='varcamp-maze-gate-refresh-v1'||!isDeepStrictEqual(rows.layers.map(r=>r.after.name).sort(),wanted.slice().sort()))throw Error('Maze/gates closed native ownership changed');
 return rows.layers;
}
/** Forward-only author transaction: retain all other owners, accept only their
 * exact prior bodies, and retire only the witnessed obsolete scenery layer. */
export function authorMazeGateContext(map:TiledMap):void{
 const id=String(map.properties?.find(p=>p.name==='worldMapId')?.value);
 const rows=changes(id);if(!rows.length)return;
 for(const row of rows){
  const at=map.layers.findIndex(l=>l.name===row.after.name),old=map.layers[at];
  if(old&&sha(old)===sha(row.after))continue;
  if(old?sha(old)!==row.beforeSha256:row.beforeSha256!==null)throw Error('Maze/gates protected author input changed: '+row.after.name);
  if(at<0)map.layers.push(structuredClone(row.after));else map.layers[at]=structuredClone(row.after);
 }
 const retired=(refresh.maps as any)[id].retiredPaint as {name:string;sha256:string}[];
 for(const row of retired){const at=map.layers.findIndex(l=>l.name===row.name);if(at<0)continue;if(sha(map.layers[at])!==row.sha256)throw Error('Maze/gates retired scenery changed');map.layers.splice(at,1);}
 map.nextlayerid=Math.max(map.nextlayerid??1,...map.layers.map(l=>l.id+1));
}
/** Additive successor to the frozen original owners: only the two maze labels, three brand panels and the Court's
 * entrances belong to this reviewed change. Maze collision masks remain exact. */
export function mazeGateOwners(id:string,original:Owner[]):Owner[]{
 const owners=structuredClone(original);
 for(const row of changes(id)){
  const old=owners.find(o=>o.name===row.after.name);
  if(row.beforeSha256!==null&&old?.bodySha256!==row.beforeSha256)throw Error('Maze/gates prior owner changed');
  if(row.beforeSha256===null&&old)throw Error('Maze/gates new owner already exists');
  const next={...old,id:row.after.id,name:row.after.name,type:row.after.type,bodySha256:sha(row.after),source:'art/source/maze-gate-refresh.json'};
  if(old)owners[owners.indexOf(old)]=next;else owners.push(next);
 }
 return owners;
}
export function mazeGateProtectedLayers(id:string,original:TiledLayer[]):TiledLayer[]{
 return original.map(layer=>{
  const row=changes(id).find(r=>r.after.name===layer.name);
  if(!row)return layer;
  if(sha(layer)!==row.beforeSha256)throw Error('Maze/gates prior nonfloor owner changed');
  return structuredClone(row.after);
 });
}
export function mazeGateAtlases(id:string):TiledTileset[]{
 if(!['orbit-maze','comet-maze','campus-exploration'].includes(id))return [];
 const sets=(refresh.maps as any)[id].atlases as TiledTileset[];
 const images=id==='campus-exploration'?['../assets/tilesets/workadventure/WA_Other_Furniture.png','../assets/tilesets/lpc-office/Coffee Maker.png','../assets/sponsors/varcamp-2026.png']:['../assets/sponsors/varcamp-2026.png'];
 if(!isDeepStrictEqual(sets.map(s=>s.image),images))throw Error('Maze/gates closed atlas extension changed');
 return structuredClone(sets);
}

