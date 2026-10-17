import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
const json = (p:string) => JSON.parse(readFileSync(p,'utf8'));
const before = (id:string, ext:string) => json(`tests/fixtures/beach-composition/before-${id}.${ext}`);
const current = (id:string,ext:string) => json(ext==='json'?`world/layouts/${id}.json`:`maps/${id}.tmj`);
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
describe('current beach composition preserves native history',()=>{
 it('pins the unchanged historical inputs',()=>{
  for(const [p,h] of Object.entries({
   'before-fa-ship.tmj':'4bc2c0935c02c3c961e2c3b37f650f7743bb64ea90484a827190db2e8ceb9a4b',
   'before-shipyard-beach.tmj':'3566cffbcf2321bd3ac0d375f3802171dd04c38d384a633f8ef6f7aaceea13ac',
   'before-fa-ship.json':'5b72da42a573909ef4d7a016b11a74f69b8798a7d35c07bd8f968a4d753dc7a4',
   'before-shipyard-beach.json':'dc9b379a2955e015c684baf6720fd59d30d8e25533c0ee9bfcacae46be043ac4'})) expect(sha(`tests/fixtures/beach-composition/${p}`)).toBe(h);
 });
 it('softens only all2440 sea cells below every original FA layer',()=>{
  const old=before('fa-ship','tmj'),now=current('fa-ship','tmj');
  const water=old.layers.find((l:any)=>l.name==='terrain').data.map((v:number,i:number)=>v>=1&&v<=18?i:-1).filter((i:number)=>i>=0);
  expect(water).toHaveLength(2440);
  const veil=now.layers[1],atlas=now.tilesets.at(-1);
  expect(veil.name).toBe('private-water-veil-trial');expect(veil.id).toBe(old.nextlayerid);
  expect(atlas.image).toBe('../assets/tilesets/original/beach-lounge.png');
  expect(atlas.firstgid).toBe(Math.max(...old.tilesets.map((t:any)=>t.firstgid+t.tilecount)));
  const mask=new Set(water),gid=atlas.firstgid+4*atlas.columns+8;
  expect(veil).toEqual({id:old.nextlayerid,name:'private-water-veil-trial',type:'tilelayer',width:48,height:56,data:Array.from({length:2688},(_,i)=>mask.has(i)?gid:0),visible:true,opacity:1,x:0,y:0});
  const restored=structuredClone(now);restored.layers.splice(1,1);restored.tilesets.pop();restored.nextlayerid--;
  expect(restored).toEqual(old);
 });
 it('removes only the duplicate board and updates the existing route text',()=>{
  const expected=before('shipyard-beach','tmj');
  const board=expected.layers.find((l:any)=>l.name==='scenery-belowAvatar-0');
  expect(board.data.slice(14*48+18,14*48+26)).toEqual(Array(8).fill(1475));
  board.data.splice(14*48+18,8,...Array(8).fill(0));
  const text=expected.layers.find((l:any)=>l.name==='wayfinding-text');
  text.objects=text.objects.filter((o:any)=>o.name!=='harbor-title');
  text.objects.find((o:any)=>o.name==='arrival-routes').text.text='FA SHIP ↓   SHORE →';
  expect(current('shipyard-beach','tmj')).toEqual(expected);
 });
 it('applies only the authored water mask and existing board text changes',()=>{
  const fa=before('fa-ship','json'),now=current('fa-ship','json');
  const added=now.placements.filter((p:any)=>p.id.startsWith('private-water-veil-'));
  expect(added).toHaveLength(2440);
  const water=before('fa-ship','tmj').layers[0].data.flatMap((v:number,i:number)=>v>=1&&v<=18?[`${i%48},${Math.floor(i/48)}`]:[]);
  expect(added.map((p:any)=>`${p.x},${p.y}`).sort()).toEqual(water.sort());
  expect(added.every((p:any)=>p.sprite==='beach-sea-veil'&&p.layer==='architecture'&&p.width===1&&p.height===1)).toBe(true);
  const restored=structuredClone(now);restored.placements=restored.placements.filter((p:any)=>!p.id.startsWith('private-water-veil-'));expect(restored).toEqual(fa);
  const beach=before('shipyard-beach','json');beach.placements=beach.placements.filter((p:any)=>p.id!=='wood-sign-harbor-title');
  beach.signs=beach.signs.filter((s:any)=>s.name!=='harbor-title');beach.signs.find((s:any)=>s.name==='arrival-routes').text='FA SHIP ↓   SHORE →';
  expect(current('shipyard-beach','json')).toEqual(beach);
 });
 it('keeps both native editor WAM documents byte-exact',()=>{
  expect(sha('maps/fa-ship.wam')).toBe('19f765e8fd4b314f84a7d00c37469c80d8061e28c435acbec5fa6917809a2786');
  expect(sha('maps/shipyard-beach.wam')).toBe('d631432218098ec0d1ac7991959418245d9614d30ef5c6a6ea7d23ff868b9018');
 });
 it('keeps previews the exact complete native projection',()=>{
  for(const id of ['fa-ship','shipyard-beach']){
   const map=current(id,'tmj');
   for(const p of map.properties??[])if(p.name==='script')p.value='../'+p.value;
   for(const t of map.tilesets)if(t.image)t.image='../'+t.image;
   const visit=(v:any)=>{if(!v||typeof v!=='object')return;if(v.name==='exitUrl'&&typeof v.value==='string')v.value=v.value.replace('.wam#','.tmj#');for(const child of Object.values(v))visit(child);};visit(map);
   expect(json(`maps/preview/${id}.tmj`)).toEqual(map);
  }
 });
});
