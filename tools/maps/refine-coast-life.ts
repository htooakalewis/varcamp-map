import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {buildMap} from './builder';
import {attachOrganicCoast} from './organic-coast';
import type {MapLayout,TiledMap} from './types';
import {reconcileNativeProjection} from './native-projection';
import type {TileCatalog} from '../art/catalog';
import {assertCoastAerialLayout,assertNativeCoastAerial,orderCoastAerialOverlays}from'./coast-aerial';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
/** A bounded native authoring migration: all original GIDs, semantic layers and
 * approved physical geometry stay reserved. Only prop/life/plane visuals move. */
export function refineCoastLife(source:TiledMap,input:MapLayout,catalog:TileCatalog){
 if(!['shipyard-beach','constellation-shore'].includes(input.id))throw Error('Coast life authoring requires a declared coast map');
 const layout=structuredClone(input),base=structuredClone(source);
 const expected=read('art/source/coast-life-placements.json').maps[layout.id];
 if(!expected?.length)throw Error(`Missing declared coast prop recipe: ${layout.id}`);
 for(const old of expected){const p=layout.placements.find(p=>p.id===old.id);if(!p||![old.originalSprite,old.sprite].includes(p.sprite))throw Error(`Missing declared original coast prop: ${old.id}`);for(const field of ['x','y','width','height','layer'])if((p as any)[field]!==old[field])throw Error(`Coast prop geometry drift: ${old.id}/${field}`);p.sprite=old.sprite;}
 layout.placements=layout.placements.filter(p=>!['coast-fish','coast-gull'].includes(p.sprite));
 if(layout.id==='shipyard-beach')layout.animatedOverlays=layout.animatedOverlays?.map(o=>o.name==='coastal-flight'||o.name.startsWith('rolling-breaker-')?read(`art/source/${o.name}.json`).overlay:o);
 layout.animatedOverlays=orderCoastAerialOverlays(layout.animatedOverlays??[]);assertCoastAerialLayout(layout);
 const built=buildMap(layout,catalog).tmj;attachOrganicCoast(built,layout);const map=reconcileNativeProjection(base,built);assertNativeCoastAerial(map,layout,catalog);return{map,layout};
}

export function writeCoastLifeMaps(){const catalog=read('art/tile-catalog.json');for(const id of ['shipyard-beach','constellation-shore']){const {map,layout}=refineCoastLife(read(`maps/${id}.tmj`),read(`world/layouts/${id}.json`),catalog);writeFileSync(`maps/${id}.tmj`,JSON.stringify(map)+'\n');writeFileSync(`world/layouts/${id}.json`,JSON.stringify(layout,null,2)+'\n');}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)writeCoastLifeMaps();
