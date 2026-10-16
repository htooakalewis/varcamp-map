import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import { WORLD_CATALOG } from '../src/world/catalog';
import { validateMap } from '../tools/maps/validate';
import * as validation from '../tools/maps/validate';
import type { MapLayout, TiledMap } from '../tools/maps/types';
const load=(hall:string):MapLayout=>{const path=`world/layouts/${hall}-hall.json`;expect(existsSync(path),'missing authored hall').toBe(true);return JSON.parse(readFileSync(path,'utf8'));};
function navigation(map:TiledMap) {
 const blocked=new Set(map.layers.flatMap(l=>l.type==='tilelayer'&&l.name==='physical-collisions'?l.data.flatMap((v,i)=>v?[i]:[]):[]));
 const start=map.layers.find(l=>l.type==='tilelayer'&&l.properties?.some(p=>p.name==='start'&&p.value===true));
 if(start?.type!=='tilelayer')throw Error('missing start');
 const seen=new Set<number>(),queue=[start.data.findIndex(Boolean)];seen.add(queue[0]);
 for(let i=0;i<queue.length;i++){const p=queue[i],x=p%map.width,y=Math.floor(p/map.width);for(const [nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=ny*map.width+nx;if(nx>=0&&ny>=0&&nx<map.width&&ny<map.height&&!blocked.has(n)&&!seen.has(n)){seen.add(n);queue.push(n);}}}
 return {blocked,seen};
}
describe.each([['solar',64,56],['lunar',64,56]] as const)('%s hall', (hall,width,height)=>{
 it('exports correctly sized, valid public entry and physical campus return',()=>{
  const l=load(hall),{tmj,wam}=buildMap(l,loadTileCatalog());expect([tmj.width,tmj.height]).toEqual([width,height]);expect(validateMap(tmj,WORLD_CATALOG)).toEqual([]);
  expect(wam.version).toBe('2.1.0');expect(l.entries.map(e=>e.name)).toEqual([`${hall}-entry`]);expect(l.exits).toEqual([expect.objectContaining({destination:'overworld',entry:`from-${hall}`})]);
  expect(tmj.properties).toEqual(expect.arrayContaining([{name:'defaultCameraState',type:'bool',value:false},{name:'defaultMicrophoneState',type:'bool',value:false}]));
 });
 it('binds audience to stable stage ID and keeps prep meeting separate',()=>{
  const {wam}=buildMap(load(hall),loadTileCatalog());const stage=wam.areas.find(a=>a.id===`${hall}-stage`);expect(stage).toBeDefined();
  expect(stage!.properties).toContainEqual({id:`${hall}-broadcast`,type:'speakerMegaphone',name:`varcamp-${hall}-main`,chatEnabled:false,seeAttendees:false});
  const audience=wam.areas.find(a=>a.id===`${hall}-audience`)!;
  expect(audience.properties).toContainEqual({id:`${hall}-listen`,type:'listenerMegaphone',speakerZoneName:`${hall}-stage`,chatEnabled:false,allowTalking:false,raiseHandEnabled:true});
  const prep=wam.areas.find(a=>a.id===`${hall}-prep`)!;expect(prep.properties).toContainEqual(expect.objectContaining({type:'livekitRoomProperty',roomName:`varcamp-${hall}-prep`,livekitRoomConfig:{startWithAudioMuted:true,startWithVideoMuted:true,disableChat:true}}));
  for(const area of [stage!,prep])expect(area.properties).toContainEqual(expect.objectContaining({type:'restrictedRightsPropertyData',readTags:['organizer','speaker'],writeTags:[]}));
  expect(prep.x+prep.width<=audience.x||prep.x>=audience.x+audience.width||prep.y+prep.height<=audience.y||prep.y>=audience.y+audience.height).toBe(true);
 });
 it('connects return, front floor and prep while keeping the full central aisle clear',()=>{
  const l=load(hall),{tmj}=buildMap(l,loadTileCatalog()),{blocked,seen}=navigation(tmj);
  for(const r of [...l.exits,...l.entries,...l.inspectionZones.filter(z=>['central-aisle','front-route','prep-route'].includes(z.name))])for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)expect(seen.has(y*width+x)&&!blocked.has(y*width+x),`${r.name} ${x},${y}`).toBe(true);
  const aisle=l.inspectionZones.find(z=>z.name==='central-aisle')!;expect(aisle.width).toBeGreaterThanOrEqual(4);
  const audience=l.areas.find(a=>a.id===`${hall}-audience`)!;for(const seat of l.placements.filter(p=>p.id.startsWith('seat-')))expect(seat.x>=audience.x&&seat.x+seat.width<=audience.x+audience.width&&seat.y>=audience.y&&seat.y+seat.height<=audience.y+audience.height,'every seat receives its hall broadcast').toBe(true);
  const seats=l.placements.filter(p=>p.id.startsWith('seat-'));expect(seats.some(p=>p.x<aisle.x)).toBe(true);expect(seats.some(p=>p.x>=aisle.x+aisle.width)).toBe(true);
  for(const sprite of ['screen-presentation','lectern','plant-palm','water-cooler'])expect(l.placements.some(p=>p.sprite===sprite),sprite).toBe(true);
 });
});
it('preserves explicit WAM IDs and previous generated IDs when omitted',()=>{
 const fixture:MapLayout={id:'solar-hall',width:80,height:64,placements:[],entries:[],exits:[],inspectionZones:[],areas:[{id:'solar-stage',name:'Solar presentation',x:1,y:1,width:2,height:2,properties:[]} as MapLayout['areas'][number],{name:'legacy',x:4,y:1,width:2,height:2,properties:[]}]};
 expect(buildMap(fixture,loadTileCatalog()).wam.areas.map(a=>a.id)).toEqual(['solar-stage','solar-hall-area-1']);
});
it('rejects display-name audience references and malformed pinned native properties',()=>{
 const validate=(validation as unknown as {validateWam?:(w:unknown)=>{code:string}[]}).validateWam;expect(validate,'missing native WAM validator').toBeTypeOf('function');
 const {wam}=buildMap(load('solar'),loadTileCatalog());expect(validate!(wam)).toEqual([]);
 const invalid=structuredClone(wam);invalid.areas.find(a=>a.id==='solar-audience')!.properties[0].speakerZoneName='varcamp-solar-main';expect(validate!(invalid).some(i=>i.code==='WAM_LISTENER_REFERENCE')).toBe(true);
 const malformed=structuredClone(wam);malformed.areas.find(a=>a.id==='solar-stage')!.properties[0].chatEnabled='false';expect(validate!(malformed).some(i=>i.code==='WAM_SCHEMA_INVALID')).toBe(true);
 const duplicate=structuredClone(wam);duplicate.areas[1].id=duplicate.areas[0].id;expect(validate!(duplicate).some(i=>i.code==='WAM_AREA_ID')).toBe(true);
});
