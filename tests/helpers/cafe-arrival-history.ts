import {mazeGateSuccessorSha,beforeMazeGateLayout,beforeMazeGateMap,beforeMazeGateCatalog} from './maze-gate-history';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import refresh from '../../art/source/cafe-arrival-refresh.json';
const raw=readFileSync('tests/fixtures/cafe-arrival/before.json.gz');
assert.equal(createHash('sha256').update(raw).digest('hex'),'e8386da25ccfbe8c253e477af5c2556476994657fd5f06f6e215729c6dcd907f');
const snapshot=JSON.parse(gunzipSync(raw).toString()),before=snapshot.components;
assert.equal(snapshot.base,'5f54780d9ba9f03edec466a5eed665a9a81531c6');
export function cafeArrivalSuccessorSha(path:string,pin:string):string{const t=JSON.parse(readFileSync('tests/fixtures/cafe-arrival/transitions.json','utf8'));assert.equal(t.base,snapshot.base);const pair=t.transitions[path];if(!pair||pair[0]!==pin)return mazeGateSuccessorSha(path,pin);assert.equal(pair[0],snapshot.pins[path]);return mazeGateSuccessorSha(path,pair[1]);}
/** Historical ambient assertions retain their original baseline. Only this
 * exact reviewed successor may be undone; current mutation tests check it too. */
export function beforeCafeArrivalLayout(input:any):any{
 input=beforeMazeGateLayout(input);
 const row=(refresh.maps as any)[input.id];if(!row)return input;
 const layout=structuredClone(input);delete layout.animatedOverlays;
 assert.deepEqual(layout,row.layoutAfter);
 const prior=JSON.parse(before[`world/layouts/${input.id}.json`]);
 assert.deepEqual((({animatedOverlays,...rest})=>rest)(prior),row.layoutBefore);
 prior.animatedOverlays=input.animatedOverlays;
 return prior;
}
export function beforeCafeArrivalMap(input:any):any{
 input=beforeMazeGateMap(input);
 const id=input.properties.find((p:any)=>p.name==='worldMapId').value,row=(refresh.maps as any)[id];if(!row)return input;
 const prior=JSON.parse(before[`maps/${id}.tmj`]),map=structuredClone(input);
 for(const change of row.layers){
  const at=map.layers.findIndex((l:any)=>l.name===change.after.name);assert.ok(at>=0);assert.deepEqual(map.layers[at],change.after);
  const old=prior.layers.find((l:any)=>l.name===change.after.name);
  if(change.beforeSha256===null){assert.equal(old,undefined);map.layers.splice(at,1);}
  else{assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),change.beforeSha256);map.layers[at]=old;}
 }
 return map;
}
export function advanceCafeArrivalLayout(input:any):any{
 let layout=structuredClone(input);const row=(refresh.maps as any)[layout.id];
 if(row){const old=structuredClone(layout);delete old.animatedOverlays;assert.deepEqual(old,row.layoutBefore);layout={...structuredClone(row.layoutAfter),animatedOverlays:layout.animatedOverlays};}
 for(const o of layout.animatedOverlays??[]){
  if(!o.name.startsWith('world-ambient-'))continue;
  if(o.name==='world-ambient-moon-cafe-steam-1'){assert.equal(o.y,10);o.y=9;}
  if(o.name==='world-ambient-moon-cafe-bubbles-2'){assert.equal(o.x,29);o.x=21;}
  const inputs=o.provenance.inputs,at=inputs.findIndex((p:any)=>p.path==='tools/maps/world-ambient-ownership.ts');assert.ok(at>=0);
  for(const p of ['tools/maps/cafe-arrival-context.ts','art/source/cafe-arrival-refresh.json'])assert.ok(!inputs.some((v:any)=>v.path===p));
  inputs.splice(at+1,0,...['tools/maps/cafe-arrival-context.ts','art/source/cafe-arrival-refresh.json'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})));
 }
 return layout;
}

/** The reviewed four café crops extend the catalog without changing any of its
 * original 1895 cells. Historical comparisons remove only these exact bodies. */
export function beforeCafeArrivalCatalog(input:any):any{
 input=beforeMazeGateCatalog(input);
 const catalog=structuredClone(input);
 for(const [name,x] of [['cafe-bar-left-end',5],['cafe-bar-span',6],['cafe-bar-right-end',7]] as const){
  assert.deepEqual(catalog[name],{sheet:'assets/tilesets/workadventure/WA_Tables.png',rect:{x,y:9,width:1,height:2},blockingCells:[[0,0],[0,1]],level:'belowAvatar',sourceId:'workadventure'});
  delete catalog[name];
 }
 assert.deepEqual(catalog['cafe-chair-cream'],{sheet:'assets/tilesets/workadventure/WA_Seats.png',rect:{x:8,y:12,width:1,height:1},blockingCells:[[0,0]],level:'belowAvatar',sourceId:'workadventure'});
 delete catalog['cafe-chair-cream'];
 assert.equal(createHash('sha256').update(JSON.stringify(catalog,null,2)+'\n').digest('hex'),snapshot.pins['art/tile-catalog.json']);
 return catalog;
}
