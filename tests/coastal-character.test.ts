import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { loadTileCatalog } from '../tools/art/catalog';
import { buildMap } from '../tools/maps/builder';
import { addNpcGuides } from '../tools/maps/npc-guides';
import type { MapLayout, TileLayer, TileRect } from '../tools/maps/types';

const load=(id:string):MapLayout=>JSON.parse(readFileSync(`world/layouts/${id}.json`,'utf8'));
const cells=(r:TileRect,w:number)=>Array.from({length:r.width*r.height},(_,i)=>(r.y+Math.floor(i/r.width))*w+r.x+i%r.width);
function walk(l:MapLayout){const {tmj}=buildMap(addNpcGuides([l])[0],loadTileCatalog()),mask=tmj.layers.find(a=>a.name==='physical-collisions') as TileLayer,start=l.entries.find(e=>e.isDefault)!,q=[start.y*l.width+start.x],seen=new Set(q);for(let h=0;h<q.length;h++){const n=q[h],x=n%l.width,y=Math.floor(n/l.width);for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const c=ny*l.width+nx;if(nx>=0&&ny>=0&&nx<l.width&&ny<l.height&&!mask.data[c]&&!seen.has(c)){seen.add(c);q.push(c);}}}return {tmj,mask,seen};}

describe('coastal event character and preserved journeys',()=>{
  it.each(['shipyard-beach','constellation-shore'])('%s has a golden beach rather than a navy office forecourt',id=>{
    const l=load(id),surface=Array(l.width*l.height).fill('');
    for(const p of l.placements.filter(p=>p.layer==='terrain'))for(const n of cells(p,l.width))surface[n]=p.sprite;
    expect(surface.filter(id=>['ground-sand','coast-sand','coast-wet-sand'].includes(id)).length).toBeGreaterThanOrEqual(id==='shipyard-beach'?500:450);
    expect(l.placements.some(p=>p.sprite==='night-wash')).toBe(false);
    expect(l.placements.some(p=>p.sprite==='coast-foam-south')).toBe(true);
    expect(l.placements.some(p=>p.sprite==='coast-parasol')).toBe(true);
  });
  it('assembles the native licensed horizontal vessel with timber structure and canvas rigging',async()=>{
    const l=load('shipyard-beach'),catalog=loadTileCatalog(),ship=l.inspectionZones.find(z=>z.name==='fa-ship-exterior')!;
    expect(ship.width).toBeGreaterThanOrEqual(36);expect(ship.height).toBeGreaterThanOrEqual(10);
    const native=l.placements.filter(p=>catalog[p.sprite].sourceId==='lpc-ship');expect(native.length).toBeGreaterThan(100);
    expect(native.some(p=>catalog[p.sprite].sheet.endsWith('/rigging.png')&&catalog[p.sprite].level==='aboveAvatar')).toBe(true);
    const sheets=[...new Set(native.map(p=>catalog[p.sprite].sheet))];let timber=0,canvas=0,transparent=0;
    for(const file of sheets){const {data}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let i=0;i<data.length;i+=4){const[r,g,b,a]=data.subarray(i,i+4);if(!a){transparent++;continue;}if(r>190&&g>170&&b>110)canvas++;if(r>55&&r>g*1.15&&g>b*1.1)timber++;}}
    expect(timber).toBeGreaterThan(10000);expect(canvas).toBeGreaterThan(10000);expect(transparent).toBeGreaterThan(10000);
  });
  it('uses a moving whole sponsor aircraft and banner rather than a stationary oversized sky prop',()=>{
    const l=load('shipyard-beach'),{tmj}=walk(l),overlay=l.animatedOverlays?.find(o=>o.name==='coastal-flight')!;
    expect(overlay).toBeDefined();expect(l.placements.some(p=>p.sprite==='coast-sponsor-plane'||p.sprite==='coast-sponsor-balloon')).toBe(false);
    expect(l.placements.filter(p=>p.sprite==='coast-gull').length).toBeGreaterThanOrEqual(3);
    expect(overlay.carrierTileIds.length).toBe(144);expect(tmj.layers.find(a=>a.name==='coastal-flight')?.type).toBe('tilelayer');
    const atlas=tmj.tilesets.find(s=>s.name==='coastal-flight')!;expect(atlas.tiles?.every(t=>(t.animation?.length??0)>1)).toBe(true);
    expect(tmj.layers.some(l=>l.type==='imagelayer')).toBe(false);
  });
  it('gives FA SHIP solid mast feet, overhead native rigging and a connected human-scale working deck',()=>{
    const l=load('fa-ship'),{mask,seen}=walk(l),c=loadTileCatalog();
    expect(l.placements.filter(p=>p.id.endsWith('mast-base')).length).toBeGreaterThanOrEqual(2);
    expect(l.placements.some(p=>c[p.sprite].sheet.endsWith('/rigging.png')&&c[p.sprite].level==='aboveAvatar')).toBe(true);
    expect(l.placements.some(p=>p.sprite==='coast-wheel')).toBe(true);
    expect(l.placements.some(p=>['copy-machine','desk-coding','screen-wide'].includes(p.sprite))).toBe(false);
    for(const area of l.areas)for(const n of cells(area,l.width)){expect(mask.data[n],area.name).toBe(0);expect(seen.has(n),area.name).toBe(true);}
  });
  it('keeps the dockmaster name readable against bright beach sand',()=>{
    const l=addNpcGuides([load('shipyard-beach')])[0],label=l.signs!.find(s=>s.name==='npc-name-dockmaster')!;
    const luminance=(hex:string)=>{const c=hex.match(/[a-f\d]{2}/gi)!.map(n=>parseInt(n,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;};
    const a=luminance(label.color!),b=luminance('#efd293');expect((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['shipyard-beach','constellation-shore','fa-ship'])('%s keeps every entry, exit and activity area clear and connected',id=>{
    const l=load(id),{mask,seen}=walk(l);
    for(const r of [...l.entries,...l.exits,...l.areas])for(const n of cells(r,l.width)){expect(mask.data[n],`${id}/${r.name} blocked`).toBe(0);expect(seen.has(n),`${id}/${r.name} disconnected`).toBe(true);}
  });
});
