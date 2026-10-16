import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import { validateWam } from '../tools/maps/validate';
import type { MapLayout, TileRect, TiledMap } from '../tools/maps/types';
type Point=[number,number];
function load(id:string):MapLayout {
  const path=`world/layouts/${id}.json`;
  expect(existsSync(path),`${id} destination is missing`).toBe(true);
  return JSON.parse(readFileSync(path,'utf8'));
}
const cells=(r:TileRect):Point[]=>Array.from({length:r.width*r.height},(_,i)=>[r.x+i%r.width,r.y+Math.floor(i/r.width)]);
function grid(tmj:TiledMap){
  const mask=tmj.layers.find(l=>l.name==='physical-collisions');if(mask?.type!=='tilelayer')throw Error('missing physical mask');
  return (x:number,y:number)=>x>=0&&y>=0&&x<tmj.width&&y<tmj.height&&!mask.data[y*tmj.width+x];
}
function reachable(tmj:TiledMap,start:Point,radius=0){
  const free=grid(tmj),ok=(x:number,y:number)=>{for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(!free(x+dx,y+dy))return false;return true;};
  const q=[start],seen=new Set([String(start)]);
  expect(ok(...start),'spawn clearance').toBe(true);
  for(let h=0;h<q.length;h++){const [x,y]=q[h];for(const p of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]] as Point[])if(ok(...p)&&!seen.has(String(p))){seen.add(String(p));q.push(p);}}
  return seen;
}
describe('short Comet Maze journey',()=>{
  // Missing or wrong navigation target prevents the guest from entering/rejoining Orbit's lobby.
  it('connects distinct arrival and return thresholds to the existing social alcove',()=>{
    const l=load('comet-maze'),orbit=load('orbit-maze'),{tmj,wam}=buildMap(l,loadTileCatalog());
    expect([l.width,l.height]).toEqual([48,48]);
    expect(l.entries).toEqual([{name:'comet-entry',isDefault:true,x:5,y:41,width:3,height:2}]);
    expect(l.exits.map(e=>({name:e.name,destination:e.destination,entry:e.entry}))).toEqual([{name:'orbit-return',destination:'orbit-maze',entry:'from-comet'},{name:'plaza-return',destination:'overworld',entry:'from-maze'}]);
    for(const entry of l.entries)for(const exit of l.exits)expect(cells(entry).some(a=>cells(exit).some(b=>String(a)===String(b))),'arrival must not trigger either return').toBe(false);
    expect(l.signs?.some(s=>s.name==='plaza-return-label'&&s.text.includes('PLAZA'))).toBe(true);
    expect(orbit.entries).toContainEqual({name:'from-comet',x:70,y:70,width:2,height:2});
    expect(orbit.exits).toContainEqual({name:'comet-gate',destination:'comet-maze',entry:'comet-entry',x:73,y:70,width:2,height:2});
    expect(tmj.layers.find(x=>x.name==='exit-orbit-return')?.properties).toContainEqual({name:'exitUrl',type:'string',value:'orbit-maze.wam#from-comet'});
    expect(tmj.layers.find(x=>x.name==='exit-plaza-return')?.properties).toContainEqual({name:'exitUrl',type:'string',value:'overworld.wam#from-maze'});
    expect(validateWam(wam)).toEqual([]);
    expect(wam.areas.every(a=>a.properties.length===0)).toBe(true);
  });
  // A narrowed corridor or misplaced crystal must not stop the advertised three-tile route.
  it('supports a wide route through all three crystals and the finish shrine',()=>{
    const l=load('comet-maze'),{tmj}=buildMap(l,loadTileCatalog()),wide=reachable(tmj,[6,41],1);
    const waypoints:Point[]=[[6,33],[15,33],[15,24],[24,24],[24,15],[33,15],[33,24],[42,24],[42,15],[42,8]];
    for(const p of waypoints)expect(wide.has(String(p)),`three-tile route missing ${p}`).toBe(true);
    for(const name of ['comet-checkpoint-1','comet-checkpoint-2','comet-checkpoint-3','comet-finish']){
      const a=l.areas.find(a=>a.name===name);expect(a,`${name} absent`).toBeDefined();
      expect(wide.has(String([a!.x+1,a!.y+1])),`${name} cannot be reached with clearance`).toBe(true);
    }
    expect(l.placements.filter(p=>p.id.startsWith('checkpoint-crystal-'))).toHaveLength(3);
    const free=grid(tmj);for(const p of [[0,0],[10,10],[37,19],[47,47]] as Point[])expect(free(...p),`wall ${p} became walkable`).toBe(false);
  });
  // Losing the side branch or loop makes the small maze a single corridor rather than an exploration.
  it('keeps loops and dead-end courts accessible without trapping guests',()=>{
    const l=load('comet-maze'),{tmj}=buildMap(l,loadTileCatalog()),seen=reachable(tmj,[6,41]),free=grid(tmj);
    for(const p of [[6,6],[24,6],[33,6],[6,24],[42,33]] as Point[])expect(seen.has(String(p)),`side court ${p} lost`).toBe(true);
    // Two independent rectangle loops with continuous three-wide center lines.
    for(const [x1,y1,x2,y2] of [[15,15,24,24],[24,24,33,33]]){
      for(let x=x1;x<=x2;x++)for(let dy=-1;dy<=1;dy++){expect(free(x,y1+dy)).toBe(true);expect(free(x,y2+dy)).toBe(true);}
      for(let y=y1;y<=y2;y++)for(let dx=-1;dx<=1;dx++){expect(free(x1+dx,y)).toBe(true);expect(free(x2+dx,y)).toBe(true);}
    }
    for(const e of l.exits)for(const p of cells(e))expect(seen.has(String(p))).toBe(true);
  });
  // Optional gate furniture must not close Orbit's old hints, restart, finish, or campus exit.
  it('retains Orbit Maze original journey and its connected side gate after keeper retirement',()=>{
    const l=load('orbit-maze'),{tmj}=buildMap(l,loadTileCatalog()),free=grid(tmj),seen=reachable(tmj,[10,68]);
    expect(l.areas.some(a=>a.name==='npc-maze-keeper')).toBe(false);
    const hint:Point[]=JSON.parse(readFileSync('world/maze-route.json','utf8')).route;
    for(const [x,y] of hint)for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)expect(free(x+dx,y+dy),`original hint blocked ${x},${y}`).toBe(true);
    for(const name of ['from-comet','comet-gate']){
      const r=[...l.entries,...l.exits,...l.areas].find(r=>r.name===name);expect(r,`${name} absent`).toBeDefined();
      for(const p of cells(r!))expect(seen.has(String(p)),`${name} tile ${p} blocked`).toBe(true);
    }
    for(const [x,y] of [[10,68],[70,11],[73,14],[39,77]])expect(seen.has(`${x},${y}`),`original destination ${x},${y} lost`).toBe(true);
  });
  // Visible gate/maze instructions must not sit underneath lamps, crystals or seating.
  it('keeps new instructions readable without prop overlap',()=>{
    for(const l of [load('comet-maze'),load('orbit-maze')])for(const s of l.signs!.filter(s=>l.id==='comet-maze'||s.name==='comet-gate-label'))for(const p of l.placements.filter(p=>p.layer==='props')){
      expect(s.x<p.x+p.width&&s.x+s.width>p.x&&s.y<p.y+p.height&&s.y+s.height>p.y,`${s.name} covered by ${p.id}`).toBe(false);
    }
  });
});
