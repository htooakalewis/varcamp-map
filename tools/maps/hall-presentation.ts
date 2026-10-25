import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import data from '../../world/hall-presentation.json';
import template from '../../world/aries-presentation.json';
import type {MapLayout,Placement,LayoutImage,LayoutSign} from './types';
import type {TileCatalog} from '../art/catalog';
type Row={beforePlacementsSha256:string;beforeSignsSha256:string;basePlacementsSha256:string;baseSignsSha256:string;placementChanges:{id:string;before:Placement;after:Placement}[];titleWidth:number;placements:Placement[];images:LayoutImage[];signs:LayoutSign[]};
const revision=data as unknown as{version:number;rooms:Record<string,Row>};
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function need(ok:unknown,message:string):asserts ok{if(!ok)throw Error('Interior hall presentation: '+message);}
function row(id:string):Row|undefined{
 if(!['solar-hall','lunar-hall'].includes(id))return;
 need(revision.version===1&&isDeepStrictEqual(Object.keys(revision.rooms).sort(),['lunar-hall','solar-hall']),'exact two-hall revision required');
 const result=revision.rooms[id];need(result,'hall revision missing');return result;
}
/** Reuse the approved native design while keeping original hall controls intact. */
export function applyHallPresentation(original:MapLayout):MapLayout{
 const style=row(original.id);if(!style)return structuredClone(original);
 const prefix=original.id.replace('-hall','')+'-hall-style-';
 need(sha(original.placements)===style.beforePlacementsSha256&&sha(original.signs)===style.beforeSignsSha256,'author input is not the genuine pre-treatment hall');
 const next=structuredClone(original);
 for(const change of style.placementChanges){const matches=next.placements.filter(p=>p.id===change.id);need(matches.length===1&&isDeepStrictEqual(matches[0],change.before),'original floor changed: '+change.id);Object.assign(matches[0],structuredClone(change.after));}
 // Wallpaper precedes original wall openings; trim precedes old stage equipment.
 next.placements.splice(next.placements.findIndex(p=>p.id==='north-wall')+1,0,...structuredClone(style.placements.slice(0,3)));
 next.placements.splice(next.placements.findIndex(p=>p.id==='primary-screen'),0,...structuredClone(style.placements.slice(3,7)));
 next.placements.push(...structuredClone(style.placements.slice(7)));
 next.images=structuredClone(style.images);
 next.signs=next.signs?.map(s=>s.name==='scene-title'?{...s,width:style.titleWidth}:s);next.signs?.push(...structuredClone(style.signs));
 need(next.placements.some(p=>p.id.startsWith(prefix)),'style assembly missing');return next;
}
/** No missing branding, floor drift or catalog mutation may opt out of release. */
export function assertHallPresentation(layout:MapLayout,catalog:TileCatalog):void{
 const style=row(layout.id);if(!style)return;
 const prefix=layout.id.replace('-hall','')+'-hall-style-';
 need(isDeepStrictEqual(layout.images,style.images),'native logo roster/geometry changed: '+layout.id);
 need(isDeepStrictEqual(layout.placements.filter(p=>p.id.startsWith(prefix)),style.placements),'stage/listener trim changed: '+layout.id);
 need(sha(layout.placements.filter(p=>!p.id.startsWith(prefix)))===style.basePlacementsSha256,'original furnishings, themes or floor boundaries changed: '+layout.id);
 need(isDeepStrictEqual(layout.signs?.filter(s=>s.name.startsWith(prefix)),style.signs),'listener/partner captions changed: '+layout.id);
 need(sha(layout.signs?.filter(s=>!s.name.startsWith(prefix)))===style.baseSignsSha256,'original sign changed: '+layout.id);
 for(const[name,sprite]of Object.entries(template.catalog))need(isDeepStrictEqual(catalog[name],sprite),'shared native style/depth/collision changed: '+name);
}
