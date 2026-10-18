import {buildMap} from './builder';
import {loadTileCatalog} from '../art/catalog';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import type {MapLayout,TiledMap} from './types';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
/** Binds a sparse, coast-following native animation to its one real source atlas. */
export function attachOrganicCoast(map:TiledMap,layout:MapLayout):void{
 if(layout.id!=='shipyard-beach'||!layout.placements.some(p=>p.sprite.startsWith('organic-coast-')))return;
 const art=JSON.parse(readFileSync('art/source/organic-coast.json','utf8')),atlas=map.tilesets.filter(t=>t.image==='../'+art.image);
 if(atlas.length!==1||sha(readFileSync(art.image))!==art.atlasSha256||art.inputs.some((p:any)=>sha(readFileSync(p.path))!==p.sha256))throw Error('Organic coast source/atlas changed; regenerate the native coast');
 const t=atlas[0];if(t.columns!==art.width/32||t.imagewidth!==art.width||t.imageheight!==art.height||t.tilecount!==art.width*art.height/1024)throw Error('Organic coast atlas geometry changed');
 t.properties=[{name:'tilesetCopyright',type:'string',value:art.attribution+' Combined atlas CC-BY-SA 3.0.'}];
 t.tiles=art.cells.map((c:any)=>({id:c.tile,animation:[0,1,2,3].map(f=>({tileid:c.tile+f,duration:art.frameMs})),properties:[{name:'collides',type:'bool',value:false}]}));
}
export function assertNativeOrganicCoast(map:TiledMap,layout:MapLayout):void{
 const identities=map.properties?.filter(p=>p.name==='worldMapId')??[],hasCoastAtlas=map.tilesets.some(t=>t.image==='../assets/tilesets/original/organic-coast.png');
 const currentCoast=layout.id==='shipyard-beach'||identities.some(p=>p.value==='shipyard-beach')||hasCoastAtlas;
 if(!currentCoast)return;
 if(layout.id!=='shipyard-beach'||identities.length!==1||identities[0].type!=='string'||identities[0].value!=='shipyard-beach')throw Error('Organic coast current map/layout identity changed');
 if(!layout.placements.some(p=>p.sprite.startsWith('organic-coast-')))throw Error('Organic coast current source cells are missing');
 const expected=structuredClone(map);attachOrganicCoast(expected,layout);
 const t=map.tilesets.find(t=>t.image==='../assets/tilesets/original/organic-coast.png')!,e=expected.tilesets.find(a=>a.firstgid===t.firstgid)!;
 if(!isDeepStrictEqual(t.tiles,e.tiles)||!isDeepStrictEqual(t.properties,e.properties))throw Error('Organic coast animation clock changed');
 const art=JSON.parse(readFileSync('art/source/organic-coast.json','utf8')),terrain=map.layers.find(l=>l.name==='terrain'),floor=map.layers.findIndex(l=>l.name==='floorLayer');
 const intended=buildMap(layout,loadTileCatalog()).tmj;
 const remap=(gid:number):number=>{if(!gid)return 0;const set=intended.tilesets.find(t=>gid>=t.firstgid&&gid<t.firstgid+t.tilecount!)!;const matches=map.tilesets.filter(t=>set.name==='navigation-mask'?t.name===set.name:t.image===set.image);if(matches.length!==1)throw Error('Organic coast native atlas binding changed');return matches[0].firstgid+gid-set.firstgid;};
 for(const name of ['terrain','physical-collisions']){const want=intended.layers.find(l=>l.name===name),actual=map.layers.find(l=>l.name===name);if(want?.type!=='tilelayer'||actual?.type!=='tilelayer'||!isDeepStrictEqual(actual.data,want.data.map(remap)))throw Error('Organic coast terrain/collision source changed');}
 if(!isDeepStrictEqual(map.tilesets.find(t=>t.name==='navigation-mask')?.tiles,intended.tilesets.find(t=>t.name==='navigation-mask')?.tiles))throw Error('Organic coast collision tile properties changed');
 if(terrain?.type!=='tilelayer'||map.layers.indexOf(terrain)>=floor||map.layers.some(l=>l.name.startsWith('beach-surf-')))throw Error('Organic coast must replace the old rectangular shore below avatars');
 for(const c of art.cells){const p=layout.placements.find(p=>p.layer==='terrain'&&p.x===c.x&&p.y===c.y);if(p?.sprite!==`organic-coast-${c.land?'land':'water'}-${c.tile}`)throw Error('Organic coast layout cell changed');const later=layout.placements.filter(p=>p.layer==='terrain'&&c.x>=p.x&&c.x<p.x+p.width&&c.y>=p.y&&c.y<p.y+p.height).at(-1)!;if(later.id===p.id&&terrain.data[c.y*map.width+c.x]!==t.firstgid+c.tile)throw Error('Organic coast native cell changed');}
}
