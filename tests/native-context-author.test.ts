import{readFileSync}from'node:fs';
import{isDeepStrictEqual}from'node:util';
import{createHash}from'node:crypto';
import{expect,it}from'vitest';
import{loadTileCatalog}from'../tools/art/catalog';
import{buildMap}from'../tools/maps/builder';
import{attachOrganicCoast}from'../tools/maps/organic-coast';
import{reconcileNativeProjection}from'../tools/maps/native-projection';
import{authorWorldAmbientMap}from'../tools/maps/author-world-ambient';
import type{MapLayout,TiledMap,ObjectLayer}from'../tools/maps/types';
import context from'../art/source/native-ownership-context.json';
const read=<T>(p:string):T=>JSON.parse(readFileSync(p,'utf8'))as T;
for(const id of ['shipyard-beach','constellation-shore','overworld']){
 const input=()=>{const map=read<TiledMap>(`maps/${id}.tmj`),layout=read<MapLayout>(`world/layouts/${id}.json`),source=buildMap(layout,loadTileCatalog()).tmj;if(id!=='overworld')attachOrganicCoast(source,layout);return{map,source};};
 it(`${id}: explicit author transaction accepts the actual valid current context without mutating input`,()=>{const{map,source}=input(),before=structuredClone(map);expect(isDeepStrictEqual(reconcileNativeProjection(map,source),map)).toBe(true);expect(isDeepStrictEqual(map,before)).toBe(true);});
 for(const kind of ['unused-body','protected-text','protected-order'])it(`${id}: author refuses ${kind} input instead of carrying it into a new epoch`,()=>{const{map,source}=input();if(kind==='unused-body')map.tilesets.find(t=>t.name===(id==='overworld'?'art-12':id==='shipyard-beach'?'beach-surf-north':'art-1'))!.properties=[{name:'unowned',type:'bool',value:true}];if(kind==='protected-text')(map.layers.find(l=>l.name==='wayfinding-text')as ObjectLayer).objects.push({id:99990,name:'unowned-native-text',x:0,y:0,width:128,height:32,text:{text:'INJECTED',pixelsize:32},visible:true});if(kind==='protected-order'){const a=map.layers.findIndex(l=>l.name==='wayfinding-text'),b=map.layers.findIndex(l=>l.name==='inspection-zones');[map.layers[a],map.layers[b]]=[map.layers[b],map.layers[a]];}const before=structuredClone(map);expect(()=>reconcileNativeProjection(map,source)).toThrow(/Native context/);expect(map).toEqual(before);});
}
it('the finite author migration accepts genuine pre-epoch comet input but refuses an unowned appended atlas',()=>{
 const raw=readFileSync('tests/fixtures/native-context/comet-maze-pre-epoch.tmj');expect(createHash('sha256').update(raw).digest('hex')).toBe(context.maps['comet-maze'].source.sha256);expect(raw.length).toBe(context.maps['comet-maze'].source.bytes);
 const old=JSON.parse(raw.toString())as TiledMap,layout=read<MapLayout>('world/layouts/comet-maze.json'),catalog=loadTileCatalog(),before=structuredClone(old);
 const current=authorWorldAmbientMap(old,layout,catalog).map;expect(isDeepStrictEqual(current,read('maps/comet-maze.tmj'))).toBe(true);expect(isDeepStrictEqual(old,before)).toBe(true);
 old.tilesets.push({name:'unowned-migration-atlas',firstgid:Math.max(...old.tilesets.map(t=>t.firstgid+t.tilecount!))+100,image:'../assets/tilesets/original/guides.png',tilewidth:32,tileheight:32,imagewidth:32,imageheight:32,columns:1,tilecount:1});
 expect(()=>authorWorldAmbientMap(old,layout,catalog)).toThrow(/Native context/);
});
