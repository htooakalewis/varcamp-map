import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {loadTileCatalog} from '../tools/art/catalog';
import {EXPO_BOOTHS} from '../tools/maps/expo-plaza';
import {buildMap} from '../tools/maps/builder';
import type {MapLayout,TileLayer,TiledMap} from '../tools/maps/types';
const layout=()=>JSON.parse(readFileSync('world/layouts/overworld.json','utf8')) as MapLayout;
const native=()=>JSON.parse(readFileSync('maps/overworld.tmj','utf8')) as TiledMap;
it('retains the dormant expo sticker reservation after every decal is removed, without painting it',()=>{
 const l=layout();l.placements=l.placements.filter(p=>!p.sprite.startsWith('sticker-'));
 const m=buildMap(l,loadTileCatalog()).tmj,s=m.tilesets.find(s=>s.image==='../assets/tilesets/original/booth-stickers.png');
 expect(s,'removing decals must not collapse the closed expo atlas family').toBeDefined();
 if(!s)return;
 for(const layer of m.layers)if(layer.type==='tilelayer')expect(layer.data.some(g=>g>=s.firstgid&&g<s.firstgid+s.tilecount!)).toBe(false);
});
it('does not add an expo reservation to historical hall projections without booth marks',()=>{
 const l=layout();l.images=l.images!.filter(i=>!i.name.startsWith('Expo / '));
 const m=buildMap(l,loadTileCatalog()).tmj;
 expect(m.tilesets.some(s=>s.image==='../assets/tilesets/original/booth-stickers.png')).toBe(false);
});
it('removes every round sticker from the actual twelve expo stalls',()=>{
 const l=layout();
 expect(EXPO_BOOTHS).toHaveLength(12);
 expect(l.placements.filter(p=>p.id.startsWith('expo-')&&p.sprite.startsWith('sticker-'))).toEqual([]);
});
it('uses native four-column reception counters without scaling or overlapping booth logos or the shared aisle',()=>{
 const l=layout(),c=loadTileCatalog();
 for(const b of EXPO_BOOTHS){
  const counter=l.placements.find(p=>p.id===`expo-${b.id}-counter`)!;
  expect(counter,b.id+' reception counter').toMatchObject({sprite:'desk-curved',x:b.interior.x+1,y:b.row==='north'?77:82,width:4,height:3});
  expect([counter.width,counter.height]).toEqual([c[counter.sprite].rect.width,c[counter.sprite].rect.height]);
  expect(counter.y+counter.height<=80||counter.y>=82,b.id+' aisle remains clear').toBe(true);
  for(const image of l.images!.filter(i=>i.name.startsWith('Expo / ')))expect(counter.x<image.x+image.width&&counter.x+counter.width>image.x&&counter.y<image.y+image.height&&counter.y+counter.height>image.y,b.id+' must not cover a mark').toBe(false);
 }
});
it('keeps each logo at exact32px tile scale and every guide cell free in the native map',()=>{
 const l=layout(),m=native(),mask=m.layers.find(p=>p.name==='physical-collisions') as TileLayer;
 for(const image of l.images!.filter(i=>i.name.startsWith('Expo / '))){
  const bytes=readFileSync(image.image),set=m.tilesets.find(t=>t.name===image.name)!;
  expect([bytes.readUInt32BE(16),bytes.readUInt32BE(20)]).toEqual([image.width*32,image.height*32]);
  expect(set).toMatchObject({tilewidth:32,tileheight:32,imagewidth:image.width*32,imageheight:image.height*32});
  for(let y=image.y;y<image.y+image.height;y++)for(let x=image.x;x<image.x+image.width;x++)expect(mask.data[y*128+x],image.name+' remains walkable').toBe(0);
 }
 const routes=JSON.parse(readFileSync('src/bots/lyra-routes.json','utf8'));
 for(const [x,y] of [...routes.allowedCells,...routes.startupReservedCells])expect(mask.data[y*128+x],`guide ${x},${y}`).toBe(0);
});
