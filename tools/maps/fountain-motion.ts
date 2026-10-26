import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {FOUNTAIN_MOTION_IDS} from './fountain-motion-roles';
import {advanceFountainProvenance,priorFountainProvenance} from './fountain-motion-provenance';
import {buildMap} from './builder';
import {reconcileNativeProjection,assertNativeSourceProjection} from './native-projection';
import type {MapLayout,TiledMap,LayoutAnimatedOverlay} from './types';
import type {TileCatalog} from '../art/catalog';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const need=(ok:unknown,m:string)=>{if(!ok)throw Error('Fountain motion: '+m);};
const overlays=():LayoutAnimatedOverlay[]=>FOUNTAIN_MOTION_IDS.map(name=>read(`art/source/${name}.json`).overlay);
const digest=(l:MapLayout)=>createHash('sha256').update(JSON.stringify(priorFountainProvenance(l))).digest('hex');
export function restoreFountainMotion(current:MapLayout):MapLayout{
 if(current.id!=='overworld')return structuredClone(current);
 const l=structuredClone(current),added=overlays();
 need(isDeepStrictEqual(l.animatedOverlays?.filter(o=>o.name.startsWith('plaza-fountain-water')),added)&&isDeepStrictEqual(l.animatedOverlays?.slice(-2),added),'two exact depth components required');
 l.animatedOverlays=l.animatedOverlays!.slice(0,-2);
 need(digest(l)===read('world/fountain-motion.json').beforeLayoutSha256,'unrelated source change');return advanceFountainProvenance(l);
}
export function applyFountainMotion(original:MapLayout):MapLayout{
 if(original.id!=='overworld')return structuredClone(original);
 need(digest(original)===read('world/fountain-motion.json').beforeLayoutSha256,'exact reviewed plaza required');
 const l=advanceFountainProvenance(original);l.animatedOverlays!.push(...overlays());restoreFountainMotion(l);return l;
}
export function reconcileFountainMotion(native:TiledMap,layout:MapLayout,catalog:TileCatalog):TiledMap{
 assertNativeSourceProjection(native,buildMap(restoreFountainMotion(layout),catalog).tmj);
 const after=reconcileNativeProjection(native,buildMap(layout,catalog).tmj);
 need(isDeepStrictEqual(after.tilesets.slice(0,native.tilesets.length),native.tilesets),'prior atlas reservations changed');
 for(const l of native.layers)need(isDeepStrictEqual(after.layers.find(a=>a.id===l.id),l),'existing native layer changed: '+l.name);
 need(isDeepStrictEqual(after.properties,native.properties),'map properties changed');return after;
}
