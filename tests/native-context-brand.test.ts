import{beforeAll,expect,it}from'vitest';
import{readFileSync}from'node:fs';
import{isDeepStrictEqual}from'node:util';
import{buildMap}from'../tools/maps/builder';
import{loadTileCatalog}from'../tools/art/catalog';
import{reconcileNativeProjection}from'../tools/maps/native-projection';
import{assertNativeOwnershipContext,assertNativeAuthoringContext,BRAND_ATLASES,EXPO_MARKS}from'../tools/maps/native-ownership-context';
import{BRAND_ASSETS,brandAssetPlacements,isBrandAssets}from'../tools/maps/brand-assets';
import registered from'../art/source/native-ownership-context.json';
import{preRoadsterV2Layout,preRoadsterV2Native}from'./helpers/roadster-epoch';
import type{MapLayout,TiledMap,TiledTileset}from'../tools/maps/types';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const brandNames=Object.keys(BRAND_ATLASES),brandSprites=['plaza-fountain','plaza-lamp'];
const member=(t:TiledTileset)=>brandNames.includes(t.name??'')||Object.values(BRAND_ATLASES).some(a=>a.image===t.image);
const expoMark=(t:TiledTileset)=>Object.values(EXPO_MARKS).some(m=>m.name===t.name);
let catalog:ReturnType<typeof loadTileCatalog>,layout:MapLayout,current:TiledMap,source:TiledMap,preBrand:TiledMap,expoLayout:MapLayout,expoSource:TiledMap,brandNative:TiledMap;
beforeAll(()=>{
 // Pinned on the pre-roadster-v2 closure (the frozen v1 roadster descriptor and its registered reservation);
 // the later v2 epoch has its own policy in native-context-roadster-v2.test.ts.
 catalog=loadTileCatalog();layout=preRoadsterV2Layout(read('world/layouts/overworld.json'));current=preRoadsterV2Native(read('maps/overworld.tmj'));source=buildMap(layout,catalog).tmj;
 // The brand operation placed the court fountain and six road lamps. The policy scenario starts from the exact
 // pre-brand context (the complete expo-epoch native without the two brand atlases) and a source without the
 // brand placements, then admits both atlases synthetically after the caption atlas.
 preBrand=structuredClone(current);preBrand.tilesets=current.tilesets.filter(t=>!member(t));
 expoLayout=structuredClone(layout);expoLayout.placements=layout.placements.filter(p=>!brandSprites.includes(p.sprite));expoSource=buildMap(expoLayout,catalog).tmj;
 brandNative=structuredClone(preBrand);let next=Math.max(...preBrand.tilesets.map(t=>t.firstgid+t.tilecount!));
 for(const t of source.tilesets.filter(member)){const name=Object.entries(BRAND_ATLASES).find(([,a])=>a.image===t.image)![0];brandNative.tilesets.push({...structuredClone(t),firstgid:next,name});next+=t.tilecount!;}
});
it('the current plaza carries the brand family after the complete expo family from GID 11768',()=>{
 expect(()=>assertNativeOwnershipContext(current,source)).not.toThrow();
 expect(preBrand.tilesets).toHaveLength(81);expect(preBrand.tilesets.some(member)).toBe(false);expect(Math.max(...preBrand.tilesets.map(t=>t.firstgid+t.tilecount!))).toBe(11768);
 expect(preBrand.tilesets.at(-1)).toMatchObject({name:'standing-captions',firstgid:11704,tilecount:64});
 expect(current.tilesets).toHaveLength(83);expect(current.tilesets.slice(0,81)).toEqual(preBrand.tilesets);
 expect(current.tilesets.slice(81).map(t=>[t.name,t.firstgid,t.tilecount])).toEqual([['plaza-fountain',11768,12],['plaza-lamp',11780,3]]);
 for(const[name,atlas]of Object.entries(BRAND_ATLASES))expect(current.tilesets.find(t=>t.name===name)).toMatchObject({...atlas,tilewidth:32,tileheight:32});
 expect(brandNative.tilesets).toEqual(current.tilesets);
 expect(isBrandAssets(layout)).toBe(true);expect(layout.placements.filter(p=>brandSprites.includes(p.sprite))).toEqual(brandAssetPlacements());expect(BRAND_ASSETS.lampColumns).toEqual([62,65]);
});
it('admits exactly the registered brand family after the expo family, in source order, with its exact geometry',()=>{
 expect(()=>assertNativeOwnershipContext(brandNative,source)).not.toThrow();
 expect(()=>assertNativeOwnershipContext(preBrand,expoSource)).not.toThrow();
 expect(source.tilesets.filter(member).map(t=>t.image)).toEqual([BRAND_ATLASES['plaza-fountain'].image,BRAND_ATLASES['plaza-lamp'].image]);
 for(const t of source.tilesets.filter(member))expect(/^art-\d+$/.test(t.name!)).toBe(true);
});
it('the production author transaction admits both brand atlases from the exact pre-brand current plaza',()=>{
 const result=reconcileNativeProjection(preBrand,source);
 expect(result.tilesets).toEqual(current.tilesets);expect(result.layers.map(l=>l.name)).toEqual(current.layers.map(l=>l.name));
 expect(()=>assertNativeOwnershipContext(result,source)).not.toThrow();
 // The fountain's top row (spout and planter tops) is painted on an above-avatar plane, its basin rows on below-avatar planes.
 const fountain=result.tilesets.find(t=>t.name==='plaza-fountain')!,painted=(prefix:string,i:number,gid:number)=>result.layers.some(l=>l.type==='tilelayer'&&l.name.startsWith(prefix)&&l.data[i]===gid);
 const f=BRAND_ASSETS.fountain;for(let x=0;x<f.width;x++){expect(painted('scenery-aboveAvatar-',f.y*128+f.x+x,fountain.firstgid+x)).toBe(true);for(const y of [1,2])expect(painted('scenery-belowAvatar-',(f.y+y)*128+f.x+x,fountain.firstgid+y*f.width+x)).toBe(true);}
});
it('author may enter the exact pre-brand or the already-brand context, never a partial one or one placed before the expo family',()=>{
 expect(()=>assertNativeAuthoringContext(preBrand,source)).not.toThrow();
 expect(()=>assertNativeAuthoringContext(current,source)).not.toThrow();
 expect(()=>assertNativeAuthoringContext(preBrand,expoSource)).not.toThrow();
 expect(()=>assertNativeAuthoringContext(current,expoSource)).toThrow(/native context/i);// the brand atlases are not a closure of a source without them
 const partial=structuredClone(current);partial.tilesets.pop();expect(()=>assertNativeAuthoringContext(partial,source)).toThrow(/native context/i);
 const early=structuredClone(current);early.tilesets.splice(68,0,...early.tilesets.splice(81,2));expect(()=>assertNativeAuthoringContext(early,source)).toThrow(/native context/i);
});
it.each(['missing-member','extra-member','duplicate-member','member-gid','member-body','member-order','before-expo','renamed-member'])('rejects changed brand native reservations: %s',kind=>{
 const a=structuredClone(current),added=()=>a.tilesets.slice(81);
 if(kind==='missing-member')a.tilesets.pop();
 if(kind==='extra-member')a.tilesets.push({...structuredClone(added()[0]),name:'plaza-unowned',firstgid:999999});
 if(kind==='duplicate-member')a.tilesets.push({...structuredClone(added()[1]),firstgid:999999});
 if(kind==='member-gid')added()[1].firstgid++;
 if(kind==='member-body')added()[0].columns=3;
 if(kind==='member-order'){[a.tilesets[81],a.tilesets[82]]=[a.tilesets[82],a.tilesets[81]];}
 if(kind==='before-expo'){const brand=a.tilesets.splice(81);a.tilesets.splice(68,0,...brand);}
 if(kind==='renamed-member')added()[0].name='art-99';
 expect(()=>assertNativeOwnershipContext(a,source)).toThrow(/native context/i);
});
it.each(['duplicate-atlas','swapped-image','geometry','native-named','tiles','unregistered-image'])('current and author gates reject invalid brand source closure: %s',kind=>{
 const s=structuredClone(source),fountain=s.tilesets.find(t=>t.image===BRAND_ATLASES['plaza-fountain'].image)!,lamp=s.tilesets.find(t=>t.image===BRAND_ATLASES['plaza-lamp'].image)!;
 if(kind==='duplicate-atlas')s.tilesets.push({...structuredClone(lamp),name:'art-98',firstgid:999999});
 if(kind==='swapped-image')fountain.image=lamp.image;
 if(kind==='geometry'){fountain.columns=3;fountain.tilecount=9;fountain.imagewidth=96;}
 if(kind==='native-named')fountain.name='plaza-fountain';
 if(kind==='tiles')lamp.tiles=[{id:0,properties:[{name:'collides',type:'bool',value:false}]}];
 if(kind==='unregistered-image')lamp.image='../assets/tilesets/original/plaza-lantern.png';
 expect(()=>assertNativeOwnershipContext(current,s)).toThrow(/native context/i);
 // An atlas under an unregistered image is no family member: the pre-brand entry stays valid and the transaction's final gate rejects it.
 if(kind==='unregistered-image')expect(()=>reconcileNativeProjection(preBrand,s)).toThrow(/native context/i);
 else expect(()=>assertNativeAuthoringContext(preBrand,s)).toThrow(/native context/i);
});
it('brand closure cannot be selected on another current map identity',()=>{
 const s=structuredClone(source),a=structuredClone(current);for(const m of [s,a])m.properties!.find(p=>p.name==='worldMapId')!.value='shipyard-beach';
 expect(()=>assertNativeOwnershipContext(a,s)).toThrow(/native context/i);
 const beach=read('maps/shipyard-beach.tmj')as TiledMap,beachSource=buildMap(read('world/layouts/shipyard-beach.json'),catalog).tmj;
 beachSource.tilesets.push({...structuredClone(source.tilesets.find(t=>t.image===BRAND_ATLASES['plaza-lamp'].image)!),firstgid:Math.max(...beachSource.tilesets.map(t=>t.firstgid+t.tilecount!))});
 expect(()=>assertNativeOwnershipContext(beach,beachSource)).toThrow(/brand asset source atlas requires overworld identity/);
});
it('the expo family remains mandatory before any brand member',()=>{
 const s=structuredClone(source);s.tilesets=s.tilesets.filter(t=>!expoMark(t));
 expect(()=>assertNativeOwnershipContext(current,s)).toThrow(/native context/i);
 const a=structuredClone(current);a.tilesets=a.tilesets.filter(t=>!expoMark(t));
 expect(()=>assertNativeOwnershipContext(a,source)).toThrow(/native context/i);
});
it('the independently registered ownership DATA is never rewritten to accept the brand atlases',()=>{
 const actual=read('art/source/native-ownership-context.json');expect(isDeepStrictEqual(actual,registered)).toBe(true);
 for(const row of Object.values(registered.maps))for(const set of row.atlases){expect(brandNames).not.toContain(set.name);expect(Object.values(BRAND_ATLASES).map(a=>a.image)).not.toContain(set.image);}
 expect(brandNames).toEqual(['plaza-fountain','plaza-lamp']);
 expect(catalog['plaza-fountain']).toMatchObject({sheet:'assets/tilesets/original/plaza-fountain.png',rect:{x:0,y:0,width:4,height:3},upperCells:[[0,0],[1,0],[2,0],[3,0]],level:'belowAvatar',sourceId:'varcamp-organiser'});
 expect(catalog['plaza-lamp']).toMatchObject({sheet:'assets/tilesets/original/plaza-lamp.png',rect:{x:0,y:0,width:1,height:3},blockingCells:[[0,1],[0,2]],upperCells:[[0,0]],level:'belowAvatar',sourceId:'varcamp-organiser'});
});
