import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import sharp from 'sharp';
import { loadTileCatalog } from '../tools/art/catalog';
import { buildMap } from '../tools/maps/builder';
import type { MapLayout,Placement,TileLayer } from '../tools/maps/types';
const layout=()=>JSON.parse(readFileSync('world/layouts/fa-ship.json','utf8')) as MapLayout;
const catalog=loadTileCatalog();
const isRigging=(p:Placement)=>catalog[p.sprite].sourceId==='lpc-ship'&&catalog[p.sprite].level==='aboveAvatar'&&catalog[p.sprite].sheet.endsWith('/rigging.png');
const isCanvas=(p:Placement)=>isRigging(p)&&/^lpc-sails[12]-/.test(p.id);
interface Pixels {width:number;height:number;rgba:Buffer;canvas:Buffer;rigging:Placement[];bases:Placement[];}
/** Rasterize the actual selected native sheet pixels at their source positions. */
async function raster(l:MapLayout):Promise<Pixels>{
 const width=l.width*32,height=l.height*32,rgba=Buffer.alloc(width*height*4),canvas=Buffer.alloc(width*height*4),rigging=l.placements.filter(isRigging),sheets=new Map<string,{data:Buffer;width:number}>();
 for(const p of rigging){const s=catalog[p.sprite];let sheet=sheets.get(s.sheet);if(!sheet){const r=await sharp(s.sheet).ensureAlpha().raw().toBuffer({resolveWithObject:true});sheet={data:r.data,width:r.info.width};sheets.set(s.sheet,sheet);}for(let y=0;y<p.height*32;y++)for(let x=0;x<p.width*32;x++){const from=((s.rect.y*32+y)*sheet.width+s.rect.x*32+x)*4,to=((p.y*32+y)*width+p.x*32+x)*4,a=sheet.data[from+3];if(!a)continue;for(const target of isCanvas(p)?[rgba,canvas]:[rgba]){const oldAlpha=target[to+3]/255,alpha=a/255,outAlpha=alpha+oldAlpha*(1-alpha);for(let c=0;c<3;c++)target[to+c]=Math.round((sheet.data[from+c]*alpha+target[to+c]*oldAlpha*(1-alpha))/outAlpha);target[to+3]=Math.round(outAlpha*255);}}}
 return {width,height,rgba,canvas,rigging,bases:l.placements.filter(p=>p.id.endsWith('mast-base'))};
}
/** Every actual sail pixel must join the opaque rigging seeded at real colliding feet. */
function assertSupported(p:Pixels){
 expect(p.rigging.length,'native rigging selection is empty').toBeGreaterThan(0);
 expect(p.rigging.filter(isCanvas).length,'native sail selection is empty').toBeGreaterThan(0);
 expect(p.bases,'three real mast feet are required').toHaveLength(3);
 const {width,height,rgba,canvas}=p,seen=new Uint8Array(width*height),queue=new Uint32Array(width*height);let tail=0;
 for(const base of p.bases){let seeds=0;expect(catalog[base.sprite].blockingCells,base.id).toEqual([[0,0]]);
  for(let y=base.y*32;y<(base.y+base.height)*32;y++)for(let x=base.x*32;x<(base.x+base.width)*32;x++){const n=y*width+x;if(rgba[n*4+3]){seeds++;if(!seen[n]){seen[n]=1;queue[tail++]=n;}}}
  expect(seeds,`${base.id}: no actual mast pixels meet its solid foot`).toBeGreaterThan(0);
 }
 for(let head=0;head<tail;head++){const n=queue[head],x=n%width,y=Math.floor(n/width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,c=ny*width+nx;if(nx>=0&&ny>=0&&nx<width&&ny<height&&!seen[c]&&rgba[c*4+3]){seen[c]=1;queue[tail++]=c;}}}
 let opaque=0,attached=0;const byMast=p.bases.map(()=>({opaque:0,attached:0}));
 for(let n=0;n<width*height;n++)if(canvas[n*4+3]){opaque++;if(seen[n])attached++;const x=n%width,nearest=p.bases.map(b=>Math.abs(x-(b.x+.5)*32)).reduce((best,d,i,ds)=>d<ds[best]?i:best,0);byMast[nearest].opaque++;if(seen[n])byMast[nearest].attached++;}
 expect(opaque,'rendered native canvas is missing').toBeGreaterThan(0);
 expect(attached/opaque,'opaque canvas is disconnected from the mast feet').toBeGreaterThan(0.98);
 for(const[i,counts]of byMast.entries()){expect(counts.opaque,`${p.bases[i].id}: rendered sail missing`).toBeGreaterThan(0);expect(counts.attached/counts.opaque,`${p.bases[i].id}: sail disconnected`).toBeGreaterThan(0.98);}
 return {riggingTiles:p.rigging.length,canvasTiles:p.rigging.filter(isCanvas).length,mastFeet:p.bases.length,opaqueCanvasPixels:opaque,attachedCanvasPixels:attached,byMast};
}
describe('supported sailing canvas',()=>{
 it('supports actual nonempty LPC canvas with three mast feet and rejects missing or floating pixels',async()=>{
  const l=layout(),actual=await raster(l);const metrics=assertSupported(actual);console.info(JSON.stringify(metrics));
  // Simulate genuinely absent source canvas pixels, retaining the declared sail identities.
  const withoutCanvas=structuredClone(l);withoutCanvas.placements=withoutCanvas.placements.filter(p=>!isCanvas(p));
  const omitted=await raster(withoutCanvas),missing={...actual,rgba:omitted.rgba,canvas:omitted.canvas};
  expect(()=>assertSupported(missing),'missing opaque canvas must fail the invariant').toThrow(/rendered native canvas is missing/);
  const detached=structuredClone(l);for(const p of detached.placements.filter(isCanvas))p.x+=15;
  const floating=await raster(detached);expect(floating.canvas.some((v,i)=>i%4===3&&v>0)).toBe(true);
  expect(()=>assertSupported(floating),'opaque but detached native canvas must fail the invariant').toThrow(/disconnected/);
 });
 it('keeps native rigging decoration independent of the physical collision mask while mast feet stay solid',()=>{
  const l=layout(),rigging=l.placements.filter(isRigging),bases=l.placements.filter(p=>p.id.endsWith('mast-base'));expect(rigging.length).toBeGreaterThan(0);expect(bases).toHaveLength(3);
  const without=structuredClone(l);without.placements=without.placements.filter(p=>!isRigging(p));
  const mask=(input:MapLayout)=>(buildMap(input,catalog).tmj.layers.find(a=>a.name==='physical-collisions') as TileLayer).data.map(n=>n?1:0),withMask=mask(l),withoutMask=mask(without);
  expect(withoutMask).toEqual(withMask);expect(without.placements.filter(p=>p.id.endsWith('mast-base'))).toEqual(bases);
  for(const base of bases){expect(catalog[base.sprite].blockingCells,base.id).toEqual([[0,0]]);expect(withMask[base.y*l.width+base.x],base.id).toBe(1);expect(withoutMask[base.y*l.width+base.x],base.id).toBe(1);}
 });
});
