import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadTileCatalog } from '../tools/art/catalog';
import { buildMap } from '../tools/maps/builder';
import { validateWam } from '../tools/maps/validate';
import type { MapLayout, TileRect, TiledMap } from '../tools/maps/types';

const signs = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
const districts = ['fire','earth','air','water'];
const ids = [...signs.map(s=>`speaker-${s}`), ...districts.map(e=>`${e}-district`),'solar-hall','lunar-hall','hidden-observatory'];
const baseline = JSON.parse(readFileSync('docs/qa/redraw-2026-10-15/interiors/original-area-properties.json','utf8'));
const layouts = readdirSync('world/layouts').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`world/layouts/${f}`,'utf8')) as MapLayout);
const load = (id:string) => { const l=layouts.find(l=>l.id===id); expect(l,`independent authored source ${id}`).toBeDefined(); return l!; };
const cells=(r:TileRect,w:number)=>Array.from({length:r.width*r.height},(_,i)=>(r.y+Math.floor(i/r.width))*w+r.x+i%r.width);
const overlap=(a:TileRect,b:TileRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function navigation(map:TiledMap, entry:TileRect) {
 const mask=map.layers.find(l=>l.name==='physical-collisions'); if(mask?.type!=='tilelayer')throw Error('missing collision mask');
 const blocked=new Set(mask.data.flatMap((v,i)=>v?[i]:[])); const start=entry.y*map.width+entry.x;
 const seen=new Set([start]),q=[start];
 for(let h=0;h<q.length;h++){const c=q[h],x=c%map.width,y=Math.floor(c/map.width);for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=ny*map.width+nx;if(nx<0||ny<0||nx>=map.width||ny>=map.height||blocked.has(n)||seen.has(n))continue;seen.add(n);q.push(n);}}
 return {blocked,seen};
}

