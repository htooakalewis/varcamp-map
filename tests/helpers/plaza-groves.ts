/** Test-only direct current delta proof; immutable historical bytes are never
 * reconstructed from current maps or accepted through an inverse projection. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import type {TileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap,TileLayer} from '../../tools/maps/types';
import {assertPlazaSuccessor,historicalFloorPlaza} from './plaza-successor';
const dir='tests/fixtures/plaza-groves/';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const need=(ok:unknown,message:string)=>{if(!ok)throw Error('Grove '+message);};
function receipt(){const raw=readFileSync(dir+'receipt.json');need(sha(raw)==='5531ac8cdd7b73162d20a26b0821191332b7a70deb4c6921d08c8f5c33cc2352','receipt changed');return JSON.parse(raw.toString());}
export function historicalPlaza(kind:'layout'|'native'|'preview'|'routes'|'catalog'){
 const name=`before-${kind}.${kind==='native'||kind==='preview'?'tmj':'json'}`,raw=readFileSync(dir+name);
 need(sha(raw)===receipt().before[name],'historical bytes changed');return JSON.parse(raw.toString());
}
export function grovePlacements():MapLayout['placements']{const raw=readFileSync(dir+'placements.json');need(sha(raw)===receipt().placementsSha256,'reviewed placement roster changed');return JSON.parse(raw.toString());}
export function groveBaseCells(catalog:TileCatalog):Set<string>{return new Set(grovePlacements().flatMap(p=>catalog[p.sprite].blockingCells.map(([x,y])=>`${p.x+x},${p.y+y}`)));}
export function assertReviewedGroves(layout:MapLayout,map:TiledMap,catalog:TileCatalog):void{
 const beforeLayout=historicalPlaza('layout') as MapLayout,before=historicalPlaza('native') as TiledMap,placements=grovePlacements();
 const originalCatalog=historicalPlaza('catalog');for(const key of new Set(placements.map(p=>p.sprite)))need(isDeepStrictEqual(catalog[key],originalCatalog[key]),'original six catalog definitions changed');
 need(placements.length===96&&new Set(placements.map(p=>p.id)).size===96,'exact96 IDs required');
 need(isDeepStrictEqual(layout,{...beforeLayout,placements:[...beforeLayout.placements,...placements]}),'source is not exact reviewed append');
 const expected=structuredClone(before),oldMask=expected.layers.find(l=>l.name==='physical-collisions') as TileLayer;
 const markers=[...new Set(oldMask.data.filter(Boolean))];need(markers.length===1,'old marker ambiguous');
 const floor=expected.layers.findIndex(l=>l.name==='floorLayer'),id=Math.max(expected.nextlayerid??0,...expected.layers.map(l=>l.id+1));
 const plane=(name:string,id:number):TileLayer=>({id,name,type:'tilelayer',width:128,height:128,data:Array(128*128).fill(0),visible:true,opacity:1,x:0,y:0});
 const below=plane('scenery-belowAvatar-3',id),above=plane('scenery-aboveAvatar-2',id+1),atlas=receipt().addedAtlas;
 need(atlas.firstgid===Math.max(...before.tilesets.map(t=>t.firstgid+(t.tilecount??0))),'new atlas reservation changed');expected.tilesets.push(atlas);
 const occupied=new Set<number>(),bases=new Set<number>();
 for(const p of placements){const s=catalog[p.sprite];need(s&&s.rect.width===p.width&&s.rect.height===p.height&&!s.upperCells,'catalog lineage/partition changed');const matches=expected.tilesets.filter(t=>t.image==='../'+s.sheet);need(matches.length===1,'catalog sheet missing/ambiguous');const t=matches[0];need(Number.isInteger(t.columns)&&t.columns!>0,'native atlas columns required');const columns=t.columns!,target=s.level==='aboveAvatar'?above:below;
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const i=(p.y+y)*128+p.x+x;need(!occupied.has(i),'reviewed footprints overlap');occupied.add(i);target.data[i]=t.firstgid+(s.rect.y+y)*columns+s.rect.x+x;}
  for(const[x,y]of s.blockingCells){const i=(p.y+y)*128+p.x+x;need(!oldMask.data[i]&&!bases.has(i),'base not independently free');bases.add(i);oldMask.data[i]=markers[0];}
 }
 need(occupied.size===420&&bases.size===120,'reviewed cell cardinality changed');
 expected.layers.splice(floor,0,below);expected.layers.push(above);expected.nextlayerid=id+2;
 need(isDeepStrictEqual(map,expected),'current native is not the exact forward delta');
}
export function assertCurrentGroves(layout:MapLayout,map:TiledMap,catalog:TileCatalog):void{
 try{assertReviewedGroves(historicalFloorPlaza('layout') as MapLayout,historicalFloorPlaza('native') as TiledMap,catalog);assertPlazaSuccessor(layout,map,catalog);}
 catch(error){throw Error('Grove successor '+String(error));}
}
