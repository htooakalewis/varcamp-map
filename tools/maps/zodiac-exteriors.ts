import {isDeepStrictEqual} from 'node:util';
import recipe from '../../world/zodiac-exteriors.json';
import {SIGN_IDS} from '../../src/world/catalog';
import {zodiacExteriorSprites} from '../art/zodiac-exteriors';
import type {MapLayout} from './types';
import type {TileCatalog} from '../art/catalog';
const need=(ok:unknown,message:string)=>{if(!ok)throw Error('Zodiac exteriors: '+message);};
function rows(){need(recipe.version===1&&isDeepStrictEqual(recipe.buildings.map(r=>r.sign),SIGN_IDS),'exact twelve-building recipe required');return recipe.buildings;}
/** Named finite successor: only twelve existing sprite selections may change. */
export function applyZodiacExteriors(original:MapLayout):MapLayout{
 if(original.id!=='overworld')return structuredClone(original);
 const next=structuredClone(original);
 for(const row of rows()){
  const found=next.placements.filter(p=>p.id===row.before.id);need(found.length===1,'building missing/duplicated: '+row.sign);
  need(isDeepStrictEqual(found[0],row.before)||isDeepStrictEqual(found[0],row.after),'building footprint/entrance/depth or unknown source changed: '+row.sign);
  found[0].sprite=row.after.sprite;
 }
 return next;
}
export function assertZodiacExteriors(layout:MapLayout,catalog:TileCatalog):void{
 if(layout.id!=='overworld')return;
 for(const row of rows()){const found=layout.placements.filter(p=>p.id===row.after.id);need(found.length===1&&isDeepStrictEqual(found[0],row.after),'current zodiac building missing/changed: '+row.sign);}
 const expected=zodiacExteriorSprites();need(isDeepStrictEqual(Object.keys(catalog).filter(k=>k.startsWith('zodiac-building-')).sort(),Object.keys(expected).sort()),'closed catalog family changed');
 for(const[id,sprite]of Object.entries(expected))need(isDeepStrictEqual(catalog[id],sprite),'current sprite geometry/depth/collision changed: '+id);
}
