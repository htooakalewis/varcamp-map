import{beforeAll,expect,it}from'vitest';
import{readFileSync}from'node:fs';
import{isDeepStrictEqual}from'node:util';
import{buildMap}from'../tools/maps/builder';
import{loadTileCatalog}from'../tools/art/catalog';
import{reconcileNativeProjection}from'../tools/maps/native-projection';
import{assertNativeOwnershipContext,assertNativeAuthoringContext,EXPO_MARKS,EXPO_STICKER_ATLAS,EXPO_CAPTION_ATLAS}from'../tools/maps/native-ownership-context';
import{expoLogoImage,expoSticker,EXPO_MARK_IDS}from'../tools/maps/expo-fixtures';
import registered from'../art/source/native-ownership-context.json';
import type{MapLayout,TiledMap,TiledTileset}from'../tools/maps/types';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const fleetNames=['plaza-fleet-camera','plaza-fleet-delivery','plaza-fleet-survey'];
const markNames=EXPO_MARK_IDS.map(id=>EXPO_MARKS[id].name);
const member=(t:TiledTileset)=>markNames.includes(t.name??'')||t.image===EXPO_STICKER_ATLAS.image||t.image===EXPO_CAPTION_ATLAS.image;
/** Synthetic current caption atlas body: the ownership context judges tileset identity, not files. */
const captionAtlas=(firstgid:number):TiledTileset=>({firstgid,name:'standing-captions',tilewidth:32,tileheight:32,columns:16,tilecount:48,image:EXPO_CAPTION_ATLAS.image,imagewidth:512,imageheight:96,properties:[{name:'tilesetCopyright',type:'string',value:'Original VarCamp pixel glyph captions; CC0-1.0'},{name:'captionAtlasSha256',type:'string',value:'a'.repeat(64)}]});
let catalog:ReturnType<typeof loadTileCatalog>,layout:MapLayout,current:TiledMap,historical:TiledMap,source:TiledMap,expoLayout:MapLayout,expoSource:TiledMap,expoNative:TiledMap;
beforeAll(()=>{
 catalog=loadTileCatalog();layout=read('world/layouts/overworld.json');current=read('maps/overworld.tmj');source=buildMap(layout,catalog).tmj;
 historical=structuredClone(current);historical.tilesets=structuredClone(registered.maps.overworld.atlases);
 expoLayout=structuredClone(layout);expoLayout.images!.push(...EXPO_MARK_IDS.map((id,i)=>expoLogoImage(id,2+(i%6)*7,100+Math.floor(i/6)*3)));expoLayout.placements.push(expoSticker('expo-test-sticker','sticker-star',3,110));
 expoSource=buildMap(expoLayout,catalog).tmj;expoSource.tilesets.push(captionAtlas(Math.max(...expoSource.tilesets.map(t=>t.firstgid+t.tilecount!))));
 expoNative=structuredClone(current);let next=11602;
 for(const t of expoSource.tilesets.filter(member)){expoNative.tilesets.push({...structuredClone(t),firstgid:next,name:/^art-\d+$/.test(t.name!)?EXPO_STICKER_ATLAS.name:t.name});next+=t.tilecount!;}
});
it('the current plaza carries every registered and fleet reservation and no expo atlas yet',()=>{
 expect(()=>assertNativeOwnershipContext(current,source)).not.toThrow();
 expect(current.tilesets).toHaveLength(68);expect(Math.max(...current.tilesets.map(t=>t.firstgid+t.tilecount!))).toBe(11602);
 expect(current.tilesets.some(member)).toBe(false);expect(source.tilesets.some(member)).toBe(false);
});
it('admits exactly the registered expo family after the fleet, in source order, with its exact geometry',()=>{
 expect(()=>assertNativeOwnershipContext(expoNative,expoSource)).not.toThrow();
 expect(expoNative.tilesets.slice(0,68)).toEqual(current.tilesets);
 const added=expoNative.tilesets.slice(68);
 expect(added.map(t=>t.name)).toEqual(['booth-stickers',...markNames,'standing-captions']);
 expect(added.map(t=>t.firstgid)).toEqual([11602,11608,11620,11632,11640,11648,11656,11664,11672,11680,11688,11696,11704,11712]);
 expect(added[0]).toMatchObject({image:EXPO_STICKER_ATLAS.image,columns:6,tilecount:6,imagewidth:192,imageheight:32});
 for(const id of EXPO_MARK_IDS)expect(added.find(t=>t.name===EXPO_MARKS[id].name)).toMatchObject({image:`../assets/sponsors/${id}.png`,columns:EXPO_MARKS[id].columns,tilecount:EXPO_MARKS[id].columns*2,imagewidth:EXPO_MARKS[id].columns*32,imageheight:64,properties:[{name:'sponsorPanel',type:'bool',value:true},expect.anything()]});
 expect(added.at(-1)).toMatchObject({image:EXPO_CAPTION_ATLAS.image,columns:16,tilecount:48,imageheight:96});
});
it('the production author transaction admits the expo marks and sticker sheet from the exact pre-expo current plaza',()=>{
 const sourceWithoutCaptions=structuredClone(expoSource);sourceWithoutCaptions.tilesets.pop();
 const result=reconcileNativeProjection(current,sourceWithoutCaptions);
 expect(result.tilesets).toEqual(expoNative.tilesets.slice(0,-1));
 expect(result.layers.filter(l=>markNames.includes(l.name))).toHaveLength(12);
 expect(()=>assertNativeOwnershipContext(result,sourceWithoutCaptions)).not.toThrow();
});
it('author may enter the exact historical, the exact pre-expo current or the already-expo context, never a partial one',()=>{
 expect(()=>assertNativeAuthoringContext(historical,expoSource)).not.toThrow();
 expect(()=>assertNativeAuthoringContext(current,expoSource)).not.toThrow();
 expect(()=>assertNativeAuthoringContext(expoNative,expoSource)).not.toThrow();
 const partial=structuredClone(expoNative);partial.tilesets.pop();
 expect(()=>assertNativeAuthoringContext(partial,expoSource)).toThrow(/native context/i);
 const unfleeted=structuredClone(historical);unfleeted.tilesets.push(...expoNative.tilesets.slice(68));
 expect(()=>assertNativeAuthoringContext(unfleeted,expoSource)).toThrow(/native context/i);
});
it.each(['missing-member','extra-member','duplicate-member','member-gid','member-body','member-order','before-fleet','historical-gid'])('rejects changed expo native reservations: %s',kind=>{
 const a=structuredClone(expoNative),added=()=>a.tilesets.slice(68);
 if(kind==='missing-member')a.tilesets.splice(70,1);
 if(kind==='extra-member')a.tilesets.push({...structuredClone(added()[1]),name:'Expo / Unowned Mark',firstgid:999999});
 if(kind==='duplicate-member')a.tilesets.push({...structuredClone(added()[1]),firstgid:999999});
 if(kind==='member-gid')added()[3].firstgid++;
 if(kind==='member-body')added()[0].columns=3;
 if(kind==='member-order'){const i=69,j=70;[a.tilesets[i],a.tilesets[j]]=[a.tilesets[j],a.tilesets[i]];}
 if(kind==='before-fleet'){const expo=a.tilesets.splice(68);a.tilesets.splice(65,0,...expo);}
 if(kind==='historical-gid')a.tilesets[14].firstgid++;
 expect(()=>assertNativeOwnershipContext(a,expoSource)).toThrow(/native context/i);
});
it.each(['duplicate-mark','mark-image','mark-geometry','mark-panel-flag','renamed-mark','sticker-geometry','sticker-named','caption-height','caption-shared-image','caption-columns','caption-hash'])('current and author gates reject invalid expo source closure: %s',kind=>{
 const s=structuredClone(expoSource),mark=s.tilesets.find(t=>t.name===EXPO_MARKS['hub-01'].name)!,stickers=s.tilesets.find(t=>t.image===EXPO_STICKER_ATLAS.image)!,captions=s.tilesets.at(-1)!;
 if(kind==='duplicate-mark')s.tilesets.push({...structuredClone(mark),firstgid:999999});
 if(kind==='mark-image')mark.image='../assets/sponsors/hub-02.png';
 if(kind==='mark-geometry'){mark.columns=6;mark.tilecount=12;mark.imagewidth=192;}
 if(kind==='mark-panel-flag')mark.properties=mark.properties!.filter(p=>p.name!=='sponsorPanel');
 if(kind==='renamed-mark'){mark.name='Sponsors / Hub 01';const layer=s.layers.find(l=>l.name===EXPO_MARKS['hub-01'].name)!;layer.name=mark.name;}
 if(kind==='sticker-geometry'){stickers.imageheight=64;stickers.tilecount=12;}
 if(kind==='sticker-named')stickers.name='booth-stickers';
 if(kind==='caption-height'){captions.imageheight=224;captions.tilecount=112;}
 if(kind==='caption-shared-image')captions.image='../assets/tilesets/original/standing-captions.png';
 if(kind==='caption-columns'){captions.columns=8;captions.imagewidth=256;captions.tilecount=24;}
 if(kind==='caption-hash')captions.properties=captions.properties!.filter(p=>p.name!=='captionAtlasSha256');
 expect(()=>assertNativeOwnershipContext(expoNative,s)).toThrow(/native context/i);
 expect(()=>assertNativeAuthoringContext(current,s)).toThrow(/native context/i);
 expect(()=>assertNativeAuthoringContext(historical,s)).toThrow(/native context/i);
});
it('expo closure cannot be selected on another current map identity',()=>{
 const s=structuredClone(expoSource),a=structuredClone(expoNative);for(const m of [s,a])m.properties!.find(p=>p.name==='worldMapId')!.value='shipyard-beach';
 expect(()=>assertNativeOwnershipContext(a,s)).toThrow(/native context/i);
 const beach=read('maps/shipyard-beach.tmj')as TiledMap,beachSource=buildMap(read('world/layouts/shipyard-beach.json'),catalog).tmj;
 beachSource.tilesets.push({...structuredClone(expoSource.tilesets.find(t=>t.name===EXPO_MARKS['demo-04'].name)!),firstgid:Math.max(...beachSource.tilesets.map(t=>t.firstgid+t.tilecount!))});
 expect(()=>assertNativeOwnershipContext(beach,beachSource)).toThrow(/expo source atlas requires overworld identity/);
});
it('fleet closure remains mandatory before any expo member',()=>{
 const s=structuredClone(expoSource);s.tilesets=s.tilesets.filter(t=>!fleetNames.includes(t.name??''));
 expect(()=>assertNativeOwnershipContext(expoNative,s)).toThrow(/plaza fleet/i);
});
it('the independently registered ownership DATA is never rewritten to accept the expo atlases',()=>{
 const actual=read('art/source/native-ownership-context.json');expect(isDeepStrictEqual(actual,registered)).toBe(true);
 for(const row of Object.values(registered.maps))for(const set of row.atlases){expect(markNames).not.toContain(set.name);expect(set.name).not.toBe(EXPO_STICKER_ATLAS.name);expect(set.image).not.toBe(EXPO_STICKER_ATLAS.image);expect(set.image).not.toBe(EXPO_CAPTION_ATLAS.image);}
 expect(Object.keys(EXPO_MARKS)).toHaveLength(12);expect(Object.values(EXPO_MARKS).filter(m=>m.columns===6).map(m=>m.name)).toEqual(['Expo / Demo Orbit','Expo / Demo Atlas']);
});
