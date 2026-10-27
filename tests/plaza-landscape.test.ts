import {preVibeCodeLayout,preVibeCodeNative} from './helpers/vibecode-history';
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {beforeLandscapeJson,preLandscapeLayout,preLandscapeNative} from './helpers/plaza-landscape-history';
import {assertCurrentNativeMap} from '../tools/maps/current-native';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const ground=(l:any)=>{const g=new Map<string,string>();for(const p of l.placements)if(p.layer==='terrain')for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++)g.set(`${x},${y}`,p.sprite);return g;};
const cells=(p:any):string[]=>Array.from({length:p.width*p.height},(_,i)=>`${p.x+i%p.width},${p.y+Math.floor(i/p.width)}`);
const overlaps=(a:any,b:any)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
describe('Landscaped circular campus and uncluttered arrival',()=>{
 it('retains the twelve circle positions, native building stencils, booth spacing and every portal/control',()=>{
  const l=preVibeCodeLayout(read('world/layouts/overworld.json')),old=beforeLandscapeJson('world/layouts/overworld.json');
  for(const prefix of ['expo-'])expect(l.placements.filter((p:any)=>p.id.startsWith(prefix))).toEqual(old.placements.filter((p:any)=>p.id.startsWith(prefix)));
  expect(l.placements.filter((p:any)=>p.sprite.startsWith('zodiac-physical-'))).toEqual(old.placements.filter((p:any)=>p.sprite.startsWith('zodiac-physical-')));
  for(const key of ['entries','exits','areas','signs','standingSigns','inspectionZones'] as const)expect(l[key],key).toEqual(old[key]);
  expect(read('maps/overworld.wam')).toEqual(beforeLandscapeJson('maps/overworld.wam'));
  const m=preVibeCodeNative(read('maps/overworld.tmj')),n=beforeLandscapeJson('maps/overworld.tmj');expect(m.tilesets).toEqual(n.tilesets);expect(m.layers.map((l:any)=>[l.id,l.name])).toEqual(n.layers.map((l:any)=>[l.id,l.name]));
  expect(preLandscapeLayout(l)).toEqual(old);expect(preLandscapeNative(m)).toEqual(n);
 });
 it('keeps the full outer road stone-paved, collision-free and connected',()=>{
  const l=read('world/layouts/overworld.json'),g=ground(l),m=read('maps/overworld.tmj'),mask=m.layers.find((p:any)=>p.name==='physical-collisions').data,road=new Set<string>();
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){const r=Math.hypot(x+.5-64,y+.5-64);if(r<52||r>56)continue;const k=`${x},${y}`;road.add(k);expect(g.get(k),k).toBe('path-stone');expect(mask[y*128+x],k).toBe(0);}
  const q=[...road].slice(0,1),seen=new Set(q);for(let i=0;i<q.length;i++){const[x,y]=q[i].split(',').map(Number);for(const k of [`${x-1},${y}`,`${x+1},${y}`,`${x},${y-1}`,`${x},${y+1}`])if(road.has(k)&&!seen.has(k)){seen.add(k);q.push(k);}}
  expect(seen.size).toBe(road.size);expect(road.size).toBeGreaterThan(1300);
 });
 it('restores substantial real grass and places native trees/flowers entirely on it',()=>{
  const l=read('world/layouts/overworld.json'),g=ground(l),old=ground(beforeLandscapeJson('world/layouts/overworld.json')),cat=read('art/tile-catalog.json');
  const green=(g:Map<string,string>)=>[...g.values()].filter(s=>s.startsWith('plaza-grass-')).length;
  expect(green(g)).toBeGreaterThan(green(old)+2000);
  const plants=l.placements.filter((p:any)=>p.layer==='props'&&cat[p.sprite].sourceId==='plaza-original-garden');
  expect(plants.filter((p:any)=>p.sprite.startsWith('plaza-tree-')).length).toBeGreaterThanOrEqual(50);
  expect(plants.filter((p:any)=>/flower|tulip/.test(p.sprite)).length).toBeGreaterThan(30);
  for(const p of plants)for(const k of cells(p))expect(g.get(k)?.startsWith('plaza-grass-'),p.id+' '+k).toBe(true);
  for(const [k,s]of g)if(s.startsWith('plaza-grass-')){const[x,y]=k.split(',').map(Number);expect(s).toBe(`plaza-grass-0${1+x%2+2*(y%2)}`);}
 });
 it('places sponsor marks around the main arrival logo with a clear gap above the booth fascia',()=>{
  const l=read('world/layouts/overworld.json'),g=ground(l),s=l.images.filter((p:any)=>p.name.startsWith('Sponsors / Demo')),main=l.images.filter((p:any)=>p.name.startsWith('Arrival / VarCamp'));
  expect(s).toHaveLength(3);expect(s.map((p:any)=>p.x+p.width/2)).toEqual([50,64,78]);
  for(const p of s){expect(p.y+p.height).toBeLessThanOrEqual(57);for(const k of cells(p))expect(g.get(k)).toBe('floor-blue');for(const q of l.images.filter((q:any)=>q!==p))expect(overlaps(p,q),p.name+' / '+q.name).toBe(false);}
  expect(main.map((p:any)=>p.y+p.height).sort().at(-1)).toBe(64);
  for(let y=53;y<65;y++)for(let x=40;x<88;x++)expect(g.get(`${x},${y}`)).toBe('floor-blue');
 });
 it('moves complete local drone tracks clear of booth walls and arrival logos while retaining pixels, clocks and depth',()=>{
  const l=read('world/layouts/overworld.json'),old=beforeLandscapeJson('world/layouts/overworld.json'),g=ground(l),m=read('maps/overworld.tmj');let moved=0;
  for(const p of l.animatedOverlays){const b=old.animatedOverlays.find((q:any)=>q.name===p.name);for(const key of ['image','sourceId','level','width','height','carrierTileIds','animations'])expect(p[key],p.name+' '+key).toEqual(b[key]);
   if(p.name.startsWith('plaza-drone-'))expect(p).toEqual(b); //40 sections form two continuous circuits.
   if(p.x===b.x&&p.y===b.y)continue;
   if(p.name==='roadster'){expect([p.x,p.y]).toEqual([83,53]);continue;}
   moved++;expect(p.level).toBe('aboveScenery');for(const k of cells(p))expect(['path-stone','floor-blue'].includes(g.get(k)!),p.name+' '+k).toBe(true);
   for(const q of l.images)expect(overlaps(p,q),p.name+' '+q.name).toBe(false);
   const z=m.layers.findIndex((q:any)=>q.name===p.name);expect(z).toBeGreaterThan(m.layers.findIndex((q:any)=>q.name==='floorLayer'));
  }
  expect(moved).toBe(6);
 });
 it('preserves clear wide booth approaches and validates the native publication boundary',()=>{
  const l=read('world/layouts/overworld.json'),m=read('maps/overworld.tmj'),mask=m.layers.find((p:any)=>p.name==='physical-collisions').data;
  for(const[x0,y0,w,h]of[[32,76,6,20],[90,76,6,20],[32,89,64,7]])for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)expect(mask[y*128+x],`${x},${y}`).toBe(0);
  expect(()=>assertCurrentNativeMap('overworld',m,l,read('maps/overworld.wam'),read('art/tile-catalog.json'))).not.toThrow();
 });
 it.each(['plant-in-road','sponsor-over-booth','break-flight','alter-circle'])('rejects unreviewed %s',kind=>{
  const l=read('world/layouts/overworld.json'),m=read('maps/overworld.tmj');
  if(kind==='plant-in-road')l.placements.find((p:any)=>p.id.startsWith('landscape-garden-')).x=64;
  if(kind==='sponsor-over-booth')l.images.find((p:any)=>p.name==='Sponsors / Demo 01').y=65;
  if(kind==='break-flight')l.animatedOverlays.find((p:any)=>p.name==='plaza-drone-00').x++;
  if(kind==='alter-circle')l.placements.find((p:any)=>p.id==='leo-building').y--;
  expect(()=>assertCurrentNativeMap('overworld',m,l,read('maps/overworld.wam'),read('art/tile-catalog.json'))).toThrow(/Plaza landscape|Vibe Code branding/);
 });
});
