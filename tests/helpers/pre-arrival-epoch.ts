import assert from 'node:assert/strict';
import {beforeArrivalJson} from './arrival-refresh-history';
import {applyArrivalRefresh,reconcileArrivalRefresh,advanceArrivalProvenance} from '../../tools/maps/arrival-refresh';
import {loadTileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap} from '../../tools/maps/types';
export function preArrivalLayout(layout:MapLayout):MapLayout{
 if(!layout.images?.some(i=>i.name.startsWith('Arrival /'))&&!layout.animatedOverlays?.some(o=>o.provenance?.metadataPath==='art/source/arrival-roadster.json'))return structuredClone(layout);
 const before=beforeArrivalJson<MapLayout>('world/layouts/overworld.json');assert.deepEqual(layout,applyArrivalRefresh(before),'Current source must be exactly the arrival successor');return advanceArrivalProvenance(before);
}
let expected:TiledMap|undefined;
export function preArrivalNative(map:TiledMap):TiledMap{
 if(!map.tilesets.some(t=>t.image?.includes('/varcamp-arrival-'))&&!map.layers.some(l=>l.name.startsWith('Arrival /')))return structuredClone(map);
 const before=beforeArrivalJson<TiledMap>('maps/overworld.tmj');expected??=reconcileArrivalRefresh(before,applyArrivalRefresh(beforeArrivalJson<MapLayout>('world/layouts/overworld.json')),loadTileCatalog());
 assert.deepEqual(map,expected,'Current native must be exactly the arrival successor');return before;
}
