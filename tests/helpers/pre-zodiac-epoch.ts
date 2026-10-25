/** Earlier ownership-policy scenarios use genuine pre-exterior bytes. A current
 * candidate is admitted only after reproducing its exact named forward successor. */
import assert from 'node:assert/strict';
import {beforeZodiacJson} from './zodiac-exterior-history';
import {applyZodiacExteriors} from '../../tools/maps/zodiac-exteriors';
import {buildMap} from '../../tools/maps/builder';
import {reconcileNativeProjection} from '../../tools/maps/native-projection';
import {loadTileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap} from '../../tools/maps/types';
export function preZodiacLayout(layout:MapLayout):MapLayout{
 if(!layout.placements.some(p=>p.sprite.startsWith('zodiac-building-')))return structuredClone(layout);
 const before=beforeZodiacJson<MapLayout>('world/layouts/overworld.json');assert.deepEqual(layout,applyZodiacExteriors(before),'Current source must be the exact exterior successor');return before;
}
let expected:TiledMap|undefined;
export function preZodiacNative(map:TiledMap):TiledMap{
 if(!map.tilesets.some(t=>t.image?.endsWith('/zodiac-exteriors.png')||t.name==='zodiac-exteriors'))return structuredClone(map);
 const before=beforeZodiacJson<TiledMap>('maps/overworld.tmj');
 expected??=reconcileNativeProjection(before,buildMap(applyZodiacExteriors(beforeZodiacJson<MapLayout>('world/layouts/overworld.json')),loadTileCatalog()).tmj);
 assert.deepEqual(map,expected,'Current native must be the exact exterior successor');return before;
}
