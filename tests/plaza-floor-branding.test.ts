import {expect,it} from 'vitest';
import {buildMap} from '../tools/maps/builder';
import {loadTileCatalog} from '../tools/art/catalog';
import type {MapLayout} from '../tools/maps/types';

function fixture(standing:boolean):MapLayout {
 return {
  id:'overworld',width:12,height:10,entries:[],exits:[],areas:[],inspectionZones:[],
  placements:standing?[{id:'fixture-support',sprite:'solid-sign-post',x:2,y:4,width:1,height:1,layer:'props'}]:[],
  images:[{name:'fixture-logo',image:'assets/sponsors/demo-01.png',x:2,y:3,width:6,height:2,standing}],
  standingSigns:standing?[{faceKind:'image',face:'fixture-logo',supports:['fixture-support']}]:[],
 };
}

it('keeps a walkable floor logo below the native avatar floor split',()=>{
 const map=buildMap(fixture(false),loadTileCatalog()).tmj;
 const floor=map.layers.findIndex(l=>l.name==='floorLayer'),logo=map.layers.findIndex(l=>l.name==='fixture-logo');
 expect(logo,'flat logo must be painted before the avatar floor boundary').toBeLessThan(floor);
 const layer=map.layers[logo];if(layer.type!=='tilelayer')throw Error('Floor logo must be native tiles');
 expect(layer.data.filter(Boolean)).toHaveLength(12);
 const mask=map.layers.find(l=>l.name==='physical-collisions');if(mask?.type!=='tilelayer')throw Error('Missing physical collision mask');
 for(let y=3;y<5;y++)for(let x=2;x<8;x++)expect(mask.data[y*12+x],`walkable logo ${x},${y}`).toBe(0);
});

it('retains an explicitly standing logo above avatars and its actual support collision',()=>{
 const map=buildMap(fixture(true),loadTileCatalog()).tmj;
 expect(map.layers.findIndex(l=>l.name==='fixture-logo')).toBeGreaterThan(map.layers.findIndex(l=>l.name==='floorLayer'));
 const mask=map.layers.find(l=>l.name==='physical-collisions');if(mask?.type!=='tilelayer')throw Error('Missing physical collision mask');
 expect(mask.data[4*12+2]).not.toBe(0);
});
