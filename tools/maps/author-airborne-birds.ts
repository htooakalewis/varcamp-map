import{readFileSync,writeFileSync}from'node:fs';
import{pathToFileURL}from'node:url';
import{isDeepStrictEqual}from'node:util';
import{renderRoadster,renderRoadsterV1,ROADSTER_V2_METADATA_PATH}from'../art/roadster';
import{renderCoastalFlight}from'../art/coastal-flight';
import{renderPlazaDrones}from'../art/plaza-drones';
import{renderPlazaFleet}from'../art/plaza-fleet';
import{renderCoastLife}from'../art/coast-life';
import{renderWorldAmbient}from'../art/world-ambient';
import{renderInteriorReferenceMotion}from'../art/interior-reference-motion';
import{buildMap}from'./builder';
import{attachOrganicCoast}from'./organic-coast';
import{reconcileNativeProjection}from'./native-projection';
import{assertCurrentNativeMap}from'./current-native';
import{WORLD_CATALOG}from'../../src/world/catalog';
import type{LayoutAnimatedOverlay,MapLayout}from'./types';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
/** Genuine source producer refresh. New depth/translated rectangles change no
 * existing PNG, pose, atlas reservation, controls or physical geometry. All
 * metadata is rendered, never repaired by rebinding input hash fields. */
export async function writeAirborneBirdMaps():Promise<void>{
 const metadata=new Map<string,Buffer>(),overlays=new Map<string,LayoutAnimatedOverlay>();
 const json=(p:string,a:unknown)=>metadata.set(p,Buffer.from(JSON.stringify(a,null,2)+'\n'));
 const exact=(p:string,body:Buffer)=>{if(!readFileSync(p).equals(body))throw Error('Airborne migration changed approved original PNG/pose: '+p);};
 const add=(o:LayoutAnimatedOverlay)=>{const key=o.provenance!.metadataPath;if(overlays.has(key))throw Error('Duplicate current effect producer');overlays.set(key,o);};
 // The frozen v1 roadster epoch keeps its atlas and receipts; the v2 epoch is the current role producer.
 const roadsterV1=await renderRoadsterV1();exact(roadsterV1.metadata.overlay.image,roadsterV1.png);json('art/source/roadster.json',roadsterV1.metadata);
 const roadster=await renderRoadster();exact(roadster.metadata.overlay.image,roadster.png);json(ROADSTER_V2_METADATA_PATH,roadster.metadata);add(roadster.metadata.overlay);
 const flight=await renderCoastalFlight();exact(flight.metadata.overlay.image,flight.png);json('art/source/coastal-flight.json',flight.metadata);add(flight.metadata.overlay);
 const drones=await renderPlazaDrones();exact('art/source/plaza-drone-poses.png',drones.posePng);json('art/source/plaza-drones.json',drones.metadata);
 for(const r of drones.resources){exact(r.overlay.image,r.png);json(r.metadataPath,{version:1,source:drones.metadata.source,overlay:r.overlay,diagnostics:r.diagnostics});add(r.overlay);}
 const fleet=await renderPlazaFleet();
 for(const r of fleet.aircraft){exact(r.overlay.image,r.png);exact(r.posePath,r.posePng);json(r.metadataPath,r.metadata);add(r.overlay);}
 json('art/source/plaza-fleet.json',fleet.metadata);
 for(const r of await renderCoastLife()){exact(r.overlay.image,r.png);json(r.overlay.provenance!.metadataPath,r.metadata);add(r.overlay);}
 for(const r of await renderWorldAmbient()){exact(r.overlay.image,r.png);exact(r.metadata.rawPoseStrip.path,r.rawPoseStrip);exact(r.metadata.poseStrip.path,r.poseStrip);json(r.overlay.provenance!.metadataPath,r.metadata);add(r.overlay);}
 const interior=await renderInteriorReferenceMotion();if(!isDeepStrictEqual(interior.catalogEntry,read('art/tile-catalog.json')['interior-ref-plant-motion-base']))throw Error('Airborne migration changed interior catalog');
 for(const[p,body]of interior.artifacts){if(p.endsWith('.png'))exact(p,body);else metadata.set(p,body);}
 for(const layout of interior.layouts.values())for(const o of layout.animatedOverlays??[])add(o);
 for(const name of ['rolling-breaker-west','rolling-breaker-east'])add(read(`art/source/${name}.json`).overlay);
 if(overlays.size!==140)throw Error('Incomplete current producer refresh');
 const layouts=new Map<string,MapLayout>();
 for(const id of Object.keys(WORLD_CATALOG)){
  const path=`world/layouts/${id}.json`,layout:MapLayout=read(path);
  if(id==='overworld')for(const r of fleet.aircraft)if(!layout.animatedOverlays?.some(o=>o.name===r.overlay.name))(layout.animatedOverlays??=[]).push(r.overlay);
  // A layout still carrying the v1 roadster descriptor migrates to the v2 epoch here.
  layout.animatedOverlays=layout.animatedOverlays?.map(o=>{const refreshed=overlays.get(o.provenance!.metadataPath)??(o.name==='roadster'&&o.provenance!.metadataPath==='art/source/roadster.json'?roadster.metadata.overlay:undefined);if(!refreshed)throw Error('Unowned animation during source migration: '+o.name);return refreshed;});layouts.set(id,layout);
 }
 // All original pixel comparisons finish before the first source write.
 for(const[p,body]of metadata)writeFileSync(p,body);
 for(const[id,layout]of layouts)writeFileSync(`world/layouts/${id}.json`,JSON.stringify(layout,null,2)+'\n');
 const catalog=read('art/tile-catalog.json'),native=[];
 for(const id of ['overworld','shipyard-beach','constellation-shore','fa-ship']){
  const layout=layouts.get(id)!,built=buildMap(layout,catalog).tmj;if(id!=='fa-ship')attachOrganicCoast(built,layout);
  const map=reconcileNativeProjection(read(`maps/${id}.tmj`),built);assertCurrentNativeMap(id,map,layout,read(`maps/${id}.wam`),catalog);native.push({id,map});
 }
 for(const{id,map}of native)writeFileSync(`maps/${id}.tmj`,JSON.stringify(map)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await writeAirborneBirdMaps();
