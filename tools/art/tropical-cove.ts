import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {renderCoast} from './coast-raster';
import cove from '../../world/tropical-cove.json';
import {isDeepStrictEqual} from 'node:util';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export const COVE_IMAGE='assets/tilesets/original/tropical-cove-coast.png';
/** A new native export; the earlier coast and all licensed source pixels stay intact. */
export async function renderTropicalCove(){
 const art=await renderCoast(cove.coast,{width:48,height:48,prefix:'tropical-cove',groundPrefix:'organic-ground',image:COVE_IMAGE});
 // The original flight band keeps its original coast tiles and clock. New
 // sprite identities leave every earlier catalog row available to old scenes.
 const legacy=JSON.parse(readFileSync('art/source/organic-coast.json','utf8'));
 for(const p of art.ground)if(p.y>=5&&p.y<=7){const edge=legacy.cells.find((c:{x:number;y:number})=>c.x===p.x&&c.y===p.y);if(edge)p.sprite=`organic-coast-${edge.land?'land':'water'}-${edge.tile}`;}
 return{...art,edges:art.edges.filter(c=>c.y<5||c.y>7)};
}
export async function checkTropicalCoveArt():Promise<void>{
 const art=await renderTropicalCove(),meta=JSON.parse(readFileSync('art/source/tropical-cove-coast.json','utf8'));
 if(!art.png.equals(readFileSync(COVE_IMAGE))||!isDeepStrictEqual(meta,tropicalCoveMetadata(art)))throw Error('Tropical cove pixels/recipe differ from the native producer');
}
export function tropicalCoveMetadata(art:Awaited<ReturnType<typeof renderTropicalCove>>){
 const inputs=['world/tropical-cove.json','tools/art/tropical-cove.ts','tools/art/coast-raster.ts','art/source/organic-coast.json','assets/tilesets/original/beach-lounge.png','assets/tilesets/lpc-water/water.png'].map(path=>({path,sha256:sha(readFileSync(path))}));
 return{schemaVersion:1,license:'CC-BY-SA-3.0',attribution:'Tropical cove by VarCamp using original sand and unchanged LPC water pixels by Lanea Zimmerman (Sharm) and Liberated Pixel Cup contributors. Complete AUTHORS retained. Recipe CC0-1.0; combined atlas CC-BY-SA-3.0.',image:COVE_IMAGE,width:art.width,height:art.height,frameMs:cove.coast.frameMs,atlasSha256:sha(art.png),inputs,cells:art.edges,ground:art.ground};
}
export async function writeTropicalCoveArt(){
 const art=await renderTropicalCove();
 writeFileSync(COVE_IMAGE,art.png);
 writeFileSync('art/source/tropical-cove-coast.json',JSON.stringify(tropicalCoveMetadata(art),null,2)+'\n');
 return art;
}
