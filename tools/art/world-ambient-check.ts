import{readFileSync,existsSync}from'node:fs';
import{createHash}from'node:crypto';
import{isDeepStrictEqual}from'node:util';
import{renderWorldAmbientAssets}from'./world-ambient-assets';
import{renderWorldAmbient}from'./world-ambient';
import{WORLD_AMBIENT_IDS}from'../maps/world-ambient';

const need=(ok:unknown,message:string):void=>{if(!ok)throw Error(message);};
const json=(value:unknown)=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const hash=(body:Buffer)=>createHash('sha256').update(body).digest('hex');

/** Mandatory publication proof for existing approved ambient artwork. All
 * renderers and comparisons are read-only; no exporter or repair is called. */
export async function checkWorldAmbientArt():Promise<string[]>{
 const errors:string[]=[];
 try{
  const assets=await renderWorldAmbientAssets(),motion=await renderWorldAmbient();
  const groups=['steam','ripples','device','lamp','leaves','cascade','glint','fish','gull'].sort();
  need(isDeepStrictEqual(Object.keys(assets.strips).sort(),groups),'closed nine source-strip groups changed');
  need(motion.length===36&&new Set(motion.map(r=>r.overlay.name)).size===36,'closed thirty-six native component roster changed');
  need(isDeepStrictEqual([...new Set(motion.map(r=>r.map))].sort(),[...WORLD_AMBIENT_IDS].sort())&&WORLD_AMBIENT_IDS.length===17,'closed seventeen-map roster changed');
  need(new Set(motion.map(r=>r.metadata.effect.name)).size===35,'closed thirty-five logical effect roster changed');
  for(const id of WORLD_AMBIENT_IDS)need(new Set(motion.filter(r=>r.map===id).map(r=>r.metadata.effect.name)).size===(id==='nebula-arcade'?3:2),'closed logical effect roster changed: '+id);

  const expected=new Map<string,Buffer>();
  const add=(path:string,body:Buffer)=>{const prior=expected.get(path);need(!prior||prior.equals(body),'conflicting producer ownership: '+path);expected.set(path,body);};
  // Genuine input art and recipes keep their existing original attribution.
  // Native layer/context/placement validation DATA is intentionally excluded.
  for(const path of ['art/source/world-ambient-generation.json','art/source/world-ambient.json',assets.metadata.master.path,...assets.metadata.marineSources.map((p:{path:string})=>p.path),...assets.metadata.plants.sources.map(p=>p.path)])add(path,readFileSync(path));
  add(assets.metadata.plants.path,assets.plants);
  add('art/source/world-ambient-assets.json',json(assets.metadata));
  for(const[name,png]of Object.entries(assets.strips))add(`art/source/world-ambient-${name}-poses.png`,png);
  for(const r of motion){
   add(r.overlay.image,r.png);
   add(r.metadata.rawPoseStrip.path,r.rawPoseStrip);
   add(r.metadata.poseStrip.path,r.poseStrip);
   add(r.overlay.provenance!.metadataPath,json(r.metadata));
  }
  need(expected.size===126,'closed artistic artifact roster changed');
  const sources=JSON.parse(readFileSync('art/sources.json','utf8'));
  need(Array.isArray(sources.original?.files),'original source registration missing');
  for(const[path,body]of expected){
   const records=sources.original.files.filter((r:{path:string})=>r.path===path);
   if(records.length!==1)errors.push(`world-ambient: ${path}: original registration missing or ambiguous`);
   else if(records[0].sha256!==hash(body))errors.push(`world-ambient: ${path}: registration differs from genuine producer/source`);
   if(!existsSync(path))errors.push(`world-ambient: ${path}: missing native artifact`);
   else if(!readFileSync(path).equals(body))errors.push(`world-ambient: ${path}: differs from complete native producer`);
  }
  for(const id of WORLD_AMBIENT_IDS){
   const path=`world/layouts/${id}.json`,layout=JSON.parse(readFileSync(path,'utf8'));
   const actual=(layout.animatedOverlays??[]).filter((o:{name:string})=>o.name.startsWith('world-ambient-'));
   if(!isDeepStrictEqual(actual,motion.filter(r=>r.map===id).map(r=>r.overlay)))errors.push(`world-ambient: ${path}: ambient overlay descriptors differ from complete producer`);
  }
 }catch(error){errors.push('world-ambient: producer validation failed: '+String(error));}
 return errors;
}
