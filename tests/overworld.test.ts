import { approvedEditorCollections } from './helpers/editor-catalog-history';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORLD_CATALOG } from '../src/world/catalog';
import { loadTileCatalog } from '../tools/art/catalog';
import { validateMap } from '../tools/maps/validate';
import type { MapLayout, TileLayer, TiledMap } from '../tools/maps/types';

const layoutPath='world/layouts/campus-exploration.json';
const readLayout=()=>JSON.parse(readFileSync(layoutPath,'utf8')) as MapLayout;
const cells=(r:{x:number;y:number;width:number;height:number},width=48)=>Array.from({length:r.width*r.height},(_,i)=>(r.y+Math.floor(i/r.width))*width+r.x+i%r.width);
function blocked(map:TiledMap):Set<number> {
  const gids=new Set(map.tilesets.flatMap(s=>(s.tiles??[]).filter(t=>t.properties?.some(p=>p.name==='collides'&&p.value===true)).map(t=>s.firstgid+t.id)));
  return new Set(map.layers.flatMap(l=>l.type==='tilelayer'?l.data.flatMap((v,i)=>gids.has(v)?[i]:[]):[]));
}
function reachable(map:TiledMap,start:number):Set<number> {
  const walls=blocked(map), seen=new Set<number>(),queue=[start];
  if(walls.has(start)) return seen;
  seen.add(start);
  for(let head=0;head<queue.length;head++) {
    const p=queue[head],x=p%map.width,y=Math.floor(p/map.width);
    for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      const n=ny*map.width+nx;
      if(nx<0||ny<0||nx>=map.width||ny>=map.height||walls.has(n)||seen.has(n))continue;
      seen.add(n);queue.push(n);
    }
  }
  return seen;
}
async function build(layout=readLayout()) { return (await import('../tools/maps/builder')).buildMap(layout,loadTileCatalog()); }

describe('outdoor campus contract',()=>{
  it('ships the compact authored exploration court',()=>{
    expect(existsSync(layoutPath),'missing editable campus layout').toBe(true);
    const l=readLayout();expect([l.width,l.height]).toEqual([48,48]);
  });
  it('exports valid starts, physical sibling WAM doors and pixel WAM areas',async()=>{
    expect(existsSync(layoutPath),'missing editable campus layout').toBe(true);
    const l=readLayout(),{tmj,wam}=await build(l);
    expect(validateMap(tmj,WORLD_CATALOG)).toEqual([]);
    expect(l.exits.map(e=>e.destination).sort()).toEqual(['fire-district','earth-district','air-district','water-district','star-garden','moon-cafe','moon-grotto','stargazer-terrace','overworld'].sort());
    expect(l.entries.map(e=>e.name).sort()).toEqual([...WORLD_CATALOG['campus-exploration'].entries].sort());
    expect(wam).toMatchObject({version:'2.1.0',mapUrl:'campus-exploration.tmj',entities:{},entityCollections:approvedEditorCollections});
    for(const e of l.exits) {
      const layer=tmj.layers.find(x=>x.name===`exit-${e.name}`) as TileLayer;
      expect(layer.properties).toContainEqual({name:'exitUrl',type:'string',value:`${e.destination}.wam#${e.entry}`});
      expect(cells(e).every(i=>layer.data[i]>0)).toBe(true);
    }
    for(const a of l.areas) expect(wam.areas.find(x=>x.name===a.name)).toMatchObject({x:a.x*32,y:a.y*32,width:a.width*32,height:a.height*32});
  });
  it('connects every arrival tile to the directory and all independent activity branches',async()=>{
    const l=readLayout(),{tmj}=await build(l),walls=blocked(tmj),reached=reachable(tmj,cells(l.entries.find(e=>e.isDefault)!)[0]);
    for(const r of [...l.entries,...l.exits,...l.areas])for(const p of cells(r))expect(!walls.has(p)&&reached.has(p),`${r.name} ${p%l.width},${Math.floor(p/l.width)}`).toBe(true);
    expect(l.areas.map(a=>a.name)).toEqual(['welcome-directory']);
    for(const name of ['telescope','moon-grotto','star-garden','orbit-playground','moon-cafe'])expect(l.inspectionZones.some(z=>z.name===name)).toBe(false);
  });
  it('signs each activity branch and supplies physical sibling-map doors',async()=>{
    const l=readLayout();for(const exit of l.exits.filter(e=>e.destination!=='overworld'))expect(l.signs?.some(s=>s.name===`${exit.name}-label`&&s.text.trim())).toBe(true);
    expect(l.placements.some(p=>p.sprite==='screen-wide')).toBe(true);expect(l.placements.some(p=>p.sprite==='console-keypad')).toBe(true);
  });
});

