import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {describe,it,expect} from 'vitest';
import {assertCurrentNativeMap} from '../tools/maps/current-native';
import {loadTileCatalog} from '../tools/art/catalog';
import type {TileLayer} from '../tools/maps/types';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const before=JSON.parse(gunzipSync(readFileSync('tests/fixtures/cafe-arrival/before.json.gz')).toString());
function datum(id='moon-cafe'){
 const map=read(`maps/${id}.tmj`),layout=read(`world/layouts/${id}.json`),wam=read(`maps/${id}.wam`),catalog=loadTileCatalog();
 return {map,layout,wam,catalog,guard:()=>assertCurrentNativeMap(id,map,layout,wam,catalog)};
}
describe('Moon Café walking and native scene ownership',()=>{
 it('reaches the bar, moon lounge, all seating groups and both exit approaches',()=>{
  const {map}=datum(),solid=new Set<number>();
  const gids=new Set<number>(map.tilesets.flatMap((s:any)=>(s.tiles??[]).filter((t:any)=>t.properties?.some((p:any)=>p.name==='collides'&&p.value===true)).map((t:any)=>s.firstgid+t.id)));
  for(const l of map.layers)if(l.type==='tilelayer')l.data.forEach((g:number,i:number)=>{if(gids.has(g&0xfffffff))solid.add(i);});
  const queue=[[19,32]],seen=new Set(['19,32']);
  for(let i=0;i<queue.length;i++)for(const [x,y] of [[queue[i][0]-1,queue[i][1]],[queue[i][0]+1,queue[i][1]],[queue[i][0],queue[i][1]-1],[queue[i][0],queue[i][1]+1]]){
   const key=`${x},${y}`;if(x<0||y<0||x>=40||y>=40||solid.has(y*40+x)||seen.has(key))continue;seen.add(key);queue.push([x,y]);
  }
  for(const target of ['12,15','12,12','29,15','9,24','30,24','9,30','30,30','7,35','19,35'])expect(seen.has(target),target).toBe(true);
  for(let x=18;x<=21;x++)for(let y=17;y<=35;y++)expect(solid.has(y*40+x),`main aisle ${x},${y}`).toBe(false);
  for(let x=6;x<=17;x++)for(let y=13;y<=14;y++)expect(solid.has(y*40+x),'bar body').toBe(true);
 });
 it.each(['moon-cafe','campus-exploration'])('%s preserves saved media/areas and every named exit',id=>{
  const d=datum(id),old=JSON.parse(before.components[`world/layouts/${id}.json`]);
  expect(readFileSync(`maps/${id}.wam`,'utf8')).toBe(before.components[`maps/${id}.wam`]);
  expect(d.layout.exits).toEqual(old.exits);expect(d.layout.areas).toEqual(old.areas);
  expect(()=>d.guard()).not.toThrow();
 });
 it.each(['collision','text','extra-atlas','extra-layer'])('rejects unreviewed café %s changes',kind=>{
  const d=datum();
  if(kind==='collision'){const l=d.map.layers.find((l:any)=>l.name==='physical-collisions') as TileLayer;l.data[13*40+12]=0;}
  if(kind==='text')d.map.layers.find((l:any)=>l.name==='wayfinding-text').objects[2].text.text='WRONG';
  if(kind==='extra-atlas')d.map.tilesets.push({...d.map.tilesets[0],name:'unowned',firstgid:90000});
  if(kind==='extra-layer')d.map.layers.push({...d.map.layers[0],name:'unowned',id:90000});
  expect(()=>d.guard()).toThrow();
 });
 it('rejects a removed or displaced southern default alias',()=>{
  for(const mode of ['removed','moved']){
   const d=datum('campus-exploration'),l=d.map.layers.find((l:any)=>l.name==='start');
   if(mode==='removed')d.map.layers=d.map.layers.filter((l:any)=>l.name!=='start');else{l.data[40*48+23]=0;l.data[12*48+7]=2416;}
   expect(()=>d.guard()).toThrow();
  }
 });
});
