import {SIGN_IDS} from '../../src/world/catalog';
import type {Sprite} from '../art/catalog';
export const HALL_BUILDINGS_IMAGE='assets/tilesets/original/hall-buildings.png';
export const ZODIAC_GROUND_NAMES_IMAGE='assets/tilesets/original/zodiac-ground-names.png';
export const HALL_BUILDING_ATLASES=[
 {name:'zodiac-ground-names',image:'../'+ZODIAC_GROUND_NAMES_IMAGE,columns:12,imagewidth:384,imageheight:768,tilecount:288},
 {name:'hall-buildings',image:'../'+HALL_BUILDINGS_IMAGE,columns:24,imagewidth:768,imageheight:384,tilecount:288},
];
export function hallBuildingSprites():Record<string,Sprite>{
 const solid:[number,number][]=[];
 for(let y=0;y<12;y++)for(let x=0;x<12;x++)if(y!==11||x<4||x>=8)solid.push([x,y]);
 return Object.fromEntries(['solar','lunar'].map((id,i)=>['hall-building-'+id,{sheet:HALL_BUILDINGS_IMAGE,rect:{x:i*12,y:0,width:12,height:12},blockingCells:structuredClone(solid),level:'aboveAvatar',sourceId:'original'}]));
}
export function zodiacGroundNameSprites():Record<string,Sprite>{return Object.fromEntries(SIGN_IDS.map((id,i)=>['zodiac-ground-name-'+id,{sheet:ZODIAC_GROUND_NAMES_IMAGE,rect:{x:0,y:i*2,width:12,height:2},blockingCells:[],level:'belowAvatar',sourceId:'original'}]));}
