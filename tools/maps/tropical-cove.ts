import {isDeepStrictEqual} from 'node:util';
import cove from '../../world/tropical-cove.json';
import {buildMap} from './builder';
import {attachOrganicCoast} from './organic-coast';
import {reconcileNativeProjection} from './native-projection';
import type {TileCatalog} from '../art/catalog';
import type {MapLayout,TiledMap,Placement} from './types';
const need=(ok:unknown,message:string):void=>{if(!ok)throw Error('Tropical cove '+message);};
const water=(s:string)=>s.startsWith('naval-water-')||s.startsWith('organic-coast-water-');
export function createTropicalCoveLayout(original:MapLayout,ground:Placement[]):MapLayout{
 need(original.id==='shipyard-beach'&&original.width===48&&original.height===48,'requires the registered beach');
 const result=structuredClone(original),removed=new Set(cove.removePlacementIds);
 const props=result.placements.filter(p=>p.layer!=='terrain'&&p.sprite!=='beach-sea-veil'&&!removed.has(p.id)).map(p=>({...p,...(cove.movePlacements as Record<string,object>)[p.id]}));
 const veils=ground.filter(p=>p.sprite.startsWith('naval-water-')).map(p=>({...p,id:`organic-veil-${p.x}-${p.y}`,sprite:'beach-sea-veil',layer:'architecture' as const}));
 result.placements=[...ground,...cove.docks as Placement[],...veils,...props];
 result.signs=result.signs?.filter(s=>!cove.retiredSigns.includes(s.name));
 result.standingSigns=result.standingSigns?.filter(s=>!cove.retiredSigns.includes(s.text??''));
 return result;
}
/** Retire only the explicitly rebuilt beach paint; protected controls are never redrawn. */
export function reconcileTropicalCove(original:TiledMap,layout:MapLayout,catalog:TileCatalog):TiledMap{
 need(layout.id==='shipyard-beach','requires the registered beach');
 const built=buildMap(layout,catalog).tmj;attachOrganicCoast(built,layout);
 const names=new Set(built.layers.map(l=>l.name)),base=structuredClone(original);
 base.layers=base.layers.filter(l=>names.has(l.name)||!(l.name.startsWith('scenery-')||cove.retiredSigns.some(s=>l.name==='standing-caption-'+s)));
 // The generic painter preserves invisible controls. Terrain authoring owns
 // the physical mask explicitly, while every portal mask remains untouched.
 const mask=base.layers.find(l=>l.name==='physical-collisions'),desired=built.layers.find(l=>l.name==='physical-collisions');
 const priorMask=base.tilesets.find(t=>t.name==='navigation-mask'),sourceMask=built.tilesets.find(t=>t.name==='navigation-mask');
 need(mask?.type==='tilelayer'&&desired?.type==='tilelayer'&&priorMask&&sourceMask,'physical source missing');
 if(mask?.type==='tilelayer'&&desired?.type==='tilelayer')mask.data=desired.data.map(g=>g?priorMask!.firstgid+g-sourceMask!.firstgid:0);
 return reconcileNativeProjection(base,built);
}
/** Mandatory current contract: a missing recipe, sign, source coast or route cannot opt out. */
export function assertTropicalCove(map:TiledMap,layout:MapLayout,catalog:TileCatalog):void{
 if(layout.id!=='shipyard-beach')return;
 need(map.width===48&&map.height===48&&map.tilewidth===32&&map.tileheight===32,'native scale changed');
 for(const field of ['entries','exits','areas','signs']as const)need(isDeepStrictEqual(layout[field],cove[field]),field+' changed');
 need(layout.standingSigns?.length===3&&layout.standingSigns.every(s=>cove.signs.some(x=>x.name===s.text)),'retained captions changed');
 need(!layout.placements.some(p=>cove.removePlacementIds.includes(p.id)),'retired decoration returned');
 need(!map.layers.some(l=>cove.retiredSigns.some(s=>l.name==='standing-caption-'+s)),'retired caption returned');
 const surface=Array(48*48).fill('')as string[];
 for(const p of layout.placements.filter(p=>p.layer==='terrain'))for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++)surface[y*48+x]=p.sprite;
 const layer=map.layers.find(l=>l.name==='physical-collisions');need(layer?.type==='tilelayer','physical mask missing');if(layer?.type!=='tilelayer')return;
 for(let i=0;i<surface.length;i++)if(water(surface[i]))need(layer.data[i]!==0,`walkable sea at ${i%48},${i/48|0}`);
 for(const p of layout.placements.filter(p=>p.layer!=='terrain'&&!p.id.startsWith('lpc-')&&p.id!=='tender-west'))for(const[x,y]of catalog[p.sprite].blockingCells)need(!water(surface[(p.y+y)*48+p.x+x]),'solid base on sea: '+p.id);
 const seen=new Set<number>(),queue=[6*48+23];
 for(let h=0;h<queue.length;h++){const i=queue[h];if(seen.has(i)||layer.data[i])continue;seen.add(i);const x=i%48,y=i/48|0;for(const[a,b]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(a>=0&&b>=0&&a<48&&b<48)queue.push(b*48+a);}
 for(const r of [...layout.entries,...layout.exits,...layout.areas])for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)need(seen.has(y*48+x),'unreachable '+r.name);
}
