import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {expect,it} from 'vitest';
import type {MapLayout,TiledMap,TileLayer} from '../tools/maps/types';
const parse=createRequire(import.meta.url)(resolve('docs/qa/coastal-flight-2026-10-16/prototype/upstream/phaser/src/tilemaps/parsers/tiled/ParseTilesets.js'));
it('renders two genuinely travelling drones in all quadrants, native clocks and below-avatar planes',async()=>{
 const layout=JSON.parse(readFileSync('world/layouts/overworld.json','utf8')) as MapLayout;
 const motion=layout.animatedOverlays!.filter(o=>o.name.startsWith('plaza-drone-'));expect(motion.length).toBeGreaterThan(8);
 const metadata=JSON.parse(readFileSync('art/source/plaza-drones.json','utf8'));
 expect(metadata.tracks).toHaveLength(2);
 for(const t of metadata.tracks){expect(new Set(t.samples.map((p:{x:number;y:number})=>`${p.x},${p.y}`)).size).toBeGreaterThan(300);expect(new Set(t.samples.map((p:{x:number;y:number})=>`${p.x<64*32?'W':'E'}${p.y<64*32?'N':'S'}`)).size).toBe(4);}
 const map=JSON.parse(readFileSync('maps/overworld.tmj','utf8')) as TiledMap,floor=map.layers.findIndex(l=>l.name==='floorLayer');
 const parsed=parse(map).tilesets;
 let visiblePixels=0;
 for(const o of motion){
  expect(o.level).toBe('belowAvatar');expect(o.width*o.height).toBeLessThan(256);
  const set=map.tilesets.find(t=>t.name===o.name)!,engine=parsed.find((t:{name:string})=>t.name===o.name),layer=map.layers.find(l=>l.name===o.name) as TileLayer;
  expect(map.layers.indexOf(layer)).toBeLessThan(floor);expect(set.tiles!.every(t=>t.properties!.some(p=>p.name==='collides'&&p.value===false))).toBe(true);
  const png=await sharp(o.image).ensureAlpha().raw().toBuffer({resolveWithObject:true});expect(png.data.length).toBeLessThanOrEqual(4*1024*1024);
  expect(o.animations.every(a=>a.frames.reduce((n,f)=>n+f.duration,0)===metadata.periodMs)).toBe(true);
  for(const time of [0,metadata.periodMs/4,metadata.periodMs/2,metadata.periodMs*3/4])for(const id of o.carrierTileIds){const tile=engine.getAnimatedTileId(set.firstgid+id,time)-set.firstgid,sx=tile%set.columns!*32,sy=Math.floor(tile/set.columns!)*32;for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(png.data[((sy+y)*png.info.width+sx+x)*4+3]>=128)visiblePixels++;}
 }
 expect(visiblePixels).toBeGreaterThan(400);
});
