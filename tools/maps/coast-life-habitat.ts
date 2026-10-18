import type {MapLayout} from './types';
/** Water terrain beneath a sailing hull is not visibly open sea. Both the
 * complete animal box and every prop footprint participate in habitat bounds. */
export function assertCoastLifeHabitat(layout:MapLayout,row:{name:string;kind:string;waterOnly:boolean;existingRockPlacement?:string;rect:{x:number;y:number};poseSize:[number,number];tracks:{samples:{x:number;y:number;pose:number|null}[]}[]}):void{
 if(!row.waterOnly)return;
 const surface=Array(layout.width*layout.height).fill('');
 for(const p of layout.placements.filter(p=>p.layer==='terrain'))for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++)surface[y*layout.width+x]=p.sprite;
 const obstacles=layout.placements.filter(p=>p.layer!=='terrain'&&p.sprite!=='beach-sea-veil'&&p.id!==row.existingRockPlacement);
 if(row.kind==='seal'&&!layout.placements.some(p=>p.id===row.existingRockPlacement&&p.sprite==='coast-life-coast-underwater-rock'))throw Error(`Coast life seal requires its declared original rock: ${row.name}`);
 for(const t of row.tracks)for(const s of t.samples){if(s.pose===null||(row.kind==='dolphin'&&s.pose===0))continue;const x=row.rect.x*32+s.x,y=row.rect.y*32+s.y,[width,height]=row.poseSize;
  for(let cy=Math.floor(y/32);cy<Math.ceil((y+height)/32);cy++)for(let cx=Math.floor(x/32);cx<Math.ceil((x+width)/32);cx++)if(cx<0||cy<0||cx>=layout.width||cy>=layout.height||!surface[cy*layout.width+cx].startsWith('naval-water-'))throw Error(`Coast life habitat is not full sea: ${row.name}/${cx},${cy}`);
  const prop=obstacles.find(p=>x<(p.x+p.width)*32&&x+width>p.x*32&&y<(p.y+p.height)*32&&y+height>p.y*32);if(prop)throw Error(`Coast life habitat overlaps ${prop.id}: ${row.name}`);
 }
}
