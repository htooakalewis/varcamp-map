import {isDeepStrictEqual} from 'node:util';
import {EXPO_MARKS} from './native-ownership-context';
import {renderCaptionMaster} from '../art/standing-captions';
import type {LayoutImage,LayoutSign,MapLayout,Placement} from './types';
/** Expo epoch fixtures. Pure functions returning the layout entries a booth producer
 * places; each entry is exactly what the expo reservation family admits on the overworld
 * (tools/maps/native-ownership-context.ts). Nothing here reads or writes maps. */
export type ExpoMarkId=keyof typeof EXPO_MARKS;
export const EXPO_MARK_IDS=Object.freeze(Object.keys(EXPO_MARKS)) as readonly ExpoMarkId[];
/** Booth logo floor inlay: the registered tileset/layer name for the mark, its PNG and its
 * exact 6×2 or 4×2 footprint at tile x,y, painted below avatars (never standing). */
export function expoLogoImage(mark:ExpoMarkId,x:number,y:number):LayoutImage{
 const registered=EXPO_MARKS[mark];if(!registered)throw Error(`Unregistered expo mark: ${mark}`);
 return{name:registered.name,image:`assets/sponsors/${mark}.png`,x,y,width:registered.columns,height:2,standing:false};
}
export const EXPO_STICKERS=Object.freeze(['sticker-star','sticker-heart','sticker-bolt','sticker-pin','sticker-smile','sticker-leaf'] as const);
export type ExpoSticker=typeof EXPO_STICKERS[number];
/** One 1×1 walkable floor decal from the booth sticker sheet. */
export function expoSticker(id:string,sprite:ExpoSticker,x:number,y:number):Placement{
 if(!EXPO_STICKERS.includes(sprite))throw Error(`Unregistered expo sticker: ${sprite}`);
 return{id,sprite,layer:'props',x,y,width:1,height:1};
}
export interface ExpoCaptionOptions{fontSize?:number;color?:string;padding?:number;align?:'left'|'center';}
export interface ExpoCaption{sign:LayoutSign;face:Placement;supports:Placement[];standingSign:{face:string;supports:string[];text:string};}
/** Booth label: a navy fascia strip (the wall-navy top row as a standing face) at tile x,y
 * spanning `width` tiles, one blocking fascia post under every column (the wall base), and
 * the linked caption text rendered by the overworld's own standing-captions atlas
 * (assets/tilesets/original/expo-captions.png via `npx tsx tools/art/standing-captions.ts`).
 * The text must fit the atlas glyph set and width at construction time. */
export function expoCaption(id:string,text:string,x:number,y:number,width:number,options:ExpoCaptionOptions={}):ExpoCaption{
 if(!/^[a-z0-9][a-z0-9-]*$/.test(id))throw Error(`Expo caption id must be a lower-case slug: ${id}`);
 if(![x,y,width].every(Number.isInteger)||width<1||width>16)throw Error(`${id}: expo caption needs an integer footprint of 1-16 tiles`);
 const sign:LayoutSign={name:id,text,x,y,width,height:1,fontSize:options.fontSize??18,color:options.color??'#f1d9a0',align:options.align??'center',padding:options.padding??1};
 const face:Placement={id:`${id}-fascia`,sprite:'expo-fascia',layer:'props',x,y,width,height:1};
 const supports=Array.from({length:width},(_,i):Placement=>({id:`${id}-fascia-post-${i}`,sprite:'expo-fascia-post',layer:'props',x:x+i,y:y+1,width:1,height:1}));
 renderCaptionMaster([{map:'overworld',face:face.id,sign}]);// glyph/fit/style policy of the caption producer
 return{sign,face,supports,standingSign:{face:face.id,supports:supports.map(s=>s.id),text:id}};
}
/** Appends one caption assembly to a layout copy: fascia, posts, sign text and the link. */
export function withExpoCaption(layout:MapLayout,caption:ExpoCaption):MapLayout{
 const l=structuredClone(layout),ids=new Set(l.placements.map(p=>p.id));
 for(const p of [caption.face,...caption.supports])if(ids.has(p.id))throw Error(`Expo caption placement id already used: ${p.id}`);
 if(l.signs?.some(s=>s.name===caption.sign.name)||l.standingSigns?.some(s=>s.face===caption.standingSign.face||s.text===caption.standingSign.text))throw Error(`Expo caption already present: ${caption.sign.name}`);
 if(!isDeepStrictEqual(expoCaption(caption.sign.name,caption.sign.text,caption.sign.x,caption.sign.y,caption.sign.width,{fontSize:caption.sign.fontSize,color:caption.sign.color,padding:caption.sign.padding,align:caption.sign.align}),caption))throw Error(`Expo caption assembly was altered: ${caption.sign.name}`);
 l.placements.push(caption.face,...caption.supports);(l.signs??=[]).push(caption.sign);(l.standingSigns??=[]).push(caption.standingSign);
 return l;
}
