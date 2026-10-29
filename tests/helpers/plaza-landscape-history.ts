import {beforeExpoChairCatalog} from '../../tools/maps/expo-chair-physics';
import {preVibeCodeLayout,preVibeCodeNative,vibeCodeSuccessorSha} from './vibecode-history';
import {beforeCrescentJson} from './plaza-crescent-history';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {isDeepStrictEqual} from 'node:util';
import assert from 'node:assert/strict';
import {applyPlazaLandscape,reconcilePlazaLandscape,restorePlazaLandscape} from '../../tools/maps/plaza-landscape';
import {loadTileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap} from '../../tools/maps/types';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
let saved:any;
export function beforeLandscape(){if(saved)return saved;const b=readFileSync('tests/fixtures/plaza-landscape/before.json.gz');assert.equal(sha(b),'92e8add1d4a5acdf2e4317f70406bc133612ec904e3e429fe8ebe164e092a39f');saved=JSON.parse(gunzipSync(b).toString());assert.equal(saved.base,'b7e33533802cef82d6a6d059a66a8be40b5fd707');return saved;}
export function beforeLandscapeJson<T=any>(path:string):T{const row=beforeLandscape().components[path];assert.ok(row);assert.equal(sha(Buffer.from(row.raw)),row.sha256);return JSON.parse(row.raw);}
export function landscapeSuccessorSha(path:string,pin:string):string{const table=JSON.parse(readFileSync('tests/fixtures/plaza-landscape/transitions.json','utf8'));assert.equal(table.base,beforeLandscape().base);const pair=table.transitions[path] as [string,string]|undefined;if(!pair||pair[0]!==pin)return vibeCodeSuccessorSha(path,pin);assert.equal(pair[0],beforeLandscape().pins[path]);return vibeCodeSuccessorSha(path,pair[1]);}
export function preLandscapeLayout(l:MapLayout):MapLayout{l=preVibeCodeLayout(l);return l.placements.some(p=>p.id.startsWith('landscape-ground-'))?restorePlazaLandscape(l):structuredClone(l);}
let expected:TiledMap|undefined;
export function preLandscapeNative(map:TiledMap):TiledMap{
 map=preVibeCodeNative(map);
 const before=beforeLandscapeJson<TiledMap>('maps/overworld.tmj');
 // Earlier immutable epochs must continue through the existing historical chain.
 if(!map.tilesets.some(s=>s.name==='hall-buildings')||isDeepStrictEqual(map,before)||isDeepStrictEqual(map,beforeCrescentJson('maps/overworld.tmj')))return structuredClone(map);
 expected??=reconcilePlazaLandscape(before,applyPlazaLandscape(beforeLandscapeJson<MapLayout>('world/layouts/overworld.json')),beforeExpoChairCatalog(loadTileCatalog()));
 assert.deepEqual(map,expected,'exact landscape/circular-ring successor required');return before;
}
