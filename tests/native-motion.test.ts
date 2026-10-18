import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { renderNativeMotion } from '../tools/art/native-motion';
import type { NativeMotionSpec } from '../tools/art/native-motion';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import type { LayoutAnimatedOverlay, MapLayout, TiledMap } from '../tools/maps/types';

const parse = createRequire(import.meta.url)(resolve('docs/qa/coastal-flight-2026-10-16/prototype/upstream/phaser/src/tilemaps/parsers/tiled/ParseTilesets.js'));
const red = Buffer.from([255,0,0,255, 255,0,0,255]);
const green = Buffer.from([0,255,0,255, 0,255,0,255]);
const spec = (): NativeMotionSpec => ({name:'motion-probe',image:'assets/tilesets/original/motion-probe.png',sourceId:'original',level:'belowAvatar',rect:{x:2,y:3,width:2,height:1},stepMs:100,periodMs:400,poses:[{width:2,height:1,rgba:red},{width:2,height:1,rgba:green}],tracks:[{id:'one',samples:[{x:30,y:10,pose:0},{x:31,y:10,pose:1},{x:32,y:10,pose:0},{x:64,y:10,pose:null}]}]});

async function consumerFrames(s:NativeMotionSpec,times:number[]):Promise<Buffer[]> {
 const r=await renderNativeMotion(s),{data,info}=await sharp(r.png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const tmj={type:'map',version:'1.10',orientation:'orthogonal',infinite:false,width:s.rect.width,height:s.rect.height,tilewidth:32,tileheight:32,layers:[],tilesets:[{firstgid:1,name:s.name,tilewidth:32,tileheight:32,columns:info.width/32,tilecount:info.width*info.height/1024,image:'probe.png',imagewidth:info.width,imageheight:info.height,tiles:r.overlay.animations.map(a=>({id:a.id,animation:a.frames}))}]} as TiledMap;
 const engine=parse(tmj).tilesets[0];
 return times.map(time=>{
  const pixels=Buffer.alloc(s.rect.width*32*s.rect.height*32*4),width=s.rect.width*32;
  for(let cell=0;cell<r.overlay.carrierTileIds.length;cell++){
   const native=engine.getAnimatedTileId(1+r.overlay.carrierTileIds[cell],time)-1;
   const sx=native%(info.width/32)*32,sy=Math.floor(native/(info.width/32))*32;
   for(let row=0;row<32;row++)data.copy(pixels,((Math.floor(cell/s.rect.width)*32+row)*width+cell%s.rect.width*32)*4,((sy+row)*info.width+sx)*4,((sy+row)*info.width+sx+32)*4);
  }return pixels;
 });
}

describe('bounded native sprite motion, actual pinned Phaser consumer',()=>{
 it('moves original pixels across a tile seam, changes pose and loops with an explicit blank phase',async()=>{
  const actual=await consumerFrames(spec(),[0,100,200,300,400,499]);
  const expected=(x:number,color:Buffer)=>{const b=Buffer.alloc(64*32*4);color.copy(b,(10*64+x)*4);return b;};
  expect(actual).toEqual([expected(30,red),expected(31,green),expected(32,red),Buffer.alloc(64*32*4),expected(30,red),expected(30,red)]);
 });
 it('clips without wrapping or duplicating actors at both boundaries',async()=>{
  const s=spec();s.tracks[0].samples=[{x:-1,y:10,pose:0},{x:63,y:10,pose:1},{x:-2,y:10,pose:0},{x:64,y:10,pose:0}];
  const actual=await consumerFrames(s,[0,100,200,300]);
  const first=Buffer.alloc(64*32*4),last=Buffer.alloc(64*32*4);red.subarray(4).copy(first,10*64*4);green.subarray(0,4).copy(last,(10*64+63)*4);
  expect(actual).toEqual([first,last,Buffer.alloc(64*32*4),Buffer.alloc(64*32*4)]);
 });
 it('preserves clock phase when one travelling actor is split between adjoining native lane rectangles',async()=>{
  const a=spec(),b=spec();a.rect.width=1;b.rect={...b.rect,x:3,width:1};
  b.tracks[0].samples=b.tracks[0].samples.map(p=>({...p,x:p.x-32}));
  const left=await consumerFrames(a,[0,100,200,300]),right=await consumerFrames(b,[0,100,200,300]);
  const whole=await consumerFrames(spec(),[0,100,200,300]);
  for(let phase=0;phase<4;phase++){const stitched=Buffer.alloc(64*32*4);for(let y=0;y<32;y++){left[phase].copy(stitched,y*64*4,y*32*4,(y+1)*32*4);right[phase].copy(stitched,(y*64+32)*4,y*32*4,(y+1)*32*4);}expect(stitched).toEqual(whole[phase]);}
 });
 it('composites simultaneous tracks and preserves RGBA source-over rather than losing the lower sprite',async()=>{
  const s=spec();s.poses.push({width:1,height:1,rgba:Buffer.from([0,0,255,128])});s.tracks.push({id:'two',samples:Array.from({length:4},()=>({x:30,y:10,pose:2}))});
  const [frame]=await consumerFrames(s,[0]);expect([...frame.subarray((10*64+30)*4,(10*64+30)*4+8)]).toEqual([127,0,128,255,255,0,0,255]);
 });
 it('emits distinct carrier tiles, nonrecursive frames and one bounded deterministic period',async()=>{
  const a=await renderNativeMotion(spec()),b=await renderNativeMotion(spec());expect(a.png).toEqual(b.png);expect(a.overlay).toEqual(b.overlay);
  expect(a.overlay.level).toBe('belowAvatar');expect(new Set(a.overlay.carrierTileIds).size).toBe(2);
  expect(a.overlay.animations.every(animation=>animation.frames.reduce((n,f)=>n+f.duration,0)===400&&animation.frames.every(f=>f.duration>=100&&!a.overlay.carrierTileIds.includes(f.tileid)))).toBe(true);
  expect(a.diagnostics.decodedRgbaBytes).toBeLessThanOrEqual(4*1024*1024);
 });
 it('rejects unique moving pixels that cannot fit the existing decoded4MiB atlas cap',async()=>{
  const s=spec();s.rect={x:0,y:0,width:8,height:8};s.periodMs=3200;
  s.poses=Array.from({length:32},(_,p)=>{const rgba=Buffer.alloc(256*256*4);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4;rgba[i]=p;rgba[i+1]=Math.floor(x/32);rgba[i+2]=Math.floor(y/32);rgba[i+3]=255;}return{width:256,height:256,rgba};});
  s.tracks=[{id:'bounded-art',samples:Array.from({length:32},(_,pose)=>({x:0,y:0,pose}))}];
  await expect(renderNativeMotion(s)).rejects.toThrow(/4MiB/);
 });
 it.each([
  ['256 carrier cells',(s:NativeMotionSpec)=>{s.rect={x:0,y:0,width:16,height:16};}],
  ['sub100ms clock',(s:NativeMotionSpec)=>{s.stepMs=50;}],
  ['incomplete cycle',(s:NativeMotionSpec)=>{s.tracks[0].samples.pop();}],
  ['missing pose',(s:NativeMotionSpec)=>{s.tracks[0].samples[0].pose=99;}],
  ['fractional coordinate',(s:NativeMotionSpec)=>{s.tracks[0].samples[0].x=.5;}],
  ['short RGBA',(s:NativeMotionSpec)=>{s.poses[0].rgba=Buffer.alloc(1);}],
  ['duplicate actor',(s:NativeMotionSpec)=>{s.tracks.push(s.tracks[0]);}],
  ['oversized phase count',(s:NativeMotionSpec)=>{s.periodMs=204900;}],
 ] as const)('rejects %s before rendering',async(_label,mutate)=>{const s=spec();mutate(s);await expect(renderNativeMotion(s)).rejects.toThrow();});
});