describe('independently authored interior family',()=>{
 it('has nineteen compact authored sources, rather than extracted district rooms',()=>{
  expect(ids.filter(id=>layouts.some(l=>l.id===id))).toHaveLength(19);
  for(const id of ids){const l=load(id);expect(l.width).toBeLessThanOrEqual(64);expect(l.height).toBeLessThanOrEqual(64);expect(l.placements.length).toBeGreaterThan(25);}
 });
 for(const sign of signs)it(`preserves ${sign} meeting settings and moves its discovery into its own room`,()=>{
  const l=load(`speaker-${sign}`),meeting=l.areas.find(a=>a.id===`meeting-${sign}`)!;
  expect(meeting.properties).toEqual(sign==='aries'?[{id:'aries-stage-broadcast',type:'speakerMegaphone',name:'varcamp-aries-talk',chatEnabled:false,seeAttendees:false}]:baseline[`meeting-${sign}`]);
  expect(l.areas.filter(a=>a.properties.some(p=>p.type==='livekitRoomProperty'))).toHaveLength(sign==='aries'?0:1);
  expect(l.areas.find(a=>a.id===`beacon-${sign}`)?.properties).toEqual(baseline[`beacon-${sign}`]);
  expect(l.entries).toEqual([expect.objectContaining({name:'speaker-entry',isDefault:true})]);
  expect(l.exits).toEqual([expect.objectContaining({name:'plaza-return',destination:'overworld',entry:`from-speaker-${sign}`})]);
  for(const sprite of [`glyph-${sign}`,`constellation-${sign}`,'screen-presentation','lectern','door-open','window-white'])expect(l.placements.some(p=>p.sprite===sprite),`${sign} ${sprite}`).toBe(true);
 });
 it('gives speakers twelve different seating and social compositions',()=>{
  const signature=(l:MapLayout)=>JSON.stringify(l.placements.filter(p=>/seat|social|workstation/.test(p.id)).map(p=>[p.sprite,p.x,p.y,p.width,p.height]));
  expect(new Set(signs.map(s=>signature(load(`speaker-${s}`)))) .size).toBe(12);
 });
 for(const element of districts)it(`turns ${element} into one activity with one preserved sigil`,()=>{
  const l=load(`${element}-district`);expect(l.width*l.height).toBeLessThanOrEqual(1600);
  expect(l.areas.filter(a=>a.properties.some(p=>p.type==='livekitRoomProperty'))).toEqual([]);
  expect(l.areas.filter(a=>a.id?.startsWith('beacon-'))).toEqual([]);
  expect(l.areas.filter(a=>a.id?.startsWith('sigil-')).map(a=>a.id)).toEqual([`sigil-${element}`]);
  expect(l.areas.find(a=>a.id===`sigil-${element}`)!.properties).toEqual(baseline[`sigil-${element}`]);
  expect(l.inspectionZones.filter(z=>z.kind==='room')).toHaveLength(1);
 });
 for(const hall of ['solar','lunar'])it(`preserves ${hall} stage rights, audience link and prep settings exactly`,()=>{
  const l=load(`${hall}-hall`);expect(l.areas.map(a=>a.name)).toEqual([`${hall==='solar'?'Solar':'Lunar'} stage`,`${hall==='solar'?'Solar':'Lunar'} audience`,`${hall==='solar'?'Solar':'Lunar'} preparation`]); for(const name of ['stage','audience','prep'])expect(l.areas.find(a=>a.id===`${hall}-${name}`)!.properties).toEqual(baseline[`${hall}-${name}`]);
  const stage=l.areas.find(a=>a.id===`${hall}-stage`)!,audience=l.areas.find(a=>a.id===`${hall}-audience`)!,prep=l.areas.find(a=>a.id===`${hall}-prep`)!;
  expect(overlap(prep,audience)).toBe(false);expect(overlap(stage,audience)).toBe(false);
  const seats=l.placements.filter(p=>p.id.startsWith('seat-'));expect(seats.length).toBeGreaterThanOrEqual(60);
  for(const p of seats)expect(p.x>=audience.x&&p.y>=audience.y&&p.x+p.width<=audience.x+audience.width&&p.y+p.height<=audience.y+audience.height).toBe(true);
 });
 it('keeps observatory discovery and silent-area contracts without adding a public inbound gate',()=>{
  const l=load('hidden-observatory');for(const id of ['observatory-discovery','observatory-quiet'])expect(l.areas.find(a=>a.id===id)!.properties).toEqual(baseline[id]);
  expect(l.entries.map(e=>e.name)).toContain('observatory-entry');
  expect(l.signs?.some(s=>/four.*sigils/i.test(s.text))).toBe(true);
 });
 for(const id of ids)it(`${id}: builds native assets and connects all entries, exits, interactions and marked aisles`,()=>{
  const l=load(id),catalog=loadTileCatalog(),{tmj,wam}=buildMap(l,catalog);expect(validateWam(wam)).toEqual([]);
  for(const e of l.entries){const {seen,blocked}=navigation(tmj,e);for(const r of [...l.entries,...l.exits,...l.areas.filter(a=>a.id?.startsWith('beacon-')||a.id?.startsWith('sigil-')||a.id==='observatory-discovery'),...l.inspectionZones.filter(z=>/aisle|route/.test(z.name))])for(const c of cells(r,l.width))expect(seen.has(c)&&!blocked.has(c),`${id} ${r.name}: ${c%l.width},${Math.floor(c/l.width)}`).toBe(true);
   for(const a of l.areas)expect(cells(a,l.width).some(c=>seen.has(c)&&!blocked.has(c)),`${id} inaccessible area ${a.name}`).toBe(true);
   for(const x of l.exits)expect(overlap(e,x),`${id} spawn on exit`).toBe(false);
   for(const s of l.signs??[])expect(overlap(e,s),`${id} spawn under sign`).toBe(false);
  }
  for(const z of l.inspectionZones.filter(z=>/aisle/.test(z.name)))expect(z.width).toBeGreaterThanOrEqual(2);
  for(const [i,s] of (l.signs??[]).entries())for(const other of (l.signs??[]).slice(i+1))expect(overlap(s,other),`${id} overlapping labels ${s.name}/${other.name}`).toBe(false);
 });
 it('keeps furniture rectangles separate except for desks sheltered inside glass pods',()=>{
  const furniture=/^(desk-|table-|sofa-|chair-|bench-|lounge-|bookcase$|forge-aries$|glass-pod$|plant-palm$)/;
  for(const id of ids){const l=load(id),pieces=l.placements.filter(p=>furniture.test(p.sprite));
   for(const [i,a] of pieces.entries())for(const b of pieces.slice(i+1)){
    const pod=a.sprite==='glass-pod'?a:b.sprite==='glass-pod'?b:undefined,desk=pod===a?b:a;
    const sheltered=pod&&desk.sprite.startsWith('desk-')&&desk.x>pod.x&&desk.y>pod.y&&desk.x+desk.width<pod.x+pod.width&&desk.y+desk.height<=pod.y+pod.height;
    expect(overlap(a,b)&&!sheltered,`${id}: ${a.id} overlaps ${b.id}`).toBe(false);
   }
  }
 });
 it('places every laptop and coffee maker on an authored desk rather than a floor',()=>{
  for(const id of ids){const l=load(id);for(const device of l.placements.filter(p=>['laptop','coffee-maker'].includes(p.sprite)))expect(l.placements.some(d=>d.sprite.startsWith('desk-')&&device.x>=d.x&&device.x<d.x+d.width&&device.y===d.y),`${id}: unsupported ${device.id}`).toBe(true);}
 });
 it('uses visible court thresholds with the agreed Exploration Court route',()=>{
  for(const element of districts){const l=load(`${element}-district`);expect(l.exits.find(e=>e.name==='court-return')).toEqual(expect.objectContaining({destination:'campus-exploration',entry:`from-${element}`}));expect(l.placements.some(p=>p.id==='court-door'&&p.sprite==='door-open')).toBe(true);}
 });

 it('keeps labels clear of furniture, lights and mounted displays',()=>{
  for(const id of ids){const l=load(id);for(const s of l.signs??[])for(const p of l.placements.filter(p=>p.layer!=='terrain'&&!/wall|door/.test(p.id)))expect(overlap(s,p),`${id}: ${s.name} covers ${p.id}`).toBe(false);}
 });
 it('bounds the walkable room with continuous walls except at authored doors',()=>{
  for(const id of ids){const l=load(id),{tmj}=buildMap(l,loadTileCatalog()),{seen}=navigation(tmj,l.entries[0]),doors=new Set(l.placements.filter(p=>p.sprite==='door-open').flatMap(p=>cells(p,l.width)));
   for(let y=0;y<l.height;y++)for(let x=0;x<l.width;x++)if(x===0||y===0||x===l.width-1||y===l.height-1)expect(seen.has(y*l.width+x)&&!doors.has(y*l.width+x),`${id}: wall leak at ${x},${y}`).toBe(false);
  }
 });

 for(const [hall,wallX,doorX] of [['solar',13,7],['lunar',50,55]] as const)it(`${hall}: blocks every prep side-wall crossing while keeping the two-tile staff door open`,()=>{
  const l=load(`${hall}-hall`),{tmj}=buildMap(l,loadTileCatalog()),{blocked,seen}=navigation(tmj,l.entries[0]);
  for(let y=6;y<16;y++){
   expect(blocked.has(y*l.width+wallX),`${hall}: cross-wall cell ${wallX},${y} must block`).toBe(true);
   expect(!blocked.has(y*l.width+wallX-1)&&!blocked.has(y*l.width+wallX)&&!blocked.has(y*l.width+wallX+1),`${hall}: horizontal crossing at y=${y}`).toBe(false);
  }
  for(let y=16;y<18;y++)for(let x=doorX;x<doorX+2;x++)expect(seen.has(y*l.width+x)&&!blocked.has(y*l.width+x),`${hall}: staff doorway ${x},${y}`).toBe(true);
 });
 it('preserves all reviewed area properties and geometry, entries, exits and inspection routes',()=>{
  const contracts=JSON.parse(readFileSync('docs/qa/redraw-2026-10-15/interiors/review-repair-contracts.json','utf8'));
  for(const id of ['solar-hall','lunar-hall','hidden-observatory']){const l=load(id);for(const key of ['areas','entries','exits','inspectionZones'] as const)expect(l[key],`${id}: changed ${key}`).toEqual(contracts[id][key]);}
 });
 it('puts the observatory telescope label on the plain inner court surface',()=>{
  const l=load('hidden-observatory'),label=l.signs!.find(s=>s.name==='telescope-label')!,plain=l.placements.find(p=>p.id==='telescope-court')!;
  expect(label.x>=plain.x&&label.y>=plain.y&&label.x+label.width<=plain.x+plain.width&&label.y+label.height<=plain.y+plain.height).toBe(true);
 });

 it('keeps every speaker audience chair fully inside its active listening or meeting area',()=>{
  for(const sign of signs){const l=load(`speaker-${sign}`),meeting=l.areas.find(a=>a.id===(sign==='aries'?'aries-audience':`meeting-${sign}`))!;
   for(const seat of l.placements.filter(p=>p.id.startsWith('seat-')))expect(seat.x>=meeting.x&&seat.y>=meeting.y&&seat.x+seat.width<=meeting.x+meeting.width&&seat.y+seat.height<=meeting.y+meeting.height,`${sign}: ${seat.id} extends outside meeting`).toBe(true);
  }
 });

});
