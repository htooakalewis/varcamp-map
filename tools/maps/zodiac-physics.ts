import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import sharp from 'sharp';
import recipe from '../../world/zodiac-physics.json';
import {SIGN_IDS} from '../../src/world/catalog';
import {zodiacExteriorSprites,ZODIAC_EXTERIOR_IMAGE} from '../art/zodiac-exteriors';
import {buildMap} from './builder';
import {assertNativeSourceProjection,reconcileNativeProjection} from './native-projection';
import type {Sprite,TileCatalog} from '../art/catalog';
import type {MapLayout,TiledMap,TileLayer} from './types';

const need=(ok:unknown,message:string)=>{if(!ok)throw Error('Zodiac physics: '+message);};
function rows(){
 need(recipe.version===1&&isDeepStrictEqual(recipe.buildings.map(r=>r.sign),SIGN_IDS),'exact twelve-building recipe required');
 need(recipe.atlas===ZODIAC_EXTERIOR_IMAGE&&recipe.alphaThreshold===192&&recipe.minOpaquePixels===256&&isDeepStrictEqual(recipe.doorPassage,{x:5,y:9,width:2,height:3}),'native silhouette rule changed');
 for(const row of recipe.buildings){
  need(row.mask.length===12&&row.mask.every(r=>/^[.#]{12}$/.test(r)),'12 by12 mask required: '+row.sign);
  const expected=structuredClone(row.beforeBuilding);expected.sprite='zodiac-physical-'+row.sign;delete (expected as {renderRole?:string}).renderRole;
  const nameplate=structuredClone(row.beforeNameplate);delete (nameplate as {renderRole?:string}).renderRole;
  need(isDeepStrictEqual(row.afterBuilding,expected)&&isDeepStrictEqual(row.afterNameplate,nameplate),'only sprite and grounded overrides may change: '+row.sign);
  for(let y=9;y<12;y++)for(const x of[5,6])need(row.mask[y][x]==='.', 'entrance must stay open: '+row.sign);
 }return recipe.buildings;
}

/** Retain every original sprite; only this new family owns the physical repair. */
export function zodiacPhysicsSprites():Record<string,Sprite>{
 const old=zodiacExteriorSprites();
 return Object.fromEntries(rows().map(row=>[row.afterBuilding.sprite,{...structuredClone(old[row.beforeBuilding.sprite]),blockingCells:row.mask.flatMap((line,y)=>[...line].flatMap((c,x)=>c==='#'?[[x,y] as [number,number]]:[]))}]));
}
/** Finite source successor; all coordinates, ordering and unrelated fields survive. */
export function applyZodiacPhysics(original:MapLayout):MapLayout{
 if(original.id!=='overworld')return structuredClone(original);
 const next=structuredClone(original);
 for(const row of rows())for(const[before,after]of[[row.beforeBuilding,row.afterBuilding],[row.beforeNameplate,row.afterNameplate]]){
  const found=next.placements.filter(p=>p.id===before.id);need(found.length===1,'placement missing/duplicated: '+before.id);
  need(isDeepStrictEqual(found[0],before)||isDeepStrictEqual(found[0],after),'unknown placement geometry/depth: '+before.id);
  next.placements[next.placements.indexOf(found[0])]=structuredClone(after) as MapLayout['placements'][number];
 }return next;
}
/** Checked predecessor view for retained historical contracts, never blind stripping. */
export function restoreZodiacPhysics(original:MapLayout):MapLayout{
 const next=structuredClone(original);if(next.id!=='overworld')return next;
 for(const row of rows())for(const[before,after]of[[row.beforeBuilding,row.afterBuilding],[row.beforeNameplate,row.afterNameplate]]){
  const found=next.placements.filter(p=>p.id===after.id);need(found.length===1&&isDeepStrictEqual(found[0],after),'current placement missing/changed: '+after.id);
  next.placements[next.placements.indexOf(found[0])]=structuredClone(before) as MapLayout['placements'][number];
 }return next;
}
export function assertZodiacPhysics(layout:MapLayout,catalog:TileCatalog):void{
 if(layout.id!=='overworld')return;
 restoreZodiacPhysics(layout);
 const expected=zodiacPhysicsSprites();need(isDeepStrictEqual(Object.keys(catalog).filter(k=>k.startsWith('zodiac-physical-')).sort(),Object.keys(expected).sort()),'closed physical catalog family changed');
 for(const[id,sprite]of Object.entries(expected))need(isDeepStrictEqual(catalog[id],sprite),'physical sprite geometry/depth/collision changed: '+id);
}
/** Independently check literal colliders against the retained native alpha pixels. */
export async function checkZodiacPhysicsArt(catalog:TileCatalog):Promise<string[]>{
 try{
  const sprites=zodiacPhysicsSprites();need(isDeepStrictEqual(Object.keys(catalog).filter(k=>k.startsWith('zodiac-physical-')).sort(),Object.keys(sprites).sort()),'exact twelve physical sprites required');
  const raw=readFileSync(recipe.atlas);need(createHash('sha256').update(raw).digest('hex')===recipe.atlasSha256,'retained native atlas changed');
  const{data,info}=await sharp(raw).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const row of rows()){
   const s=sprites[row.afterBuilding.sprite];need(isDeepStrictEqual(catalog[row.afterBuilding.sprite],s),'physical sprite changed: '+row.sign);
   for(let y=0;y<12;y++)for(let x=0;x<12;x++){
    let opaque=0;for(let py=0;py<32;py++)for(let px=0;px<32;px++)if(data[((s.rect.y*32+y*32+py)*info.width+s.rect.x*32+x*32+px)*4+3]>=192)opaque++;
    const expected=opaque>=256&&!((x===5||x===6)&&y>=9);need((row.mask[y][x]==='#')===expected,`mask differs from native alpha: ${row.sign} ${x},${y}`);
   }
  }return [];
 }catch(error){return[String(error)];}
}
/** Only an exact predecessor/current projection can enter this transaction.
 * Invisible collision DATA needs an explicit remap; the shared paint author
 * deliberately does not rewrite it. No atlas or control ownership is widened. */
export function reconcileZodiacPhysics(native:TiledMap,layout:MapLayout,catalog:TileCatalog):TiledMap{
 assertZodiacPhysics(layout,catalog);const source=buildMap(layout,catalog).tmj;
 try{assertNativeSourceProjection(native,source);return structuredClone(native);}catch{/* The only other admitted state is the checked predecessor below. */}
 assertNativeSourceProjection(native,buildMap(restoreZodiacPhysics(layout),catalog).tmj);
 const adjusted=structuredClone(native),target=adjusted.layers.find(l=>l.name==='physical-collisions'),wanted=source.layers.find(l=>l.name==='physical-collisions');
 const actualSet=adjusted.tilesets.find(t=>t.name==='navigation-mask'),sourceSet=source.tilesets.find(t=>t.name==='navigation-mask');
 need(target?.type==='tilelayer'&&wanted?.type==='tilelayer'&&actualSet&&sourceSet,'unique physical collision layer/atlas required');
 (target as TileLayer).data=(wanted as TileLayer).data.map(g=>g?actualSet!.firstgid+g-sourceSet!.firstgid:0);
 return reconcileNativeProjection(adjusted,source);
}
