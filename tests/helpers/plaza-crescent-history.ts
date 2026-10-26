import {preLandscapeLayout,preLandscapeNative,landscapeSuccessorSha} from './plaza-landscape-history';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {isDeepStrictEqual} from 'node:util';
import assert from 'node:assert/strict';
import {applyPlazaCrescent,reconcilePlazaCrescent,restorePlazaCrescent} from '../../tools/maps/plaza-crescent';
import {loadTileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap} from '../../tools/maps/types';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
let saved:any;
export function beforeCrescent(){if(saved)return saved;const b=readFileSync('tests/fixtures/plaza-crescent/before.json.gz');assert.equal(sha(b),'e90d0b366a825a6f4b98723ea9afe659e0830c46398288e88cdc3800728dcab3');saved=JSON.parse(gunzipSync(b).toString());assert.equal(saved.base,'03581b104ae2a6b9599af09a2f994fe9e3e2f7fa');return saved;}
export function beforeCrescentJson<T=any>(path:string):T{const row=beforeCrescent().components[path];assert.ok(row);assert.equal(sha(Buffer.from(row.raw)),row.sha256);return JSON.parse(row.raw);}
export function crescentSuccessorSha(path:string,pin:string):string{const table=JSON.parse(readFileSync('tests/fixtures/plaza-crescent/transitions.json','utf8'));assert.equal(table.base,beforeCrescent().base);const pair=table.transitions[path] as [string,string]|undefined;if(!pair||pair[0]!==pin)return landscapeSuccessorSha(path,pin);assert.equal(pair[0],beforeCrescent().pins[path]);return landscapeSuccessorSha(path,pair[1]);}
export function preCrescentLayout(l:MapLayout):MapLayout{l=preLandscapeLayout(l);return l.placements.some(p=>p.id.startsWith('crescent-ground-'))?restorePlazaCrescent(l):structuredClone(l);}
let expected:TiledMap|undefined;
export function preCrescentNative(map:TiledMap):TiledMap{
 map=preLandscapeNative(map);
 const before=beforeCrescentJson<TiledMap>('maps/overworld.tmj');
 // Earlier immutable epochs must continue through the existing historical chain.
 if(!map.tilesets.some(s=>s.name==='hall-buildings')||isDeepStrictEqual(map,before))return structuredClone(map);
 expected??=reconcilePlazaCrescent(before,applyPlazaCrescent(beforeCrescentJson<MapLayout>('world/layouts/overworld.json')),loadTileCatalog());
 assert.deepEqual(map,expected,'exact crescent/circular-ring successor required');return before;
}
