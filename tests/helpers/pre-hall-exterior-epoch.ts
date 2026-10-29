import {beforeExpoChairCatalog} from '../../tools/maps/expo-chair-physics';
/** Historical tests stage genuine predecessor bytes only after validating the
 * complete named successor. No candidate fields are stripped or silently reset. */
import assert from 'node:assert/strict';
import {beforeHallJson} from './hall-exterior-history';
import {applyHallExteriors} from '../../tools/maps/hall-exteriors';
import {buildMap} from '../../tools/maps/builder';
import {reconcileNativeProjection} from '../../tools/maps/native-projection';
import {loadTileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap} from '../../tools/maps/types';
import {prePhysicsLayout,prePhysicsNative} from './pre-zodiac-physics-epoch';
export function preHallLayout(layout:MapLayout):MapLayout{
 layout=prePhysicsLayout(layout);
 if(!layout.placements.some(p=>p.sprite.startsWith('hall-exterior-')))return structuredClone(layout);
 const before=beforeHallJson<MapLayout>('world/layouts/overworld.json');assert.deepEqual(layout,applyHallExteriors(before),'Current source must be the exact two-hall exterior successor');return before;
}
let expected:TiledMap|undefined;
export function preHallNative(map:TiledMap):TiledMap{
 map=prePhysicsNative(map);
 if(!map.tilesets.some(t=>t.image?.endsWith('/hall-exteriors.png')||t.name==='hall-exteriors'))return structuredClone(map);
 const before=beforeHallJson<TiledMap>('maps/overworld.tmj');
 expected??=reconcileNativeProjection(before,buildMap(applyHallExteriors(beforeHallJson<MapLayout>('world/layouts/overworld.json')),beforeExpoChairCatalog(loadTileCatalog())).tmj);
 assert.deepEqual(map,expected,'Current native must be the exact two-hall exterior successor');return before;
}
