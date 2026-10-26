import {preHallBuildingsLayout,preHallBuildingsNative,hallBuildingsSuccessorSha} from './hall-buildings-history';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {applyLeoLionHead,reconcileLeoLionHead,restoreLeoLionHead} from '../../tools/maps/leo-lion-head';
import {loadTileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap} from '../../tools/maps/types';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
let saved:any;
export function beforeLeo(){if(saved)return saved;const b=readFileSync('tests/fixtures/leo-lion-head/before.json.gz');assert.equal(sha(b),'e2009bcc4ab763dae11c391fd78931ad085325ad5edd880cf74d1d4a659fd0a2');saved=JSON.parse(gunzipSync(b).toString());assert.equal(saved.base,'427c4a2e423ae4bad5c5eff2193b1f424783e729');return saved;}
export function beforeLeoJson<T=any>(path:string):T{const row=beforeLeo().components[path];assert.ok(row);assert.equal(sha(Buffer.from(row.raw)),row.sha256);return JSON.parse(row.raw);}
export function leoSuccessorSha(path:string,pin:string):string{const table=JSON.parse(readFileSync('tests/fixtures/leo-lion-head/transitions.json','utf8'));assert.equal(table.base,beforeLeo().base);const pair=table.transitions[path] as [string,string]|undefined;if(!pair||pair[0]!==pin)return hallBuildingsSuccessorSha(path,pin);assert.equal(pair[0],beforeLeo().pins[path]);return hallBuildingsSuccessorSha(path,pair[1]);}
export function preLeoLayout(layout:MapLayout):MapLayout{layout=preHallBuildingsLayout(layout);return layout.placements.some(p=>p.id==='leo-lion-head')?restoreLeoLionHead(layout):structuredClone(layout);}
let expected:TiledMap|undefined;
export function preLeoNative(map:TiledMap):TiledMap{
 map=preHallBuildingsNative(map);
 if(!map.tilesets.some(s=>s.name==='leo-lion-head'))return structuredClone(map);
 const before=beforeLeoJson<TiledMap>('maps/overworld.tmj');expected??=reconcileLeoLionHead(before,applyLeoLionHead(beforeLeoJson<MapLayout>('world/layouts/overworld.json')),loadTileCatalog());
 assert.deepEqual(map,expected,'exact Leo ornament successor required');return before;
}
