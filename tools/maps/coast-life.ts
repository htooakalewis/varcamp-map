import type {MapLayout,TiledMap} from './types';
import type {TileCatalog} from '../art/catalog';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {buildMap} from './builder';
import {assertNativeSourceProjection} from './native-projection';
import {attachOrganicCoast} from './organic-coast';
import {assertCoastLifeHabitat} from './coast-life-habitat';
import {assertNativeCoastAerial}from'./coast-aerial';
const ids=['shipyard-beach','constellation-shore'];
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
/** Required current-map contract. Historical draft builders do not call this.
 * Current source absence is an error, never a means to disable validation. */
export function assertNativeCoastLife(map:TiledMap,layout:MapLayout,catalog:TileCatalog):void {
 const fail=(message:string):never=>{throw Error('Coast life '+message);};
 const identities=map.properties?.filter(p=>p.name==='worldMapId')??[];
 const matched=ids.filter(id=>layout.id===id||identities.some(p=>p.value===id));
 if(!matched.length){if(map.tilesets.some(t=>t.name?.startsWith('coast-life-'))||layout.animatedOverlays?.some(o=>o.name.startsWith('coast-life-')))fail('current map identity is missing');return;}
 const id=matched[0];if(matched.length!==1||layout.id!==id||identities.length!==1||identities[0].value!==id||identities[0].type!=='string')fail('current map/layout identity changed');
 const props=read('art/source/coast-life-placements.json').maps[id];
 if(!props?.length)fail('declared prop recipe is missing');
 const art=read('art/source/coast-life-assets.json');if(sha(readFileSync(art.atlas.path))!==art.atlas.sha256||art.masters.some((m:any)=>sha(readFileSync(m.path))!==m.sha256)||art.poseStrips.some((m:any)=>sha(readFileSync(m.path))!==m.sha256))fail('original master/native PNG source changed');
 for(const p of props){const source=layout.placements.find(q=>q.id===p.id);if(!source||source.sprite!==p.sprite||['x','y','width','height','layer'].some(k=>(source as any)[k]!==p[k]))fail('declared prop source changed: '+p.id);
  const original=catalog[p.originalSprite],current=catalog[p.sprite];if(!original||!current||!isDeepStrictEqual(current.blockingCells,original.blockingCells)||!isDeepStrictEqual(current.upperCells,original.upperCells)||current.level!==original.level)fail('solid/upper prop geometry changed: '+p.id);
 }
 if(layout.placements.some(p=>['coast-fish','coast-gull'].includes(p.sprite)))fail('obsolete static wildlife must not return');
 const rows=read('art/source/coast-life-tracks.json').maps[id],overlays=layout.animatedOverlays?.filter(o=>o.name.startsWith('coast-life-'))??[];
 if(!rows?.length||overlays.length!==rows.length)fail('required native wildlife source is missing');
 const floor=map.layers.findIndex(l=>l.name==='floorLayer');if(floor<0)fail('avatar floor boundary is missing');
 for(const row of rows){assertCoastLifeHabitat(layout,row);const found=overlays.filter(o=>o.name===row.name);if(found.length!==1)fail('required source overlay is missing: '+row.name);const actual=found[0],metadata=read(`art/source/${row.name}.json`);
  if(actual.level!==row.level||!isDeepStrictEqual(actual,metadata.overlay)||!actual.provenance||sha(readFileSync(actual.image))!==actual.provenance.atlasSha256)fail('wildlife recipe/atlas/depth changed: '+row.name);
  const index=map.layers.findIndex(l=>l.name===row.name);if(index<0||(row.level==='belowAvatar'?index>=floor:index<=floor))fail('native wildlife depth changed: '+row.name);
 }
 assertNativeCoastAerial(map,layout,catalog);
 const intended=buildMap(layout,catalog).tmj;attachOrganicCoast(intended,layout);assertNativeSourceProjection(map,intended);
}
