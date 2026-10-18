import{readFileSync,writeFileSync}from'node:fs';
import{pathToFileURL}from'node:url';
import{buildMap}from'./builder';
import{migrateAmbientPlants,WORLD_AMBIENT_IDS}from'./world-ambient';
import{validateAmbientOwnership}from'./world-ambient-ownership';
import{reconcileNativeProjection}from'./native-projection';
import type{MapLayout,TiledMap}from'./types';
import type{TileCatalog}from'../art/catalog';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
/** One source projection transaction; rejected atlas epochs cannot be reused by
 * image identity. Exact legacy retirement witnesses remain mandatory first. */
export function authorWorldAmbientMap(source:TiledMap,input:MapLayout,catalog:TileCatalog){
 const layout=migrateAmbientPlants(input,catalog),base=structuredClone(source),built=buildMap(layout,catalog).tmj;
 base.layers=validateAmbientOwnership(base,layout,catalog,built,true);
 return{map:reconcileNativeProjection(base,built),layout};
}
export function writeWorldAmbientMaps(){const catalog=read('art/tile-catalog.json'),staged=WORLD_AMBIENT_IDS.map(id=>({id,...authorWorldAmbientMap(read(`maps/${id}.tmj`),read(`world/layouts/${id}.json`),catalog)}));for(const{id,map,layout}of staged){writeFileSync(`maps/${id}.tmj`,JSON.stringify(map)+'\n');writeFileSync(`world/layouts/${id}.json`,JSON.stringify(layout,null,2)+'\n');}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)writeWorldAmbientMaps();
