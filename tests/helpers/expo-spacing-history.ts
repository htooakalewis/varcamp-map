import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {applyExpoSpacing,reconcileExpoSpacing} from '../../tools/maps/expo-spacing';
import {advanceSpacingProvenance} from '../../tools/maps/expo-spacing-provenance';
import {loadTileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap,TileLayer} from '../../tools/maps/types';
import {preFountainLayout,preFountainNative,fountainSuccessorSha} from './fountain-motion-history';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
let saved:any;
export function beforeSpacing(){
 if(saved)return saved;
 const raw=readFileSync('tests/fixtures/expo-spacing/before.json.gz');
 assert.equal(sha(raw),'706626ed5b0d14a856f0f4bbff43187c4690569ac0904a114a9791964602a5eb');
 saved=JSON.parse(gunzipSync(raw).toString());assert.equal(saved.base,'1feca766409787dbfc5bc77407dc8da571bf2571');return saved;
}
export function beforeSpacingJson<T=any>(path:string):T{const r=beforeSpacing().components[path];assert.ok(r);assert.equal(sha(Buffer.from(r.raw)),r.sha256);const value=JSON.parse(r.raw);return path==='world/layouts/overworld.json'?advanceSpacingProvenance(value):value;}
export function spacingSuccessorSha(path:string,pin:string):string{
 const table=JSON.parse(readFileSync('tests/fixtures/expo-spacing/transitions.json','utf8'));assert.equal(table.base,beforeSpacing().base);
 const pair=table.transitions[path] as [string,string]|undefined;
 if(!pair||pair[0]!==pin)return fountainSuccessorSha(path,pin);assert.equal(pair[0],beforeSpacing().pins[path]);return fountainSuccessorSha(path,pair[1]);
}
export function preSpacingLayout(layout:MapLayout):MapLayout{
 layout=preFountainLayout(layout);
 if(!layout.placements.some(p=>p.id.startsWith('expo-spaced-')))return structuredClone(layout);
 const before=beforeSpacingJson<MapLayout>('world/layouts/overworld.json');
 assert.deepEqual(layout,applyExpoSpacing(before),'exact spacing successor required');return before;
}
let expected:TiledMap|undefined;
export function preSpacingNative(map:TiledMap):TiledMap{
 map=preFountainNative(map);
 const caption=map.layers.find(l=>l.name==='standing-caption-expo-n1-nameplate') as TileLayer|undefined;
 if(!caption?.data.slice(65*128,66*128).some(Boolean))return structuredClone(map);
 const before=beforeSpacingJson<TiledMap>('maps/overworld.tmj');
 expected??=reconcileExpoSpacing(before,applyExpoSpacing(beforeSpacingJson<MapLayout>('world/layouts/overworld.json')),loadTileCatalog());
 assert.deepEqual(map,expected,'exact native spacing successor required');return before;
}
