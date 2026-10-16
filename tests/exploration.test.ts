import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import { validateMap, validateWam } from '../tools/maps/validate';
import { nativeAreaPropertySchema } from '../tools/maps/wam-schema';
import { WORLD_CATALOG } from '../src/world/catalog';
import type { MapLayout, TileRect, TiledMap } from '../tools/maps/types';
type Point=[number,number];
function load(id:string):MapLayout {const file=`world/layouts/${id}.json`;expect(existsSync(file),'missing authored exploration map').toBe(true);return JSON.parse(readFileSync(file,'utf8'));}
const cells=(r:TileRect):Point[]=>Array.from({length:r.width*r.height},(_,i)=>[r.x+i%r.width,r.y+Math.floor(i/r.width)]);
function grid(m:TiledMap){const l=m.layers.find(l=>l.name==='physical-collisions');if(l?.type!=='tilelayer')throw Error('missing mask');return (x:number,y:number)=>x>=0&&y>=0&&x<m.width&&y<m.height&&!l.data[y*m.width+x];}
function route(m:TiledMap,start:Point,end:Point,radius=0):Point[]{const free=grid(m),ok=(x:number,y:number)=>{for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(!free(x+dx,y+dy))return false;return true;};const key=([x,y]:Point)=>`${x},${y}`,q=[start],seen=new Map([[key(start),null as Point|null]]);if(!ok(...start)||!ok(...end))return [];for(let i=0;i<q.length;i++){const p=q[i];if(key(p)===key(end)){const out:Point[]=[];let c:Point|null=p;while(c){out.push(c);c=seen.get(key(c))!;}return out.reverse();}for(const n of [[p[0]-1,p[1]],[p[0]+1,p[1]],[p[0],p[1]-1],[p[0],p[1]+1]] as Point[])if(ok(...n)&&!seen.has(key(n))){seen.set(key(n),p);q.push(n);}}return [];}
const center=(r:TileRect):Point=>[r.x+Math.floor(r.width/2),r.y+Math.floor(r.height/2)];
for(const [id,w,h,entry,action] of [['orbit-maze',80,80,'maze-entry','maze-finish'],['hidden-observatory',40,36,'observatory-entry','observatory-discovery']] as const)it(`${id} exports a furnished valid map with reachable action and physical campus return`,()=>{
 const l=load(id),{tmj,wam}=buildMap(l,loadTileCatalog());expect([tmj.width,tmj.height]).toEqual([w,h]);expect(validateMap(tmj,WORLD_CATALOG)).toEqual([]);expect(validateWam(wam)).toEqual([]);
 const start=l.entries.find(e=>e.name===entry)!;expect(start).toBeDefined();const a=wam.areas.find(a=>a.id===action);expect(a?.name).toBe(action);expect(a?.properties).toEqual([]);
 const targets=[...l.entries,...l.exits,l.areas.find(a=>a.id===action)!];for(const target of targets)for(const c of cells(target))expect(route(tmj,center(start),c).length,`${target.name} ${c}`).toBeGreaterThan(0);
 expect(l.exits.some(e=>e.destination==='overworld'&&e.entry===(id==='orbit-maze'?'from-maze':'from-observatory'))).toBe(true);
 for(const z of l.inspectionZones.filter(z=>z.kind==='auxiliary'))expect(l.placements.filter(p=>p.layer!=='terrain'&&p.x>=z.x&&p.y>=z.y&&p.x+p.width<=z.x+z.width&&p.y+p.height<=z.y+z.height).length,z.name).toBeGreaterThanOrEqual(3);
});
it('maze has a continuous full hint with three-tile clearance and all three landmark visits',()=>{
 const l=load('orbit-maze'),{tmj}=buildMap(l,loadTileCatalog());expect(existsSync('world/maze-route.json'),'missing full hint').toBe(true);const hint:Point[]=JSON.parse(readFileSync('world/maze-route.json','utf8')).route;
 expect(hint[0]).toEqual(center(l.entries.find(e=>e.name==='maze-entry')!));expect(cells(l.areas.find(a=>a.id==='maze-finish')!).some(p=>String(p)===String(hint.at(-1)))).toBe(true);
 const free=grid(tmj);for(const [i,[x,y]] of hint.entries()){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)expect(free(x+dx,y+dy),`hint clearance ${x},${y}`).toBe(true);if(i)expect(Math.abs(x-hint[i-1][0])+Math.abs(y-hint[i-1][1])).toBe(1);}
 expect(route(tmj,hint[0],hint.at(-1)!,1).length).toBeGreaterThan(0);
 for(const name of ['crescent-fountain','comet-statue','star-ring']){const z=l.inspectionZones.find(z=>z.name===name)!;expect(z).toBeDefined();expect(hint.some(([x,y])=>x>=z.x&&y>=z.y&&x<z.x+z.width&&y<z.y+z.height)).toBe(true);}
 expect(l.exits.some(e=>e.destination==='orbit-maze'&&e.entry==='maze-entry')).toBe(true);
});
it('rejects an actually blocked finish fixture',()=>{
 const l=load('orbit-maze'),{tmj}=buildMap(l,loadTileCatalog()),start=center(l.entries[0]),end=center(l.areas.find(a=>a.id==='maze-finish')!);expect(route(tmj,start,end).length).toBeGreaterThan(0);
 const mask=tmj.layers.find(l=>l.name==='physical-collisions');if(mask?.type!=='tilelayer')throw Error('missing mask');for(const [x,y] of cells(l.areas.find(a=>a.id==='maze-finish')!))mask.data[y*tmj.width+x]=1;expect(route(tmj,start,end)).toEqual([]);
});
it('exports native silent geometry excluding the marked external maze social alcove',()=>{
 for(const id of ['orbit-maze','hidden-observatory']){const l=load(id),{wam}=buildMap(l,loadTileCatalog());const quiet=wam.areas.filter(a=>a.properties.some(p=>p.type==='silent'));expect(quiet.length).toBeGreaterThan(0);expect(validateWam(wam)).toEqual([]);
 if(id==='orbit-maze'){const social=l.areas.find(a=>a.id==='maze-social-alcove')!;expect(social).toBeDefined();expect(social.properties).toEqual([]);for(const a of quiet)expect(a.x<32*(social.x+social.width)&&a.x+a.width>32*social.x&&a.y<32*(social.y+social.height)&&a.y+a.height>32*social.y).toBe(false);expect(l.signs?.some(s=>s.name==='social-alcove-label')).toBe(true);}}
});
it('accepts only the exact silent native property variant without widening unrelated types',()=>{expect(nativeAreaPropertySchema.safeParse({id:'quiet',type:'silent'}).success).toBe(true);expect(nativeAreaPropertySchema.safeParse({type:'silent'}).success).toBe(false);expect(nativeAreaPropertySchema.safeParse({id:'quiet',type:'audio'}).success).toBe(false);});
it('owns the reachable telescope action on Stargazer Terrace with no ungated observatory exit',()=>{
 const l=load('stargazer-terrace'),{tmj,wam}=buildMap(l,loadTileCatalog()),a=wam.areas.find(a=>a.id==='observatory-telescope');expect(a,'missing explicit telescope action').toBeDefined();expect(a?.name).toBe('observatory-telescope');expect(a?.properties).toEqual([]);
 const target=l.areas.find(a=>a.id==='observatory-telescope')!;for(const c of cells(target))expect(route(tmj,center(l.entries.find(e=>e.isDefault)!),c).length).toBeGreaterThan(0);
 expect(l.exits.some(e=>e.destination==='hidden-observatory')).toBe(false);expect(load('campus-exploration').areas.some(a=>a.id==='observatory-telescope')).toBe(false);
 expect(l.signs?.some(s=>s.name==='four-sigil-clue'&&s.text.includes('FOUR DISTRICTS'))).toBe(true);
});
it('keeps the finish title clear of the foreground cyan lamp at avatar scale',()=>{
 const l=load('orbit-maze'),title=l.signs!.find(s=>s.name==='finish-title')!;
 for(const p of l.placements.filter(p=>p.sprite==='light-cyan'))expect(title.x<p.x+p.width&&title.x+title.width>p.x&&title.y<p.y+p.height&&title.y+title.height>p.y,`title overlaps ${p.id}`).toBe(false);
});
