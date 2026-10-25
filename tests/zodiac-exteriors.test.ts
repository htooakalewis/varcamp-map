import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {SIGN_IDS} from '../src/world/catalog';
import {loadTileCatalog} from '../tools/art/catalog';
import {assertNativePlaza} from '../tools/maps/plaza-native';
import {renderZodiacExteriors,checkZodiacExteriorArt} from '../tools/art/zodiac-exteriors';
import {applyZodiacExteriors} from '../tools/maps/zodiac-exteriors';
import {emitNativeMapAssets} from '../tools/release';
import {beforeZodiac,beforeZodiacJson,beforeZodiacRaw} from './helpers/zodiac-exterior-history';
import type {MapLayout,TiledMap,TileLayer} from '../tools/maps/types';
import {preHallLayout,preHallNative} from './helpers/pre-hall-exterior-epoch';
// Stage the genuine zodiac epoch only after proving the complete current hall successor.
const read=<T=any>(p:string):T=>{const value=JSON.parse(readFileSync(p,'utf8'));return(p==='world/layouts/overworld.json'?preHallLayout(value):p==='maps/overworld.tmj'?preHallNative(value):value)as T;};
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
describe('twelve zodiac exterior architectures',()=>{
 for(const sign of SIGN_IDS)it(`${sign}: uses its own architecture on the unchanged native doorway and collision footprint`,()=>{
  const l=read<MapLayout>('world/layouts/overworld.json'),old=beforeZodiacJson<MapLayout>('world/layouts/overworld.json'),catalog=loadTileCatalog();
  const p=l.placements.find(p=>p.id===sign+'-building')!,b=old.placements.find(p=>p.id===sign+'-building')!;
  expect(p.sprite).toBe('zodiac-building-'+sign);expect({...p,sprite:b.sprite}).toEqual(b);expect(p.renderRole).toBe('grounded');
  const s=catalog[p.sprite];expect(s).toMatchObject({sheet:'assets/tilesets/original/zodiac-exteriors.png',rect:{width:12,height:12},sourceId:'zodiac-exteriors',level:'aboveAvatar',blockingCells:catalog[b.sprite].blockingCells});expect(s.upperCells).toBeUndefined();
  expect(l.exits.find(e=>e.name===sign+'-door')??l.exits.find(e=>e.x===p.x+5&&e.y===p.y+11)).toMatchObject({x:p.x+5,y:p.y+11,width:2,height:1});
 });
 it('changes only twelve sprite selections while every pre-existing asset and WAM byte stays exact',()=>{
  const l=read<MapLayout>('world/layouts/overworld.json'),old=beforeZodiacJson<MapLayout>('world/layouts/overworld.json'),expected=structuredClone(old);
  for(const sign of SIGN_IDS)expected.placements.find(p=>p.id===sign+'-building')!.sprite='zodiac-building-'+sign;
  expect(l).toEqual(expected);expect(readFileSync('maps/overworld.wam')).toEqual(beforeZodiacRaw('maps/overworld.wam'));
  const c=loadTileCatalog(),oldC=beforeZodiacJson('art/tile-catalog.json');for(const[id,s]of Object.entries(oldC))expect(c[id],id+' frozen catalog definition').toEqual(s);
  for(const[path,pin]of Object.entries(beforeZodiac().assets))expect(sha(readFileSync(path)),path+' original bytes').toBe(pin);
 });
 it('adds one atlas after all83 retained reservations and confines changed paint to the twelve envelopes',()=>{
  const m=read<TiledMap>('maps/overworld.tmj'),old=beforeZodiacJson<TiledMap>('maps/overworld.tmj'),l=read<MapLayout>('world/layouts/overworld.json');
  expect(old.tilesets).toHaveLength(83);expect(m.tilesets.slice(0,83)).toEqual(old.tilesets);expect(m.tilesets).toHaveLength(84);
  expect(m.tilesets[83]).toMatchObject({firstgid:12791,name:'zodiac-exteriors',image:'../assets/tilesets/original/zodiac-exteriors.png',imagewidth:1536,imageheight:1152,columns:48,tilecount:1728});
  expect(m.layers.filter(x=>x.type!=='tilelayer')).toEqual(old.layers.filter(x=>x.type!=='tilelayer'));
  const envelope=new Set<number>();for(const p of l.placements.filter(p=>SIGN_IDS.some(s=>p.id===s+'-building')))for(let y=p.y;y<p.y+12;y++)for(let x=p.x;x<p.x+12;x++)envelope.add(y*128+x);
  for(const layer of m.layers){const prior=old.layers.find(x=>x.name===layer.name);expect(prior,layer.name+' retained layer').toBeDefined();if(layer.type!=='tilelayer'||prior?.type!=='tilelayer')continue;for(let i=0;i<layer.data.length;i++)if(layer.data[i]!==prior.data[i])expect(envelope.has(i)&&/^scenery-belowAvatar-/.test(layer.name),layer.name+' changed protected cell '+i).toBe(true);}
  expect((m.layers.find(x=>x.name==='physical-collisions') as TileLayer).data).toEqual((old.layers.find(x=>x.name==='physical-collisions') as TileLayer).data);
 });
 it('provides twelve genuinely different native roof silhouettes and transparent complete sprites',async()=>{
  const path='assets/tilesets/original/zodiac-exteriors.png';expect(existsSync(path),'new architecture atlas exists').toBe(true);
  const {data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});expect([info.width,info.height]).toEqual([1536,1152]);
  const masks:string[]=[],crops:string[]=[];for(let i=0;i<12;i++){const crop=await sharp(path).extract({left:i%4*384,top:Math.floor(i/4)*384,width:384,height:384}).ensureAlpha().raw().toBuffer();crops.push(sha(crop));masks.push(sha(Buffer.from(Array.from({length:384*160},(_,p)=>crop[p*4+3]>=192?1:0))));expect(crop.some((v,p)=>p%4===3&&v===0)).toBe(true);}
  expect(new Set(crops).size).toBe(12);expect(new Set(masks).size).toBe(12);expect(data.length).toBe(1536*1152*4);
 });
 it('rejects a coherent return to the old four-building design through the normal plaza gate',()=>{
  const l=read<MapLayout>('world/layouts/overworld.json'),c=loadTileCatalog();for(const sign of SIGN_IDS){const b=beforeZodiacJson<MapLayout>('world/layouts/overworld.json').placements.find(p=>p.id===sign+'-building')!;l.placements.find(p=>p.id===b.id)!.sprite=b.sprite;}
  expect(()=>assertNativePlaza(beforeZodiacJson<TiledMap>('maps/overworld.tmj'),l,c)).toThrow();
 });
 it('reproduces the exact saved atlas/metadata and authors an idempotent twelve-field successor without mutating history',async()=>{
  const r=await renderZodiacExteriors();expect(r.png.equals(readFileSync('assets/tilesets/original/zodiac-exteriors.png'))).toBe(true);expect(r.metadata).toEqual(read('art/source/zodiac-exteriors.json'));
  const old=beforeZodiacJson<MapLayout>('world/layouts/overworld.json'),saved=structuredClone(old),current=read<MapLayout>('world/layouts/overworld.json');expect(applyZodiacExteriors(old)).toEqual(current);expect(old).toEqual(saved);expect(applyZodiacExteriors(current)).toEqual(current);
  expect(await checkZodiacExteriorArt(loadTileCatalog(),read('art/sources.json'))).toEqual([]);
 },30000);
 it.each(['missing','duplicate','wrong-sign','moved-doorway','wrong-depth','blocking-change','extra-catalog'])('rejects coherent %s source/catalog mutations before native publication',kind=>{
  const l=read<MapLayout>('world/layouts/overworld.json'),c=loadTileCatalog(),p=l.placements.find(p=>p.id==='aries-building')!;
  if(kind==='missing')l.placements=l.placements.filter(p=>p.id!=='aries-building');
  if(kind==='duplicate')l.placements.push(structuredClone(p));
  if(kind==='wrong-sign')p.sprite='zodiac-building-taurus';
  if(kind==='moved-doorway')p.x++;
  if(kind==='wrong-depth')p.renderRole=undefined;
  if(kind==='blocking-change')c[p.sprite].blockingCells.push([5,10]);
  if(kind==='extra-catalog')c['zodiac-building-extra']=structuredClone(c[p.sprite]);
  expect(()=>assertNativePlaza(read<TiledMap>('maps/overworld.tmj'),l,c)).toThrow();
 });
 it.each(['missing','duplicate','misidentified','resized'])('rejects a %s new native reservation while retaining all earlier bodies',kind=>{
  const l=read<MapLayout>('world/layouts/overworld.json'),c=loadTileCatalog(),m=read<TiledMap>('maps/overworld.tmj'),set=m.tilesets.at(-1)!;
  if(kind==='missing')m.tilesets.pop();
  if(kind==='duplicate')m.tilesets.push(structuredClone(set));
  if(kind==='misidentified')set.name='unregistered-zodiac-art';
  if(kind==='resized')set.tilecount=(set.tilecount??0)-1;
  expect(()=>assertNativePlaza(m,l,c)).toThrow();
 });
 it('does not opt out when the entire new source and registry family is absent',async()=>{
  const c=loadTileCatalog(),s=read('art/sources.json');for(const k of Object.keys(c))if(k.startsWith('zodiac-building-'))delete c[k];delete s['zodiac-exteriors'];
  expect((await checkZodiacExteriorArt(c,s)).join('\n')).toMatch(/source registry family missing/);
  expect(()=>assertNativePlaza(beforeZodiacJson<TiledMap>('maps/overworld.tmj'),beforeZodiacJson<MapLayout>('world/layouts/overworld.json'),c)).toThrow(/Zodiac exteriors/);
 });
 it('publishes a titled provenance section with working license and attribution dependencies',()=>{
  const files=new Map<string,string|Buffer>();
  emitNativeMapAssets([{id:'overworld',map:read<TiledMap>('maps/overworld.tmj'),sourceWam:read('maps/overworld.wam')}],'runtime.js',[],a=>files.set(a.fileName,a.source));
  expect(String(files.get('credits/index.html'))).toContain('<h2>Distinct zodiac pavilion exteriors</h2>');
  for(const name of ['LICENSE.txt','ATTRIBUTION.md']){const p='credits/zodiac-exteriors/'+name,b=files.get(p);expect(b).toBeDefined();expect(String(files.get('credits/index.html'))).toContain('zodiac-exteriors/'+name+'?v='+sha(b!));}
 });
});
