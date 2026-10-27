import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {loadTileCatalog} from '../tools/art/catalog';
import {buildMap} from '../tools/maps/builder';
import {assertNativeReferenceInterior,renderReferenceInterior} from '../tools/maps/reference-interiors';
import {validateWam} from '../tools/maps/validate';
import type {MapLayout,TiledMap,TileLayer,WamFile} from '../tools/maps/types';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const current=()=>({layout:read('world/layouts/speaker-aries.json') as MapLayout,map:read('maps/speaker-aries.tmj') as TiledMap,wam:read('maps/speaker-aries.wam') as WamFile,catalog:loadTileCatalog()});
const marks=[['VarCamp','assets/sponsors/varcamp-2026.png',15,0,6],['AWS UG Myanmar','assets/sponsors/partner-aws-ug-mm.png',8,4,4],['BSides Myanmar','assets/sponsors/partner-bsides-mm.png',16,4,4],['OpenInfra Myanmar','assets/sponsors/partner-openinfra-mm.png',24,4,4],['Vibe Code Tours','assets/sponsors/vibecode-tours.png',8,0,4]] as const;
describe('Aries in-game presentation preview',()=>{
 it('publishes a stage and listener zone covering every seat while leaving the social foyer outside',()=>{
  const a=current(),stage=a.wam.areas.find(z=>z.id==='meeting-aries')!,audience=a.wam.areas.find(z=>z.id==='aries-audience');
  expect(stage).toMatchObject({x:96,y:192,width:960,height:256,properties:[{id:'aries-stage-broadcast',type:'speakerMegaphone',name:'varcamp-aries-talk',chatEnabled:false,seeAttendees:false}]});
  expect(audience).toMatchObject({x:64,y:448,width:1024,height:352,properties:[{id:'aries-listener',type:'listenerMegaphone',speakerZoneName:'meeting-aries',chatEnabled:false,allowTalking:false,raiseHandEnabled:true}]});
  expect(stage.y+stage.height).toBe(audience!.y);
  for(const s of a.layout.placements.filter(p=>p.id.startsWith('seat-')))expect(s.x*32>=audience!.x&&s.y*32>=audience!.y&&(s.x+s.width)*32<=audience!.x+audience!.width&&(s.y+s.height)*32<=audience!.y+audience!.height,s.id).toBe(true);
  expect(audience!.y+audience!.height).toBeLessThanOrEqual(27*32);
  expect(a.wam.areas.flatMap(z=>z.properties).some(p=>p.type==='livekitRoomProperty')).toBe(false);
  expect(validateWam(a.wam)).toEqual([]);
  expect(()=>assertNativeReferenceInterior(a.map,a.layout,a.catalog,a.wam)).not.toThrow();
 });
 it('paints five complete logos in exact native 32px tiles without altering their source pixels',()=>{
  const a=current();expect(a.layout.images).toHaveLength(5);
  for(const [name,image,x,y,width] of marks){
   expect(a.layout.images).toContainEqual({name:'Aries / '+name,image,x,y,width,height:2});
   const sheet=a.map.tilesets.find(s=>s.name==='Aries / '+name)!;
   expect(sheet).toMatchObject({tilewidth:32,tileheight:32,columns:width,tilecount:width*2,imagewidth:width*32,imageheight:64,image:'../'+image});
   const layer=a.map.layers.find(l=>l.name==='Aries / '+name) as TileLayer;
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<width;dx++)expect(layer.data[(y+dy)*36+x+dx]).toBe(sheet.firstgid+dy*width+dx);
  }
 });
 it.each(['missing-audience','wrong-stage-reference','talking-enabled','missing-logo','shifted-logo','missing-trim','blocking-style'])('rejects coherent %s before release',kind=>{
  const a=current();
  if(kind==='missing-audience')a.layout.areas=a.layout.areas.filter(z=>z.id!=='aries-audience');
  if(kind==='wrong-stage-reference')a.layout.areas.find(z=>z.id==='aries-audience')!.properties[0].speakerZoneName='varcamp-aries-talk';
  if(kind==='talking-enabled')a.layout.areas.find(z=>z.id==='aries-audience')!.properties[0].allowTalking=true;
  if(kind==='missing-logo')a.layout.images!.pop();
  if(kind==='shifted-logo')a.layout.images![0].x++;
  if(kind==='missing-trim')a.layout.placements=a.layout.placements.filter(p=>p.id!=='aries-style-stage-front');
  if(kind==='blocking-style')a.catalog['speaker-style-wall'].blockingCells=[[0,0]];
  let rejected=false;
  try{const b=buildMap(a.layout,a.catalog);a.map=renderReferenceInterior(a.layout,a.catalog).tmj;a.wam=b.wam;assertNativeReferenceInterior(a.map,a.layout,a.catalog,a.wam);}catch{rejected=true;}
  expect(rejected,kind).toBe(true);
 });
});
