import {isDeepStrictEqual} from 'node:util';
import recipe from '../../world/hall-exteriors.json';
import {hallExteriorSprites} from '../art/hall-exteriors';
import type {MapLayout} from './types';
import type {TileCatalog} from '../art/catalog';
const need=(ok:unknown,message:string)=>{if(!ok)throw Error('Hall exteriors: '+message);};
function rows(){need(recipe.version===1&&isDeepStrictEqual(recipe.buildings.map(r=>r.id),['solar','lunar']),'exact two-building recipe required');return recipe.buildings;}
/** Only the two existing facade sprite selections may change. */
export function applyHallExteriors(original:MapLayout):MapLayout{
 if(original.id!=='overworld')return structuredClone(original);
 const next=structuredClone(original);
 for(const row of rows()){
  const found=next.placements.filter(p=>p.id===row.before.id);need(found.length===1,'hall missing/duplicated: '+row.id);
  need(isDeepStrictEqual(found[0],row.before)||isDeepStrictEqual(found[0],row.after),'hall footprint/entrance/depth or unknown source changed: '+row.id);found[0].sprite=row.after.sprite;
 }return next;
}
export function assertHallExteriors(layout:MapLayout,catalog:TileCatalog):void{
 if(layout.id!=='overworld')return;
 for(const row of rows()){const found=layout.placements.filter(p=>p.id===row.after.id);need(found.length===1&&isDeepStrictEqual(found[0],row.after),'current hall missing/changed: '+row.id);}
 const expected=hallExteriorSprites();need(isDeepStrictEqual(Object.keys(catalog).filter(k=>k.startsWith('hall-exterior-')).sort(),Object.keys(expected).sort()),'closed catalog family changed');
 for(const[id,sprite]of Object.entries(expected))need(isDeepStrictEqual(catalog[id],sprite),'current sprite geometry/depth/collision changed: '+id);
}
