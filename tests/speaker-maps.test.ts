import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SIGN_IDS, WORLD_CATALOG } from '../src/world/catalog';
import { loadTileCatalog } from '../tools/art/catalog';
import { buildMap } from '../tools/maps/builder';
import { composeZodiacWheel } from '../tools/maps/zodiac-wheel';
import type { MapLayout, TileRect, TiledMap } from '../tools/maps/types';

const raw = readdirSync('world/layouts').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`world/layouts/${f}`,'utf8')) as MapLayout);
const composed=composeZodiacWheel(structuredClone(raw));
const tileCells=(r:TileRect,w:number)=>Array.from({length:r.width*r.height},(_,i)=>(r.y+Math.floor(i/r.width))*w+r.x+i%r.width);
const overlaps=(a:TileRect,b:TileRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const walk=(map:TiledMap,start:number)=>{
 const gids=new Set(map.tilesets.flatMap(t=>(t.tiles??[]).filter(c=>c.properties?.some(p=>p.name==='collides'&&p.value===true)).map(c=>t.firstgid+c.id)));
 const blocked=new Set(map.layers.flatMap(l=>l.type==='tilelayer'?l.data.flatMap((gid,i)=>gids.has(gid)?[i]:[]):[]));
 const seen=new Set([start]),q=[start];
 for(let h=0;h<q.length;h++){const cell=q[h],x=cell%map.width,y=Math.floor(cell/map.width);for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=ny*map.width+nx;if(nx<0||ny<0||nx>=map.width||ny>=map.height||blocked.has(n)||seen.has(n))continue;seen.add(n);q.push(n);}}
 return{seen,blocked};
};

