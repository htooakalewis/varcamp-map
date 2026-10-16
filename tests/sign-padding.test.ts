import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import type { MapLayout,ObjectLayer } from '../tools/maps/types';
function specimen(padding?:number){const l=JSON.parse(readFileSync('world/layouts/constellation-shore.json','utf8')) as MapLayout;l.signs=[{name:'padded-direction',text:'BEACH →',x:14,y:8,width:6,height:1,fontSize:18,...padding===undefined?{}:{padding}}];return l;}
const text=(l:MapLayout)=>(buildMap(l,loadTileCatalog()).tmj.layers.find(l=>l.name==='wayfinding-text') as ObjectLayer).objects[0];
describe('native sign text padding',()=>{
 it('insets the real Tiled text rectangle inside a sign, preserving the authored footprint',()=>{const s=text(specimen(4));expect([s.x,s.y,s.width,s.height]).toEqual([452,260,184,24]);expect(s.text).toMatchObject({text:'BEACH →',pixelsize:18});});
 it('keeps all existing unpadded text bytes and dimensions unchanged',()=>expect(text(specimen(0))).toEqual(text(specimen())));
 it.each([-1,0.5,NaN,Infinity,16,40])('rejects invalid or empty text-box padding %s before export',p=>expect(()=>text(specimen(p))).toThrow(/padding/i));
});
