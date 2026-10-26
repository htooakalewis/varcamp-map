import {preHallBuildingsLayout} from './helpers/hall-buildings-history';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {loadTileCatalog} from '../tools/art/catalog';
import {assertNativePlaza} from '../tools/maps/plaza-native';
import {beforeHallExteriors,beforeHallJson} from './helpers/hall-exterior-history';
import {emitNativeMapAssets} from '../tools/release';
import type {MapLayout,TiledMap} from '../tools/maps/types';
import {prePhysicsNative} from './helpers/pre-zodiac-physics-epoch';
import {applyZodiacPhysics,zodiacPhysicsSprites} from '../tools/maps/zodiac-physics';
const read=<T=any>(p:string):T=>JSON.parse(readFileSync(p,'utf8'));
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
describe('Solar and Lunar exterior architectures',()=>{
 for(const [id,x]of [['solar',17],['lunar',103]]as const)it(id+': displays its themed architecture on the unchanged four-wide hall entrance',()=>{
  const l=preHallBuildingsLayout(read<MapLayout>('world/layouts/overworld.json')),old=beforeHallJson<MapLayout>('world/layouts/overworld.json'),c=loadTileCatalog();
  const p=l.placements.find(p=>p.id==='exterior-gate-'+id)!,b=old.placements.find(p=>p.id==='exterior-gate-'+id)!;
  expect(p.sprite).toBe('hall-exterior-'+id);expect({...p,sprite:b.sprite}).toEqual(b);
  expect(p).toMatchObject({x,y:18,width:8,height:6,layer:'props'});
  expect(c[p.sprite]).toMatchObject({sheet:'assets/tilesets/original/hall-exteriors.png',rect:{width:8,height:6},sourceId:'hall-exteriors',level:'aboveAvatar',blockingCells:c[b.sprite].blockingCells});
  expect(c[p.sprite].blockingCells).toHaveLength(24);expect(l.exits.find(e=>e.name===id)).toMatchObject({x:x+2,y:21,width:4,height:1,destination:id+'-hall'});
 });
 it('requires the new exterior family even when all its markers are removed',()=>{
  expect(()=>assertNativePlaza(beforeHallJson<TiledMap>('maps/overworld.tmj'),applyZodiacPhysics(beforeHallJson<MapLayout>('world/layouts/overworld.json')),{...beforeHallJson('art/tile-catalog.json'),...zodiacPhysicsSprites()})).toThrow(/Hall exteriors|Hall buildings/);
 });
 it('provides a separate transparent native atlas without replacing the original gate artwork',()=>{
  expect(existsSync('assets/tilesets/original/hall-exteriors.png'),'two themed hall facade atlas exists').toBe(true);
 });
 it('preserves every prior asset, other native map, WAM, catalog definition and collision cell',()=>{
  const b=beforeHallExteriors(),c=loadTileCatalog(),old=beforeHallJson('art/tile-catalog.json');
  for(const[path,pin]of Object.entries({...b.assets,...b.nativeMaps,...b.wams}))if(path!=='maps/preview/overworld.tmj')expect(sha(readFileSync(path)),path+' retained bytes').toBe(pin);
  for(const[id,s]of Object.entries(old))expect(c[id],id+' retained catalog definition').toEqual(s);
  const m=prePhysicsNative(read<TiledMap>('maps/overworld.tmj')),prior=beforeHallJson<TiledMap>('maps/overworld.tmj');
  expect(m.tilesets.slice(0,84)).toEqual(prior.tilesets);expect(m.tilesets).toHaveLength(85);
  expect(m.tilesets[84]).toMatchObject({firstgid:14519,name:'hall-exteriors',image:'../assets/tilesets/original/hall-exteriors.png',imagewidth:512,imageheight:192,columns:16,tilecount:96});
  expect(m.layers.filter(l=>l.type!=='tilelayer')).toEqual(prior.layers.filter(l=>l.type!=='tilelayer'));
  expect(m.layers.find(l=>l.name==='physical-collisions')).toEqual(prior.layers.find(l=>l.name==='physical-collisions'));
  const preview=read<TiledMap>('maps/preview/overworld.tmj');expect(preview.layers.find(l=>l.name==='physical-collisions')).toEqual(read<TiledMap>('maps/overworld.tmj').layers.find(l=>l.name==='physical-collisions'));
  expect(preview.tilesets.map(t=>[t.firstgid,t.name,t.image])).toEqual(read<TiledMap>('maps/overworld.tmj').tilesets.map(t=>[t.firstgid,t.name,'../'+t.image]));
  const allowed=new Set<number>();for(const x0 of[17,103])for(let y=18;y<24;y++)for(let x=x0;x<x0+8;x++)allowed.add(y*128+x);
  expect(m.layers.map(l=>l.name)).toEqual(prior.layers.map(l=>l.name));
  for(const layer of m.layers){const before=prior.layers.find(l=>l.name===layer.name)!;if(layer.type!=='tilelayer'||before.type!=='tilelayer')continue;for(let n=0;n<layer.data.length;n++)if(layer.data[n]!==before.data[n])expect(allowed.has(n)&&/^scenery-aboveAvatar-/.test(layer.name),layer.name+' changed cell '+n).toBe(true);}
 });
 it('keeps both four-wide approach/portal corridors visually transparent and their roofs distinct at native scale',async()=>{
  const path='assets/tilesets/original/hall-exteriors.png';expect(existsSync(path)).toBe(true);
  const m=await sharp(path).metadata();expect([m.width,m.height]).toEqual([512,192]);
  const roofs=[];for(let i=0;i<2;i++){
   const pixels=await sharp(path).extract({left:i*256,top:0,width:256,height:192}).ensureAlpha().raw().toBuffer();
   for(let y=96;y<192;y++)for(let x=64;x<192;x++)expect(pixels[(y*256+x)*4+3],`hall${i} passage pixel ${x},${y}`).toBe(0);
   roofs.push(sha(pixels.subarray(0,256*64*4)));expect(pixels.some((v,n)=>n%4===3&&v>=192)).toBe(true);
  }expect(roofs[0]).not.toBe(roofs[1]);
 });
 it('reproduces the retained masters and authors exactly two sprite fields with no other layout edits',async()=>{
  const {renderHallExteriors,checkHallExteriorArt}=await import('../tools/art/hall-exteriors');
  const {applyHallExteriors}=await import('../tools/maps/hall-exteriors');
  const before=beforeHallJson<MapLayout>('world/layouts/overworld.json'),saved=structuredClone(before),expected=structuredClone(before);
  for(const id of['solar','lunar'])expected.placements.find(p=>p.id==='exterior-gate-'+id)!.sprite='hall-exterior-'+id;
  expect(applyHallExteriors(before)).toEqual(expected);expect(before).toEqual(saved);expect(applyHallExteriors(expected)).toEqual(expected);
  const r=await renderHallExteriors();expect(r.png).toEqual(readFileSync('assets/tilesets/original/hall-exteriors.png'));expect(r.metadata).toEqual(read('art/source/hall-exteriors.json'));
  expect(await checkHallExteriorArt(loadTileCatalog(),read('art/sources.json'))).toEqual([]);
 },30000);
 it.each(['missing','duplicate','wrong-theme','moved','wrong-depth','blocker','extra-catalog'])('denies coherent %s source/catalog mutations at the normal plaza gate',kind=>{
  const l=read<MapLayout>('world/layouts/overworld.json'),c=loadTileCatalog(),p=l.placements.find(p=>p.id==='exterior-gate-solar')!;
  if(kind==='missing')l.placements=l.placements.filter(p=>p.id!==l.placements.find(p=>p.id==='exterior-gate-solar')!.id);
  if(kind==='duplicate')l.placements.push(structuredClone(p));
  if(kind==='wrong-theme')p.sprite='hall-exterior-lunar';if(kind==='moved')p.x++;
  if(kind==='wrong-depth')p.renderRole='grounded';
  if(kind==='blocker')c[p.sprite].blockingCells.push([2,3]);
  if(kind==='extra-catalog')c['hall-exterior-extra']=structuredClone(c[p.sprite]);
  expect(()=>assertNativePlaza(read<TiledMap>('maps/overworld.tmj'),l,c)).toThrow(/Hall exteriors|Hall buildings/);
 });
 it.each(['missing','duplicate','misidentified','resized'])('denies a %s new native reservation',kind=>{
  const m=read<TiledMap>('maps/overworld.tmj'),t=m.tilesets.at(-1)!;
  if(kind==='missing')m.tilesets.pop();if(kind==='duplicate')m.tilesets.push(structuredClone(t));
  if(kind==='misidentified')t.name='unknown-hall';if(kind==='resized')t.tilecount=95;
  expect(()=>assertNativePlaza(m,read<MapLayout>('world/layouts/overworld.json'),loadTileCatalog())).toThrow();
 });
 it('keeps the art gate mandatory if the complete new family is removed',async()=>{
  const {checkHallExteriorArt}=await import('../tools/art/hall-exteriors'),c=loadTileCatalog(),sources=read('art/sources.json');
  for(const id of Object.keys(c))if(id.startsWith('hall-exterior-'))delete c[id];delete sources['hall-exteriors'];
  expect((await checkHallExteriorArt(c,sources)).join('\n')).toMatch(/source registry family missing/);
 });
 it('includes titled provenance and both credit dependencies in the distributable map package',()=>{
  const files=new Map<string,string|Buffer>();emitNativeMapAssets([{id:'overworld',map:read<TiledMap>('maps/overworld.tmj'),sourceWam:read('maps/overworld.wam')}],'runtime.js',[],a=>files.set(a.fileName,a.source));
  expect(String(files.get('credits/index.html'))).toContain('<h2>Solar and Lunar pavilion exteriors</h2>');
  for(const name of['LICENSE.txt','ATTRIBUTION.md']){const p='credits/hall-exteriors/'+name,b=files.get(p);expect(b).toBeDefined();expect(String(files.get('credits/index.html'))).toContain('hall-exteriors/'+name+'?v='+sha(b!));}
 });
});
