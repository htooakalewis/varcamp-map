import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {buildMap} from './builder';
import {assertNativeSourceProjection,reconcileNativeProjection} from './native-projection';
import type {MapLayout,TiledMap,TileLayer} from './types';
import type {TileCatalog} from '../art/catalog';
type Change={beforeIndex:number|null;afterIndex:number|null;before:unknown;after:unknown};
const recipe=()=>JSON.parse(readFileSync('world/plaza-landscape.json','utf8'));
const sha=(l:MapLayout)=>createHash('sha256').update(JSON.stringify(l)).digest('hex');
const need=(ok:unknown,message:string)=>{if(!ok)throw Error('Plaza landscape: '+message);};
/** Exact reviewed layout transaction; furniture scale, artwork and media controls are retained. */
function transform(original:MapLayout,forward:boolean):MapLayout{
 const r=recipe();need(original.id==='overworld'&&original.width===128&&original.height===128,'requires the128-square campus');
 need(sha(original)===(forward?r.beforeLayoutSha256:r.afterLayoutSha256),'unreviewed source geometry');
 const l=structuredClone(original),from=forward?'before':'after',to=forward?'after':'before';
 for(const key of ['placements','images','entries','exits','inspectionZones','standingSigns','animatedOverlays'] as const){
  const changes=r.changes[key] as Change[],rows=l[key]! as unknown[];
  for(const row of changes.filter(row=>row[from]!==null).sort((a,b)=>b[`${from}Index`]!-a[`${from}Index`]!)){
   const i=row[`${from}Index`]!;need(isDeepStrictEqual(rows[i],row[from]),'changed '+key+' at '+i);rows.splice(i,1);
  }
  for(const row of changes.filter(row=>row[to]!==null).sort((a,b)=>a[`${to}Index`]!-b[`${to}Index`]!))rows.splice(row[`${to}Index`]!,0,structuredClone(row[to]));
 }
 need(sha(l)===(forward?r.afterLayoutSha256:r.beforeLayoutSha256),'transaction output changed');return l;
}
export const applyPlazaLandscape=(original:MapLayout):MapLayout=>transform(original,true);
export const restorePlazaLandscape=(current:MapLayout):MapLayout=>transform(current,false);
export function reconcilePlazaLandscape(native:TiledMap,layout:MapLayout,catalog:TileCatalog):TiledMap{
 const prior=restorePlazaLandscape(layout),source=buildMap(layout,catalog).tmj;
 assertNativeSourceProjection(native,buildMap(prior,catalog).tmj);
 const result=structuredClone(native),from=source.tilesets.find(t=>t.name==='navigation-mask')!,to=result.tilesets.find(t=>t.name==='navigation-mask')!;
 const names=new Set(['physical-collisions',...recipe().changes.entries.map((r:any)=>r.after.name),...recipe().changes.exits.map((r:any)=>'exit-'+r.after.name)]);
 for(const name of names){
  const a=result.layers.find(l=>l.name===name),b=source.layers.find(l=>l.name===name);
  need(a?.type==='tilelayer'&&b?.type==='tilelayer','missing native control '+name);
  const target=a as TileLayer,wanted=b as TileLayer;
  need(isDeepStrictEqual({...target,id:0,data:[]},{...wanted,id:0,data:[]}),'control envelope changed '+name);
  target.data=wanted.data.map(g=>{if(!g)return 0;need(g>=from.firstgid&&g<from.firstgid+from.tilecount!,'control GID outside navigation mask');return to.firstgid+g-from.firstgid;});
 }
 const after=reconcileNativeProjection(result,source);
 need(isDeepStrictEqual(after.tilesets,native.tilesets),'existing atlas bodies changed');
 need(isDeepStrictEqual(after.layers.map(l=>[l.id,l.name]),native.layers.map(l=>[l.id,l.name])),'native layer identities/order changed');
 need(isDeepStrictEqual(after.properties,native.properties),'map properties changed');return after;
}
