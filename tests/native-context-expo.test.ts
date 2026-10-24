import{beforeAll,expect,it}from'vitest';
import{readFileSync}from'node:fs';
import{isDeepStrictEqual}from'node:util';
import{buildMap}from'../tools/maps/builder';
import{loadTileCatalog}from'../tools/art/catalog';
import{reconcileNativeProjection}from'../tools/maps/native-projection';
import{assertNativeOwnershipContext,assertNativeAuthoringContext,EXPO_MARKS,EXPO_STICKER_ATLAS,EXPO_CAPTION_ATLAS,BRAND_ATLASES}from'../tools/maps/native-ownership-context';
import{expoLogoImage,expoSticker,EXPO_MARK_IDS}from'../tools/maps/expo-fixtures';
import registered from'../art/source/native-ownership-context.json';
import{preRoadsterV2Layout,preRoadsterV2Native}from'./helpers/roadster-epoch';
import type{MapLayout,TiledMap,TiledTileset,TileLayer}from'../tools/maps/types';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const fleetNames=['plaza-fleet-camera','plaza-fleet-delivery','plaza-fleet-survey'];
const markNames=EXPO_MARK_IDS.map(id=>EXPO_MARKS[id].name);
const member=(t:TiledTileset)=>markNames.includes(t.name??'')||t.image===EXPO_STICKER_ATLAS.image||t.image===EXPO_CAPTION_ATLAS.image;
const nameplate=(id:string)=>/^expo-[ns]\d-nameplate/.test(id);
// The brand family (court fountain, road lamps) is admitted after the expo family; this policy scenario leaves it out.
const brand=(t:TiledTileset)=>Object.values(BRAND_ATLASES).some(a=>a.image===t.image),brandSprites=['plaza-fountain','plaza-lamp'];
let catalog:ReturnType<typeof loadTileCatalog>,layout:MapLayout,current:TiledMap,historical:TiledMap,source:TiledMap,pre:TiledMap,expoLayout:MapLayout,expoSource:TiledMap,expoNative:TiledMap;
beforeAll(()=>{
 // Pinned on the pre-roadster-v2 closure (the frozen v1 roadster descriptor and its registered reservation);
 // the later v2 epoch has its own policy in native-context-roadster-v2.test.ts.
 catalog=loadTileCatalog();layout=preRoadsterV2Layout(read('world/layouts/overworld.json'));current=preRoadsterV2Native(read('maps/overworld.tmj'));source=buildMap(layout,catalog).tmj;
 historical=structuredClone(current);historical.tilesets=structuredClone(registered.maps.overworld.atlases);
 // The expo hall placed eleven marks, the sticker sheet and the caption atlas. The policy scenario below
 // starts from the exact pre-expo context (registered + fleet, no member, no brand atlas, no hall panel/caption
 // layer) and a source without the hall's expo entries or brand assets, then admits all sixteen marks synthetically.
 const hallLayers=new Set([...layout.images!.filter(i=>markNames.includes(i.name)).map(i=>i.name),...(layout.standingSigns??[]).filter(s=>nameplate(s.face)).map(s=>'standing-caption-'+s.text)]);
 pre=structuredClone(current);pre.tilesets=current.tilesets.filter(t=>!member(t)&&!brand(t));pre.layers=current.layers.filter(l=>!hallLayers.has(l.name));
 // The invisible collision mask is not a painted layer the transaction rebuilds, so the brand bases are cleared from the pre-expo native too.
 const mask=pre.layers.find(l=>l.name==='physical-collisions') as TileLayer;for(const p of layout.placements.filter(p=>brandSprites.includes(p.sprite)))for(const [cx,cy] of catalog[p.sprite].blockingCells)mask.data[(p.y+cy)*128+p.x+cx]=0;
 // The twelve hall nameplates stay linked (their fascia posts are part of the collision mask the
 // pre-expo native keeps), so the source carries the real overworld caption atlas as its last tileset.
 expoLayout=structuredClone(layout);expoLayout.images=layout.images!.filter(i=>!markNames.includes(i.name));expoLayout.placements=layout.placements.filter(p=>!p.sprite.startsWith('sticker-')&&!brandSprites.includes(p.sprite));
 expoLayout.images.push(...EXPO_MARK_IDS.map((id,i)=>expoLogoImage(id,2+(i%6)*7,100+Math.floor(i/6)*3)));expoLayout.placements.push(expoSticker('expo-test-sticker','sticker-star',3,110));
 expoSource=buildMap(expoLayout,catalog).tmj;expect(expoSource.tilesets.at(-1)).toMatchObject({name:'standing-captions',image:EXPO_CAPTION_ATLAS.image,tilecount:64,imageheight:128});
 expoNative=structuredClone(pre);let next=11602;
 for(const t of expoSource.tilesets.filter(member)){expoNative.tilesets.push({...structuredClone(t),firstgid:next,name:/^art-\d+$/.test(t.name!)?EXPO_STICKER_ATLAS.name:t.name});next+=t.tilecount!;}
});
it('the current plaza carries every registered and fleet reservation and, after them, the expo hall family from GID 11602',()=>{
 expect(()=>assertNativeOwnershipContext(current,source)).not.toThrow();
 expect(pre.tilesets).toHaveLength(68);expect(Math.max(...pre.tilesets.map(t=>t.firstgid+t.tilecount!))).toBe(11602);expect(pre.tilesets.some(member)).toBe(false);
 expect(current.tilesets).toHaveLength(83);expect(current.tilesets.slice(0,68)).toEqual(pre.tilesets);expect(current.tilesets[68].firstgid).toBe(11602);
 const hallMarks=layout.images!.filter(i=>markNames.includes(i.name)).map(i=>i.name);expect(hallMarks).toHaveLength(11);
 expect(current.tilesets.slice(68).map(t=>t.name)).toEqual(['booth-stickers',...hallMarks,'standing-captions',...Object.keys(BRAND_ATLASES)]);
 expect(current.tilesets[68+1+hallMarks.length]).toMatchObject({image:EXPO_CAPTION_ATLAS.image,columns:16,imagewidth:512});
 expect(expoSource.tilesets.filter(member)).toHaveLength(18);
});
it('admits exactly the registered expo family after the fleet, in source order, with its exact geometry',()=>{
 expect(()=>assertNativeOwnershipContext(expoNative,expoSource)).not.toThrow();
 expect(expoNative.tilesets.slice(0,68)).toEqual(pre.tilesets);
 const added=expoNative.tilesets.slice(68);
 expect(added.map(t=>t.name)).toEqual(['booth-stickers',...markNames,'standing-captions']);
 expect(added.map(t=>t.firstgid)).toEqual([11602,11608,11620,11632,11640,11648,11656,11664,11672,11680,11688,11696,11704,11712,11720,11728,11736,11744]);
 expect(added[0]).toMatchObject({image:EXPO_STICKER_ATLAS.image,columns:6,tilecount:6,imagewidth:192,imageheight:32});
 for(const id of EXPO_MARK_IDS)expect(added.find(t=>t.name===EXPO_MARKS[id].name)).toMatchObject({image:`../assets/sponsors/${id}.png`,columns:EXPO_MARKS[id].columns,tilecount:EXPO_MARKS[id].columns*2,imagewidth:EXPO_MARKS[id].columns*32,imageheight:64,properties:[{name:'sponsorPanel',type:'bool',value:true},expect.anything()]});
 expect(added.at(-1)).toMatchObject({image:EXPO_CAPTION_ATLAS.image,columns:16,tilecount:64,imageheight:128});
});
it('the production author transaction admits the expo marks and sticker sheet from the exact pre-expo current plaza',()=>{
 const sourceWithoutCaptions=structuredClone(expoSource);sourceWithoutCaptions.tilesets.pop();sourceWithoutCaptions.layers=sourceWithoutCaptions.layers.filter(l=>!l.name.startsWith('standing-caption-'));
 const result=reconcileNativeProjection(pre,sourceWithoutCaptions);
 expect(result.tilesets).toEqual(expoNative.tilesets.slice(0,-1));
 expect(result.layers.filter(l=>markNames.includes(l.name))).toHaveLength(16);
 expect(()=>assertNativeOwnershipContext(result,sourceWithoutCaptions)).not.toThrow();
});
it('author may enter the exact historical, the exact pre-expo current or the already-expo context, never a partial one',()=>{
 expect(()=>assertNativeAuthoringContext(historical,expoSource)).not.toThrow();
 expect(()=>assertNativeAuthoringContext(pre,expoSource)).not.toThrow();
 expect(()=>assertNativeAuthoringContext(expoNative,expoSource)).not.toThrow();
 expect(()=>assertNativeAuthoringContext(current,source)).not.toThrow();
 expect(()=>assertNativeAuthoringContext(current,expoSource)).toThrow(/native context/i);// the hall context (eleven marks plus the brand family) is not the sixteen-mark closure
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
 expect(()=>assertNativeAuthoringContext(pre,s)).toThrow(/native context/i);
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
 expect(Object.keys(EXPO_MARKS)).toHaveLength(16);expect(Object.values(EXPO_MARKS).filter(m=>m.columns===6).map(m=>m.name)).toEqual(['Expo / Demo Orbit','Expo / Demo Atlas']);
});
