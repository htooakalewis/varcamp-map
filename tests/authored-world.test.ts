import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadTileCatalog } from '../tools/art/catalog';
import { buildMap } from '../tools/maps/builder';
import { composeZodiacWheel } from '../tools/maps/zodiac-wheel';
import { WORLD_CATALOG, SIGN_IDS } from '../src/world/catalog';
import type { MapLayout, TileRect, TiledMap } from '../tools/maps/types';

const raw=()=>readdirSync('world/layouts').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`world/layouts/${f}`,'utf8')) as MapLayout);
const scenes=()=>composeZodiacWheel(raw());
const cells=(r:TileRect,w:number)=>Array.from({length:r.width*r.height},(_,i)=>(r.y+Math.floor(i/r.width))*w+r.x+i%r.width);
const overlap=(a:TileRect,b:TileRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function distances(map:TiledMap,start:number){
 const blockedIds=new Set(map.tilesets.flatMap(t=>(t.tiles??[]).filter(c=>c.properties?.some(p=>p.name==='collides'&&p.value===true)).map(c=>t.firstgid+c.id)));
 const blocked=new Set(map.layers.flatMap(l=>l.type==='tilelayer'?l.data.flatMap((gid,i)=>blockedIds.has(gid)?[i]:[]):[]));
 const d=new Map<number,number>();if(blocked.has(start))return{d,blocked};d.set(start,0);const q=[start];
 for(let h=0;h<q.length;h++){const c=q[h],x=c%map.width,y=Math.floor(c/map.width);for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=ny*map.width+nx;if(nx<0||ny<0||nx>=map.width||ny>=map.height||blocked.has(n)||d.has(n))continue;d.set(n,d.get(c)!+1);q.push(n);}}
 return{d,blocked};
}

describe('medium authored event world',()=>{
 it('keeps every required activity on its own routable map',()=>{
  const layouts=scenes();
  for(const id of ['orbit-playground','constellation-shore','fa-ship','star-garden','moon-cafe','moon-grotto','stargazer-terrace']){
   expect(layouts.find(l=>l.id===id),`${id} is still combined with another activity`).toBeDefined();
   expect(Object.hasOwn(WORLD_CATALOG,id),`${id} cannot be navigated to`).toBe(true);
  }
  expect(layouts).toHaveLength(34);
 });
 it('limits the arrival footprint and contains no event activities',()=>{
  const hub=scenes().find(l=>l.id==='overworld')!;
  expect([hub.width,hub.height]).toEqual([128,128]);
  expect(hub.areas.some(a=>/meeting-|maze-finish|beach-games|playground-conversation|observatory-telescope/.test(a.name))).toBe(false);
  for(const sign of SIGN_IDS)expect(hub.exits.some(e=>e.destination===`speaker-${sign}`)).toBe(true);
 });
 it('puts all twelve room doors and activity choices within short collision-aware arrival walks',()=>{
  const hub=scenes().find(l=>l.id==='overworld')!,{tmj}=buildMap(hub,loadTileCatalog()),spawn=hub.entries.find(e=>e.isDefault)!;
  for(const start of cells(spawn,hub.width)){
   const{d}=distances(tmj,start);
   for(const sign of SIGN_IDS){const door=hub.exits.find(e=>e.destination===`speaker-${sign}`)!;
    expect(Math.min(...cells(door,hub.width).map(c=>d.get(c)??Infinity)),`${sign} arrival walk`).toBeLessThanOrEqual(65);}
   for(const id of ['solar-hall','lunar-hall','zodiac-festival-park','orbit-maze','shipyard-beach','campus-exploration']){
    const exit=hub.exits.find(e=>e.destination===id);expect(exit,`${id} has no physical arrival choice`).toBeDefined();
    expect(Math.min(...cells(exit!,hub.width).map(c=>d.get(c)??Infinity)),`${id} arrival walk`).toBeLessThanOrEqual(120);
   }
  }
 });
 it('shows three independently replaceable sponsor images beside arrival',()=>{
  const hub=scenes().find(l=>l.id==='overworld')!;const images=(hub as MapLayout & {images?:({image:string}&TileRect)[]}).images??[];
  expect(images).toHaveLength(3);
  expect(new Set(images.map(i=>i.image)).size).toBe(3);
  const spawn=hub.entries.find(e=>e.isDefault)!;
  for(const image of images){expect(image.image).toMatch(/^assets\/sponsors\/demo-0[123]\.png$/);expect([image.width,image.height]).toEqual([6,2]);
   expect(Math.abs(image.x+image.width/2-spawn.x)+Math.abs(image.y+1-spawn.y)).toBeLessThanOrEqual(18);}
 });
 it('keeps every spawn and full physical exit clear, connected and disjoint',()=>{
  for(const l of scenes()){
   const{tmj}=buildMap(l,loadTileCatalog()),spawn=l.entries.find(e=>e.isDefault)!;expect(spawn,`${l.id} default missing`).toBeDefined();
   const{d,blocked}=distances(tmj,spawn.y*l.width+spawn.x);
   for(const entry of l.entries){expect(l.exits.some(e=>overlap(entry,e)),`${l.id}/${entry.name} bounces on spawn`).toBe(false);
    for(const cell of cells(entry,l.width))expect(d.has(cell)&&!blocked.has(cell),`${l.id}/${entry.name} blocked spawn ${cell%l.width},${Math.floor(cell/l.width)}`).toBe(true);}
   for(const exit of l.exits)for(const cell of cells(exit,l.width))expect(d.has(cell)&&!blocked.has(cell),`${l.id}/${exit.name} unreachable ${cell%l.width},${Math.floor(cell/l.width)}`).toBe(true);
  }
 });
 it('has valid named physical destinations and return paths throughout the complete graph',()=>{
  const layouts=scenes(),byId=new Map(layouts.map(l=>[l.id,l]));
  for(const l of layouts)for(const exit of l.exits){const destination=byId.get(exit.destination);expect(destination,`${l.id}/${exit.name} target missing`).toBeDefined();expect(destination!.entries.some(e=>e.name===exit.entry),`${l.id}/${exit.name} arrival alias missing`).toBe(true);}
  const reachable=new Set<string>(['overworld']),q=['overworld'];
  for(let i=0;i<q.length;i++)for(const exit of byId.get(q[i] as MapLayout['id'])!.exits)if(!reachable.has(exit.destination)){reachable.add(exit.destination);q.push(exit.destination);}
  for(const l of layouts)if(l.id!=='hidden-observatory')expect(reachable.has(l.id),`${l.id} has no physical route from arrival`).toBe(true);
  for(const l of layouts)if(l.id!=='overworld')expect(l.exits.some(e=>e.destination==='overworld'),`${l.id} lacks a signed direct plaza return`).toBe(true);
 });
});
