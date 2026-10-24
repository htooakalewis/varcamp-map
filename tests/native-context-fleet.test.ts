import{beforeAll,expect,it}from'vitest';
import{readFileSync}from'node:fs';
import{isDeepStrictEqual}from'node:util';
import{buildMap}from'../tools/maps/builder';
import{assertNativeOwnershipContext,assertNativeAuthoringContext}from'../tools/maps/native-ownership-context';
import registered from'../art/source/native-ownership-context.json';
import type{TiledMap}from'../tools/maps/types';
const names=['plaza-fleet-camera','plaza-fleet-delivery','plaza-fleet-survey'];
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
let source:TiledMap,native:TiledMap,current:TiledMap;
beforeAll(()=>{
 // The fleet policy is pinned on the pre-expo closure: the hall's logo inlays, sticker decals and nameplate captions
 // (the expo reservation family admitted after the fleet) are left out of this source.
 const layout=read('world/layouts/overworld.json'),nameplate=(id:string)=>/^expo-[ns]\d-nameplate/.test(id);
 // The brand assets (the court fountain and the road lamps, admitted after the expo family) are left out too.
 layout.images=layout.images.filter((i:{name:string})=>!i.name.startsWith('Expo / '));layout.placements=layout.placements.filter((p:{id:string;sprite:string})=>!p.sprite.startsWith('sticker-')&&!nameplate(p.id)&&!['plaza-fountain','plaza-lamp'].includes(p.sprite));
 layout.signs=layout.signs.filter((s:{name:string})=>!nameplate(s.name));layout.standingSigns=layout.standingSigns.filter((s:{face:string})=>!nameplate(s.face));
 // ...and on the pre-roadster-v2 closure: the frozen sixteen-pose v1 roadster descriptor keeps the registered reservation in place.
 layout.animatedOverlays=layout.animatedOverlays.map((o:{name:string})=>o.name==='roadster'?read('art/source/roadster.json').overlay:o);
 source=buildMap(layout,read('art/tile-catalog.json')).tmj;
 native=read('maps/overworld.tmj');native.tilesets=structuredClone(registered.maps.overworld.atlases);
 current=structuredClone(native);let next=registered.maps.overworld.nextAtlasGid;
 for(const name of names){const set=source.tilesets.find(s=>s.name===name)!;current.tilesets.push({...structuredClone(set),firstgid:next});next+=set.tilecount!;}
});
it('current plaza admits exactly its three compiled fleet bodies after every immutable historical reservation',()=>{
 expect(()=>assertNativeOwnershipContext(current,source)).not.toThrow();expect(current.tilesets.slice(0,native.tilesets.length)).toEqual(native.tilesets);expect(current.tilesets.slice(-3).map(s=>s.firstgid)).toEqual([10914,11090,11330]);
});
it('author may enter exact historical or already-current reservations with the complete current source closure',()=>{
 expect(()=>assertNativeAuthoringContext(native,source)).not.toThrow();expect(()=>assertNativeAuthoringContext(current,source)).not.toThrow();
});
it.each(['missing-native','unknown-native','duplicate-native','native-body','native-gid','historical-body','historical-gid','native-order'])('rejects changed native reservations: %s',kind=>{
 const a=structuredClone(current);
 if(kind==='missing-native')a.tilesets.pop();if(kind==='unknown-native')a.tilesets.push({...a.tilesets.at(-1)!,name:'plaza-fleet-unowned',firstgid:999999});if(kind==='duplicate-native')a.tilesets.push(structuredClone(a.tilesets.at(-1)!));
 if(kind==='native-body')a.tilesets.at(-1)!.columns=15;if(kind==='native-gid')a.tilesets.at(-1)!.firstgid++;
 if(kind==='historical-body')a.tilesets[0].imagewidth!+=32;if(kind==='historical-gid')a.tilesets[0].firstgid++;
 if(kind==='native-order')a.tilesets.splice(a.tilesets.length-3,3,...a.tilesets.slice(-3).reverse());
 expect(()=>assertNativeOwnershipContext(a,source)).toThrow(/native context/i);
});
it.each(['missing','duplicate','unknown','image','geometry','order'])('current and historical-input author gates reject invalid source fleet closure: %s',kind=>{
 const s=structuredClone(source),set=s.tilesets.find(s=>s.name===names[0])!;
 if(kind==='missing')s.tilesets=s.tilesets.filter(t=>t!==set);if(kind==='duplicate')s.tilesets.push(structuredClone(set));if(kind==='unknown')set.name='plaza-fleet-unowned';if(kind==='image')set.image='../assets/tilesets/original/guides.png';if(kind==='geometry')set.columns=15;
 if(kind==='order'){const indices=names.map(n=>s.tilesets.findIndex(t=>t.name===n)),values=indices.map(i=>s.tilesets[i]).reverse();indices.forEach((n,i)=>s.tilesets[n]=values[i]);}
 expect(()=>assertNativeOwnershipContext(current,s)).toThrow(/native context/i);expect(()=>assertNativeAuthoringContext(native,s)).toThrow(/native context/i);
});
it('fleet closure cannot be selected by atlas name on another current map identity',()=>{
 const s=structuredClone(source),a=structuredClone(current);for(const m of [s,a])m.properties!.find(p=>p.name==='worldMapId')!.value='shipyard-beach';expect(()=>assertNativeOwnershipContext(a,s)).toThrow(/native context/i);
});
it('the independently registered ownership DATA is never rewritten to accept the new atlases',()=>{
 const actual=read('art/source/native-ownership-context.json');expect(isDeepStrictEqual(actual,registered)).toBe(true);expect(registered.maps.overworld.atlases.some(s=>names.includes(s.name))).toBe(false);
});
