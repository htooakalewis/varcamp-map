import{beforeAll,expect,it}from'vitest';
import{readFileSync}from'node:fs';
import{gunzipSync}from'node:zlib';
import{createHash}from'node:crypto';
import{isDeepStrictEqual}from'node:util';
import{buildMap}from'../tools/maps/builder';
import{loadTileCatalog}from'../tools/art/catalog';
import{reconcileNativeProjection,assertNativeSourceProjection}from'../tools/maps/native-projection';
import{assertNativeOwnershipContext,assertNativeAuthoringContext,ROADSTER_V2_ATLAS,BRAND_ATLASES,isRoadsterV2}from'../tools/maps/native-ownership-context';
import{PRE_ROADSTER_V2_NATIVE_SHA256,preRoadsterV2Layout,preRoadsterV2Native,registeredRoadster}from'./helpers/roadster-epoch';
import registered from'../art/source/native-ownership-context.json';
import {preZodiacLayout,preZodiacNative} from './helpers/pre-zodiac-epoch';
import type{MapLayout,TiledMap,TileLayer}from'../tools/maps/types';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const sha=(b:string)=>createHash('sha256').update(b).digest('hex');
const fleetNames=['plaza-fleet-camera','plaza-fleet-delivery','plaza-fleet-survey'];
const brand=(t:{image?:string})=>Object.values(BRAND_ATLASES).some(a=>a.image===t.image);
const V1={firstgid:4330,tilecount:240,image:'../assets/tilesets/original/roadster.png'};
const V2_GID=11783;// after the brand family (plaza-lamp 11780+3)
let catalog:ReturnType<typeof loadTileCatalog>,layout:MapLayout,current:TiledMap,historical:TiledMap,source:TiledMap,v1Source:TiledMap,preExpo:TiledMap,preBrand:TiledMap,preV2:TiledMap;
beforeAll(()=>{
 catalog=loadTileCatalog();layout=preZodiacLayout(read('world/layouts/overworld.json'));current=preZodiacNative(read('maps/overworld.tmj'));source=buildMap(layout,catalog).tmj;
 // The frozen v1 epoch is still a maintained producer output, so a source carrying the sixteen-pose
 // descriptor remains buildable; it is the pre-v2 closure every earlier context test pins on.
 v1Source=buildMap(preRoadsterV2Layout(layout),catalog).tmj;
 historical=structuredClone(current);historical.tilesets=structuredClone(registered.maps.overworld.atlases);
 preV2=preRoadsterV2Native(current);
 preBrand=structuredClone(preV2);preBrand.tilesets=preV2.tilesets.filter(t=>!brand(t));
 preExpo=structuredClone(preV2);preExpo.tilesets=preV2.tilesets.slice(0,registered.maps.overworld.atlases.length+fleetNames.length);
});
it('inverts the genuine pre-booth v2 transaction to the byte-identical brand-epoch plaza',()=>{
 const raw=gunzipSync(readFileSync('tests/fixtures/expo-booths/before-native.tmj.gz'));
 expect(sha(raw.toString())).toBe('f7db4ebeb3ea0afc1f99764e365bc4719552204345d3c72d8c32dd568072089c');
 expect(sha(JSON.stringify(preRoadsterV2Native(JSON.parse(raw.toString())))+'\n')).toBe(PRE_ROADSTER_V2_NATIVE_SHA256);
 expect(registeredRoadster()).toMatchObject({index:17,body:{name:'roadster',...V1}});
});
it('the current plaza vacates the registered v1 roadster interval and carries the v2 body after the brand family from GID 11783',()=>{
 expect(()=>assertNativeOwnershipContext(current,source)).not.toThrow();
 expect(current.tilesets).toHaveLength(83);expect(current.tilesets.filter(t=>t.name==='roadster')).toHaveLength(1);
 expect(current.tilesets.some(t=>t.firstgid===V1.firstgid||t.image===V1.image)).toBe(false);
 expect(current.tilesets.slice(0,-1)).toEqual(preV2.tilesets.filter(t=>t.name!=='roadster'));
 expect(current.tilesets.slice(-3,-1).map(t=>t.name)).toEqual(Object.keys(BRAND_ATLASES));
 const v2=current.tilesets.at(-1)!;expect(v2).toMatchObject({name:'roadster',image:ROADSTER_V2_ATLAS.image,firstgid:V2_GID,columns:16,imagewidth:512});
 expect(v2.tilecount).toBeGreaterThan(V1.tilecount);expect(v2.tilecount).toBeLessThanOrEqual(1024);expect(v2.imageheight).toBe(v2.tilecount!/16*32);expect(v2.tiles).toHaveLength(25);
 expect(Math.max(...preV2.tilesets.map(t=>t.firstgid+t.tilecount!))).toBe(V2_GID);
 expect(preV2.tilesets).toHaveLength(83);expect(preV2.tilesets.find(t=>t.name==='roadster')).toMatchObject(V1);
 expect(()=>assertNativeOwnershipContext(preV2,v1Source)).not.toThrow();
});
it('the production author transaction moves the roadster role to v2 from the exact pre-v2 current plaza',()=>{
 const result=reconcileNativeProjection(preV2,source);
 expect(result.layers.map(l=>[l.id,l.name])).toEqual(preV2.layers.map(l=>[l.id,l.name]));expect(result.nextlayerid).toBe(preV2.nextlayerid);
 const before=preV2.layers.find(l=>l.name==='roadster') as TileLayer,after=result.layers.find(l=>l.name==='roadster') as TileLayer,cells=(l:TileLayer)=>l.data.flatMap((g,i)=>g?[i]:[]);
 expect(cells(after)).toEqual(cells(before));expect(cells(after)).toHaveLength(25);
 for(const g of after.data)if(g)expect(g).toBeGreaterThanOrEqual(V2_GID);
 expect(()=>assertNativeSourceProjection(result,source)).not.toThrow();
 expect(isDeepStrictEqual(result,current)).toBe(true);
});
it('author may enter the exact historical, pre-expo, pre-brand, pre-v2 or already-v2 context, never a partial one',()=>{
 for(const entry of [historical,preExpo,preBrand,preV2,current])expect(()=>assertNativeAuthoringContext(entry,source)).not.toThrow();
 expect(()=>assertNativeAuthoringContext(current,v1Source)).toThrow(/native context/i);// a v2 native cannot author a v1 source
 const both=structuredClone(current);both.tilesets.splice(17,0,{...registeredRoadster().body,name:'roadster-v1'});
 expect(()=>assertNativeAuthoringContext(both,source)).toThrow(/native context/i);
 const partial=structuredClone(current);partial.tilesets.pop();
 expect(()=>assertNativeAuthoringContext(partial,source)).toThrow(/native context/i);
 const early=structuredClone(preBrand);early.tilesets.splice(17,1);early.tilesets.push(structuredClone(current.tilesets.at(-1)!));
 expect(()=>assertNativeAuthoringContext(early,source)).toThrow(/native context/i);// v2 before the brand family
});
it.each(['missing-v2','v1-retained','v1-and-v2','v2-gid','v2-body','v2-before-expo','v2-before-brand','v2-renamed','historical-gid'])('rejects changed roadster-v2 native reservations: %s',kind=>{
 const a=structuredClone(current),v2=a.tilesets.at(-1)!,v1=registeredRoadster().body;
 if(kind==='missing-v2')a.tilesets.pop();
 if(kind==='v1-retained'){a.tilesets.pop();a.tilesets.splice(17,0,v1);}
 if(kind==='v1-and-v2')a.tilesets.splice(17,0,{...v1,name:'roadster-v1'});
 if(kind==='v2-gid')v2.firstgid++;
 if(kind==='v2-body')v2.columns=15;
 if(kind==='v2-before-expo'){a.tilesets.pop();a.tilesets.splice(67,0,v2);}
 if(kind==='v2-before-brand'){a.tilesets.pop();a.tilesets.splice(a.tilesets.length-2,0,v2);}
 if(kind==='v2-renamed')v2.name='roadster-v2';
 if(kind==='historical-gid')a.tilesets[14].firstgid++;
 expect(()=>assertNativeOwnershipContext(a,source)).toThrow(/native context/i);
});
it.each(['duplicate','image','columns','height','tilecount','carriers','no-animation','margin'])('current and author gates reject invalid roadster-v2 source closure: %s',kind=>{
 const s=structuredClone(source),set=s.tilesets.find(isRoadsterV2)!;
 if(kind==='duplicate')s.tilesets.push({...structuredClone(set),firstgid:999999});
 if(kind==='image')set.image='../assets/tilesets/original/roadster-v3.png';
 if(kind==='columns'){set.columns=32;set.imagewidth=1024;set.imageheight=set.imageheight!/2;}
 if(kind==='height'){set.imageheight=2080;set.tilecount=1040;}
 if(kind==='tilecount')set.tilecount!--;
 if(kind==='carriers')set.tiles!.pop();
 if(kind==='no-animation')delete set.tiles![0].animation;
 if(kind==='margin')set.margin=1;
 expect(()=>assertNativeOwnershipContext(current,s)).toThrow(/native context/i);
 expect(()=>assertNativeAuthoringContext(preV2,s)).toThrow(/native context/i);
 expect(()=>assertNativeAuthoringContext(historical,s)).toThrow(/native context/i);
});
it('a v1 and a v2 roadster in one source are ambiguous, and v2 cannot be selected on another current map identity',()=>{
 const twin=structuredClone(source);twin.tilesets.push({...structuredClone(v1Source.tilesets.find(t=>t.name==='roadster')!),firstgid:999999});
 expect(()=>assertNativeOwnershipContext(current,twin)).toThrow(/native context/i);
 const s=structuredClone(source),a=structuredClone(current);for(const m of [s,a])m.properties!.find(p=>p.name==='worldMapId')!.value='shipyard-beach';
 expect(()=>assertNativeOwnershipContext(a,s)).toThrow(/native context/i);
 const beach=read('maps/shipyard-beach.tmj')as TiledMap,beachSource=buildMap(read('world/layouts/shipyard-beach.json'),catalog).tmj;
 beachSource.tilesets.push({...structuredClone(source.tilesets.find(isRoadsterV2)!),firstgid:Math.max(...beachSource.tilesets.map(t=>t.firstgid+t.tilecount!))});
 expect(()=>assertNativeOwnershipContext(beach,beachSource)).toThrow(/roadster-v2 source atlas requires overworld identity/);
});
it('the v2 epoch needs the whole expo and brand families before it',()=>{
 const noExpo=structuredClone(source);noExpo.tilesets=noExpo.tilesets.filter(t=>t.image!=='../assets/tilesets/original/booth-stickers.png');
 expect(()=>assertNativeOwnershipContext(current,noExpo)).toThrow(/native context/i);
 const noBrand=structuredClone(source);noBrand.tilesets=noBrand.tilesets.filter(t=>!brand(t));
 expect(()=>assertNativeOwnershipContext(current,noBrand)).toThrow(/native context/i);
});
it('the independently registered ownership DATA keeps the v1 roadster reservation and never names the v2 atlas',()=>{
 const actual=read('art/source/native-ownership-context.json');expect(isDeepStrictEqual(actual,registered)).toBe(true);
 expect(registered.maps.overworld.atlases.filter(t=>t.name==='roadster')).toHaveLength(1);
 expect(registered.maps.overworld.atlases.find(t=>t.name==='roadster')).toMatchObject(V1);
 for(const row of Object.values(registered.maps))for(const set of row.atlases)expect(set.image).not.toBe(ROADSTER_V2_ATLAS.image);
 expect(ROADSTER_V2_ATLAS.vacates).toEqual({name:'roadster',...V1});
});
