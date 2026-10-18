import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{expect,it}from'vitest';
import{approvedUnchangedLayoutIds,approvedHistoricalLayout,approvedHistoricalRaw,assertApprovedLayoutSuccessor,advanceReviewedProvenance}from'./helpers/approved-world-successor';
import before from'./fixtures/interior-original-palms/before.json';
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const current=(id:string)=>JSON.parse(readFileSync(`world/layouts/${id}.json`,'utf8'));
it('ties genuine old14 interior hash oracles and every current30 source body to only the eight reviewed forward inputs',()=>{
 expect(approvedUnchangedLayoutIds).toHaveLength(30);
 for(const[id,pin]of Object.entries(before.maps)){
  const old=approvedHistoricalLayout(id),rest=structuredClone(old);delete(rest as Partial<typeof rest>).placements;
  expect(digest(rest)).toBe(pin.layoutExceptPlacementsSha256);expect(digest(old.animatedOverlays)).toBe(pin.motionSha256);
 }
 for(const id of approvedUnchangedLayoutIds)assertApprovedLayoutSuccessor(id,current(id));
 expect(createHash('sha256').update(approvedHistoricalRaw('maps/overworld.tmj')).digest('hex')).toBe('65d9705f7c44078bf7f593b4d966315cac67f0b02029660f7d2666bbd18ebcd8');
});
it.each(['control','clock','unknown-input','old-pin','input-order','extra-field'])('rejects %s instead of stripping provenance or trusting a refreshed current receipt',kind=>{
 const layout=current('speaker-aries'),overlay=layout.animatedOverlays[0];
 if(kind==='control')layout.entries[0].x++;
 if(kind==='clock')overlay.animations[0].frames[0].duration++;
 if(kind==='unknown-input')overlay.provenance.inputs.push({path:'tools/maps/unapproved.ts',sha256:'0'.repeat(64)});
 if(kind==='old-pin')overlay.provenance.inputs.find((p:{path:string})=>p.path==='tools/art/native-motion.ts').sha256='8746ae341a730748115a051a7b8b6750689f9afac6bd5b59f4900aa2e730b9a6';
 if(kind==='input-order')overlay.provenance.inputs.reverse();
 if(kind==='extra-field')overlay.provenance.unapproved=true;
 expect(()=>assertApprovedLayoutSuccessor('speaker-aries',layout)).toThrow();
});
it('refuses a changed historical fingerprint before making any forward replacement',()=>{
 const old=approvedHistoricalLayout('speaker-aries');old.animatedOverlays![0].provenance!.inputs.find(p=>p.path==='tools/art/native-motion.ts')!.sha256='0'.repeat(64);
 expect(()=>advanceReviewedProvenance(old)).toThrow(/Unreviewed old provenance/);
});
