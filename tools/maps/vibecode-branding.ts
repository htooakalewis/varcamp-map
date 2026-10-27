import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import data from '../../world/vibecode-branding.json';
import {buildMap} from './builder';
import {assertNativeSourceProjection,reconcileNativeProjection} from './native-projection';
import type {MapLayout,TiledMap,LayoutImage,LayoutSign} from './types';
import type {TileCatalog} from '../art/catalog';
type Row={beforeLayoutSha256:string;afterLayoutSha256:string;image:LayoutImage;imageIndex:number;beforeSign?:LayoutSign;afterSign?:LayoutSign};
const rows=data.maps as Record<string,Row>;
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const need=(ok:unknown,message:string)=>{if(!ok)throw Error('Vibe Code branding: '+message);};
/** One logo per approved map, and one formerly empty booth caption. No physical or media edits. */
function transform(original:MapLayout,forward:boolean):MapLayout{
 const r=rows[original.id];need(r,'unregistered map');
 need(sha(original)===(forward?r.beforeLayoutSha256:r.afterLayoutSha256),'unreviewed source layout');
 const l=structuredClone(original);
 if(forward)l.images!.splice(r.imageIndex,0,structuredClone(r.image));
 else{need(isDeepStrictEqual(l.images![r.imageIndex],r.image),'logo geometry changed');l.images!.splice(r.imageIndex,1);}
 if(r.beforeSign&&r.afterSign){const i=l.signs!.findIndex(s=>s.name===r.beforeSign!.name);need(isDeepStrictEqual(l.signs![i],forward?r.beforeSign:r.afterSign),'booth caption changed');l.signs![i]=structuredClone(forward?r.afterSign:r.beforeSign);}
 need(sha(l)===(forward?r.afterLayoutSha256:r.beforeLayoutSha256),'transaction output changed');return l;
}
export const applyVibeCodeBranding=(l:MapLayout):MapLayout=>transform(l,true);
export const restoreVibeCodeBranding=(l:MapLayout):MapLayout=>transform(l,false);
export const VIBECODE_MAP_IDS=Object.keys(rows);
/** Retain all previous global IDs, protected layers, animations and collision masks. */
export function reconcileVibeCodeBranding(native:TiledMap,l:MapLayout,c:TileCatalog):TiledMap{
 need(l.id==='overworld','native reservation migration only applies to the plaza');
 const prior=restoreVibeCodeBranding(l),source=buildMap(l,c).tmj;
 assertNativeSourceProjection(native,buildMap(prior,c).tmj);
 const staged=structuredClone(native),caption=staged.tilesets.find(t=>t.name==='standing-captions')!,newCaption=source.tilesets.find(t=>t.name==='standing-captions')!;
 need(caption.tilecount===newCaption.tilecount,'caption reservation size changed');
 staged.tilesets[staged.tilesets.indexOf(caption)]={...structuredClone(newCaption),firstgid:caption.firstgid};
 const logo=source.tilesets.find(t=>t.name===rows.overworld.image.name)!;
 staged.tilesets.push({...structuredClone(logo),firstgid:Math.max(...native.tilesets.map(t=>t.firstgid+t.tilecount!))});
 const result=reconcileNativeProjection(staged,source);
 for(const old of native.layers.filter(t=>t.type!=='tilelayer'||t.name==='physical-collisions'||t.name==='terrain'||t.visible===false||t.name.startsWith('exit-')))
  need(isDeepStrictEqual(result.layers.find(t=>t.id===old.id),old),'protected layer changed: '+old.name);
 need(isDeepStrictEqual(result.properties,native.properties),'map properties changed');return result;
}
