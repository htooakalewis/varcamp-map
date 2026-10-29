import {beforeExpoChairCatalog} from '../../tools/maps/expo-chair-physics';
/** Stage historical tests only after proving the complete named successor. */
import assert from 'node:assert/strict';
import {beforePhysicsJson} from './zodiac-physics-history';
import {applyZodiacPhysics,reconcileZodiacPhysics} from '../../tools/maps/zodiac-physics';
import {loadTileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap} from '../../tools/maps/types';
import {preArrivalLayout,preArrivalNative} from './pre-arrival-epoch';
export function prePhysicsLayout(layout:MapLayout):MapLayout{
 layout=preArrivalLayout(layout);
 if(!layout.placements.some(p=>p.sprite.startsWith('zodiac-physical-')))return structuredClone(layout);
 const before=beforePhysicsJson<MapLayout>('world/layouts/overworld.json');
 assert.deepEqual(layout,applyZodiacPhysics(before),'Current source must be exactly the zodiac physical successor');return before;
}
let expected:TiledMap|undefined;
export function prePhysicsNative(map:TiledMap):TiledMap{
 map=preArrivalNative(map);
 if(!map.layers.some(l=>l.name==='scenery-aboveAvatar-1'))return structuredClone(map);
 const before=beforePhysicsJson<TiledMap>('maps/overworld.tmj');
 expected??=reconcileZodiacPhysics(before,applyZodiacPhysics(beforePhysicsJson<MapLayout>('world/layouts/overworld.json')),beforeExpoChairCatalog(loadTileCatalog()));
 assert.deepEqual(map,expected,'Current native must be exactly the zodiac physical successor');return before;
}
