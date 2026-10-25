import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {loadTileCatalog} from '../tools/art/catalog';
import {reconcileTropicalCove} from '../tools/maps/tropical-cove';
import {assertCoastAerialLayout} from '../tools/maps/coast-aerial';
import {renderTropicalCove,COVE_IMAGE} from '../tools/art/tropical-cove';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const baseline=()=>read('tests/fixtures/tropical-cove/baseline.json');
const before=(p:string)=>{const r=baseline().files[p],b=readFileSync(r.fixture);expect(sha(b)).toBe(r.sha256);return JSON.parse(b.toString());};
const layout=()=>read('world/layouts/shipyard-beach.json');
const native=()=>read('maps/shipyard-beach.tmj');
function surface(l:any,docks=true){const cells=Array(l.width*l.height).fill('');for(const p of l.placements.filter((p:any)=>p.layer==='terrain'&&(docks||p.sprite!=='naval-dock')))for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++)cells[y*l.width+x]=p.sprite;return cells;}
const isWater=(s:string)=>s.startsWith('naval-water-')||s.startsWith('organic-coast-water-');
const isSand=(s:string)=>s.startsWith('beach-sand-')||s.startsWith('organic-coast-land-');
describe('tropical cove visitor experience',()=>{
 it('retains the complete aircraft habitat and prop footprint, including small grass cells',()=>{
  expect(()=>assertCoastAerialLayout(layout())).not.toThrow();
 });
 it('exports the current shoreline and tide pixels from the retained native recipe',async()=>{
  const art=await renderTropicalCove(),meta=read('art/source/tropical-cove-coast.json');
  expect(art.png.equals(readFileSync(COVE_IMAGE))).toBe(true);expect(art.edges).toEqual(meta.cells);
 });
 it('authors the new coast through an explicit native reservation and is idempotent',()=>{
  const catalog=loadTileCatalog(),l=layout(),original=before('maps/shipyard-beach.tmj'),untouched=structuredClone(original);
  const result=reconcileTropicalCove(original,l,catalog);expect(original).toEqual(untouched);
  expect(result.tilesets.at(-1)?.image).toBe('../assets/tilesets/original/tropical-cove-coast.png');
  expect(reconcileTropicalCove(result,l,catalog)).toEqual(result);
 });
 it('recesses the middle shore between two sandy headlands without a cross-bay promenade',()=>{
  const l=layout(),s=surface(l,false);expect(isWater(s[23*48+27]),'the bay must occupy the former middle sand tongue').toBe(true);
  for(const[x,y]of[[7,23],[40,23],[24,17]])expect(isSand(s[y*48+x]),`dry headland/back beach ${x},${y}`).toBe(true);
  const docks=new Set<number>();for(const p of l.placements.filter((p:any)=>p.layer==='terrain'&&p.sprite==='naval-dock'))for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++)docks.add(y*48+x);
  expect(docks.size,'a jetty and edge access, rather than a wooden plaza').toBeLessThanOrEqual(130);
 });
 it('leaves the central dry beach clear and groups only four loungers into two pockets',()=>{
  const l=layout(),m=native(),mask=m.layers.find((x:any)=>x.name==='physical-collisions').data;
  for(let y=10;y<=18;y++)for(let x=22;x<=28;x++)expect(mask[y*48+x],`open sand ${x},${y}`).toBe(0);
  expect(l.placements.filter((p:any)=>p.sprite==='coast-life-solid-beach-recliner')).toHaveLength(4);
  expect(l.placements.some((p:any)=>['quay-promenade','lookout-quay','organic-east-boardwalk'].includes(p.id))).toBe(false);
 });
 it('retains only destination signs and no retired caption, face or invisible support',()=>{
  const l=layout(),m=native();expect(l.signs.map((s:any)=>s.name).sort()).toEqual(['boarding-label','plaza-return-label','shore-label']);
  expect(l.standingSigns).toHaveLength(3);
  for(const name of ['workshop-label','dockmaster-station','arrival-routes']){
   expect(l.placements.some((p:any)=>p.id.startsWith('wood-sign-'+name))).toBe(false);
   expect(m.layers.some((p:any)=>p.name==='standing-caption-'+name)).toBe(false);
  }
 });
 it('grounds each solid beach prop on land or wood and blocks true sea',()=>{
  const l=layout(),s=surface(l),catalog=loadTileCatalog(),mask=native().layers.find((x:any)=>x.name==='physical-collisions').data;
  for(let i=0;i<s.length;i++)if(isWater(s[i]))expect(mask[i],`open water ${i%48},${i/48|0}`).not.toBe(0);
  for(const p of l.placements.filter((p:any)=>p.layer!=='terrain'&&!p.id.startsWith('lpc-')&&p.id!=='tender-west')){for(const[x,y]of catalog[p.sprite].blockingCells){
   expect(isWater(s[(p.y+y)*48+p.x+x]),`solid base on sea: ${p.id}`).toBe(false);
   expect(mask[(p.y+y)*48+p.x+x],`missing solid base: ${p.id}`).not.toBe(0);
  }}
 });
 it('retains native scale, all original portal envelopes and safe routes in both directions',()=>{
  const l=layout(),old=before('world/layouts/shipyard-beach.json'),m=native(),prior=before('maps/shipyard-beach.tmj');
  expect([m.width,m.height,m.tilewidth,m.tileheight]).toEqual([48,48,32,32]);
  expect(l.entries).toEqual(old.entries);expect(l.exits).toEqual(old.exits);expect(l.areas).toEqual(old.areas);
  for(const n of ['shipyard-entry','from-fa-ship','from-constellation-shore','exit-plaza-return','exit-board-fa-ship','exit-shore-gate'])expect(m.layers.find((x:any)=>x.name===n)).toEqual(prior.layers.find((x:any)=>x.name===n));
  const mask=m.layers.find((x:any)=>x.name==='physical-collisions').data;
  const walk=(seed:number,forbidden:Set<number>)=>{const seen=new Set<number>(),q=[seed];for(let h=0;h<q.length;h++){const i=q[h];if(seen.has(i)||mask[i]||forbidden.has(i))continue;seen.add(i);const x=i%48,y=i/48|0;for(const[a,b]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(a>=0&&b>=0&&a<48&&b<48)q.push(b*48+a);}return seen;};
  const autoExits=new Set<number>();for(const r of l.exits)for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)autoExits.add(y*48+x);
  const seen=walk(6*48+23,autoExits);
  for(const r of [...l.entries,...l.areas])for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)expect(seen.has(y*48+x),r.name).toBe(true);
  for(const r of l.exits){const target=new Set(autoExits);for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)target.delete(y*48+x);const reachable=walk(6*48+23,target);for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)expect(reachable.has(y*48+x),r.name).toBe(true);}
 });
 it('preserves every original asset byte, the complete ship and protected aircraft band',()=>{
  for(const[p,h]of Object.entries(baseline().assets))expect(sha(readFileSync(p)),p).toBe(h);
  const l=layout(),old=before('world/layouts/shipyard-beach.json'),ship=(l:any)=>l.placements.filter((p:any)=>p.id.startsWith('lpc-')||p.id.startsWith('harbor-'));
  expect(ship(l)).toEqual(ship(old));expect(l.animatedOverlays).toEqual(old.animatedOverlays);
  const band=(l:any)=>surface(l).slice(5*48,8*48);expect(band(l)).toEqual(band(old));
  const mask=(m:any)=>m.layers.find((x:any)=>x.name==='physical-collisions').data.slice(5*48,8*48);expect(mask(native()).map(Boolean)).toEqual(mask(before('maps/shipyard-beach.tmj')).map(Boolean));
 });
});
