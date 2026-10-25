import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {SIGN_IDS} from '../src/world/catalog';
import {buildMap} from '../tools/maps/builder';
import {renderReferenceInterior} from '../tools/maps/reference-interiors';
import {beforeSpeakerWam} from './helpers/speaker-presentation-history';
import {assertNativeReferenceInterior} from '../tools/maps/reference-interiors';
import {loadTileCatalog} from '../tools/art/catalog';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const overlap=(a:any,b:any)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
describe('approved Aries treatment across all speaker rooms',()=>{
 for(const sign of SIGN_IDS)it(`${sign}: exports native branding and separate controls covering its own stage and every seat`,()=>{
  const id=`speaker-${sign}`,l=read(`world/layouts/${id}.json`),m=read(`maps/${id}.tmj`),w=read(`maps/${id}.wam`),label=sign[0].toUpperCase()+sign.slice(1),dx=(l.width-36)/2;
  expect(l.images).toEqual([
   {name:`${label} / VarCamp`,image:'assets/sponsors/varcamp-2026.png',x:15+dx,y:0,width:6,height:2},
   {name:`${label} / AWS UG Myanmar`,image:'assets/sponsors/partner-aws-ug-mm.png',x:sign==='capricorn'?12:8+dx,y:4,width:4,height:2},
   {name:`${label} / BSides Myanmar`,image:'assets/sponsors/partner-bsides-mm.png',x:sign==='capricorn'?18:16+dx,y:4,width:4,height:2},
   {name:`${label} / OpenInfra Myanmar`,image:'assets/sponsors/partner-openinfra-mm.png',x:24+dx,y:4,width:4,height:2}]);
  const stage=w.areas.find((a:any)=>a.id===`meeting-${sign}`),audience=w.areas.find((a:any)=>a.id===`${sign}-audience`),border=l.placements.find((p:any)=>p.id==='stage-gold-edge');
  expect(stage).toMatchObject({x:border.x*32,y:border.y*32,width:border.width*32,height:border.height*32,properties:[{id:`${sign}-stage-broadcast`,type:'speakerMegaphone',name:`varcamp-${sign}-talk`,chatEnabled:false,seeAttendees:false}]});
  expect(audience).toMatchObject({x:64,y:448,width:(l.width-4)*32,height:(sign==='pisces'?12:11)*32,properties:[{id:`${sign}-listener`,type:'listenerMegaphone',speakerZoneName:`meeting-${sign}`,chatEnabled:false,allowTalking:false,raiseHandEnabled:true}]});
  for(const p of l.placements.filter((p:any)=>p.id.startsWith('seat-')))expect(p.x*32>=audience.x&&p.y*32>=audience.y&&(p.x+p.width)*32<=audience.x+audience.width&&(p.y+p.height)*32<=audience.y+audience.height,p.id).toBe(true);
  expect(overlap(stage,audience)).toBe(false);expect(audience.y+audience.height).toBeLessThanOrEqual(27*32);
  expect(w.areas.flatMap((a:any)=>a.properties).some((p:any)=>p.type==='livekitRoomProperty')).toBe(false);
  for(const img of l.images){const sheet=m.tilesets.find((t:any)=>t.name===img.name),layer=m.layers.find((p:any)=>p.name===img.name);expect(sheet).toMatchObject({tilewidth:32,tileheight:32,imagewidth:img.width*32,imageheight:64});for(let y=0;y<2;y++)for(let x=0;x<img.width;x++)expect(layer.data[(img.y+y)*l.width+img.x+x]).toBe(sheet.firstgid+y*img.width+x);}
  expect(()=>assertNativeReferenceInterior(m,l,loadTileCatalog(),w)).not.toThrow();
 });
 it('keeps opaque native logo layers clear of every original furnishing',()=>{
  for(const sign of SIGN_IDS){
   const l=read(`world/layouts/speaker-${sign}.json`),m=read(`maps/speaker-${sign}.tmj`);
   for(const image of l.images){
    expect(m.layers.some((layer:any)=>layer.name===image.name&&layer.type==='tilelayer')).toBe(true);
    const covered=l.placements.filter((p:any)=>p.layer!=='terrain'&&!p.id.startsWith(sign+'-style-')&&!/wall/.test(p.id)&&overlap(image,p)).map((p:any)=>p.id);
    expect(covered,`${sign}/${image.name}: native opaque branding covers existing furniture`).toEqual([]);
   }
  }
 });
 it.each(['missing-audience','wrong-link','shifted-brand','missing-zodiac','wrong-stage-trim','blocking-style'])('rejects coherent %s in a rolled-out room',kind=>{
  const l=read('world/layouts/speaker-pisces.json'),c=loadTileCatalog();
  if(kind==='missing-audience')l.areas=l.areas.filter((a:any)=>a.id!=='pisces-audience');
  if(kind==='wrong-link')l.areas.find((a:any)=>a.id==='pisces-audience').properties[0].speakerZoneName='meeting-taurus';
  if(kind==='shifted-brand')l.images[0].x++;
  if(kind==='missing-zodiac')l.placements=l.placements.filter((p:any)=>p.sprite!=='glyph-pisces');
  if(kind==='wrong-stage-trim')l.placements.find((p:any)=>p.id==='pisces-style-stage-front').width++;
  if(kind==='blocking-style')c['speaker-style-wall'].blockingCells=[[0,0]];
  expect(()=>{const b=buildMap(l,c),m=renderReferenceInterior(l,c).tmj;assertNativeReferenceInterior(m,l,c,b.wam);}).toThrow();
 });
 it('refuses unowned data and control drift when proving genuine speaker WAM history',()=>{
  expect(()=>beforeSpeakerWam('speaker-taurus')).not.toThrow();
  for(const kind of ['metadata','entity','beacon','stage','listener']){
   const w=read('maps/speaker-taurus.wam');
   if(kind==='metadata')w.metadata.extra='unreviewed';
   if(kind==='entity')w.entities.extra={x:0,y:0};
   if(kind==='beacon')w.areas.find((a:any)=>a.id==='beacon-taurus').x++;
   if(kind==='stage')w.areas[0].width--;
   if(kind==='listener')w.areas.at(-1).properties[0].allowTalking=0;
   expect(()=>beforeSpeakerWam('speaker-taurus',JSON.stringify(w))).toThrow();
  }
 });
 it('keeps the approved Aries map byte-exact during rollout',()=>{
  expect(createHash('sha256').update(readFileSync('maps/speaker-aries.tmj')).digest('hex')).toBe('86affaec2c2708b399473628b1c41edf0cecd102ab08cc172d76b41226c28842');
 });
});
