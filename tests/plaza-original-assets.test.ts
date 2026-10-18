import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {expect,it} from 'vitest';
import {loadTileCatalog} from '../tools/art/catalog';
import {SIGN_IDS} from '../src/world/catalog';

it('shares twelve recognizable approved native crests without a blocking or above-avatar footprint',async()=>{
 const catalog=loadTileCatalog();
 const atlas=await sharp('assets/tilesets/original/zodiac-emblems.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 expect([atlas.info.width,atlas.info.height]).toEqual([512,384]);
 const hashes=new Set<string>();
 for(const [i,sign] of SIGN_IDS.entries()){
  const sprite=catalog[`zodiac-emblem-${sign}`];
  expect(sprite,sign).toBeDefined();
  expect(sprite).toMatchObject({sheet:'assets/tilesets/original/zodiac-emblems.png',rect:{x:i%4*4,y:Math.floor(i/4)*4,width:4,height:4},blockingCells:[],level:'belowAvatar',sourceId:'zodiac-emblems'});
  const pixels=await sharp('assets/tilesets/original/zodiac-emblems.png').extract({left:i%4*128,top:Math.floor(i/4)*128,width:128,height:128}).ensureAlpha().raw().toBuffer();
  const visible=Array.from({length:128*128},(_,j)=>pixels[j*4+3]).filter(a=>a>=192).length;
  expect(visible,sign).toBeGreaterThan(1000);expect(visible,sign).toBeLessThan(12000);
  hashes.add(createHash('sha256').update(pixels).digest('hex'));
 }
 expect(hashes.size).toBe(12);
 const metadata=JSON.parse(readFileSync('art/source/plaza-generated.json','utf8'));
 expect(metadata.inputs.zodiac.sha256).toBe(createHash('sha256').update(readFileSync(metadata.inputs.zodiac.path)).digest('hex'));
 expect(metadata.exports.zodiac.sha256).toBe(createHash('sha256').update(readFileSync('assets/tilesets/original/zodiac-emblems.png')).digest('hex'));
});

it('preserves the approved horizontal event identity at the same native scale as sponsor floor logos',async()=>{
 const brand=await sharp('assets/sponsors/varcamp-2026.png').metadata();
 expect([brand.width,brand.height,brand.hasAlpha]).toEqual([192,64,true]);
 const metadata=JSON.parse(readFileSync('art/source/plaza-generated.json','utf8'));
 expect(metadata.inputs.brand.sha256).toBe(createHash('sha256').update(readFileSync(metadata.inputs.brand.path)).digest('hex'));
 expect(metadata.exports.brand.sha256).toBe(createHash('sha256').update(readFileSync('assets/sponsors/varcamp-2026.png')).digest('hex'));
});

it('normalizes only low-alpha building matte while retaining every selected foreground RGBA value',async()=>{
 const m=JSON.parse(readFileSync('art/source/plaza-buildings.json','utf8'));
 expect(m.source.path).toBe('art/source/plaza-original/buildings-cleaned-master.png');expect(m.alphaThreshold).toBe(192);
 const atlas=await sharp(m.atlas.path).ensureAlpha().raw().toBuffer({resolveWithObject:true});let visible=0,cleared=0;
 for(const row of m.crops){const pixels=await sharp(m.source.path).extract(row.crop).resize(row.target.width,row.target.height,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
  for(let y=0;y<row.target.height;y++)for(let x=0;x<row.target.width;x++){
   const from=(y*row.target.width+x)*4,to=((row.target.y+y)*atlas.info.width+row.target.x+x)*4;
   if(pixels[from+3]>=192){if(!pixels.subarray(from,from+4).equals(atlas.data.subarray(to,to+4)))throw Error(`Visible original building pixel changed at${x},${y}`);visible++;}
   else{if(!atlas.data.subarray(to,to+4).equals(Buffer.alloc(4)))throw Error(`Uncleared technical matte at${x},${y}`);cleared++;}
  }
 }
 expect(visible).toBeGreaterThan(400000);expect(cleared).toBeGreaterThan(10000);
});
