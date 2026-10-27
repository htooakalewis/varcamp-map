import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {describe,it,expect} from 'vitest';
import {buildMap} from '../tools/maps/builder';
import {loadTileCatalog} from '../tools/art/catalog';
import {startPosition} from './helpers/pinned-start';
import type {MapLayout,TiledMap} from '../tools/maps/types';

const before=JSON.parse(gunzipSync(readFileSync('tests/fixtures/cafe-arrival/before.json.gz')).toString());
const old=JSON.parse(before.components['maps/campus-exploration.tmj']) as TiledMap;
const sources=()=>{
 const layout=JSON.parse(readFileSync('world/layouts/campus-exploration.json','utf8')) as MapLayout;
 return {authored:buildMap(layout,loadTileCatalog()).tmj,native:JSON.parse(readFileSync('maps/campus-exploration.tmj','utf8')) as TiledMap};
};
const southernArrival=[{x:752,y:1296},{x:784,y:1296},{x:752,y:1328},{x:784,y:1328}];
describe('Exploration Court default entry in the deployed client',()=>{
 it.each([undefined,'missing-entry'])('puts a fresh %s link at the southern welcome path',name=>{
  for(const [kind,map] of Object.entries(sources()))for(let i=0;i<4;i++)expect(startPosition(map,i,name),kind).toEqual(southernArrival[i]);
 });
 it('preserves all sixteen explicit return destinations',()=>{
  const names=old.layers.filter(l=>l.properties?.some(p=>p.name==='startLayer'&&p.value===true)).map(l=>l.name);
  expect(names).toHaveLength(16);
  for(const map of Object.values(sources()))for(const name of names)for(let i=0;i<4;i++)expect(startPosition(map,i,name),name).toEqual(startPosition(old,i,name));
 });
 it('reproduces the Fire doorway bug if the literal start alias is removed',()=>{
  for(const map of Object.values(sources())){
   map.layers=map.layers.filter(l=>l.name!=='start');
   expect(startPosition(map,0)).toEqual({x:240,y:400});
  }
 });
});
