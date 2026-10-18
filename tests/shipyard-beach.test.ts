import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import { validateWam } from '../tools/maps/validate';
import type { MapLayout, TileRect, TiledMap } from '../tools/maps/types';

function load(id='shipyard-beach'): MapLayout {
  const file=`world/layouts/${id}.json`;expect(existsSync(file),'the approved harbor destination is missing').toBe(true);
  return JSON.parse(readFileSync(file,'utf8'));
}
const cells=(r:TileRect,width:number)=>Array.from({length:r.width*r.height},(_,i)=>(r.y+Math.floor(i/r.width))*width+r.x+i%r.width);
function physical(map:TiledMap,start:TileRect,clearance=0) {
  const mask=map.layers.find(l=>l.name==='physical-collisions');
  if(mask?.type!=='tilelayer')throw Error('missing collision export');
  const queue=[start.y*map.width+start.x],seen=new Set(queue);
  for(let h=0;h<queue.length;h++){
    const n=queue[h],x=n%map.width,y=Math.floor(n/map.width);
    for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
      const next=ny*map.width+nx;
      let clear=true;
      for(let dy=-clearance;dy<=clearance;dy++)for(let dx=-clearance;dx<=clearance;dx++)if(nx+dx<0||ny+dy<0||nx+dx>=map.width||ny+dy>=map.height||mask.data[(ny+dy)*map.width+nx+dx])clear=false;
      if(clear&&!seen.has(next)){seen.add(next);queue.push(next);}
    }
  }
  return {seen,blocked:mask.data};
}

describe('separate harbor, shore and ship journeys',()=>{
  it('routes the harbor to independent shore and ship scenes with safe arrivals',()=>{
    const l=load(),{tmj,wam}=buildMap(l,loadTileCatalog());expect([l.width,l.height]).toEqual([48,48]);
    expect(l.exits.map(e=>e.destination).sort()).toEqual(['overworld','fa-ship','constellation-shore'].sort());
    expect(l.entries.map(e=>e.name).sort()).toEqual(['shipyard-entry','from-fa-ship','from-constellation-shore'].sort());
    for(const id of ['shipyard-beach','fa-ship','constellation-shore']){const scene=load(id);for(const entry of scene.entries)expect(scene.exits.some(e=>cells(entry,scene.width).some(c=>cells(e,scene.width).includes(c))),`${id} immediate return`).toBe(false);expect(scene.exits.some(e=>e.destination==='overworld'&&e.entry==='from-shipyard')).toBe(true);}
    expect(tmj.layers.find(layer=>layer.name==='exit-plaza-return')?.properties).toContainEqual({name:'exitUrl',type:'string',value:'overworld.wam#from-shipyard'});
    expect(wam.mapUrl).toBe('shipyard-beach.tmj');expect(validateWam(wam)).toEqual([]);
  });
  it('keeps harbor workshop, shore games and vessel destinations in their owning scenes',()=>{
    const ownership={'shipyard-beach':['harbor-workshop','pier-lookout'],'constellation-shore':['beach-games','picnic-bay','shore-lounge'],'fa-ship':['fa-ship-cockpit','fa-ship-cargo','cargo-deck','fa-ship-lounge']};
    for(const[id,names]of Object.entries(ownership)){const l=load(id),{tmj,wam}=buildMap(l,loadTileCatalog()),{seen,blocked}=physical(tmj,l.entries.find(e=>e.isDefault)!);expect(l.areas.map(a=>a.name).sort()).toEqual([...names].sort());
     for(const r of [...l.entries,...l.exits,...l.areas])for(const c of cells(r,l.width)){expect(blocked[c],`${id} ${r.name} blocked ${c}`).toBe(0);expect(seen.has(c),`${id} ${r.name} unreachable ${c}`).toBe(true);}
     expect(wam.areas.some(a=>a.properties.some(p=>p.type==='livekitRoomProperty'))).toBe(false);
    }
  });
  it('retains a shaped harbor with blocked sea, accessible timber piers and moored boats',()=>{
    const l=load(),{tmj}=buildMap(l,loadTileCatalog()),{seen,blocked}=physical(tmj,l.entries[0]);
    for(const[x,y]of[[0,0],[0,47],[47,47],[20,46]])expect(blocked[y*l.width+x],`open harbor sea ${x},${y}`).not.toBe(0);
    const pier=l.inspectionZones.find(z=>z.name==='boarding-pier')!;expect(pier).toBeDefined();expect(cells(pier,l.width).some(c=>!blocked[c]&&seen.has(c))).toBe(true);
    expect(l.placements.some(p=>p.sprite==='boat-wood')).toBe(true);expect(load('constellation-shore').placements.some(p=>['ground-sand','coast-sand'].includes(p.sprite)||p.sprite.startsWith('beach-sand-'))).toBe(true);
  });
  it('keeps signed physical returns readable and clear of foreground props',()=>{
    for(const id of ['shipyard-beach','fa-ship','constellation-shore']){const l=load(id);expect(l.signs!.some(s=>s.name==='plaza-return-label')).toBe(true);for(const s of l.signs!)for(const p of l.placements.filter(p=>p.layer==='props'))expect(s.x<p.x+p.width&&s.x+s.width>p.x&&s.y<p.y+p.height&&s.y+s.height>p.y,`${id} ${s.name} covered by ${p.id}`).toBe(false);}
  });
  it('exports a named large vessel with connected navigation, cargo and crew decks',()=>{
    const l=load('fa-ship'),{tmj}=buildMap(l,loadTileCatalog()),{seen,blocked}=physical(tmj,l.entries[0]),ship=l.inspectionZones.find(z=>z.name==='fa-ship')!;
    expect(ship.width).toBeGreaterThanOrEqual(36);expect(ship.height).toBeGreaterThanOrEqual(10);expect(ship.height).toBeLessThanOrEqual(16);
    const name=l.placements.find(p=>p.id==='hull-painted-name');expect(name,'native painted name belongs on the vessel').toBeDefined();expect(name!.y).toBeGreaterThan(ship.y);
    for(const area of l.areas)for(const c of cells(area,l.width)){expect(blocked[c],area.name).toBe(0);expect(seen.has(c),area.name).toBe(true);}
    for(const[x,y]of[[2,25],[45,30],[24,40],[10,45]])expect(blocked[y*l.width+x],`sea around hull ${x},${y}`).not.toBe(0);
    const gangway=l.inspectionZones.find(z=>z.name==='safe-gangway')!;expect(gangway.height).toBeGreaterThanOrEqual(3);for(const c of cells(gangway,l.width)){expect(blocked[c],`gangway ${c}`).toBe(0);expect(seen.has(c)).toBe(true);}
    const wide=physical(tmj,{x:l.entries[0].x,y:l.entries[0].y,width:1,height:1},1).seen;
    expect(wide.size,'the gangway and main working deck have real turning space').toBeGreaterThan(20);
  });
});
