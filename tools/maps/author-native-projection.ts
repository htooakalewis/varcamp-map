import{readFileSync,writeFileSync}from'node:fs';
import{pathToFileURL}from'node:url';
import{buildMap}from'./builder';
import{loadTileCatalog}from'../art/catalog';
import{authorWorldAmbientMap}from'./author-world-ambient';
import{WORLD_AMBIENT_IDS,assertNativeWorldAmbient}from'./world-ambient';
import{attachOrganicCoast}from'./organic-coast';
import{assertNativeCoastLife}from'./coast-life';
import{assertNativePlaza}from'./plaza-native';
import{reconcileNativeProjection}from'./native-projection';
import{assertAnimatedDecorationSource,assertNativeAnimationSafety}from'./animated-decoration';
import type{MapLayout,TiledMap}from'./types';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
/** Explicit current-epoch export; every result is validated before any source
 * body is written. Semantic layers, WAMs, GID reservations and clocks persist. */
export function writeNativeProjectionEpoch(){
 const catalog=loadTileCatalog(),staged:{id:string;map:TiledMap;layout:MapLayout}[]=[];
 for(const id of [...WORLD_AMBIENT_IDS,'shipyard-beach','constellation-shore','overworld']){
  const source=read(`maps/${id}.tmj`)as TiledMap,input=read(`world/layouts/${id}.json`)as MapLayout;
  if(WORLD_AMBIENT_IDS.includes(id)){const r=authorWorldAmbientMap(source,input,catalog);assertNativeWorldAmbient(r.map,r.layout,catalog);assertNativeAnimationSafety(r.map,r.layout,catalog);staged.push({id,...r});continue;}
  const layout=structuredClone(input);
  if(id==='shipyard-beach')layout.animatedOverlays=layout.animatedOverlays?.map(o=>o.name.startsWith('rolling-breaker-')?read(`art/source/${o.name}.json`).overlay:o);
  if(id==='overworld')layout.animatedOverlays=layout.animatedOverlays?.map(o=>o.name==='roadster'?read('art/source/roadster.json').overlay:o);
  assertAnimatedDecorationSource(layout);
  const intended=buildMap(layout,catalog).tmj;
  if(id!=='overworld')attachOrganicCoast(intended,layout);
  const map=reconcileNativeProjection(source,intended);
  if(id==='overworld')assertNativePlaza(map,layout,catalog);else assertNativeCoastLife(map,layout,catalog);
  assertNativeAnimationSafety(map,layout,catalog);
  staged.push({id,map,layout});
 }
 for(const{id,map,layout}of staged){writeFileSync(`maps/${id}.tmj`,JSON.stringify(map)+'\n');writeFileSync(`world/layouts/${id}.json`,JSON.stringify(layout,null,2)+'\n');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)writeNativeProjectionEpoch();
