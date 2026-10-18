import{reconcileNativeProjection}from'../../tools/maps/native-projection';
import{buildMap}from'../../tools/maps/builder';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {refinePlazaFloorGarden} from '../../tools/maps/plaza-floor-garden';
import {refineNativePlaza} from '../../tools/maps/plaza-native';
import {plazaGardenSprites} from '../../tools/art/plaza-garden';
import type {TileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap} from '../../tools/maps/types';
import contract from '../../world/plaza-floor-garden-native.json';
const folder='tests/fixtures/plaza-floor-garden/';
export function historicalFloorPlaza(kind:'layout'|'native'):MapLayout|TiledMap{
 assert.equal(contract.beforeNativeSha256,'6ae3de6475c7410101e1c7e2689f581c83f044f86bc19b6dc996f763d28541f2');
 assert.equal(contract.beforeLayoutSha256,'ff2d682ae76144ada9f67b93a1af479159733ce086a31b66d01c3a4289eaa9ed');
 const raw=readFileSync(folder+`before-${kind}.${kind==='native'?'tmj':'json'}`),pin=kind==='native'?contract.beforeNativeSha256:contract.beforeLayoutSha256;
 assert.equal(createHash('sha256').update(raw).digest('hex'),pin,'Actual36c7 plaza fixture changed');return JSON.parse(raw.toString());
}
/** Direct current-state successor proof. Frozen historical bytes are input, never recovered from current state. */
export function assertPlazaSuccessor(layout:MapLayout,map:TiledMap,catalog:TileCatalog):void{
 for(const [id,s] of Object.entries(plazaGardenSprites()))assert.deepEqual(catalog[id],s,`Original grounded tree/canopy contract ${id}`);
 const expected=refinePlazaFloorGarden(historicalFloorPlaza('layout') as MapLayout);
 expected.animatedOverlays=expected.animatedOverlays!.filter(o=>o.name!=='roadster'&&!o.name.startsWith('plaza-drone-'));
 expected.animatedOverlays.push(JSON.parse(readFileSync('art/source/roadster.json','utf8')).overlay,...JSON.parse(readFileSync('art/source/plaza-drones.json','utf8')).resources.map((r:any)=>r.overlay));
 assert.ok(isDeepStrictEqual(layout,expected),'Current plaza source must be exactly the approved forward operation');
 assert.ok(isDeepStrictEqual(map,reconcileNativeProjection(refineNativePlaza(readFileSync(folder+'before-native.tmj','utf8'),expected,catalog),buildMap(expected,catalog).tmj)),'Current native must be exactly the approved forward operation');
}