describe('separate authored speaker scenes',()=>{
 it('provides all twelve private meetings and discoveries solely in speaker scenes',()=>{
  expect(composed).toHaveLength(34);expect(Object.keys(WORLD_CATALOG)).toHaveLength(34);expect(composed.map(l=>l.id).sort()).toEqual(Object.keys(WORLD_CATALOG).sort());
  for(const sign of SIGN_IDS){
   const l=composed.find(l=>l.id===`speaker-${sign}`)!;expect(l).toBeDefined();expect(l.width).toBeLessThanOrEqual(40);expect(l.height).toBeLessThanOrEqual(40);expect(l.width).toBeGreaterThanOrEqual(32);expect(l.height).toBeGreaterThanOrEqual(32);
   expect(l.areas.filter(a=>a.properties.some(p=>p.type==='livekitRoomProperty')).map(a=>a.name)).toEqual([`meeting-${sign}`]);
   expect(l.areas.find(a=>a.name===`meeting-${sign}`)!.properties).toEqual([{id:`${sign}-livekit`,type:'livekitRoomProperty',roomName:`varcamp-${sign}`,livekitRoomConfig:{startWithAudioMuted:true,startWithVideoMuted:true,disableChat:true,raiseHandEnabled:true}}]);
   expect(l.areas.find(a=>a.name===`beacon-${sign}`)?.properties).toEqual([]);
   expect(l.placements.some(p=>p.sprite===`glyph-${sign}`)).toBe(true);expect(l.placements.some(p=>p.sprite===`constellation-${sign}`)).toBe(true);
  }
  for(const l of composed.filter(l=>!l.id.startsWith('speaker-')&&!l.id.endsWith('-hall'))){expect(l.areas.some(a=>a.properties.some(p=>p.type==='livekitRoomProperty')),`${l.id} hosts a private meeting`).toBe(false);expect(l.areas.some(a=>a.name.startsWith('beacon-'))).toBe(false);}
 });
 it('keeps speaker arrivals, aisles, discoveries, meeting approaches and physical returns connected',()=>{
  for(const sign of SIGN_IDS){
   const l=composed.find(l=>l.id===`speaker-${sign}`)!,spawn=l.entries.find(e=>e.isDefault)!;
   expect(l.exits).toEqual([expect.objectContaining({name:'plaza-return',destination:'overworld',entry:`from-speaker-${sign}`})]);
   const {tmj}=buildMap(l,loadTileCatalog()),{seen,blocked}=walk(tmj,spawn.y*l.width+spawn.x);
   const clear=[...l.entries,...l.exits,l.areas.find(a=>a.name===`beacon-${sign}`)!,...l.inspectionZones.filter(z=>['central-aisle','front-route'].includes(z.name))];
   for(const e of l.entries)expect(l.exits.some(x=>overlaps(e,x))).toBe(false);
   for(const r of clear)for(const c of tileCells(r,l.width))expect(seen.has(c)&&!blocked.has(c),`${sign} ${r.name} blocked ${c}`).toBe(true);
   expect(tileCells(l.areas.find(a=>a.name===`meeting-${sign}`)!,l.width).some(c=>seen.has(c)&&!blocked.has(c))).toBe(true);
  }
 });
 it('places audience seating on both sides of a clear aisle with a furnished social pocket',()=>{
  for(const sign of SIGN_IDS){const l=composed.find(l=>l.id===`speaker-${sign}`)!,aisle=l.inspectionZones.find(z=>z.name==='central-aisle')!,meeting=l.areas.find(a=>a.name===`meeting-${sign}`)!;
   const seats=l.placements.filter(p=>p.id.startsWith('seat-'));expect(seats.some(p=>p.x<aisle.x)).toBe(true);expect(seats.some(p=>p.x>=aisle.x+aisle.width)).toBe(true);
   for(const seat of seats)expect(seat.x>=meeting.x&&seat.y>=meeting.y&&seat.x+seat.width<=meeting.x+meeting.width&&seat.y+seat.height<=meeting.y+meeting.height,`${sign} ${seat.id} lies outside its private meeting`).toBe(true);
   expect(l.placements.some(p=>p.sprite==='screen-presentation')).toBe(true);expect(l.placements.some(p=>p.sprite==='lectern')).toBe(true);
   const social=l.inspectionZones.find(z=>z.name==='social-pocket')!;expect(social).toBeDefined();expect(l.placements.some(p=>/sofa|lounge|bench|chair/.test(p.sprite)&&overlaps(p,social))).toBe(true);
  }
 });
 it('connects each numbered facade and its return to the medium arrival',()=>{
  const l=composed.find(l=>l.id==='overworld')!,spawn=l.entries.find(e=>e.isDefault)!,{tmj}=buildMap(l,loadTileCatalog()),{seen,blocked}=walk(tmj,spawn.y*l.width+spawn.x);
  expect([l.width,l.height]).toEqual([128,128]);
  for(const sign of SIGN_IDS){const exit=l.exits.find(e=>e.destination===`speaker-${sign}`)!,entry=l.entries.find(e=>e.name===`from-speaker-${sign}`)!;expect(exit?.entry).toBe('speaker-entry');expect(entry).toBeDefined();expect(l.exits.some(e=>overlaps(entry,e))).toBe(false);for(const cell of [...tileCells(exit,l.width),...tileCells(entry,l.width)])expect(seen.has(cell)&&!blocked.has(cell),`${sign} door/return blocked`).toBe(true);}
  for(const entry of l.entries){expect(l.exits.some(e=>overlaps(entry,e)),`${entry.name} overlaps an exit`).toBe(false);expect(l.signs?.some(s=>overlaps(entry,s)),`${entry.name} overlaps wayfinding`).toBe(false);for(const cell of tileCells(entry,l.width))expect(seen.has(cell)&&!blocked.has(cell),`${entry.name} blocked`).toBe(true);}
 });
 it('offers six adjacent category thresholds while retaining legacy return aliases',()=>{
  const l=composed.find(l=>l.id==='overworld')!;expect(l.exits.filter(e=>!e.destination.startsWith('speaker-')).map(e=>e.destination).sort()).toEqual(['solar-hall','lunar-hall','orbit-maze','zodiac-festival-park','shipyard-beach','campus-exploration'].sort());
  for(const [alias,parent] of [['from-fire','from-campus'],['from-earth','from-campus'],['from-air','from-campus'],['from-water','from-campus'],['from-observatory','from-campus'],['from-arcade','from-festival']]){const a=l.entries.find(e=>e.name===alias)!,b=l.entries.find(e=>e.name===parent)!;expect([a.x,a.y,a.width,a.height]).toEqual([b.x,b.y,b.width,b.height]);}
 });
});
