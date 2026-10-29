import {beforeExpoChairCatalog} from '../../tools/maps/expo-chair-physics';
import {readFileSync} from 'node:fs';
import {preSpacingLayout,preSpacingNative,spacingSuccessorSha} from './expo-spacing-history';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {applyPlazaPatrol,reconcilePlazaPatrol} from '../../tools/maps/plaza-patrol';
import {advancePatrolProvenance} from '../../tools/maps/plaza-patrol-provenance';
import {loadTileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap} from '../../tools/maps/types';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
let cached:any;
export function beforePatrol(){if(cached)return cached;const raw=readFileSync('tests/fixtures/plaza-patrol/before.json.gz');assert.equal(sha(raw),'352ae3d097af10a8f69992d4c0c08b93a5ee338f85b73dbce4c9b33bb73f9da0');cached=JSON.parse(gunzipSync(raw).toString());assert.equal(cached.base,'a55a30b217a1ee31afa42f72ea5e95c94e9e9eac');return cached;}
export function beforePatrolJson<T=any>(path:string):T{const r=beforePatrol().components[path];assert.ok(r);assert.equal(sha(Buffer.from(r.raw)),r.sha256);return JSON.parse(r.raw);}
export function patrolSuccessorSha(path:string,pin:string):string{
 const table=JSON.parse(readFileSync('tests/fixtures/plaza-patrol/transitions.json','utf8'));assert.equal(table.base,beforePatrol().base);
 const row=table.transitions[path] as [string,string]|undefined;if(!row||row[0]!==pin)return spacingSuccessorSha(path,pin);assert.equal(row[0],beforePatrol().pins[path]);return spacingSuccessorSha(path,row[1]);
}
export function prePatrolLayout(layout:MapLayout):MapLayout{
 layout=preSpacingLayout(layout);
 if(!layout.animatedOverlays?.some(o=>o.name.startsWith('plaza-patrol-')))return advancePatrolProvenance(layout);
 const before=advancePatrolProvenance(beforePatrolJson<MapLayout>('world/layouts/overworld.json'));assert.deepEqual(layout,applyPlazaPatrol(before),'exact patrol successor required');return before;
}
let expected:TiledMap|undefined;
export function prePatrolNative(map:TiledMap):TiledMap{
 map=preSpacingNative(map);
 if(!map.layers.some(l=>l.name.startsWith('plaza-patrol-')))return structuredClone(map);
 const before=beforePatrolJson<TiledMap>('maps/overworld.tmj');expected??=reconcilePlazaPatrol(before,applyPlazaPatrol(advancePatrolProvenance(beforePatrolJson<MapLayout>('world/layouts/overworld.json'))),beforeExpoChairCatalog(loadTileCatalog()));assert.deepEqual(map,expected,'exact native patrol successor required');return before;
}
/** The drone-depth epoch predates the six additional patrols. */
export const BEFORE_PATROL_DRONES=[...Array.from({length:40},(_,i)=>({map:'overworld',name:'plaza-drone-'+String(i).padStart(2,'0')})),...['camera','delivery','survey'].map(id=>({map:'overworld',name:'plaza-fleet-'+id}))];
