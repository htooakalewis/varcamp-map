import{assertNativeSourceProjection,reconcileNativeProjection}from'../../tools/maps/native-projection';
import{buildMap}from'../../tools/maps/builder';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {refinePlazaFloorGarden} from '../../tools/maps/plaza-floor-garden';
import {refineNativePlaza} from '../../tools/maps/plaza-native';
import {plazaGardenSprites} from '../../tools/art/plaza-garden';
import {renderRoadster} from '../../tools/art/roadster';
import {renderPlazaDrones} from '../../tools/art/plaza-drones';
import {renderPlazaFleet} from '../../tools/art/plaza-fleet';
import {approvedHistoricalPlaza,approvedHistoricalRaw} from './approved-world-successor';
import type {TileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap,TileLayer} from '../../tools/maps/types';
import contract from '../../world/plaza-floor-garden-native.json';
const folder='tests/fixtures/plaza-floor-garden/';
export function historicalFloorPlaza(kind:'layout'|'native'):MapLayout|TiledMap{
 assert.equal(contract.beforeNativeSha256,'6ae3de6475c7410101e1c7e2689f581c83f044f86bc19b6dc996f763d28541f2');
 assert.equal(contract.beforeLayoutSha256,'ff2d682ae76144ada9f67b93a1af479159733ce086a31b66d01c3a4289eaa9ed');
 const raw=readFileSync(folder+`before-${kind}.${kind==='native'?'tmj':'json'}`),pin=kind==='native'?contract.beforeNativeSha256:contract.beforeLayoutSha256;
 assert.equal(createHash('sha256').update(raw).digest('hex'),pin,'Actual36c7 plaza fixture changed');return JSON.parse(raw.toString());
}
/** Direct current-state successor proof. Frozen historical bytes are input, never recovered from current state. */
const fleetNames=['plaza-fleet-camera','plaza-fleet-delivery','plaza-fleet-survey'];
const fleetPngPins=['24e1fb8d757c08aefc12e6f7e27b8103f8a20b55811c26edd4081f48bd529cb0','caf13a85f2e813a64354e823f14ba8f0b027c1df13a60d481a6659d63d1fce57','b391c29129d863be52d51ec529431bcb837c911cd9706042e863c5e02776863e'];
type Fleet=Awaited<ReturnType<typeof renderPlazaFleet>>['aircraft'];
/** Independent native extension, not a call back into the projection under
 * test. All65 historical atlases and98 layer bodies remain exact. */
export function appendReviewedFleetNative(original:TiledMap,aircraft:Fleet):TiledMap{
 assert.equal(original.tilesets.length,65);assert.equal(original.layers.length,98);assert.equal(original.nextlayerid,102);
 assert.deepEqual(aircraft.map(a=>a.overlay.name),fleetNames,'Exactly three reviewed fleet types required');
 assert.equal(original.layers[45].name,'Sponsors / Demo 01');assert.equal(original.layers[49].name,'floorLayer');
 const native=structuredClone(original),layers:TileLayer[]=[];let gid=10914;
 assert.equal(Math.max(...original.tilesets.map(t=>t.firstgid+t.tilecount!)),gid);
 for(const[i,a]of aircraft.entries()){
  const o=a.overlay;assert.equal(o.level,'belowAvatar');assert.equal(createHash('sha256').update(a.png).digest('hex'),fleetPngPins[i]);
  assert.equal(o.image,`assets/tilesets/original/${fleetNames[i]}.png`);assert.ok(a.png.equals(readFileSync(o.image)),'Saved fleet PNG differs from reviewed pure producer');
  const width=a.png.readUInt32BE(16),height=a.png.readUInt32BE(20),count=width/32*height/32;assert.equal(width,512);assert.equal(count,[176,240,272][i]);
  assert.deepEqual([o.x,o.y,o.width,o.height],[[60,62,6,3],[67,70,8,3],[53,69,7,3]][i]);
  native.tilesets.push({firstgid:gid,name:o.name,tilewidth:32,tileheight:32,columns:16,tilecount:count,image:'../'+o.image,imagewidth:width,imageheight:height,properties:[{name:'tilesetCopyright',type:'string',value:'Original generated VarCamp drone sprites; native motion authored for this project; Original project artwork; permitted project distribution'}],tiles:o.animations.map(a=>({id:a.id,animation:a.frames.map(f=>({...f})),properties:[{name:'collides',type:'bool',value:false}]}))});
  const data=Array(128*128).fill(0);for(let y=0;y<o.height;y++)for(let x=0;x<o.width;x++)data[(o.y+y)*128+o.x+x]=gid+o.carrierTileIds[y*o.width+x];
  layers.push({id:102+i,name:o.name,type:'tilelayer',width:128,height:128,data,visible:true,opacity:1,x:0,y:0});gid+=count;
 }
 native.layers.splice(45,0,...layers);native.nextlayerid=105;return native;
}
/** Approved welcome-plaza retirement: two standing signs with posts, the compass marker, the
 * reception desk and its wide screen. Source IDs and native cells are listed independently;
 * every cell must be occupied before clearing, and the production projection gate must accept
 * the result, so the native delta is exactly the projection of the source delta. */
