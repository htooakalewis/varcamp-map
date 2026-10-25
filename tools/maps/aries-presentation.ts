import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import data from '../../world/aries-presentation.json';
import type {TileCatalog} from '../art/catalog';
import type {MapLayout,LayoutArea,Placement,LayoutImage,LayoutSign} from './types';
type Functional=Pick<MapLayout,'width'|'height'|'entries'|'exits'|'areas'|'inspectionZones'>;
const style=data as {version:number;mapId:string;baselineFunctionalSha256:string;basePlacementsSha256:string;baseSignsSha256:string;areas:LayoutArea[];placements:Placement[];images:LayoutImage[];signs:LayoutSign[];catalog:TileCatalog};
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function need(v:unknown,message:string):asserts v{if(!v)throw Error('Interior Aries presentation: '+message);}
/** A named successor; the original fourteen-room functional contract stays frozen. */
export function ariesPresentationFunctional(id:string,baseline:Functional):Functional{
 if(id!=='speaker-aries')return baseline;
 need(style.version===1&&style.mapId===id,'revision identity');
 need(sha(baseline)===style.baselineFunctionalSha256,'historical functional baseline changed');
 need(style.areas.length===2&&style.areas[0].id==='meeting-aries'&&style.areas[1].id==='aries-audience','stage/listener roster');
 const next=structuredClone(baseline);
 need(next.areas.filter(a=>a.id==='meeting-aries').length===1,'original meeting missing');
 next.areas=next.areas.map(a=>a.id==='meeting-aries'?structuredClone(style.areas[0]):a);
 next.areas.push(structuredClone(style.areas[1]));return next;
}
export function assertAriesPresentation(layout:MapLayout,catalog:TileCatalog):void{
 if(layout.id!=='speaker-aries')return;
 need(isDeepStrictEqual(layout.images,style.images),'native branding roster or geometry changed');
 need(isDeepStrictEqual(layout.placements.filter(p=>p.id.startsWith('aries-style-')),style.placements),'wallpaper/trim placement changed');
 need(sha(layout.placements.filter(p=>!p.id.startsWith('aries-style-')))===style.basePlacementsSha256,'original furnishings, zodiac features or routes changed');
 need(isDeepStrictEqual(layout.signs?.filter(s=>s.name.startsWith('aries-style-')),style.signs),'presentation captions changed');
 need(sha(layout.signs?.filter(s=>!s.name.startsWith('aries-style-')))===style.baseSignsSha256,'original signs changed');
 for(const [name,sprite] of Object.entries(style.catalog))need(isDeepStrictEqual(catalog[name],sprite),'native wallpaper pixels/depth/collision declaration changed: '+name);
}
/** Finite forward author operation; never reinterprets current bytes as history. */
export function applyAriesPresentation(original:MapLayout):MapLayout{
 if(original.id!=='speaker-aries')return structuredClone(original);
 need(!original.placements.some(p=>p.id.startsWith('aries-style-')),'source already carries the successor');
 const next=structuredClone(original),rows=style.placements;
 next.placements.splice(next.placements.findIndex(p=>p.id==='north-wall')+1,0,...structuredClone(rows.slice(0,4)));
 next.placements.splice(next.placements.findIndex(p=>p.id==='primary-screen'),0,...structuredClone(rows.slice(4,9)));
 next.placements.push(...structuredClone(rows.slice(9)));
 next.images=structuredClone(style.images);
 next.signs=next.signs?.map(s=>s.name==='scene-title'?{...s,x:14,y:2,width:16,height:1,padding:0,align:'left' as const}:s);
 next.signs?.push(...structuredClone(style.signs));
 next.areas=next.areas.map(a=>a.id==='meeting-aries'?structuredClone(style.areas[0]):a);
 next.areas.push(structuredClone(style.areas[1]));return next;
}
