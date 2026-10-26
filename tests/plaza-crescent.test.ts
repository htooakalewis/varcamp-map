import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {beforeCrescentJson} from './helpers/plaza-crescent-history';
import {assertCurrentNativeMap} from '../tools/maps/current-native';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const signs=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
const ground=(l:any)=>{const g=new Map<string,string>();for(const p of l.placements)if(p.layer==='terrain')for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++)g.set(`${x},${y}`,p.sprite);return g;};
describe('Crescent plaza and expanded circular speaker ring',()=>{
 it('keeps all twelve full-size buildings on the same evenly spaced44-tile circle',()=>{
  const l=read('world/layouts/overworld.json');
  for(const [i,sign]of signs.entries()){
   const p=l.placements.find((p:any)=>p.id===sign+'-building');
   expect([p.width,p.height]).toEqual([12,12]);
   expect([p.x+6,p.y+6],sign).toEqual([64+Math.round(44*Math.cos(i*Math.PI/6)),64+Math.round(44*Math.sin(i*Math.PI/6))]);
   const e=l.exits.find((e:any)=>e.name==='speaker-'+sign),entry=l.entries.find((e:any)=>e.name==='from-speaker-'+sign);
   expect([e.x,e.y]).toEqual([p.x+5,p.y+11]);expect(entry.y).toBe(e.y+2);
   const label=l.placements.find((p:any)=>p.id===sign+'-ground-name');expect(label.y).toBe(p.y+16);expect(label.x).toBe(p.x);
  }
 });
 it('provides at least six clear tiles beside and behind the booths',()=>{
  const m=read('maps/overworld.tmj'),mask=m.layers.find((l:any)=>l.name==='physical-collisions').data;
  for(const [x0,y0,w,h] of [[32,76,6,20],[90,76,6,20],[32,89,64,7]])for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)expect(mask[y*128+x],`clear promenade ${x},${y}`).toBe(0);
 });
 it('frames a broad north approach with mirrored garden wings and a fully paved fountain court',()=>{
  const l=read('world/layouts/overworld.json'),g=ground(l);
  expect(l.placements.some((p:any)=>p.id.startsWith('crescent-ground-'))).toBe(true);
  for(let y=39;y<54;y++)for(let x=40;x<60;x++)expect(g.get(`${x},${y}`)?.startsWith('plaza-grass'),`${x},${y}`).toBe(g.get(`${127-x},${y}`)?.startsWith('plaza-grass'));
  for(let y=38;y<54;y++)for(let x=60;x<68;x++)expect(g.get(`${x},${y}`)).toBe('path-stone');
  for(let y=58;y<63;y++)for(let x=48;x<54;x++)expect(g.get(`${x},${y}`),`fountain court ${x},${y}`).toBe('path-stone');
 });
 it('uses symmetric paving throughout the lower terrace',()=>{
  const g=ground(read('world/layouts/overworld.json'));
  for(let y=89;y<120;y++)for(let x=16;x<64;x++)expect(g.get(`${x},${y}`)==='path-stone',`${x},${y}`).toBe(g.get(`${127-x},${y}`)==='path-stone');
 });
 it('retains the enlarged booth interiors, chat controls, animations and every atlas reservation',()=>{
  const l=read('world/layouts/overworld.json'),old=beforeCrescentJson('world/layouts/overworld.json'),m=read('maps/overworld.tmj'),n=beforeCrescentJson('maps/overworld.tmj');
  expect(l.placements.filter((p:any)=>p.id.startsWith('expo-'))).toEqual(old.placements.filter((p:any)=>p.id.startsWith('expo-')));
  expect(l.images.filter((p:any)=>!p.name.startsWith('Sponsors / Demo'))).toEqual(old.images.filter((p:any)=>!p.name.startsWith('Sponsors / Demo')));
  for(const key of ['areas','signs','animatedOverlays'])expect(l[key],key).toEqual(old[key]);
  expect(read('maps/overworld.wam')).toEqual(beforeCrescentJson('maps/overworld.wam'));
  expect(read('art/tile-catalog.json')).toEqual(beforeCrescentJson('art/tile-catalog.json'));
  expect(m.tilesets).toEqual(n.tilesets);expect(m.layers.map((l:any)=>[l.id,l.name])).toEqual(n.layers.map((l:any)=>[l.id,l.name]));
 });
 it('keeps every moved door and return reachable from the arrival without crossing a different portal',()=>{
  const l=read('world/layouts/overworld.json'),m=read('maps/overworld.tmj'),mask=m.layers.find((l:any)=>l.name==='physical-collisions').data;
  const portals=new Set<number>(l.exits.flatMap((e:any)=>Array.from({length:e.width*e.height},(_,i)=>(e.y+Math.floor(i/e.width))*128+e.x+i%e.width)));
  const seen=new Set([65*128+63]),queue=[65*128+63];
  for(let h=0;h<queue.length;h++)for(const n of [queue[h]-128,queue[h]+128,...(queue[h]%128?[queue[h]-1]:[]),...(queue[h]%128<127?[queue[h]+1]:[])])if(n>=0&&n<16384&&!mask[n]&&!portals.has(n)&&!seen.has(n)){seen.add(n);queue.push(n);}
  for(const sign of signs){const e=l.exits.find((e:any)=>e.name==='speaker-'+sign),r=l.entries.find((e:any)=>e.name==='from-speaker-'+sign);
   expect(seen.has(r.y*128+r.x),sign+' return').toBe(true);
   for(let x=e.x;x<e.x+e.width;x++){expect(mask[e.y*128+x],sign+' doorway').toBe(0);expect(seen.has((e.y+1)*128+x),sign+' threshold approach').toBe(true);}
  }
  expect(()=>assertCurrentNativeMap('overworld',m,l,read('maps/overworld.wam'),read('art/tile-catalog.json'))).not.toThrow();
 });
 it.each(['collapsed-circle','blocked-promenade','misaligned-return'])('rejects %s at the publication gate',kind=>{
  const l=read('world/layouts/overworld.json'),m=read('maps/overworld.tmj');
  if(kind==='collapsed-circle')l.placements.find((p:any)=>p.id==='leo-building').y--;
  if(kind==='misaligned-return')l.entries.find((p:any)=>p.name==='from-speaker-virgo').x++;
  if(kind==='blocked-promenade'){const layer=m.layers.find((l:any)=>l.name==='physical-collisions'),set=m.tilesets.find((s:any)=>s.name==='navigation-mask');layer.data[92*128+35]=set.firstgid+1;}
  expect(()=>assertCurrentNativeMap('overworld',m,l,read('maps/overworld.wam'),read('art/tile-catalog.json'))).toThrow(/Plaza crescent|Native projection/);
 });
});