export const WELCOME_PLAZA_RETIREMENT=Object.freeze({
 placements:['directory-prompt','arrival-position-label','arrival-compass','reception-post-directory','reception-post-position','reception-desk','reception-screen','reception-screen-content'],
 standingSigns:['directory-prompt','arrival-position-label'],
 nativeCells:{
  'scenery-aboveAvatar-0':[[61,70],[62,70],[63,70],[64,70],[61,73],[62,73],[63,73],[64,73]],
  'scenery-belowAvatar-1':[[62,71],[62,74],[59,73],[76,65],[77,65],[78,65],[76,66],[77,66],[78,66],[75,67],[76,67],[77,67],[78,67],[75,68],[76,68],[77,68],[78,68],[75,69],[76,69],[77,69],[78,69]],
  'scenery-belowAvatar-2':[[76,65],[77,65],[78,65],[76,66],[77,66],[78,66]],
  'physical-collisions':[[62,71],[62,74],[75,67],[76,67],[77,67],[78,67],[75,68],[78,68],[75,69],[78,69]],
 } as Record<string,number[][]>,
});
export function retireWelcomePlazaProps(layout:MapLayout,native:TiledMap,catalog:TileCatalog):{layout:MapLayout;native:TiledMap}{
 const l=structuredClone(layout),map=structuredClone(native),r=WELCOME_PLAZA_RETIREMENT;
 for(const id of r.placements)assert.equal(l.placements.filter(p=>p.id===id).length,1,`Retired placement ${id} must exist exactly once`);
 for(const face of r.standingSigns)assert.equal(l.standingSigns!.filter(s=>s.face===face).length,1,`Retired standing sign ${face} must exist exactly once`);
 l.placements=l.placements.filter(p=>!r.placements.includes(p.id));l.standingSigns=l.standingSigns!.filter(s=>!r.standingSigns.includes(s.face));
 let cleared=0;
 for(const[name,cells]of Object.entries(r.nativeCells)){const layer=map.layers.find(l=>l.name===name);assert.ok(layer?.type==='tilelayer',`Retired native layer ${name}`);
  for(const[x,y]of cells){const i=y*128+x;assert.notEqual(layer.data[i],0,`Retired native cell ${name} ${x},${y} already empty`);layer.data[i]=0;cleared++;}}
 assert.equal(cleared,45);
 assertNativeSourceProjection(map,buildMap(l,catalog).tmj);
 return{layout:l,native:map};
}
/** One shared actual forward producer transaction for groves/redraw tests. */
export async function expectedPlazaSuccessor(catalog:TileCatalog):Promise<{layout:MapLayout;native:TiledMap}>{
 for(const [id,s] of Object.entries(plazaGardenSprites()))assert.deepEqual(catalog[id],s,`Original grounded tree/canopy contract ${id}`);
 return (async()=>{
  assert.equal(createHash('sha256').update(readFileSync('tools/art/plaza-fleet.ts')).digest('hex'),'3ffa9d3b2da3aba95251226725d56516ecfc5e0688944a73d41e178cb3ba6960');
  assert.equal(createHash('sha256').update(readFileSync('art/source/plaza-fleet-recipe.json')).digest('hex'),'343db1ef1f79eaf111759651092ae82efeaa61ae152fe971c5f30ce4d41f78f3');
  const l=refinePlazaFloorGarden(historicalFloorPlaza('layout') as MapLayout),roadster=await renderRoadster(),drones=await renderPlazaDrones(),fleet=await renderPlazaFleet();
  l.animatedOverlays=l.animatedOverlays!.filter(o=>o.name!=='roadster'&&!o.name.startsWith('plaza-drone-'));
  l.animatedOverlays.push(roadster.metadata.overlay,...drones.metadata.resources.map(r=>r.overlay));
  // Refine the genuine old65 epoch BEFORE adding fleet source. Passing the
  // historical refiner a current fleet would manufacture an invalid hybrid.
  const legacy=refineNativePlaza(readFileSync(folder+'before-native.tmj','utf8'),l,catalog);
  const base=approvedHistoricalPlaza();assert.equal(createHash('sha256').update(approvedHistoricalRaw('maps/overworld.tmj')).digest('hex'),'65d9705f7c44078bf7f593b4d966315cac67f0b02029660f7d2666bbd18ebcd8');assert.deepEqual(legacy.tilesets,base.tilesets);
  l.animatedOverlays.push(...fleet.aircraft.map(a=>a.overlay));
  const manual=appendReviewedFleetNative(base,fleet.aircraft);
  assert.deepEqual(reconcileNativeProjection(legacy,buildMap(l,catalog).tmj),manual,'Production current forward transaction differs from independent three-append native oracle');
  assert.ok(readFileSync('maps/overworld.wam').equals(approvedHistoricalRaw('maps/overworld.wam')),'Fleet must retain all organizer controls');
  return retireWelcomePlazaProps(l,manual,catalog);
 })();
}
export async function assertPlazaSuccessor(layout:MapLayout,map:TiledMap,catalog:TileCatalog):Promise<void>{
 const expected=await expectedPlazaSuccessor(catalog);
 assert.ok(isDeepStrictEqual(layout,expected.layout),'Current plaza source must be exactly the approved forward operation');
 assert.ok(isDeepStrictEqual(map,expected.native),'Current native must be exactly the approved forward operation');
}
