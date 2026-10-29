import {isDeepStrictEqual} from 'node:util';
import {buildMap} from './builder';
import {assertNativeSourceProjection} from './native-projection';
import type {Sprite,TileCatalog} from '../art/catalog';
import type {MapLayout,TiledMap,TileLayer} from './types';

const need=(ok:unknown,message:string):void=>{if(!ok)throw Error('Expo chair physics: '+message);};
const original:Sprite={sheet:'assets/tilesets/workadventure/WA_Seats.png',rect:{x:0,y:9,width:1,height:2},blockingCells:[[0,1]],level:'belowAvatar',sourceId:'workadventure'};
export const expoChairSprite=():Sprite=>({...structuredClone(original),blockingCells:[[0,0]]});
const chairs=['n','s'].flatMap(row=>[44,52,60,67,75,83].map((x,i)=>({id:`expo-${row}${i+1}-chair`,x,y:row==='n'?71:84,width:1,height:2,layer:'props' as const,sprite:'chair-presentation'})));

export function assertExpoChairCatalog(catalog:TileCatalog):void{
 need(isDeepStrictEqual(catalog['chair-presentation'],expoChairSprite()),'visible-seat collider changed');
}
/** Historical transactions must use the genuine old collider, not today's fix. */
export function beforeExpoChairCatalog(catalog:TileCatalog):TileCatalog{
 assertExpoChairCatalog(catalog);
 return {...catalog,'chair-presentation':structuredClone(original)};
}
/** Only the two cells of each chair may change; native visuals and GIDs survive. */
function project(native:TiledMap,layout:MapLayout,catalog:TileCatalog,forward:boolean):TiledMap{
 assertExpoChairCatalog(catalog);
 need(layout.id==='overworld','requires the plaza');
 for(const chair of chairs){const found=layout.placements.filter(p=>p.id===chair.id);need(found.length===1&&isDeepStrictEqual(found[0],chair),'unreviewed chair: '+chair.id);}
 need(layout.placements.filter(p=>p.sprite==='chair-presentation').length===12,'unexpected chair roster');
 const oldCatalog=beforeExpoChairCatalog(catalog);
 assertNativeSourceProjection(native,buildMap(layout,forward?oldCatalog:catalog).tmj);
 const target=buildMap(layout,forward?catalog:oldCatalog).tmj,next=structuredClone(native);
 const mask=next.layers.find(l=>l.name==='physical-collisions') as TileLayer;
 const wanted=target.layers.find(l=>l.name==='physical-collisions') as TileLayer;
 const a=next.tilesets.find(t=>t.name==='navigation-mask')!,b=target.tilesets.find(t=>t.name==='navigation-mask')!;
 const allowed=new Set(chairs.flatMap(p=>[p.y*next.width+p.x,(p.y+1)*next.width+p.x]));
 let changes=0;
 mask.data=mask.data.map((old,i)=>{
  const value=wanted.data[i]?wanted.data[i]-b.firstgid+a.firstgid:0;
  if(value!==old){need(allowed.has(i),'unrelated collision changed');changes++;}
  return value;
 });
 need(changes===24,'exactly twelve chair corrections required');
 assertNativeSourceProjection(next,target);return next;
}
export const reconcileExpoChairPhysics=(m:TiledMap,l:MapLayout,c:TileCatalog):TiledMap=>project(m,l,c,true);
export const restoreExpoChairNative=(m:TiledMap,l:MapLayout,c:TileCatalog):TiledMap=>project(m,l,c,false);
