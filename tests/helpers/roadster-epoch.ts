/** The exact pre-roadster-v2 closure, derived from current state for the earlier epoch policy tests
 * (fleet, expo, brand, groves), which are pinned on the plaza as it stood before the roadster role
 * moved to its v2 motion atlas. tests/native-context-roadster-v2.test.ts proves the native inverse is
 * byte-identical to the genuine pre-v2 native, so this is a receipt-checked inverse, not a guess. */
import{readFileSync}from'node:fs';
import registered from'../../art/source/native-ownership-context.json';
import type{LayoutAnimatedOverlay,MapLayout,TiledMap,TiledTileset,TileLayer}from'../../tools/maps/types';
export const ROADSTER_V2_IMAGE='../assets/tilesets/original/roadster-v2.png';
/** Byte receipt of the genuine pre-v2 native (maps/overworld.tmj at 7f0edea, the brand epoch). */
export const PRE_ROADSTER_V2_NATIVE_SHA256='621073334271a2d11a0d9ac10666e89dfa0e5e74ed90991f6e9c89dc9ab998f9';
/** The frozen sixteen-pose v1 roadster descriptor: the role's pre-v2 source. */
export const roadsterV1Overlay=():LayoutAnimatedOverlay=>JSON.parse(readFileSync('art/source/roadster.json','utf8')).overlay;
/** The registered v1 `roadster` reservation and its slot in the registered atlas roster. */
export function registeredRoadster():{index:number;body:TiledTileset}{
 const atlases=registered.maps.overworld.atlases as unknown as TiledTileset[],index=atlases.findIndex(t=>t.name==='roadster');
 if(index<0)throw Error('Registered roadster reservation missing');return{index,body:structuredClone(atlases[index])};
}
/** The pre-v2 source: the current layout with the v1 descriptor in the roadster role. */
export function preRoadsterV2Layout(layout:MapLayout):MapLayout{
 const l=structuredClone(layout);if(!l.animatedOverlays?.some(o=>o.name==='roadster'))throw Error('Roadster role missing');
 l.animatedOverlays=l.animatedOverlays.map(o=>o.name==='roadster'?roadsterV1Overlay():o);return l;
}
/** The pre-v2 native: the v2 atlas removed, the registered v1 body restored at its registered slot
 * and the roadster layer pointing at the v1 carriers. Every other atlas, layer and id is untouched. */
export function preRoadsterV2Native(native:TiledMap):TiledMap{
 const m=structuredClone(native),{index,body}=registeredRoadster(),v2=m.tilesets.filter(t=>t.image===ROADSTER_V2_IMAGE);
 if(v2.length!==1||m.tilesets.some(t=>t.firstgid===body.firstgid))throw Error('Pre-v2 inverse needs exactly the current v2 epoch');
 m.tilesets=m.tilesets.filter(t=>t!==v2[0]);m.tilesets.splice(index,0,body);
 const layer=m.layers.find(l=>l.name==='roadster') as TileLayer|undefined,o=roadsterV1Overlay();if(!layer)throw Error('Roadster layer missing');
 for(let y=0;y<o.height;y++)for(let x=0;x<o.width;x++)layer.data[(o.y+y)*m.width+o.x+x]=body.firstgid+o.carrierTileIds[y*o.width+x];
 return m;
}
