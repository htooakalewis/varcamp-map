import {preCrescentLayout,preCrescentNative} from './helpers/plaza-crescent-history';
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {assertCurrentNativeMap} from '../tools/maps/current-native';
import {beforeHallBuildingsJson} from './helpers/hall-buildings-history';
const raw=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const read=(p:string)=>p==='world/layouts/overworld.json'?preCrescentLayout(raw(p)):p==='maps/overworld.tmj'?preCrescentNative(raw(p)):raw(p);
describe('Enclosed hall buildings and zodiac ground labels',()=>{
 it('uses full-size enclosed buildings at both existing entrances',()=>{
  const l=read('world/layouts/overworld.json'),c=read('art/tile-catalog.json');
  for(const [id,x] of [['solar',15],['lunar',101]] as const){
   const p=l.placements.find((p:any)=>p.id==='exterior-gate-'+id);
   expect(p).toMatchObject({sprite:'hall-building-'+id,x,y:10,width:12,height:12});
   const s=c[p.sprite];expect(s.level).toBe('aboveAvatar');
   for(let y=3;y<11;y++)for(let x=0;x<12;x++)expect(s.blockingCells).toContainEqual([x,y]);
   for(let x=4;x<8;x++)expect(s.blockingCells).not.toContainEqual([x,11]);
   expect(l.exits.find((e:any)=>e.name===id)).toMatchObject({x:x+4,y:21,width:4,height:1,destination:id+'-hall'});
  }
 });
 it('moves all twelve numbered names below their floor emblems and under players',()=>{
  const l=read('world/layouts/overworld.json'),c=read('art/tile-catalog.json');
  expect(l.placements.filter((p:any)=>p.id.endsWith('-bold-nameplate'))).toHaveLength(0);
  const labels=l.placements.filter((p:any)=>p.id.endsWith('-ground-name'));expect(labels).toHaveLength(12);
  for(const p of labels){const id=p.id.replace('-ground-name',''),e=l.placements.find((p:any)=>p.id===id+'-zodiac-threshold');
   expect(p.y).toBe(e.y+e.height);expect(p.x+p.width/2).toBe(e.x+e.width/2);
   expect(c[p.sprite]).toMatchObject({level:'belowAvatar',blockingCells:[]});
  }
 });
 it('retains all door triggers and confines physical changes to the hall fronts and Cancer forecourt',()=>{
  const old=beforeHallBuildingsJson('maps/overworld.tmj'),map=read('maps/overworld.tmj'),layout=read('world/layouts/overworld.json'),before=beforeHallBuildingsJson('world/layouts/overworld.json');
  expect(map.tilesets.slice(0,98)).toEqual(old.tilesets);expect(map.tilesets).toHaveLength(100);
  for(const key of ['entries','exits','areas','images','signs','inspectionZones'])expect(layout[key]).toEqual(before[key]);
  const a=old.layers.find((l:any)=>l.name==='physical-collisions').data,b=map.layers.find((l:any)=>l.name==='physical-collisions').data;
  for(let i=0;i<a.length;i++)if(a[i]!==b[i]){const x=i%128,y=Math.floor(i/128);expect((y>=10&&y<24&&((x>=15&&x<27)||(x>=99&&x<113)))||(y>=110&&y<115&&x>=57&&x<77)).toBe(true);}
  for(const e of [...layout.entries,...layout.exits])for(let y=e.y;y<e.y+e.height;y++)for(let x=e.x;x<e.x+e.width;x++)expect(b[y*128+x],e.name+' portal/return').toBe(0);
  expect(()=>assertCurrentNativeMap('overworld',raw('maps/overworld.tmj'),raw('world/layouts/overworld.json'),read('maps/overworld.wam'),read('art/tile-catalog.json'))).not.toThrow();
 });
 it('uses translucent text-only floor marks and clears only the hall threshold',async()=>{
  const {data,info}=await sharp('assets/tilesets/original/zodiac-ground-names.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});expect([info.width,info.height]).toEqual([384,768]);
  const alpha=[...data].filter((_,i)=>i%4===3);expect(alpha.reduce((a,b)=>Math.max(a,b),0)).toBe(155);expect(alpha.filter(a=>a===0).length/alpha.length).toBeGreaterThan(.85);
  const halls=await sharp('assets/tilesets/original/hall-buildings.png').ensureAlpha().raw().toBuffer();
  for(const offset of [0,384]){for(let y=352;y<384;y++)for(let x=128;x<256;x++)expect(halls[(y*768+offset+x)*4+3]).toBe(0);
   let painted=0;for(let y=160;y<320;y++)for(let x=128;x<256;x++)if(halls[(y*768+offset+x)*4+3])painted++;
   expect(painted/(160*128),'solid roof and enclosed lobby').toBeGreaterThan(.95);
  }
 });
 it.each(['missing-hall','closed-door','raised-ground-name','returned-board'])('rejects %s at the current publication gate',kind=>{
  const l=raw('world/layouts/overworld.json'),c=read('art/tile-catalog.json');
  if(kind==='missing-hall')l.placements=l.placements.filter((p:any)=>p.sprite!=='hall-building-solar');
  if(kind==='closed-door')c['hall-building-solar'].blockingCells.push([5,11]);
  if(kind==='raised-ground-name')c['zodiac-ground-name-scorpio'].level='aboveAvatar';
  if(kind==='returned-board')l.placements.push(beforeHallBuildingsJson('world/layouts/overworld.json').placements.find((p:any)=>p.id==='scorpio-bold-nameplate'));
  expect(()=>assertCurrentNativeMap('overworld',raw('maps/overworld.tmj'),l,read('maps/overworld.wam'),c)).toThrow(/Hall buildings|Plaza crescent|Plaza landscape/);
 });
});
