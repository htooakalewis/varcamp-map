import {beforeExpoChairCatalog} from '../../tools/maps/expo-chair-physics';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {applyFountainMotion,reconcileFountainMotion,restoreFountainMotion} from '../../tools/maps/fountain-motion';
import {loadTileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap} from '../../tools/maps/types';
import {preLeoLayout,preLeoNative,leoSuccessorSha} from './leo-lion-head-history';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
let saved:any;
export function beforeFountain(){if(saved)return saved;const b=readFileSync('tests/fixtures/fountain-motion/before.json.gz');assert.equal(sha(b),'3698f5eaa7e585d762d6a7c0024fefe86e11896e1c344d9feb387ef4632fae7f');saved=JSON.parse(gunzipSync(b).toString());assert.equal(saved.base,'6ed576729f01578cacea7c60d16392da3a78d835');return saved;}
export function beforeFountainJson<T=any>(path:string):T{const row=beforeFountain().components[path];assert.ok(row);assert.equal(sha(Buffer.from(row.raw)),row.sha256);return JSON.parse(row.raw);}
export function fountainSuccessorSha(path:string,pin:string):string{const table=JSON.parse(readFileSync('tests/fixtures/fountain-motion/transitions.json','utf8'));assert.equal(table.base,beforeFountain().base);const pair=table.transitions[path] as [string,string]|undefined;if(!pair||pair[0]!==pin)return leoSuccessorSha(path,pin);assert.equal(pair[0],beforeFountain().pins[path]);return leoSuccessorSha(path,pair[1]);}
export function preFountainLayout(layout:MapLayout):MapLayout{layout=preLeoLayout(layout);return layout.animatedOverlays?.some(o=>o.name==='plaza-fountain-water')?restoreFountainMotion(layout):structuredClone(layout);}
let expected:TiledMap|undefined;
export function preFountainNative(map:TiledMap):TiledMap{
 map=preLeoNative(map);
 if(!map.layers.some(l=>l.name==='plaza-fountain-water'))return structuredClone(map);
 const before=beforeFountainJson<TiledMap>('maps/overworld.tmj');expected??=reconcileFountainMotion(before,applyFountainMotion(beforeFountainJson<MapLayout>('world/layouts/overworld.json')),beforeExpoChairCatalog(loadTileCatalog()));
 assert.deepEqual(map,expected,'exact fountain successor required');return before;
}
