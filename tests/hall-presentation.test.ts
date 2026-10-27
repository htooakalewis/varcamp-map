import {applyVibeCodeBranding} from '../tools/maps/vibecode-branding';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {loadTileCatalog} from '../tools/art/catalog';
import {renderReferenceInterior,assertNativeReferenceInterior} from '../tools/maps/reference-interiors';
import {applyHallPresentation} from '../tools/maps/hall-presentation';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const baseline=()=>{const b=readFileSync('tests/fixtures/hall-presentation/baseline.json');expect(sha(b),'frozen pre-treatment evidence envelope').toBe('0de497d125cd3b0475e0fc1e0ba5327c8ce72a25f1ae7fc1edf9f777a46539e5');return JSON.parse(b.toString());};
function before(p:string){const r=baseline().files[p],b=readFileSync(r.fixture);expect(sha(b),p+' genuine original bytes').toBe(r.sha256);return JSON.parse(b.toString());}
const overlap=(a:any,b:any)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const rect=(r:any)=>({x:r.x,y:r.y,width:r.width,height:r.height});
describe('VarCamp assembly hall presentation',()=>{
 for(const sign of ['solar','lunar']){
  const id=sign+'-hall',label=sign==='solar'?'Solar':'Lunar';
  it(`${sign}: authors the exact current treatment from genuine history and rejects repeated authoring`,()=>{
   const old=before(`world/layouts/${id}.json`),saved=structuredClone(old),current=read(`world/layouts/${id}.json`);
   expect(applyVibeCodeBranding(applyHallPresentation(old))).toEqual(current);expect(old).toEqual(saved);
   expect(()=>applyHallPresentation(current)).toThrow('genuine pre-treatment');
  });
  it(`${sign}: paints five native logos clearly above the original stage and furnishings`,()=>{
   const l=read(`world/layouts/${id}.json`),m=read(`maps/${id}.tmj`),old=before(`world/layouts/${id}.json`);
   expect(l.images).toEqual([
    {name:label+' / VarCamp',image:'assets/sponsors/varcamp-2026.png',x:29,y:0,width:6,height:2},
    {name:label+' / AWS UG Myanmar',image:'assets/sponsors/partner-aws-ug-mm.png',x:22,y:3,width:4,height:2},
    {name:label+' / BSides Myanmar',image:'assets/sponsors/partner-bsides-mm.png',x:30,y:3,width:4,height:2},
    {name:label+' / OpenInfra Myanmar',image:'assets/sponsors/partner-openinfra-mm.png',x:38,y:3,width:4,height:2},
    {name:label+' / Vibe Code Tours',image:'assets/sponsors/vibecode-tours.png',x:22,y:0,width:4,height:2}]);
   for(const img of l.images){
    expect(old.placements.filter((p:any)=>p.layer!=='terrain'&&!/wall|foundation/.test(p.id)&&overlap(img,p)).map((p:any)=>p.id),img.name+' covers old furniture/window').toEqual([]);
    const t=m.tilesets.find((t:any)=>t.name===img.name),layer=m.layers.find((t:any)=>t.name===img.name);
    expect(t).toMatchObject({tilewidth:32,tileheight:32,imagewidth:img.width*32,imageheight:64});
    for(let y=0;y<2;y++)for(let x=0;x<img.width;x++)expect(layer.data[(img.y+y)*64+img.x+x]).toBe(t.firstgid+y*img.width+x);
   }
  });
  it(`${sign}: makes the painted stage and listener floor match the actual areas`,()=>{
   const l=read(`world/layouts/${id}.json`),w=read(`maps/${id}.wam`),audience=w.areas.find((a:any)=>a.id===sign+'-audience'),stage=w.areas.find((a:any)=>a.id===sign+'-stage');
   const floor=l.placements.find((p:any)=>p.id==='audience-floor'),deck=l.placements.find((p:any)=>p.id==='stage-gold-border');
   expect(rect(floor)).toEqual({x:16,y:22,width:32,height:20});expect(rect(deck)).toEqual({x:16,y:5,width:32,height:13});
   for(const [paint,area]of [[floor,audience],[deck,stage]])for(const k of ['x','y','width','height'])expect(paint[k]*32,k).toBe(area[k]);
   expect(audience.properties.find((p:any)=>p.type==='listenerMegaphone')).toMatchObject({speakerZoneName:sign+'-stage',allowTalking:false,raiseHandEnabled:true});
   for(const p of l.placements.filter((p:any)=>p.id.startsWith('seat-')))expect(p.x>=floor.x&&p.y>=floor.y&&p.x+p.width<=floor.x+floor.width&&p.y+p.height<=floor.y+floor.height,p.id).toBe(true);
   expect(l.signs.some((s:any)=>s.name===sign+'-hall-style-listeners'&&/LISTENING AREA/.test(s.text))).toBe(true);
  });
  it(`${sign}: preserves every original seat, themed prop, animation, WAM byte and collision cell`,()=>{
   const l=read(`world/layouts/${id}.json`),m=read(`maps/${id}.tmj`),old=before(`world/layouts/${id}.json`),prior=before(`maps/${id}.tmj`),catalog=loadTileCatalog();
   const altered=new Set(['audience-floor','stage-gold-border','stage-deck']);
   expect(l.placements.filter((p:any)=>!p.id.startsWith(sign+'-hall-style-')&&!altered.has(p.id))).toEqual(old.placements.filter((p:any)=>!altered.has(p.id)));
   expect(l.placements.filter((p:any)=>p.id.startsWith('seat-'))).toHaveLength(60);
   expect(l.animatedOverlays).toEqual(old.animatedOverlays);expect(l.areas).toEqual(old.areas);expect(l.entries).toEqual(old.entries);expect(l.exits).toEqual(old.exits);
   const mask=(m:any)=>m.layers.find((x:any)=>x.name==='physical-collisions').data.map(Boolean);expect(mask(m)).toEqual(mask(prior));
   const r=baseline().files[`maps/${id}.wam`];expect(readFileSync(`maps/${id}.wam`).equals(readFileSync(r.fixture))).toBe(true);
   expect(()=>assertNativeReferenceInterior(m,l,catalog,read(`maps/${id}.wam`))).not.toThrow();
   const blocked=mask(m),seen=new Set<number>(),queue=[50*64+31];
   for(let h=0;h<queue.length;h++){const n=queue[h];if(seen.has(n)||blocked[n])continue;seen.add(n);const x=n%64,y=n/64|0;for(const[a,b]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(a>=0&&b>=0&&a<64&&b<56)queue.push(b*64+a);}
   for(const p of l.placements.filter((p:any)=>p.id.startsWith('seat-')))for(const[x,y]of catalog[p.sprite].blockingCells)expect([[p.x+x,p.y+y-1],[p.x+x-1,p.y+y],[p.x+x+1,p.y+y]].some(([a,b])=>seen.has(b*64+a)),p.id+' has no reachable approach').toBe(true);
  });
  it.each(['missing-brand','shifted-brand','wrong-floor','missing-trim','missing-theme','changed-rights','blocking-style'])(`${sign}: rejects coherent %s before release`,kind=>{
   const l=read(`world/layouts/${id}.json`),c=loadTileCatalog();
   if(kind==='missing-brand')l.images=(l.images??[]).slice(0,-1);
   if(kind==='shifted-brand'&&l.images?.length)l.images[0].x++;
   if(kind==='wrong-floor')l.placements.find((p:any)=>p.id==='audience-floor').y++;
   if(kind==='missing-trim')l.placements=l.placements.filter((p:any)=>p.id!==sign+'-hall-style-stage-front');
   if(kind==='missing-theme')l.placements=l.placements.filter((p:any)=>p.id!=='stage-rune-west');
   if(kind==='changed-rights')l.areas.find((a:any)=>a.id===sign+'-stage').properties.find((p:any)=>p.type==='restrictedRightsPropertyData').readTags=[];
   if(kind==='blocking-style')c['speaker-style-wall'].blockingCells=[[0,0]];
   expect(()=>{const b=renderReferenceInterior(l,c);assertNativeReferenceInterior(b.tmj,l,c,b.wam);}).toThrow();
  });
 }
});
