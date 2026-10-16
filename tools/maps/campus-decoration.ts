import { loadTileCatalog } from '../art/catalog';
import type { MapLayout, Placement, TileRect } from './types';

const intersects = (a: TileRect,b: TileRect) => a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const expand = (r: TileRect, margin=1): TileRect => ({x:r.x-margin,y:r.y-margin,width:r.width+margin*2,height:r.height+margin*2});

/** Landscape only unused outdoor space; complete room modules and circulation stay authored. */
export function decorateCampus(layout: MapLayout): MapLayout {
  if(layout.id!=='overworld'||layout.placements.some(p=>p.id.startsWith('campus-decor-')))return layout;
  const catalog=loadTileCatalog(), additions: Placement[]=[];
  const roads=layout.placements.filter(p=>p.id.startsWith('road-'));
  const rooms=layout.inspectionZones.filter(z=>z.kind==='room'&&z.name.endsWith('-pavilion'));
  const protectedRects=[...rooms,...roads,...layout.entries,...layout.exits,...layout.areas,...layout.inspectionZones.filter(z=>z.name==='npc-guide-clearance'),...(layout.signs??[])].map(r=>expand(r));
  const occupied=[...protectedRects,...layout.placements.filter(p=>p.layer==='props').map(p=>expand(p))];
  const available=(r: TileRect) => r.x>=2&&r.y>=2&&r.x+r.width<=layout.width-2&&r.y+r.height<=layout.height-2&&!occupied.some(o=>intersects(r,o));
  const add=(id: string,sprite: string,x: number,y: number,width=catalog[sprite].rect.width,height=catalog[sprite].rect.height,layer='props') => {
    const p={id:`campus-decor-${id}`,sprite,x,y,width,height,layer};
    if(!available(p))return false;
    additions.push(p);occupied.push(expand(p));return true;
  };

  // Close, furnished welcome corners remain outside the board, spawn and crossing lanes.
  for(const [id,sprite,x,y] of [
    ['welcome-west-sofa','sofa-blue',69,78],['welcome-west-table','table-small-white',73,79],
    ['welcome-west-planter','plant-grass',70,74],['welcome-west-light','light-amber',74,74],
    ['welcome-east-sofa','sofa-blue',84,70],['welcome-east-table','table-small-white',86,74],
    ['welcome-east-planter','plant-grass',89,72],['welcome-east-light','light-cyan',90,68],
    ['welcome-south-bench','bench-park',69,91],['welcome-south-flower','flower-bed',90,90],
    ['welcome-north-flower','plant-flower',82,71],['welcome-north-crystal','crystal-cyan',79,70],
  ] as [string,string,number,number][])add(id,sprite,x,y);

  // Water, lilies and rocks echo island gardens without interrupting a connecting road.
  const pockets=[{x:54,y:54},{x:94,y:54},{x:54,y:94},{x:94,y:94}];
  for(let i=0;i<pockets.length;i++){
    const {x,y}=pockets[i], pond={x:x+4,y:y+3,width:6,height:4};
    if(add(`pond-${i+1}`,'water-blue',pond.x,pond.y,pond.width,pond.height,'terrain')){
      for(let k=0;k<2;k++)additions.push({id:`campus-decor-pond-${i+1}-lily-${k+1}`,sprite:'lily-pad',x:pond.x+1+k*3,y:pond.y+1+k,width:1,height:1,layer:'props'});
    }
    for(const [name,sprite,dx,dy] of [
      ['rock','shrub-rock',0,3],['tree','tree-flowering',0,0],['flower','flower-bed',11,0],
      ['bench','bench-park',3,9],['lamp','light-amber',7,9],['crystal','crystal-cyan',11,7],
      ['grass','plant-grass',11,4],['flower-west','plant-flower',0,8],
    ] as [string,string,number,number][])add(`pond-${i+1}-${name}`,sprite,x+dx,y+dy);
  }

  // Every doorway gets a small planted forecourt; pick unused cells beside its approach.
  const frontSprites=['flower-bed','tree-flowering','bench-park','light-amber','shrub-rock','plant-grass','crystal-cyan','light-cyan'];
  for(const room of rooms){
    const sign=room.name.slice(0,-9), door={x:room.x+8,y:room.y+12};
    const candidates: {x:number;y:number;score:number}[]=[];
    for(let y=door.y+1;y<=door.y+14;y++)for(let x=door.x-22;x<=door.x+22;x++){
      const distance=Math.hypot(x+1-door.x,y+1-door.y);
      if(distance<=21)candidates.push({x,y,score:distance+Math.abs(y-(door.y+5))*.3});
    }
    candidates.sort((a,b)=>a.score-b.score||a.y-b.y||a.x-b.x);
    for(let i=0;i<frontSprites.length;i++){
      const sprite=frontSprites[i], spot=candidates.find(c=>available({x:c.x,y:c.y,width:catalog[sprite].rect.width,height:catalog[sprite].rect.height}));
      if(spot)add(`front-${sign}-${i+1}`,sprite,spot.x,spot.y);
    }
  }

  // Alternating planting, seating and warm/cool lights follow the routes in each quadrant.
  const routeSprites=['tree-round','flower-bed','bench-park','tree-evergreen','light-amber','shrub-rock','tree-flowering','plant-palm','light-cyan','crystal-cyan'];
  const distanceToRoad=(r: TileRect) => Math.min(...roads.map(p=>Math.max(0,r.x-(p.x+p.width),p.x-(r.x+r.width),r.y-(p.y+p.height),p.y-(r.y+r.height))));
  const quadrants: {x:number;y:number}[][]=[[],[],[],[]];
  for(let y=6;y<layout.height-6;y+=4)for(let x=6;x<layout.width-6;x+=4){
    const d=distanceToRoad({x,y,width:2,height:3});
    if(d>=2&&d<=8)quadrants[(y<80?0:2)+(x<80?0:1)].push({x,y});
  }
  for(let q=0;q<quadrants.length;q++){
    let count=0;
    for(const spot of quadrants[q]){
      const sprite=routeSprites[(count+q*3)%routeSprites.length];
      if(add(`route-${q+1}-${count+1}`,sprite,spot.x,spot.y))count++;
      if(count===25)break;
    }
  }
  return {...layout,placements:[...layout.placements,...additions]};
}
