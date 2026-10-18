/** Explicit fourteen-map author export; no publication or other world file writes. */
import { readFileSync, writeFileSync } from 'node:fs';
import {renderReferenceInterior,assertNativeReferenceInterior} from './reference-interiors';
import { validateMap, validateWam } from './validate';
import { loadTileCatalog } from '../art/catalog';
import { WORLD_CATALOG } from '../../src/world/catalog';
import type { MapLayout } from './types';
const before=JSON.parse(readFileSync('tests/fixtures/interior-reference/before-functions.json','utf8'));
const writes=new Map<string,string>();
for(const name of Object.keys(before)){
 const layout:MapLayout=JSON.parse(readFileSync(`world/layouts/${name}.json`,'utf8'));
 for(const[key,value]of Object.entries(before[name]))if(JSON.stringify(layout[key as keyof MapLayout])!==JSON.stringify(value))throw Error(`${name}: exact original ${key} changed`);
 const catalog=loadTileCatalog(),{tmj,wam}=renderReferenceInterior(layout,catalog);
 const issues=[...validateMap(tmj,WORLD_CATALOG),...validateWam(wam)];if(issues.length)throw Error(`${name}: ${JSON.stringify(issues)}`);
 const wamPath=`maps/${name}.wam`,originalWam=readFileSync(wamPath,'utf8');
 assertNativeReferenceInterior(tmj,layout,catalog,JSON.parse(originalWam));
 writes.set(`maps/${name}.tmj`,JSON.stringify(tmj)+'\n');writes.set(wamPath,originalWam);
}
for(const[path,body]of writes)writeFileSync(path,body);
console.log('Validated and exported fourteen exact-function native TMJ/WAM pairs; publication unchanged.');
