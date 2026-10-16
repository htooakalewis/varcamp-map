import type { MapLayout, TileRect } from './types';

const guides=[
  {map:'overworld',id:'guide',name:'Lyra · Guide'},
  {map:'orbit-maze',id:'maze-keeper',name:'Aster · Maze Keeper'},
  {map:'comet-maze',id:'maze-keeper',name:'Aster · Maze Keeper'},
  {map:'shipyard-beach',id:'dockmaster',name:'Nova · Dockmaster'},
] as const;
const intersects=(a:TileRect,b:TileRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;

/** Add visible non-colliding hosts after scenery composition, without altering authored layouts. */
export function addNpcGuides(layouts: MapLayout[]): MapLayout[] {
  return layouts.map(source=>{
    const host=guides.find(g=>g.map===source.id);if(!host)return source;
    const layout=structuredClone(source),areaName=`npc-${host.id}`;
    let area=layout.areas.find(a=>a.name===areaName);
    if(!area&&layout.id==='comet-maze'){
      area={id:areaName,name:areaName,x:38,y:41,width:3,height:3,properties:[]};layout.areas.push(area);
    }
    if(!area)throw Error(`${layout.id}: missing conversation area ${areaName}`);
    const characterId=`npc-character-${host.id}`,labelName=`npc-name-${host.id}`;
    // Reapplication deliberately replaces only this transform's own objects.
    layout.placements=layout.placements.filter(p=>p.id!==characterId);
    layout.signs=(layout.signs??[]).filter(s=>s.name!==labelName);
    const character={id:characterId,sprite:areaName,x:area.x+1,y:area.y-1,width:1,height:2,layer:'props'};
    layout.placements.push(character);
    const candidates=[
      {x:area.x-2,y:area.y+2},{x:area.x-4,y:area.y-2},
      {x:area.x+3,y:area.y},{x:area.x-8,y:area.y},
      {x:area.x-2,y:area.y+3},{x:area.x+3,y:area.y-2},
    ];
    const label=candidates.map(p=>({...p,width:9,height:1})).find(r=>r.x>=1&&r.y>=1&&r.x+r.width<layout.width&&r.y+r.height<layout.height&&!layout.placements.some(p=>p.layer==='props'&&intersects(r,p))&&!layout.signs!.some(s=>intersects(r,s)));
    if(!label)throw Error(`${layout.id}: no clear native name for ${host.name}`);
    layout.signs.push({...label,name:labelName,text:host.name,fontSize:14,color:layout.id==='shipyard-beach'?'#3c3427':'#f8dfa1'});
    return layout;
  });
}
