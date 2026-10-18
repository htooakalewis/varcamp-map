import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {SIGN_IDS} from '../src/world/catalog';
import {loadTileCatalog} from '../tools/art/catalog';
import type {MapLayout} from '../tools/maps/types';
import {refinePlazaFloorGarden} from '../tools/maps/plaza-floor-garden';
import {expectedPlazaSuccessor} from './helpers/plaza-successor';
import routes from '../src/bots/lyra-routes.json';
import type {TiledMap,TileLayer} from '../tools/maps/types';
import {validateMap} from '../tools/maps/validate';
import {WORLD_CATALOG} from '../src/world/catalog';
const source=()=>JSON.parse(readFileSync('world/layouts/overworld.json','utf8')) as MapLayout;
const before=()=>JSON.parse(readFileSync('tests/fixtures/plaza-floor-garden/before-layout.json','utf8')) as MapLayout;
it('reserves unique engine atlas names as well as nonoverlapping GIDs in the actual forward export',()=>{
 const map=JSON.parse(readFileSync('maps/overworld.tmj','utf8')) as TiledMap;
 expect(validateMap(map,WORLD_CATALOG)).toEqual([]);
});

it('puts sponsor and event identity on the floor without posts or unrelated sign assemblies',()=>{
 const l=source(),sponsors=l.images!.filter(p=>p.name.startsWith('Sponsors /'));
 expect(sponsors).toHaveLength(3);for(const p of sponsors)expect(p.standing,p.name).toBe(false);
 expect(l.images!.find(p=>p.name==='VarCamp 2026 Floor')).toMatchObject({image:'assets/sponsors/varcamp-2026.png',x:60,y:60,width:6,height:2,standing:false});
 expect(l.placements.filter(p=>/^standing-sponsor-|^sponsor-frame-|^sponsor-trim-|^reception-post-brand-|^varcamp-nameplate$/.test(p.id))).toEqual([]);
 expect(l.standingSigns!.filter(s=>s.face==='varcamp-nameplate'||s.faceKind==='image')).toEqual([]);
 expect(l.standingSigns!.filter(s=>s.face!=='varcamp-nameplate')).toEqual(before().standingSigns!.filter(s=>s.face!=='varcamp-nameplate'&&s.faceKind!=='image'));
});

it('is idempotent and retains every real native semantic layer and reachable guide/entrance cell',async()=>{
 const l=source(),catalog=loadTileCatalog();expect(refinePlazaFloorGarden(l)).toEqual(l);
 const native=JSON.parse(readFileSync('maps/overworld.tmj','utf8')) as TiledMap,expected=await expectedPlazaSuccessor(catalog);
 expect(l).toEqual(expected.layout);expect(expected.native).toEqual(native);
 const mask=native.layers.find(p=>p.name==='physical-collisions') as TileLayer;
 for(const [x,y] of routes.allowedCells)expect(mask.data[y*128+x],`guide ${x},${y}`).toBe(0);
 const spawn=l.entries.find(p=>p.isDefault)!,queue=[spawn.y*128+spawn.x],seen=new Set(queue);
 for(let h=0;h<queue.length;h++){const n=queue[h],x=n%128,y=Math.floor(n/128);for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const c=ny*128+nx;if(nx>=0&&ny>=0&&nx<128&&ny<128&&!mask.data[c]&&!seen.has(c)){seen.add(c);queue.push(c);}}}
 for(const p of [...l.entries,...l.exits,...l.areas])for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++)expect(seen.has(y*128+x),p.name).toBe(true);
 const floor=native.layers.findIndex(p=>p.name==='floorLayer');
 for(const image of l.images!)expect(native.layers.findIndex(p=>p.name===image.name),image.name).toBeLessThan(floor);
 expect(l.placements.filter(p=>p.id.startsWith('plaza-garden-'))).toHaveLength(144);
});

it('retains all twelve doorway footprints while consuming original generated pavilion and grass artwork',()=>{
 const l=source(),old=before(),catalog=loadTileCatalog();
 for(const sign of SIGN_IDS){
  const p=l.placements.find(p=>p.id===`${sign}-building`)!,b=old.placements.find(row=>row.id===p.id)!;
  expect({...p,sprite:b.sprite}).toEqual(b);
  expect(p.sprite).toMatch(/^plaza-building-0[1-4]$/);
  expect(catalog[p.sprite].sourceId).toBe('plaza-original-buildings');
  expect(catalog[p.sprite].blockingCells).toEqual(catalog[b.sprite].blockingCells);
  expect(catalog[p.sprite].level).toBe(catalog[b.sprite].level);
  expect(l.placements.find(p=>p.id===`${sign}-zodiac-threshold`)).toMatchObject({sprite:`zodiac-emblem-${sign}`,x:p.x+4,y:p.y+12,width:4,height:4});
 }
 expect(l.placements.filter(p=>p.sprite==='ground-grass')).toEqual([]);
 expect(l.placements.filter(p=>['plant-grass','plant-flower'].includes(p.sprite))).toEqual([]);
 expect(l.placements.filter(p=>p.layer==='terrain'&&p.sprite.startsWith('plaza-grass-')).length).toBeGreaterThan(100);
 for(const p of l.placements.filter(p=>p.sprite.startsWith('plaza-grass-')))expect(catalog[p.sprite]).toMatchObject({sourceId:'plaza-original-garden',blockingCells:[],level:'belowAvatar'});
 expect(l.entries).toEqual(old.entries);expect(l.exits).toEqual(old.exits);expect(l.areas).toEqual(old.areas);expect(l.signs).toEqual(old.signs);
});
