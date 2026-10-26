import {readFileSync} from 'node:fs';
import {preCrescentLayout,preCrescentNative,crescentSuccessorSha} from './plaza-crescent-history';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {applyHallBuildings,reconcileHallBuildings,restoreHallBuildings} from '../../tools/maps/hall-buildings';
import {loadTileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap} from '../../tools/maps/types';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
let saved:any;
export function beforeHallBuildings(){if(saved)return saved;const b=readFileSync('tests/fixtures/hall-buildings/before.json.gz');assert.equal(sha(b),'69e8caf250b6d9beec8bcf8726ac85787de0eba73fed5866994fab589b143497');saved=JSON.parse(gunzipSync(b).toString());assert.equal(saved.base,'a117126d20cbc9b43ac89a5907ed9dee38cc7e4d');return saved;}
export function beforeHallBuildingsJson<T=any>(path:string):T{const row=beforeHallBuildings().components[path];assert.ok(row);assert.equal(sha(Buffer.from(row.raw)),row.sha256);return JSON.parse(row.raw);}
export function hallBuildingsSuccessorSha(path:string,pin:string):string{const table=JSON.parse(readFileSync('tests/fixtures/hall-buildings/transitions.json','utf8'));assert.equal(table.base,beforeHallBuildings().base);const pair=table.transitions[path] as [string,string]|undefined;if(!pair||pair[0]!==pin)return crescentSuccessorSha(path,pin);assert.equal(pair[0],beforeHallBuildings().pins[path]);return crescentSuccessorSha(path,pair[1]);}
export function preHallBuildingsLayout(layout:MapLayout):MapLayout{layout=preCrescentLayout(layout);return layout.placements.some(p=>p.sprite.startsWith('hall-building-'))?restoreHallBuildings(layout):structuredClone(layout);}
let expected:TiledMap|undefined;
export function preHallBuildingsNative(map:TiledMap):TiledMap{
 map=preCrescentNative(map);
 if(!map.tilesets.some(s=>s.name==='hall-buildings'))return structuredClone(map);
 const before=beforeHallBuildingsJson<TiledMap>('maps/overworld.tmj');expected??=reconcileHallBuildings(before,applyHallBuildings(beforeHallBuildingsJson<MapLayout>('world/layouts/overworld.json')),loadTileCatalog());
 assert.deepEqual(map,expected,'exact enclosed-hall and ground-name successor required');return before;
}
