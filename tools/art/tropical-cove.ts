import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {renderCoast} from './coast-raster';
import cove from '../../world/tropical-cove.json';
import {isDeepStrictEqual} from 'node:util';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export const COVE_IMAGE='assets/tilesets/original/tropical-cove-coast.png';
/** A new native export; the earlier coast and all licensed source pixels stay intact. */
export async function renderTropicalCove(){
 return renderCoast(cove.coast,{width:48,height:48,prefix:'organic-coast',groundPrefix:'organic-ground',image:COVE_IMAGE});
}
export async function checkTropicalCoveArt():Promise<void>{
 const art=await renderTropicalCove(),meta=JSON.parse(readFileSync('art/source/tropical-cove-coast.json','utf8'));
 if(!art.png.equals(readFileSync(COVE_IMAGE))||meta.image!==COVE_IMAGE||meta.width!==art.width||meta.height!==art.height||meta.frameMs!==cove.coast.frameMs||meta.atlasSha256!==sha(art.png)||!isDeepStrictEqual(meta.cells,art.edges)||meta.inputs.some((p:{path:string;sha256:string})=>sha(readFileSync(p.path))!==p.sha256))throw Error('Tropical cove pixels/recipe differ from the native producer');
}
export async function writeTropicalCoveArt(){
 const art=await renderTropicalCove();
 writeFileSync(COVE_IMAGE,art.png);
 const inputs=['world/tropical-cove.json','tools/art/tropical-cove.ts','tools/art/coast-raster.ts','assets/tilesets/original/beach-lounge.png','assets/tilesets/lpc-water/water.png'].map(path=>({path,sha256:sha(readFileSync(path))}));
 writeFileSync('art/source/tropical-cove-coast.json',JSON.stringify({schemaVersion:1,license:'CC-BY-SA-3.0',attribution:'Tropical cove by VarCamp using original sand and unchanged LPC water pixels by Lanea Zimmerman (Sharm) and Liberated Pixel Cup contributors. Complete AUTHORS retained. Recipe CC0-1.0; combined atlas CC-BY-SA-3.0.',image:COVE_IMAGE,width:art.width,height:art.height,frameMs:cove.coast.frameMs,atlasSha256:sha(art.png),inputs,cells:art.edges},null,2)+'\n');
 return art;
}
