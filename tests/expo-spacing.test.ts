import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {expect,it} from 'vitest';
import type {MapLayout,TiledMap,TileLayer} from '../tools/maps/types';
import {priorSpacingProvenance} from '../tools/maps/expo-spacing-provenance';
import {preFountainLayout} from './helpers/fountain-motion-history';
import {loadTileCatalog} from '../tools/art/catalog';
import {buildMap} from '../tools/maps/builder';
import {restoreExpoChairNative,reconcileExpoChairPhysics,assertExpoChairCatalog} from '../tools/maps/expo-chair-physics';
const read=<T=any>(p:string):T=>JSON.parse(readFileSync(p,'utf8'));
const current=()=>read<MapLayout>('world/layouts/overworld.json');
const native=()=>read<TiledMap>('maps/overworld.tmj');
const prior=()=>JSON.parse(JSON.parse(gunzipSync(readFileSync('tests/fixtures/expo-spacing/before.json.gz')).toString()).components['world/layouts/overworld.json'].raw) as MapLayout;
const interior=(l:MapLayout,id:string)=>l.placements.find(p=>p.id===`expo-${id}-carpet`)!;
it('provides 50 percent more interior floor and two solid tiles between adjacent booth interiors',()=>{
 const l=current();
 for(const row of ['n','s']){
  const booths=Array.from({length:6},(_,i)=>interior(l,row+(i+1)));
  for(const b of booths)expect([b.width,b.height],b.id).toEqual([6,6]);
  for(const i of [0,1,3,4])expect(booths[i+1].x-booths[i].x-booths[i].width).toBe(2);
 }
});
it('leaves a six-tile shared aisle between opposing counters and the south walkway open',()=>{
 const l=current(),m=native(),mask=(m.layers.find(l=>l.name==='physical-collisions') as TileLayer).data;
 for(let i=1;i<=6;i++){
  const a=l.placements.find(p=>p.id===`expo-n${i}-counter`)!,b=l.placements.find(p=>p.id===`expo-s${i}-counter`)!;
  expect(b.y-a.y-a.height).toBe(6);
 }
 for(const [left,right] of [[38,61],[66,89]])for(let y=74;y<80;y++)for(let x=left;x<=right;x++)expect(mask[y*128+x],`aisle ${x},${y}`).toBe(0);
 for(let x=38;x<90;x++)expect(mask[89*128+x],`south walkway ${x}`).toBe(0);
});
it('keeps neighboring interior feet farther apart than the live64px proximity join distance',()=>{
 const l=current(),mask=(native().layers.find(l=>l.name==='physical-collisions') as TileLayer).data;
 const cells=(id:string)=>{const b=interior(l,id),out:number[][]=[];for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++)if(!mask[y*128+x])out.push([x*32+16,y*32+16]);return out;};
 for(const row of ['n','s'])for(const i of [1,2,4,5]){
  const distance=Math.min(...cells(row+i).flatMap(a=>cells(row+(i+1)).map(b=>Math.hypot(a[0]-b[0],a[1]-b[1]))));
  expect(distance).toBeGreaterThan(64);
 }
 for(let i=1;i<=6;i++)expect(Math.min(...cells('n'+i).flatMap(a=>cells('s'+i).map(b=>Math.hypot(a[0]-b[0],a[1]-b[1]))))).toBeGreaterThan(192);
});
it('blocks both divider columns while retaining a walking route into every booth',()=>{
 const l=current(),m=native(),mask=(m.layers.find(l=>l.name==='physical-collisions') as TileLayer).data;
 const forbidden=new Set(l.exits.flatMap(e=>Array.from({length:e.width*e.height},(_,i)=>(e.y+Math.floor(i/e.width))*128+e.x+i%e.width)));
 const seen=new Set([66*128+63]),queue=[66*128+63];
 for(let h=0;h<queue.length;h++)for(const i of [queue[h]-128,queue[h]+128,...(queue[h]%128?[queue[h]-1]:[]),...(queue[h]%128<127?[queue[h]+1]:[])])if(i>=0&&i<16384&&!mask[i]&&!forbidden.has(i)&&!seen.has(i)){seen.add(i);queue.push(i);}
 for(const row of ['n','s'])for(let i=1;i<=6;i++){
  const b=interior(l,row+i);expect(seen.has((b.y+3)*128+b.x+2),b.id+' reachable interior').toBe(true);
  if([1,2,4,5].includes(i))for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x+6;x<b.x+8;x++)expect(mask[y*128+x],b.id+' solid two-tile divider').not.toBe(0);
 }
});
it.each(['native','authored'] as const)('%s booth chairs block the visible seat and leave the transparent tile below walkable',kind=>{
 const l=current(),m=kind==='native'?native():buildMap(l,loadTileCatalog()).tmj;
 const mask=(m.layers.find(layer=>layer.name==='physical-collisions') as TileLayer).data;
 const chairs=l.placements.filter(p=>/^expo-[ns][1-6]-chair$/.test(p.id));
 expect(chairs).toHaveLength(12);
 // WA_Seats row 9 contains the entire chair; row 10 in its 1x2 crop is empty.
 // Blocking row 10 creates an invisible obstacle while leaving the chair walkable.
 for(const p of chairs){
  expect.soft(mask[p.y*m.width+p.x],p.id+' visible seat').not.toBe(0);
  expect.soft(mask[(p.y+1)*m.width+p.x],p.id+' empty floor below').toBe(0);
 }
});
it('preserves the old chair collision receipt through an exact reversible native successor',()=>{
 const l=current(),m=native(),c=loadTileCatalog(),prior=l,old=restoreExpoChairNative(m,l,c);
 expect(reconcileExpoChairPhysics(old,prior,c)).toEqual(m);
 const a=(old.layers.find(l=>l.name==='physical-collisions') as TileLayer).data,b=(m.layers.find(l=>l.name==='physical-collisions') as TileLayer).data;
 expect(a.filter((v,i)=>v!==b[i])).toHaveLength(24);
 expect(old.layers.filter(l=>l.name!=='physical-collisions')).toEqual(m.layers.filter(l=>l.name!=='physical-collisions'));
 expect(old.tilesets).toEqual(m.tilesets);
 for(const p of prior.placements.filter(p=>/^expo-[ns][1-6]-chair$/.test(p.id))){expect(a[p.y*128+p.x]).toBe(0);expect(a[(p.y+1)*128+p.x]).not.toBe(0);}
});
it.each(['chair','extra-cell','catalog-art','catalog-collider'])('rejects %s drift when preserving the chair predecessor',kind=>{
 const l=current(),m=native(),c=loadTileCatalog();
 if(kind==='chair')l.placements.find(p=>p.id==='expo-n1-chair')!.x++;
 if(kind==='extra-cell'){const a=(m.layers.find(l=>l.name==='physical-collisions') as TileLayer).data;a[76*128+70]=a.find(Boolean)!;}
 if(kind==='catalog-art')c['chair-presentation'].rect.y++;
 if(kind==='catalog-collider')c['chair-presentation'].blockingCells=[[0,1]];
 expect(()=>{assertExpoChairCatalog(c);restoreExpoChairNative(m,l,c);}).toThrow();
});
it('preserves all meeting, media, entry, exit, animation and zodiac building behavior',()=>{
 const l=priorSpacingProvenance(preFountainLayout(current())),old=prior();
 for(const key of ['areas','entries','exits','inspectionZones','animatedOverlays','standingSigns'] as const)expect(l[key],key).toEqual(old[key]);
 expect(l.placements.filter(p=>!p.id.startsWith('expo-')&&p.id!=='plaza-fountain')).toEqual(old.placements.filter(p=>!p.id.startsWith('expo-')&&p.id!=='plaza-fountain'));
 expect(read('maps/overworld.wam').areas).toEqual(JSON.parse(JSON.parse(gunzipSync(readFileSync('tests/fixtures/expo-spacing/before.json.gz')).toString()).components['maps/overworld.wam'].raw).areas);
});
