import {beforeExpoChairCatalog,restoreExpoChairNative} from '../tools/maps/expo-chair-physics';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {describe,it,expect} from 'vitest';
import {applyVibeCodeBranding,restoreVibeCodeBranding,reconcileVibeCodeBranding,VIBECODE_MAP_IDS} from '../tools/maps/vibecode-branding';
import {renderReferenceInterior} from '../tools/maps/reference-interiors';
import {assertCurrentNativeMap} from '../tools/maps/current-native';
import {loadTileCatalog} from '../tools/art/catalog';
import {checkVibeCodeArt} from '../tools/art/vibecode';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const raw=readFileSync('tests/fixtures/vibecode/before.json.gz');
expect(createHash('sha256').update(raw).digest('hex')).toBe('72b7c42fb448dce358ad8491df31f136704209cac95f3f0d24f569b9410cc11f');
const b=JSON.parse(gunzipSync(raw).toString()),prior=(p:string)=>JSON.parse(b.components[p].raw),catalog=loadTileCatalog();
describe('Vibe Code Tours booth and room branding',()=>{
 it.each(VIBECODE_MAP_IDS)('%s changes only its approved image and optional booth label',id=>{
  const l=read(`world/layouts/${id}.json`),old=prior(`world/layouts/${id}.json`),m=read(`maps/${id}.tmj`);
  expect(l).toEqual(applyVibeCodeBranding(old));expect(restoreVibeCodeBranding(l)).toEqual(old);
  for(const k of ['placements','areas','entries','exits','inspectionZones','animatedOverlays','standingSigns'])expect(l[k]).toEqual(old[k]);
  const expected=id==='overworld'?reconcileVibeCodeBranding(prior('maps/overworld.tmj'),l,beforeExpoChairCatalog(catalog)):renderReferenceInterior(l,catalog).tmj;
  expect(id==='overworld'?restoreExpoChairNative(m,l,catalog):m).toEqual(expected);assertCurrentNativeMap(id,m,l,read(`maps/${id}.wam`),catalog);
 });
 it('keeps every old image, all reservations and every control; replaces only the empty booth caption',()=>{
  const l=read('world/layouts/overworld.json'),m=restoreExpoChairNative(read('maps/overworld.tmj'),l,catalog),old=prior('maps/overworld.tmj');
  expect(l.signs.find((s:any)=>s.name==='expo-s6-nameplate').text).toBe('VIBE CODE TOURS');
  expect(m.tilesets).toHaveLength(old.tilesets.length+1);
  for(const t of old.tilesets){const now=m.tilesets.find((x:any)=>x.name===t.name)!;if(t.name==='standing-captions'){expect(now.firstgid).toBe(t.firstgid);expect(now.tilecount).toBe(t.tilecount);}else expect(now).toEqual(t);}
  for(const row of old.layers){const now=m.layers.find((x:any)=>x.name===row.name)!;expect(now.id).toBe(row.id);if(row.name!=='standing-caption-expo-s6-nameplate')expect(now).toEqual(row);}
 });
 it.each(['moved','removed','duplicate','caption','collision'])('rejects %s branding drift',kind=>{
  const l=read('world/layouts/overworld.json');
  const i=l.images.findIndex((i:any)=>i.image==='assets/sponsors/vibecode-tours.png');
  if(kind==='moved')l.images[i].x--;if(kind==='removed')l.images.splice(i,1);if(kind==='duplicate')l.images.push(l.images[i]);
  if(kind==='caption')l.signs.find((s:any)=>s.name==='expo-s6-nameplate').text='WRONG';
  if(kind==='collision')l.placements[0].x++;
  expect(()=>restoreVibeCodeBranding(l)).toThrow();
 });
 it('retains supplied vector artwork and deterministic native pixels',async()=>{await checkVibeCodeArt();});
});