describe('reusable physical export',()=>{
  const fixture:MapLayout={id:'campus-exploration',width:256,height:192,placements:[],entries:[],exits:[],areas:[],inspectionZones:[]};
  const place=(id:string,sprite:string,x:number,y:number,width:number,height:number,layer='props')=>({id,sprite,x,y,width,height,layer});
  it('batches repeated sprites with unique names and keeps door, tree and bridge masks correct',async()=>{
    expect(existsSync('tools/maps/builder.ts'),'missing physical map builder').toBe(true);
    const f=structuredClone(fixture);f.placements=[place('grass','ground-grass',0,0,256,192,'terrain'),place('river','water-blue',9,0,4,192,'terrain'),place('bridge','floor-wood-long',9,8,4,8,'terrain'),place('door-a','door-open',3,3,4,2),place('door-b','door-open',20,3,4,2),place('tree-a','tree-round',15,8,2,3),place('tree-b','tree-round',18,8,2,3)];
    const {tmj}=await build(f),walls=blocked(tmj);
    expect(new Set(tmj.layers.map(l=>l.name)).size).toBe(tmj.layers.length);
    expect(tmj.layers.length).toBeLessThan(12);
    expect(walls.has(4*256+3)).toBe(true);expect(walls.has(4*256+4)).toBe(false);
    expect(walls.has(8*256+15)).toBe(false);expect(walls.has(10*256+15)).toBe(true);
    expect(walls.has(8*256+10)).toBe(false);expect(walls.has(7*256+10)).toBe(true);
    expect(reachable(tmj,10*256+5).has(10*256+20)).toBe(true);
    const floor=tmj.layers.findIndex(l=>l.name==='floorLayer');
    expect(tmj.layers.slice(floor+1).some(l=>l.type==='tilelayer'&&l.data[8*256+15]!==0)).toBe(true);
    f.placements=f.placements.filter(p=>p.id!=='bridge');
    expect(reachable((await build(f)).tmj,10*256+5).has(10*256+20),'blocked bridge must disconnect banks').toBe(false);
  });
  it('preserves stacked transparent props and rejects clipped or unknown sprites',async()=>{
    expect(existsSync('tools/maps/builder.ts'),'missing physical map builder').toBe(true);
    const f=structuredClone(fixture);f.placements=[place('desk','desk-glass',4,4,3,3),place('laptop','laptop',5,5,1,1)];
    const {tmj}=await build(f);
    expect(tmj.layers.filter(l=>l.type==='tilelayer'&&l.opacity!==0&&l.data[5*256+5]!==0)).toHaveLength(2);
    f.placements.push(place('bad','tree-round',255,2,2,3));
    await expect(build(f)).rejects.toThrow(/bounds/i);
    f.placements=[place('missing','no-such-sprite',0,0,1,1)];await expect(build(f)).rejects.toThrow(/unknown/i);
  });
});
it('keeps a continuous native night wash between replaced ground and repeated scenery',async()=>{
  const c=loadTileCatalog();expect(c['night-wash'],'missing original atmosphere tile').toBeDefined();
  const f:MapLayout={id:'campus-exploration',width:256,height:192,entries:[],exits:[],areas:[],inspectionZones:[],placements:[
    {id:'ground',sprite:'ground-grass',x:0,y:0,width:256,height:192,layer:'terrain'},
    {id:'night',sprite:'night-wash',x:0,y:0,width:256,height:192,layer:'atmosphere'},
    {id:'bench-a',sprite:'bench-park',x:4,y:4,width:2,height:1,layer:'props'},
    {id:'bench-b',sprite:'bench-park',x:8,y:4,width:2,height:1,layer:'props'},
  ]};
  const {tmj}=await build(f),visible=tmj.layers.filter((l):l is TileLayer=>l.type==='tilelayer'&&l.opacity!==0);
  expect(visible).toHaveLength(3);
  expect(visible[1].data.filter(Boolean)).toHaveLength(49152);
  expect(visible[2].data.filter(Boolean)).toHaveLength(4);
});
it('exports signs using the pinned client supported concrete font and top-left alignment',async()=>{
  const {tmj}=await build();
  const signLayer=tmj.layers.find(l=>l.name==='wayfinding-text');
  expect(signLayer?.type).toBe('objectgroup');
  if(signLayer?.type!=='objectgroup')throw new Error('Missing text objects');
  for(const o of signLayer.objects)expect(o.text).toMatchObject({fontfamily:'Arial',bold:false,halign:'left',valign:'top'});
});
it('names later-map exports from their own identity instead of copying the campus title',async()=>{
  const {tmj,wam}=await build({id:'solar-hall',width:80,height:64,placements:[],entries:[],exits:[],areas:[],inspectionZones:[]});
  expect(tmj.properties).toContainEqual({name:'mapName',type:'string',value:'VarCamp · Solar Hall'});
  expect(wam.metadata?.name).toBe('VarCamp · Solar Hall');
});
it.each([['night-wash','bench-park'],['bench-park','night-wash']])('keeps every navigation GID valid with %s first',async(first,second)=>{
  const tiles=loadTileCatalog();
  const f:MapLayout={id:'campus-exploration',width:48,height:48,areas:[],inspectionZones:[],
    entries:readLayout().entries,
    exits:[{name:'solar',destination:'solar-hall',entry:'solar-entry',x:12,y:10,width:1,height:1}],
    placements:[first,second].map((sprite,i)=>({id:`prop-${i}`,sprite,x:i*4,y:0,width:tiles[sprite].rect.width,height:tiles[sprite].rect.height,layer:'props'})),
  };
  const {tmj}=await build(f);
  const navigation=tmj.layers.filter((l):l is TileLayer=>l.type==='tilelayer'&&l.opacity===0);
  const emitted=new Set(navigation.flatMap(l=>l.data.filter(Boolean)));
  expect(emitted.size).toBe(2); // Exercise both the nonblocking marker and the blocking cell.
  for(const gid of emitted)expect(tmj.tilesets.some(s=>gid>=s.firstgid&&gid<s.firstgid+s.tilecount!),`navigation GID ${gid} does not resolve`).toBe(true);
  const mask=tmj.tilesets.find(s=>s.name==='navigation-mask')!;
  expect(mask.image).toBe('../'+tiles['floor-charcoal'].sheet);
  expect(mask.tilecount).toBeGreaterThanOrEqual(2);
  expect(validateMap(tmj,WORLD_CATALOG)).toEqual([]);
});
