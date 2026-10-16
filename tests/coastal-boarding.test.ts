import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{describe,it,expect}from'vitest';
import sharp from'sharp';
import{buildMap}from'../tools/maps/builder';
import{addNpcGuides}from'../tools/maps/npc-guides';
import{loadTileCatalog}from'../tools/art/catalog';
import type{MapLayout,TileRect,TileLayer}from'../tools/maps/types';
const source=(id:string)=>JSON.parse(readFileSync(`world/layouts/${id}.json`,'utf8')) as MapLayout;
const before=JSON.parse(readFileSync('docs/qa/coastal-reassessment-2026-10-16/implementation/fa-ship-before.json','utf8')) as MapLayout;
const cells=(r:TileRect,w:number)=>Array.from({length:r.width*r.height},(_,i)=>(r.y+Math.floor(i/r.width))*w+r.x+i%r.width);
const contains=(a:TileRect,b:TileRect)=>b.x>=a.x&&b.y>=a.y&&b.x+b.width<=a.x+a.width&&b.y+b.height<=a.y+a.height;
const overlap=(a:TileRect,b:TileRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function built(id:string){const l=addNpcGuides([source(id)])[0],{tmj}=buildMap(l,loadTileCatalog());return{l,tmj,mask:(tmj.layers.find(t=>t.name==='physical-collisions') as TileLayer).data};}
function walk(l:MapLayout,mask:number[],size=1){const e=l.entries.find(e=>e.isDefault)!,start=e.y*l.width+e.x,q=[start],seen=new Set(q);const clear=(x:number,y:number)=>x>=0&&y>=0&&x+size<=l.width&&y+size<=l.height&&!cells({x,y,width:size,height:size},l.width).some(n=>mask[n]);expect(clear(e.x,e.y),'default cannot accommodate a clear arrival footprint').toBe(true);for(let h=0;h<q.length;h++){const n=q[h],x=n%l.width,y=Math.floor(n/l.width);for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const k=ny*l.width+nx;if(clear(nx,ny)&&!seen.has(k)){seen.add(k);q.push(k);}}}return seen;}
describe('native coastal boarding and nautical proportions',()=>{
 it('preserves other maps/assets except the separately verified start alias and exact robot retirement',()=>{const before=JSON.parse(readFileSync('docs/qa/coastal-reassessment-2026-10-16/implementation/before-sha256.json','utf8')) as Record<string,string>;for(const[path,hash]of Object.entries(before))if((path.startsWith('maps/')&&!/^maps\/(?:shipyard-beach|fa-ship)\.(?:tmj|wam)$/.test(path))||path.startsWith('assets/')||path.startsWith('world/layouts/')&&!['world/layouts/shipyard-beach.json','world/layouts/fa-ship.json'].includes(path)){
  if(path==='maps/overworld.tmj'||path==='world/layouts/overworld.json'){
   const frozen=readFileSync(`docs/qa/plaza-start-2026-10-16/before/${path}`);
   expect(createHash('sha256').update(frozen).digest('hex'),path+' retained pre-fix baseline').toBe(hash);
   const current=JSON.parse(readFileSync(path,'utf8')),original=JSON.parse(frozen.toString());
   if(path.endsWith('.tmj')){
    const aliases=current.layers.filter((l:{name:string})=>l.name==='start');expect(aliases).toHaveLength(1);
    const welcome=current.layers.find((l:{name:string})=>l.name==='welcome');
    expect(aliases[0]).toEqual({...welcome,id:aliases[0].id,name:'start',properties:[{name:'startLayer',type:'bool',value:true}]});
    const aliasIndex=current.layers.indexOf(aliases[0]);expect(aliases[0].id).toBe(aliasIndex+1);
    current.layers=current.layers.filter((l:{name:string})=>l.name!=='start');
    current.layers.forEach((l:{id:number},i:number)=>{if(i>=aliasIndex)l.id--;});current.nextlayerid--;
   }else{
    const aliases=current.entries.filter((e:{name:string})=>e.name==='start');
    expect(aliases).toEqual([{name:'start',x:63,y:65,width:2,height:2}]);
    current.entries=current.entries.filter((e:{name:string})=>e.name!=='start');
   }
   if(path.endsWith('.tmj')){
    const l=original.layers.find((l:{name:string})=>l.name==='scenery-belowAvatar-1');l.data[70*128+77]=0;l.data[71*128+77]=0;
    const names=original.layers.find((l:{name:string})=>l.name==='wayfinding-text');names.objects=names.objects.filter((o:{name:string})=>o.name!=='npc-name-guide');
   }else original.areas=original.areas.filter((a:{name:string})=>a.name!=='npc-guide');
   expect(current,path+' changed beyond its start alias and exact robot removal').toEqual(original);
  }else if(['maps/comet-maze.tmj','maps/comet-maze.wam','maps/orbit-maze.tmj','maps/orbit-maze.wam','maps/overworld.wam','world/layouts/orbit-maze.json'].includes(path)){
   // The old coastal receipt stays immutable; exact native semantic deltas are
   // independently checked in npc-maps.test.ts, and publication pins their bytes.
   const revisions=JSON.parse(readFileSync('publication/revisions/2026-10-16-shared-guides.json','utf8')).revisions;
   const revision=revisions.find((r:{path:string})=>r.path===path);expect(revision,path+' reviewed retirement').toBeDefined();
   expect(revision.fromSha256,path+' original coastal receipt').toBe(hash);
   expect(createHash('sha256').update(readFileSync(path)).digest('hex'),path).toBe(revision.toSha256);
  }else expect(createHash('sha256').update(readFileSync(path)).digest('hex'),path).toBe(hash);
 }const old=JSON.parse(readFileSync('docs/qa/coastal-reassessment-2026-10-16/implementation/before-inputs/art/tile-catalog.json.before','utf8')),catalog=loadTileCatalog();for(const[id,sprite]of Object.entries(old))expect(catalog[id],id).toEqual(sprite);});

 it('lands directly aboard or on the actual gangway instead of a second quay',()=>{const l=source('fa-ship'),e=l.entries.find(e=>e.isDefault)!,hull=l.inspectionZones.find(z=>z.name==='fa-ship')!,gangway=l.inspectionZones.find(z=>z.name==='safe-gangway')!;expect(contains(hull,e)||contains(gangway,e),'the physical boarding destination is on an unrelated pier').toBe(true);});
 it('uses the approved horizontal hull proportions at native avatar scale',()=>{const l=source('fa-ship'),hull=l.inspectionZones.find(z=>z.name==='fa-ship')!;expect([l.width,l.height]).toEqual([48,56]);expect(hull.width).toBeGreaterThanOrEqual(36);expect(hull.width).toBeLessThanOrEqual(44);expect(hull.height).toBeGreaterThanOrEqual(10);expect(hull.height).toBeLessThanOrEqual(16);});
 it('paints FA SHIP on the hull and keeps the complete name in every first camera',async()=>{const l=source('fa-ship'),name=l.placements.find(p=>p.id==='hull-painted-name');expect(name,'a remote text board does not paint the vessel name on its hull').toBeDefined();if(!name)throw Error('name assertion failed');const c=loadTileCatalog()[name.sprite],{data}=await sharp(c.sheet).extract({left:c.rect.x*32,top:c.rect.y*32,width:c.rect.width*32,height:c.rect.height*32}).ensureAlpha().raw().toBuffer({resolveWithObject:true});expect([c.rect.width,c.rect.height]).toEqual([6,1]);const glyphs=JSON.parse(readFileSync('art/source/hub-nameplates.json','utf8')).glyphs,text='FA SHIP',expected=new Set<number>(),left=(192-(text.length*6-1)*2)/2;for(const[i,ch]of[...text].entries())for(const[y,row]of(glyphs[ch] as string[]).entries())for(const[x,bit]of[...row].entries())if(bit==='1')for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)expected.add((9+y*2+dy)*192+left+i*12+x*2+dx);for(let i=0;i<data.length;i+=4){const painted=expected.has(i/4);expect(data[i+3],`painted glyph pixel ${i/4}`).toBe(painted?255:0);if(painted)expect([...data.subarray(i,i+3)]).toEqual([255,231,177]);}for(const n of cells(l.entries.find(e=>e.isDefault)!,l.width)){const safe={x:n%l.width+.5-14,y:Math.floor(n/l.width)+.5-7,width:28,height:13};expect(contains(safe,name),'FA SHIP misses HUD-safe first viewport').toBe(true);}});
 it('uses barrels and cannon barrels at human scale with solid mast feet',()=>{const l=source('fa-ship'),c=loadTileCatalog(),barrels=l.placements.filter(p=>p.id.includes('barrel')),cannons=l.placements.filter(p=>p.id.includes('cannon'));expect(barrels.length).toBeGreaterThan(0);expect(cannons.length).toBeGreaterThan(0);for(const p of barrels)expect([p.width,p.height],p.id).toEqual([1,1]);for(const p of cannons)expect([p.width,p.height],p.id).toEqual([2,1]);const bases=l.placements.filter(p=>p.id.endsWith('mast-base'));expect(bases.length,'rigging is not a colliding mast foot').toBeGreaterThanOrEqual(2);for(const p of bases){expect([p.width,p.height]).toEqual([1,1]);expect(c[p.sprite].blockingCells).toEqual([[0,0]]);}});
 it('preserves all four existing functional identities and their complete properties',()=>{const l=source('fa-ship');expect(l.areas.map(a=>a.id).sort()).toEqual(before.areas.map(a=>a.id).sort());for(const a of before.areas)expect(l.areas.find(b=>b.id===a.id)?.properties,a.id).toEqual(a.properties);});
 it.each(['shipyard-beach','fa-ship'])('%s keeps all control/interaction cells clear, connected and spawn-safe',id=>{const{l,mask}=built(id),seen=walk(l,mask);for(const r of[...l.entries,...l.exits,...l.areas])for(const n of cells(r,l.width)){expect(mask[n],`${id}/${r.name} blocked`).toBe(0);expect(seen.has(n),`${id}/${r.name} detached`).toBe(true);}for(const e of l.entries)for(const x of l.exits)expect(overlap(e,x),e.name+' auto-returns').toBe(false);});
 it('provides two-avatar-width access to every real deck activity',()=>{const{l,mask}=built('fa-ship'),seen=walk(l,mask,2);for(const a of l.areas){const anchors=cells({x:a.x,y:a.y,width:a.width-1,height:a.height-1},l.width);expect(anchors.some(n=>seen.has(n)),`${a.id} has only a narrow or blocked approach`).toBe(true);}});
});
