import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import recipe from '../../world/plaza-patrol.json';
import {PATROL_IDS} from './patrol-roles';
import {advancePatrolProvenance,priorPatrolProvenance} from './plaza-patrol-provenance';
import {buildMap} from './builder';
import {assertNativeSourceProjection,reconcileNativeProjection} from './native-projection';
import type {TileCatalog} from '../art/catalog';
import type {MapLayout,TiledMap,LayoutAnimatedOverlay,TileLayer} from './types';
const need=(ok:unknown,m:string)=>{if(!ok)throw Error('Plaza patrol: '+m);};
const digest=(l:MapLayout)=>createHash('sha256').update(JSON.stringify(priorPatrolProvenance(l))).digest('hex');
const overlays=():LayoutAnimatedOverlay[]=>PATROL_IDS.map(name=>JSON.parse(readFileSync(`art/source/${name}.json`,'utf8')).overlay);
/** Checked inverse: the six patrols and the one table are the entire source delta. */
export function restorePlazaPatrol(current:MapLayout):MapLayout{
 if(current.id!=='overworld')return structuredClone(current);
 const l=structuredClone(current),added=overlays();
 need(!l.placements.some(p=>p.id===recipe.removedTable.placement.id),'tiny welcome table restored');
 need(isDeepStrictEqual(l.animatedOverlays?.filter(o=>o.name.startsWith('plaza-patrol-')),added),'six patrol descriptors missing/changed');
 need(isDeepStrictEqual(l.animatedOverlays?.slice(-6),added),'patrol ordering changed');
 l.animatedOverlays=l.animatedOverlays!.slice(0,-6);l.placements.splice(recipe.removedTable.index,0,structuredClone(recipe.removedTable.placement) as MapLayout['placements'][number]);
 need(digest(l)===recipe.beforeLayoutSha256,'unrelated source change');return advancePatrolProvenance(l);
}
export function applyPlazaPatrol(original:MapLayout):MapLayout{
 if(original.id!=='overworld')return structuredClone(original);
 if(digest(original)!==recipe.beforeLayoutSha256){restorePlazaPatrol(original);return structuredClone(original);}
 const l=advancePatrolProvenance(original);l.placements.splice(recipe.removedTable.index,1);l.animatedOverlays!.push(...overlays());restorePlazaPatrol(l);return l;
}
export function reconcilePlazaPatrol(native:TiledMap,layout:MapLayout,catalog:TileCatalog):TiledMap{
 const before=restorePlazaPatrol(layout),source=buildMap(layout,catalog).tmj;
 try{assertNativeSourceProjection(native,source);return structuredClone(native);}catch{/* Only the exact checked predecessor is accepted next. */}
 assertNativeSourceProjection(native,buildMap(before,catalog).tmj);
 const adjusted=structuredClone(native),mask=adjusted.layers.find(l=>l.name==='physical-collisions') as TileLayer,wanted=source.layers.find(l=>l.name==='physical-collisions') as TileLayer;
 need(mask?.type==='tilelayer'&&wanted?.type==='tilelayer','collision mask missing');
 // Clear only the removed table's cell if its catalog footprint blocks it.
 const cell=67*128+52;need(wanted.data[cell]===0,'table location must be walkable');mask.data[cell]=0;
 return reconcileNativeProjection(adjusted,source);
}