describe('native overlay depth is an authored constraint',()=>{
 const base=():MapLayout=>({id:'overworld',width:4,height:4,placements:[],entries:[],exits:[],areas:[],inspectionZones:[]});
 const overlay=(level:'belowAvatar'|'aboveAvatar'):LayoutAnimatedOverlay=>({name:'depth-probe',image:'assets/tilesets/original/guides.png',sourceId:'original',level,x:0,y:0,width:1,height:1,carrierTileIds:[0],animations:[{id:0,frames:[{tileid:1,duration:100}]}]});
 it.each(['belowAvatar','aboveAvatar'] as const)('places %s on its actual side of floorLayer and keeps collision clear',level=>{const m=buildMap({...base(),animatedOverlays:[overlay(level)]},loadTileCatalog()).tmj;const i=m.layers.findIndex(l=>l.name==='depth-probe'),floor=m.layers.findIndex(l=>l.name==='floorLayer');expect(level==='belowAvatar'?i<floor:i>floor).toBe(true);expect(m.tilesets.find(t=>t.name==='depth-probe')?.tiles?.[0].properties).toEqual([{name:'collides',type:'bool',value:false}]);});
 it('rejects unrecognized depth rather than silently covering the Woka',()=>{const o=overlay('belowAvatar');(o as unknown as {level:string}).level='onTopMaybe';expect(()=>buildMap({...base(),animatedOverlays:[o]},loadTileCatalog())).toThrow(/depth|level/i);});
});
