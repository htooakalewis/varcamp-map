import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadTileCatalog} from '../tools/art/catalog';
import {standingFace,assertVisual,assertSponsorFootprints} from './helpers/physical-prop-contracts';
const source=()=>JSON.parse(readFileSync('world/layouts/overworld.json','utf8'));
const native=()=>JSON.parse(readFileSync('maps/overworld.tmj','utf8'));
const catalog=loadTileCatalog();
describe('physical prop consumer contracts',()=>{
 it('requires exact declared face and original visual lineage',()=>{expect(standingFace(source(),catalog,'welcome-control-sign','hub-nav-welcome').id).toBe('welcome-control-sign');});
 it.each(['missing','duplicate','wrongface','wrongvisual'])('rejects %s assembly omission/substitution',kind=>{const l=source();if(kind==='missing')l.standingSigns=l.standingSigns.filter((s:any)=>s.face!=='welcome-control-sign');if(kind==='duplicate')l.standingSigns.push(l.standingSigns.find((s:any)=>s.face==='welcome-control-sign'));if(kind==='wrongface')l.standingSigns.find((s:any)=>s.face==='welcome-control-sign').face='directory-prompt';if(kind==='wrongvisual')l.placements.find((p:any)=>p.id==='welcome-control-sign').sprite='standing-hub-nav-directory';expect(()=>standingFace(l,catalog,'welcome-control-sign','hub-nav-welcome')).toThrow();});
 it('rejects unrelated visual despite a plausible alias name',()=>expect(()=>assertVisual({...catalog['hub-nav-welcome'],rect:catalog['hub-nav-directory'].rect},catalog['hub-nav-welcome'])).toThrow());
 it('accepts only the six actual support endpoints and connected remaining image footprint',()=>assertSponsorFootprints(source(),catalog,native()));
 it.each(['missingbase','seventhbase','interiorbase','upperpost','blockedcontrol','unrelatedoverlap','widebase'])('rejects %s physical contract drift',kind=>{const l=source(),m=native(),mask=m.layers.find((r:any)=>r.name==='physical-collisions').data,wall=mask.find(Boolean);if(kind==='missingbase')mask[68*128+53]=0;if(kind==='seventhbase')mask[67*128+54]=wall;if(kind==='interiorbase'){const p=l.placements.find((p:any)=>p.id==='standing-sponsor-0-support-0');p.x++;}if(kind==='upperpost')l.placements.find((p:any)=>p.id==='standing-sponsor-0-support-0').renderRole='canopy';if(kind==='unrelatedoverlap')l.placements.push({id:'unrelated-cover',sprite:'floor-charcoal',x:54,y:67,width:1,height:1,layer:'props'});if(kind==='widebase')l.placements.find((p:any)=>p.id==='standing-sponsor-0-support-0').width=2;if(kind==='blockedcontrol'){const e=l.entries[0];mask[e.y*128+e.x]=wall;}expect(()=>assertSponsorFootprints(l,catalog,m)).toThrow();});
});
