import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {LEO_LION_PLACEMENT,LEO_LION_SPRITE} from './leo-lion-head-definition';
import {advanceLeoProvenance,priorLeoProvenance} from './leo-lion-head-provenance';
import {buildMap} from './builder';
import {assertNativeSourceProjection,reconcileNativeProjection} from './native-projection';
import type {MapLayout,TiledMap} from './types';
import type {TileCatalog} from '../art/catalog';
const need=(ok:unknown,m:string)=>{if(!ok)throw Error('Leo lion head: '+m);};
const recipe=()=>JSON.parse(readFileSync('world/leo-lion-head.json','utf8'));
const digest=(l:MapLayout)=>createHash('sha256').update(JSON.stringify(priorLeoProvenance(l))).digest('hex');
export function restoreLeoLionHead(current:MapLayout):MapLayout{
 if(current.id!=='overworld')return structuredClone(current);
 const l=structuredClone(current);need(isDeepStrictEqual(recipe().placement,LEO_LION_PLACEMENT),'reviewed ornament placement changed');
 need(isDeepStrictEqual(l.placements.filter(p=>p.id==='leo-lion-head'),[LEO_LION_PLACEMENT])&&isDeepStrictEqual(l.placements.at(-1),LEO_LION_PLACEMENT),'single roof ornament required');l.placements.pop();
 need(digest(l)===recipe().beforeLayoutSha256,'unrelated source change');return advanceLeoProvenance(l);
}
export function applyLeoLionHead(original:MapLayout):MapLayout{
 if(original.id!=='overworld')return structuredClone(original);
 need(digest(original)===recipe().beforeLayoutSha256,'exact reviewed plaza required');
 const l=advanceLeoProvenance(original);l.placements.push(structuredClone(LEO_LION_PLACEMENT));restoreLeoLionHead(l);return l;
}
export function assertLeoLionHead(layout:MapLayout,catalog:TileCatalog):void{
 restoreLeoLionHead(layout);need(isDeepStrictEqual(catalog['leo-lion-head'],LEO_LION_SPRITE),'ornament geometry/depth/collision changed');
 const owner=layout.placements.find(p=>p.id==='leo-building');need(owner,'Leo owner missing');
 const solid=new Set(catalog[owner!.sprite].blockingCells.map(([x,y])=>`${owner!.x+x},${owner!.y+y}`));
 const p=LEO_LION_PLACEMENT;for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++)need(solid.has(`${x},${y}`),'ornament escapes the existing solid roof');
}
export function reconcileLeoLionHead(native:TiledMap,layout:MapLayout,catalog:TileCatalog):TiledMap{
 assertLeoLionHead(layout,catalog);assertNativeSourceProjection(native,buildMap(restoreLeoLionHead(layout),catalog).tmj);
 const after=reconcileNativeProjection(native,buildMap(layout,catalog).tmj);
 need(isDeepStrictEqual(after.tilesets.slice(0,native.tilesets.length),native.tilesets),'previous atlas reservations changed');
 need(isDeepStrictEqual(after.layers.find(l=>l.name==='physical-collisions'),native.layers.find(l=>l.name==='physical-collisions')),'collision cells changed');
 need(isDeepStrictEqual(after.properties,native.properties),'map properties changed');return after;
}
