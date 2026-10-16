import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadTileCatalog } from '../tools/art/catalog';
import { buildMap } from '../tools/maps/builder';
import { composeZodiacWheel } from '../tools/maps/zodiac-wheel';
import type { MapLayout, TileRect } from '../tools/maps/types';

const authored = () => readdirSync('world/layouts').filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`world/layouts/${f}`, 'utf8')) as MapLayout);
// Compose the expensive pathfinding fixture once. Each test receives its own copy.
const COMPOSED_CAMPUS = composeZodiacWheel(authored()).find(l => l.id === 'overworld')!;
const campus = () => structuredClone(COMPOSED_CAMPUS);
const intersects = (a: TileRect, b: TileRect) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
const cellIds = (r: TileRect, width: number) => Array.from({length:r.width*r.height}, (_,i) => (r.y+Math.floor(i/r.width))*width+r.x+i%r.width);

describe('landscaped zodiac campus', () => {
  it('contains bounded planted beds and two edged water gardens close to the court',()=>{
    // The new bounded exterior verge is shoreline terrain; cultivated beds still require full frames.
    const l=campus(),beds=l.placements.filter(p=>p.sprite==='ground-grass'&&!p.id.startsWith('exterior-verge-'));expect(beds.length).toBeGreaterThan(0);
    // Authored notched beds may use several grass fills inside one physical frame.
    // Bound each fill and require its enclosing garden to contain both flowers and mature trees.
    for(const bed of beds){
      expect(bed.width<=10&&bed.height<=10,`${bed.id} is unbounded lawn`).toBe(true);
      const frame=l.placements.find(p=>p.sprite==='floor-inlay'&&/(?:-rim|-frame)$/.test(p.id)&&p.x<bed.x&&p.y<bed.y&&p.x+p.width>bed.x+bed.width&&p.y+p.height>bed.y+bed.height);
      expect(frame,`${bed.id} has no complete physical garden frame`).toBeDefined();
      expect(l.placements.some(p=>p.sprite==='flower-bed'&&intersects(p,frame!))).toBe(true);
      expect(l.placements.some(p=>p.sprite.startsWith('tree-')&&intersects(p,frame!))).toBe(true);
    }
    const ponds=l.placements.filter(p=>p.sprite==='water-blue'&&p.width<l.width);expect(ponds).toHaveLength(2);
    for(const pond of ponds){expect(l.placements.some(p=>p.sprite==='floor-inlay'&&p.x<pond.x&&p.y<pond.y&&p.x+p.width>pond.x+pond.width&&p.y+p.height>pond.y+pond.height)).toBe(true);expect(l.placements.some(p=>p.sprite==='lily-pad'&&intersects(p,pond))).toBe(true);}
  });
  it('keeps planted beds and ponds separate from spawns, exit triggers and interactive areas',()=>{
    const l=campus(),landscape=l.placements.filter(p=>p.sprite==='ground-grass'&&!p.id.startsWith('exterior-verge-')||p.sprite==='water-blue'&&p.width<l.width);
    for(const p of landscape){expect([...l.entries,...l.exits,...l.areas].some(r=>intersects(p,r)),`${p.id} covers a public approach`).toBe(false);expect(p.x>0&&p.y>0&&p.x+p.width<l.width&&p.y+p.height<l.height).toBe(true);}
  });
  it('groups a reception desk and screen beside the guide conversation area',()=>{
    const l=campus(),guide=l.areas.find(a=>a.name==='npc-guide')!;expect(guide).toBeDefined();
    for(const sprite of ['desk-curved','screen-wide'])expect(l.placements.some(p=>p.sprite===sprite&&Math.hypot(p.x+p.width/2-guide.x-guide.width/2,p.y+p.height/2-guide.y-guide.height/2)<10),sprite).toBe(true);
  });

  it('retains complete walkability of the loop, all twelve rooms and every map gate after landscaping', () => {
    const l=campus(), {tmj,wam}=buildMap(l,loadTileCatalog());
    const colliding=new Set(tmj.tilesets.flatMap(t=>(t.tiles??[]).filter(c=>c.properties?.some(p=>p.name==='collides'&&p.value===true)).map(c=>t.firstgid+c.id)));
    const blocked=new Set(tmj.layers.flatMap(layer=>layer.type==='tilelayer'?layer.data.flatMap((gid,i)=>colliding.has(gid)?[i]:[]):[]));
    const spawn=l.entries.find(e=>e.isDefault)!, queue=[spawn.y*l.width+spawn.x], seen=new Set(queue);
    for(let h=0;h<queue.length;h++){
      const cell=queue[h], x=cell%l.width,y=Math.floor(cell/l.width);
      for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
        const next=ny*l.width+nx;
        if(nx<0||ny<0||nx>=l.width||ny>=l.height||blocked.has(next)||seen.has(next))continue;
        seen.add(next);queue.push(next);
      }
    }
    for(const p of l.placements.filter(p=>p.id.startsWith('promenade-'))) for(const cell of cellIds(p,l.width).filter(c=>!blocked.has(c)))expect(seen.has(cell),`clear promenade detached at ${p.x},${p.y}`).toBe(true);
    expect(wam.areas.some(a=>a.name.startsWith('meeting-'))).toBe(false);
    for(const exit of l.exits)for(const cell of cellIds(exit,l.width))expect(seen.has(cell),`${exit.name} gate unreachable`).toBe(true);
  });
});
