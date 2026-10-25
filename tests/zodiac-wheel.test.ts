import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SIGN_IDS } from '../src/world/catalog';
import { composeZodiacWheel } from '../tools/maps/zodiac-wheel';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import type { MapLayout, TileRect } from '../tools/maps/types';
const layouts=composeZodiacWheel(readdirSync('world/layouts').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`world/layouts/${f}`,'utf8')) as MapLayout));
const l=layouts.find(l=>l.id==='overworld')!;
const overlaps=(a:TileRect,b:TileRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;

describe('medium authored zodiac arrival',()=>{
 it('preserves explicit authored scenes without injecting facade or furniture transforms',()=>{
  const source=readdirSync('world/layouts').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`world/layouts/${f}`,'utf8')) as MapLayout);
  const before=structuredClone(source),result=composeZodiacWheel(source);
  expect(result).toEqual(before);expect(source).toEqual(before);expect(result).not.toBe(source);
  result[0].placements.length=0;expect(source).toEqual(before);
 });
 it('has twelve separate compact zodiac facades surrounding the welcome court',()=>{
  expect([l.width,l.height]).toEqual([128,128]);
  const buildings=l.inspectionZones.filter(z=>z.name.endsWith('-pavilion'));
  expect(buildings.map(z=>z.name).sort()).toEqual(SIGN_IDS.map(s=>`${s}-pavilion`).sort());
  for(const b of buildings){expect(b.width*b.height).toBeLessThanOrEqual(144);expect(b.x>=0&&b.y>=0&&b.x+b.width<=l.width&&b.y+b.height<=l.height).toBe(true);}
  for(let i=0;i<buildings.length;i++)for(let j=i+1;j<buildings.length;j++)expect(overlaps(buildings[i],buildings[j])).toBe(false);
 });
 it('numbers every speaker facade and signs all six hall and activity directions',()=>{
  for(const [i,sign] of SIGN_IDS.entries()){
   const pavilion=l.inspectionZones.find(z=>z.name===`${sign}-pavilion`)!,door=l.exits.find(e=>e.destination===`speaker-${sign}`)!;
   // Point from the public approach into the facade, based on the actual doorway edge.
   const edges=[{gap:door.x-pavilion.x,arrow:'→'},{gap:pavilion.x+pavilion.width-door.x-door.width,arrow:'←'},{gap:door.y-pavilion.y,arrow:'↓'},{gap:pavilion.y+pavilion.height-door.y-door.height,arrow:'↑'}].sort((a,b)=>a.gap-b.gap);
   expect(edges[0].gap,`${sign} doorway must touch its facade edge`).toBe(0);
   const copy=JSON.parse(readFileSync('art/source/hub-nameplates.json','utf8')).labels.find((r:{id:string})=>r.id===sign);
   expect(copy.text).toBe(`${String(i+1).padStart(2,'0')} ${sign.toUpperCase()} SPEAKER ROOM`);
   expect(l.placements.find(p=>p.id===`${sign}-bold-nameplate`)?.sprite).toBe(`hub-label-${sign}`);
   expect(l.placements.find(p=>p.id===`approach-arrow-${sign}`)?.sprite).toBe('arrow-north');
  }
  for(const name of ['solar','lunar','maze','festival','shipyard','campus']){
   const hall=name==='solar'||name==='lunar';
   expect(l.placements.find(p=>p.id===`exterior-gate-${name}`)?.sprite).toBe(hall?`hall-exterior-${name}`:`exterior-gate-${name}`);
   if(hall){const meta=JSON.parse(readFileSync('art/source/hall-exteriors.json','utf8'));expect(meta.subjects.find((r:{id:string})=>r.id===name).title).toBe(name.toUpperCase()+' HALL');}
   expect(l.exits.some(e=>e.name===name)).toBe(true);
  }
 });
 it('provides a continuous inner promenade around the court',()=>{
  const loop=l.placements.filter(p=>p.id.startsWith('promenade-'));
  expect(loop.length).toBeGreaterThan(0);
  const cells=new Set(loop.flatMap(p=>Array.from({length:p.width*p.height},(_,i)=>`${p.x+i%p.width},${p.y+Math.floor(i/p.width)}`)));
  const first=loop[0],queue=[[first.x,first.y]],seen=new Set([`${first.x},${first.y}`]);
  for(let h=0;h<queue.length;h++){const[x,y]=queue[h];for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const k=`${nx},${ny}`;if(cells.has(k)&&!seen.has(k)){seen.add(k);queue.push([nx,ny]);}}}
  expect(seen.size).toBe(cells.size);
 });
 it('keeps the welcome directory area clear after retiring the welcome and directory boards',()=>{
  const copy=JSON.parse(readFileSync('art/source/hub-nameplates.json','utf8'));
  expect(copy.navigation.find((p:{id:string})=>p.id==='welcome').lines).toContain('MOVE: ARROWS / WASD');
  expect(copy.labels).toHaveLength(12);expect(l.placements.some(p=>p.id==='directory-prompt'||p.id==='welcome-control-sign')).toBe(false);
  expect(l.standingSigns!.some(s=>s.face==='welcome-control-sign')).toBe(false);
  const area=l.areas.find(a=>a.name==='welcome-directory')!;expect(area.properties).toEqual([]);
  expect(l.exits.some(e=>overlaps(area,e))).toBe(false);
  const {tmj,wam}=buildMap(l,loadTileCatalog());
  expect(wam.areas.find(a=>a.name===area.name)).toMatchObject({id:'welcome-directory',x:area.x*32,y:area.y*32,width:area.width*32,height:area.height*32,properties:[]});
  const mask=tmj.layers.find(layer=>layer.name==='physical-collisions');if(mask?.type!=='tilelayer')throw Error('missing collision mask');
  const spawn=l.entries.find(e=>e.isDefault)!,queue=[spawn.y*l.width+spawn.x],seen=new Set(queue);
  for(let h=0;h<queue.length;h++){const n=queue[h];for(const next of[n-l.width,n+l.width,n-1,n+1])if(next>=0&&next<l.width*l.height&&Math.abs(next%l.width-n%l.width)<=1&&!mask.data[next]&&!seen.has(next)){seen.add(next);queue.push(next);}}
  expect(l.areas.some(a=>a.name==='npc-guide')).toBe(false);
  for(const target of [area,{name:'former-guide-station',x:76,y:71,width:3,height:3}])for(let y=target.y;y<target.y+target.height;y++)for(let x=target.x;x<target.x+target.width;x++){expect(mask.data[y*l.width+x],`${target.name} collision ${x},${y}`).toBe(0);expect(seen.has(y*l.width+x),`${target.name} unreachable ${x},${y}`).toBe(true);}
 });
});
