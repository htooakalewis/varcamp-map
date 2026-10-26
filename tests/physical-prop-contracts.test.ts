import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadTileCatalog} from '../tools/art/catalog';
import {standingFace,assertVisual,assertSponsorFootprints,assertRaisedSponsorFootprints} from './helpers/physical-prop-contracts';
import {historicalFloorPlaza} from './helpers/plaza-successor';
import {preArrivalLayout} from './helpers/pre-arrival-epoch';
const source=()=>JSON.parse(readFileSync('world/layouts/overworld.json','utf8'));
const native=()=>JSON.parse(readFileSync('maps/overworld.tmj','utf8'));
const catalog=loadTileCatalog();
describe('physical prop consumer contracts',()=>{
 it('retains the exact historical face and original visual lineage behind the checked arrival successor',()=>{expect(standingFace(preArrivalLayout(source()),catalog,'arrival-direction-crosspost','hub-nav-arrival-crosspost').id).toBe('arrival-direction-crosspost');});
 it.each(['missing','duplicate','wrongface','wrongvisual'])('rejects historical %s assembly omission/substitution',kind=>{const l=preArrivalLayout(source());if(kind==='missing')l.standingSigns=l.standingSigns!.filter((s:any)=>s.face!=='arrival-direction-crosspost');if(kind==='duplicate')l.standingSigns!.push(l.standingSigns!.find((s:any)=>s.face==='arrival-direction-crosspost')!);if(kind==='wrongface')l.standingSigns!.find((s:any)=>s.face==='arrival-direction-crosspost')!.face='directory-prompt';if(kind==='wrongvisual')l.placements.find((p:any)=>p.id==='arrival-direction-crosspost')!.sprite='standing-hub-nav-directory';expect(()=>standingFace(l,catalog,'arrival-direction-crosspost','hub-nav-arrival-crosspost')).toThrow();});
 it('rejects unrelated visual despite a plausible alias name',()=>expect(()=>assertVisual({...catalog['hub-nav-welcome'],rect:catalog['hub-nav-directory'].rect},catalog['hub-nav-welcome'])).toThrow());
 it('retains the six-post historical sponsor receipt on actual frozen bytes',()=>assertRaisedSponsorFootprints(historicalFloorPlaza('layout') as any,catalog,historicalFloorPlaza('native') as any));
 it('keeps all four current logo inlays walkable below avatars',()=>assertSponsorFootprints(source(),catalog,native()));
 it.each(['missingbase','seventhbase','interiorbase','upperpost','blockedcontrol','unrelatedoverlap','widebase'])('rejects %s physical contract drift',kind=>{const l=historicalFloorPlaza('layout') as any,m=historicalFloorPlaza('native') as any,mask=m.layers.find((r:any)=>r.name==='physical-collisions').data,wall=mask.find(Boolean);if(kind==='missingbase')mask[68*128+53]=0;if(kind==='seventhbase')mask[67*128+54]=wall;if(kind==='interiorbase'){const p=l.placements.find((p:any)=>p.id==='standing-sponsor-0-support-0');p.x++;}if(kind==='upperpost')l.placements.find((p:any)=>p.id==='standing-sponsor-0-support-0').renderRole='canopy';if(kind==='unrelatedoverlap')l.placements.push({id:'unrelated-cover',sprite:'floor-charcoal',x:54,y:67,width:1,height:1,layer:'props'});if(kind==='widebase')l.placements.find((p:any)=>p.id==='standing-sponsor-0-support-0').width=2;if(kind==='blockedcontrol'){const e=l.entries[0];mask[e.y*128+e.x]=wall;}expect(()=>assertRaisedSponsorFootprints(l,catalog,m)).toThrow();});
});

it.each(['raised','post','moved','missing-cell','wrong-cell','above-avatar','blocked-logo','blocked-control','unrelated-prop'])('rejects current floor-logo %s drift',kind=>{
 const l=source(),m=native(),mask=m.layers.find((r:any)=>r.name==='physical-collisions').data,wall=mask.find(Boolean),panel=m.layers.find((p:any)=>p.name==='Sponsors / Demo 01');
 if(kind==='raised')l.images[0].standing=true;
 if(kind==='post')l.placements.push({id:'standing-sponsor-0-support-0',sprite:'solid-sign-post',x:53,y:68,width:1,height:1,layer:'props'});
 if(kind==='moved')l.images[0].x++;
 if(kind==='missing-cell')panel.data[55*128+53]=0;
 if(kind==='wrong-cell')panel.data[55*128+53]++;
 if(kind==='above-avatar')m.layers.push(m.layers.splice(m.layers.indexOf(panel),1)[0]);
 if(kind==='blocked-logo')mask[55*128+53]=wall;
 if(kind==='blocked-control'){const e=l.entries[0];mask[e.y*128+e.x]=wall;}
 if(kind==='unrelated-prop')l.placements.push({id:'unrelated-cover',sprite:'floor-charcoal',x:54,y:55,width:1,height:1,layer:'props'});
 expect(()=>assertSponsorFootprints(l,catalog,m)).toThrow();
});
