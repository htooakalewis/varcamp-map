import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {hallBuildingSprites,zodiacGroundNameSprites} from './hall-buildings-definition';
import {advanceHallBuildingsProvenance,priorHallBuildingsProvenance} from './hall-buildings-provenance';
import {buildMap} from './builder';
import {assertNativeSourceProjection,reconcileNativeProjection} from './native-projection';
import type {MapLayout,TiledMap,Placement,TileLayer} from './types';
import type {TileCatalog} from '../art/catalog';
const need=(ok:unknown,m:string)=>{if(!ok)throw Error('Hall buildings: '+m);};
const recipe=()=>JSON.parse(readFileSync('world/hall-buildings.json','utf8'));
const digest=(l:MapLayout)=>createHash('sha256').update(JSON.stringify(priorHallBuildingsProvenance(l))).digest('hex');
export function restoreHallBuildings(current:MapLayout):MapLayout{
 if(current.id!=='overworld')return structuredClone(current);
 const r=recipe(),l=structuredClone(current);
 for(const p of [...r.additions].reverse()){need(isDeepStrictEqual(l.placements.at(-1),p),'forecourt missing/changed');l.placements.pop();}
 for(const row of r.replacements){const matches=l.placements.filter(p=>p.id===row.after.id);need(matches.length===1&&isDeepStrictEqual(matches[0],row.after),'building or ground name missing/changed: '+row.after.id);l.placements[l.placements.indexOf(matches[0])]=structuredClone(row.before);}
 for(const row of r.removed){need(!l.placements.some(p=>p.id===row.placement.id),'retired road sign returned');l.placements.splice(row.index,0,structuredClone(row.placement));}
 for(const row of r.removedStandingSigns){need(!l.standingSigns?.some(s=>s.face===row.sign.face),'retired road sign contract returned');l.standingSigns!.splice(row.index,0,structuredClone(row.sign));}
 need(digest(l)===r.beforeLayoutSha256,'unrelated source change');return advanceHallBuildingsProvenance(l);
}
export function applyHallBuildings(original:MapLayout):MapLayout{
 if(original.id!=='overworld')return structuredClone(original);
 need(digest(original)===recipe().beforeLayoutSha256,'exact reviewed exterior source required');const l=advanceHallBuildingsProvenance(original),r=recipe();
 for(const row of r.replacements){const i=l.placements.findIndex(p=>p.id===row.before.id);need(i>=0&&isDeepStrictEqual(l.placements[i],row.before),'original exterior changed');l.placements[i]=structuredClone(row.after);}
 const removed=new Set(r.removed.map((r:{placement:Placement})=>r.placement.id));l.placements=l.placements.filter(p=>!removed.has(p.id));l.standingSigns=l.standingSigns?.filter(s=>!removed.has(s.face));l.placements.push(...structuredClone(r.additions));restoreHallBuildings(l);return l;
}
export function assertHallBuildings(layout:MapLayout,catalog:TileCatalog):void{
 restoreHallBuildings(layout);const expected={...hallBuildingSprites(),...zodiacGroundNameSprites()};
 need(isDeepStrictEqual(Object.keys(catalog).filter(k=>k.startsWith('hall-building-')||k.startsWith('zodiac-ground-name-')).sort(),Object.keys(expected).sort()),'closed building and ground-name roster changed');
 for(const[id,s]of Object.entries(expected))need(isDeepStrictEqual(catalog[id],s),'native geometry/depth/collision changed: '+id);
}
export function reconcileHallBuildings(native:TiledMap,layout:MapLayout,catalog:TileCatalog):TiledMap{
 assertHallBuildings(layout,catalog);assertNativeSourceProjection(native,buildMap(restoreHallBuildings(layout),catalog).tmj);
 const source=buildMap(layout,catalog).tmj,adjusted=structuredClone(native),target=adjusted.layers.find(l=>l.name==='physical-collisions') as TileLayer,wanted=source.layers.find(l=>l.name==='physical-collisions') as TileLayer,actualSet=adjusted.tilesets.find(t=>t.name==='navigation-mask')!,sourceSet=source.tilesets.find(t=>t.name==='navigation-mask')!;
 target.data=wanted.data.map(g=>g?actualSet.firstgid+g-sourceSet.firstgid:0);
 const after=reconcileNativeProjection(adjusted,source);
 need(isDeepStrictEqual(after.tilesets.slice(0,native.tilesets.length),native.tilesets),'previous atlas reservations changed');
 need(isDeepStrictEqual(after.properties,native.properties),'map properties changed');return after;
}
