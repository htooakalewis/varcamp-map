import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import recipe from '../../world/expo-spacing.json';
import {buildMap} from './builder';
import {assertNativeSourceProjection} from './native-projection';
import {expoPlazaNative} from './expo-plaza';
import {advanceSpacingProvenance,priorSpacingProvenance} from './expo-spacing-provenance';
import type {TileCatalog} from '../art/catalog';
import type {MapLayout,TiledMap} from './types';
const sha=(l:MapLayout)=>createHash('sha256').update(JSON.stringify(priorSpacingProvenance(l))).digest('hex');
const need=(ok:unknown,message:string)=>{if(!ok)throw Error('Expo spacing: '+message);};
type Row={beforeIndex:number|null;afterIndex:number|null;before:unknown;after:unknown};
/** One finite physical-layout transaction. Areas, media properties, atlas pixels,
 * animations, portals and buildings are outside this operation's ownership. */
function transform(original:MapLayout,forward:boolean):MapLayout{
 need(original.id==='overworld'&&original.width===128&&original.height===128,'requires the existing128-square plaza');
 need(sha(original)===(forward?recipe.beforeLayoutSha256:recipe.afterLayoutSha256),'unrelated source change or unreviewed booth geometry');
 const l=structuredClone(original),from=forward?'before':'after',to=forward?'after':'before';
 for(const key of ['placements','images','signs'] as const){
  const changes=recipe.changes[key] as Row[],rows=l[key]! as unknown[];
  const removals=changes.filter(r=>r[from]!==null).sort((a,b)=>b[`${from}Index`]!-a[`${from}Index`]!);
  for(const r of removals){const i=r[`${from}Index`]!;need(isDeepStrictEqual(rows[i],r[from]),`changed ${key} before-image at${i}`);rows.splice(i,1);}
  const additions=changes.filter(r=>r[to]!==null).sort((a,b)=>a[`${to}Index`]!-b[`${to}Index`]!);
  for(const r of additions)rows.splice(r[`${to}Index`]!,0,structuredClone(r[to]));
 }
 need(sha(l)===(forward?recipe.afterLayoutSha256:recipe.beforeLayoutSha256),'transaction output changed');
 return advanceSpacingProvenance(l);
}
export const applyExpoSpacing=(original:MapLayout):MapLayout=>transform(original,true);
export const restoreExpoSpacing=(current:MapLayout):MapLayout=>transform(current,false);
export function reconcileExpoSpacing(native:TiledMap,layout:MapLayout,catalog:TileCatalog):TiledMap{
 const before=restoreExpoSpacing(layout);
 assertNativeSourceProjection(native,buildMap(before,catalog).tmj);
 const output=expoPlazaNative(native,layout,catalog);
 need(isDeepStrictEqual(output.tilesets,native.tilesets),'must retain every existing atlas reservation');
 need(isDeepStrictEqual(output.layers.filter(l=>l.type!=='tilelayer'),native.layers.filter(l=>l.type!=='tilelayer')),'must retain native object controls');
 assertNativeSourceProjection(output,buildMap(layout,catalog).tmj);
 return output;
}
