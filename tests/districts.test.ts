import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import { validateMap, validateWam } from '../tools/maps/validate';
import { WORLD_CATALOG } from '../src/world/catalog';
import type { MapLayout, TileRect, TiledMap } from '../tools/maps/types';
const districts = {fire:['aries','leo','sagittarius'],earth:['taurus','virgo','capricorn'],air:['gemini','libra','aquarius'],water:['cancer','scorpio','pisces']};
function load(element:string):MapLayout {const p=`world/layouts/${element}-district.json`;expect(existsSync(p),'missing authored district').toBe(true);return JSON.parse(readFileSync(p,'utf8'));}
const cells=(r:TileRect,w:number)=>Array.from({length:r.width*r.height},(_,i)=>(r.y+Math.floor(i/r.width))*w+r.x+i%r.width);
function reachable(map:TiledMap,excluded:TileRect[]=[]) {
 const mask=map.layers.find(l=>l.name==='physical-collisions');if(mask?.type!=='tilelayer')throw Error('missing collision');
 const blocked=new Set(mask.data.flatMap((v,i)=>v?[i]:[]));for(const r of excluded)for(const c of cells(r,map.width))blocked.add(c);
 const start=map.layers.find(l=>l.type==='tilelayer'&&l.properties?.some(p=>p.name==='start'&&p.value===true));if(start?.type!=='tilelayer')throw Error('missing start');
 const queue=[start.data.findIndex(Boolean)],seen=new Set(queue);
 for(let i=0;i<queue.length;i++){const p=queue[i],x=p%map.width,y=Math.floor(p/map.width);for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=ny*map.width+nx;if(nx>=0&&ny>=0&&nx<map.width&&ny<map.height&&!blocked.has(n)&&!seen.has(n)){seen.add(n);queue.push(n);}}}return {seen,blocked};
}
const inside=(a:TileRect,b:TileRect)=>a.x>=b.x&&a.y>=b.y&&a.x+a.width<=b.x+b.width&&a.y+a.height<=b.y+b.height;
for(const [element,signs] of Object.entries(districts))describe(`${element} compact activity district`,()=>{
 it('owns its sigil and returns to both the plaza and exploration court',()=>{
  const l=load(element),{tmj,wam}=buildMap(l,loadTileCatalog());expect([tmj.width,tmj.height]).toEqual([36,34]);expect(validateMap(tmj,WORLD_CATALOG)).toEqual([]);expect(validateWam(wam)).toEqual([]);
  expect(l.areas.map(a=>a.id)).toEqual([`sigil-${element}`]);expect(wam.areas[0].properties).toEqual([]);
  expect(l.entries.map(e=>e.name)).toEqual([`${element}-entry`]);expect(l.exits).toEqual(expect.arrayContaining([expect.objectContaining({destination:'overworld',entry:`from-${element}`}),expect.objectContaining({destination:'campus-exploration',entry:`from-${element}`})]));
  expect(l.inspectionZones.some(z=>z.name===`${element}-activity`)).toBe(true);
  for(const sign of signs)expect(l.areas.some(a=>a.name===`meeting-${sign}`||a.name===`beacon-${sign}`)).toBe(false);
 });
 it('reaches the sigil, clear aisles and both physical returns',()=>{
  const l=load(element),{tmj}=buildMap(l,loadTileCatalog()),{seen,blocked}=reachable(tmj);
  const routes=l.inspectionZones.filter(z=>['central-aisle','cross-route'].includes(z.name));expect(routes.map(z=>z.name).sort()).toEqual(['central-aisle','cross-route']);
  for(const r of [...l.areas,...l.entries,...l.exits,...routes])for(const c of cells(r,l.width))expect(seen.has(c)&&!blocked.has(c),`${r.name} ${c%l.width},${Math.floor(c/l.width)}`).toBe(true);
 });
 it('furnishes its activity and social areas without reverting to duplicated meeting shells',()=>{
  const l=load(element),activity=l.inspectionZones.find(z=>z.name===`${element}-activity`)!;
  expect(l.placements.some(p=>p.sprite===`sigil-${element}`)).toBe(true);expect(l.placements.some(p=>p.sprite==='quest-shrine')).toBe(true);
  const theme={fire:['forge-aries','table-workshop'],earth:['bookcase','table-circular'],air:['table-circular','desk-coding'],water:['plaza-flower-bed','water-wall']}[element]!;
  for(const sprite of theme)expect(l.placements.some(p=>p.sprite===sprite&&inside(p,activity)),`${element} missing ${sprite} in activity`).toBe(true);
  expect(l.placements.some(p=>/sofa|lounge|bench/.test(p.sprite))).toBe(true);
  expect(new Set(l.inspectionZones.map(z=>z.name)).size).toBe(l.inspectionZones.length);
  expect(l.signs?.some(s=>s.name==='sigil-label'&&s.text.includes('ACTIVATE'))).toBe(true);
 });
});
it('exports exactly four district sigils while meetings and discoveries belong to speaker maps',()=>{
 const layouts=Object.keys(districts).map(load),areas=layouts.flatMap(l=>l.areas);
 expect(areas.filter(a=>a.id?.startsWith('sigil-')).map(a=>a.id).sort()).toEqual(Object.keys(districts).map(e=>`sigil-${e}`).sort());
 expect(areas.some(a=>a.id?.startsWith('beacon-')||a.properties.some(p=>p.type==='livekitRoomProperty'))).toBe(false);
});
