import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {renderPlazaFleet,FLEET_IDS} from './plaza-fleet';

export const FLEET_ART_PATHS=[
 ...FLEET_IDS.flatMap(id=>[`art/source/${id}-poses.png`,`art/source/${id}.json`,`assets/tilesets/original/${id}.png`]),
 ...['camera','delivery','survey'].map(type=>`art/source/plaza-fleet-original/${type}-generated-master.png`),
 'art/source/plaza-fleet-original/NOTICE.txt','art/source/plaza-fleet-original/prompts.json',
 'art/source/plaza-fleet-recipe.json','art/source/plaza-fleet.json',
].sort();
type Sources=Record<string,{files:{path:string;sha256:string}[]}>;
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
/** The family is mandatory independently of the generic manifest loop: deleting
 * a registration must never opt artwork out of source validation. */
export function assertFleetRegistrations(sources:Sources):void{
 const files=sources['plaza-original-drones']?.files;
 if(!Array.isArray(files))throw Error('Fleet required registration source is absent');
 const rows=files.filter(r=>typeof r.path==='string'&&r.path.includes('plaza-fleet'));
 if(!isDeepStrictEqual(rows.map(r=>r.path).sort(),FLEET_ART_PATHS))throw Error('Fleet required registration roster differs from the closed16 original inputs/exports');
 for(const row of rows)if(!/^[a-f0-9]{64}$/.test(row.sha256)||sha(readFileSync(row.path))!==row.sha256)throw Error('Fleet required registration hash changed: '+row.path);
}
export function assertFleetArtifactBytes(actual:Map<string,Buffer>,expected:Map<string,Buffer>):void{
 for(const[path,bytes]of expected){const value=actual.get(path);if(!value||!value.equals(bytes))throw Error('Fleet native producer differs: '+path);}
 if(!isDeepStrictEqual([...actual.keys()].sort(),[...expected.keys()].sort()))throw Error('Fleet native producer artifact roster differs');
}
/** Pure validation: no writer, repair or output-existence opt-out. */
export async function checkPlazaFleetArt(sources:Sources):Promise<string[]>{
 try{
  assertFleetRegistrations(sources);
  const result=await renderPlazaFleet(),expected=new Map<string,Buffer>();
  const json=(p:string,v:unknown)=>expected.set(p,Buffer.from(JSON.stringify(v,null,2)+'\n'));
  for(const a of result.aircraft){expected.set(a.overlay.image,a.png);expected.set(a.posePath,a.posePng);json(a.metadataPath,a.metadata);}
  json('art/source/plaza-fleet.json',result.metadata);
  assertFleetArtifactBytes(new Map([...expected.keys()].map(p=>[p,readFileSync(p)])),expected);
  return [];
 }catch(error){return[String(error)];}
}
