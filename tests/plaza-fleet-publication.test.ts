import {beforeAll,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {renderPlazaFleet} from '../tools/art/plaza-fleet';
import {assertFleetRegistrations,assertFleetArtifactBytes,FLEET_ART_PATHS} from '../tools/art/plaza-fleet-check';
const rows=FLEET_ART_PATHS.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
const registry=(files=rows)=>({'plaza-original-drones':{files}});
it('accepts the exact closed16 source/export registrations',()=>expect(()=>assertFleetRegistrations(registry())).not.toThrow());
it.each(FLEET_ART_PATHS)('rejects omitted source/export registration %s',path=>expect(()=>assertFleetRegistrations(registry(rows.filter(r=>r.path!==path)))).toThrow(/required registration/));
it('rejects duplicate fleet ownership',()=>expect(()=>assertFleetRegistrations(registry([...rows,rows[0]]))).toThrow(/required registration/));
it('rejects unknown fleet ownership',()=>expect(()=>assertFleetRegistrations(registry([...rows,{path:'art/source/plaza-fleet-unreviewed.png',sha256:'0'.repeat(64)}]))).toThrow(/required registration/));
it('rejects an incorrect master hash',()=>expect(()=>assertFleetRegistrations(registry(rows.map((r,i)=>i? r:{...r,sha256:'0'.repeat(64)})))).toThrow(/hash changed/));
let expected:Map<string,Buffer>;
beforeAll(async()=>{
 const r=await renderPlazaFleet();expected=new Map();
 for(const a of r.aircraft){expected.set(a.overlay.image,a.png);expected.set(a.posePath,a.posePng);expected.set(a.metadataPath,Buffer.from(JSON.stringify(a.metadata,null,2)+'\n'));}
 expected.set('art/source/plaza-fleet.json',Buffer.from(JSON.stringify(r.metadata,null,2)+'\n'));
});
it('accepts exactly reproduced PNG, pose, descriptor and aggregate bytes',()=>expect(()=>assertFleetArtifactBytes(new Map([...expected.keys()].map(p=>[p,readFileSync(p)])),expected)).not.toThrow());
it.each(['assets/tilesets/original/plaza-fleet-camera.png','art/source/plaza-fleet-camera-poses.png','art/source/plaza-fleet-camera.json','art/source/plaza-fleet.json'])('rejects changed producer artifact %s',p=>{
 const actual=new Map(expected),changed=Buffer.from(actual.get(p)!);changed[changed.length-1]^=1;actual.set(p,changed);
 expect(()=>assertFleetArtifactBytes(actual,expected)).toThrow(/producer differs/);
});
it('rejects a missing native output',()=>{const actual=new Map(expected);actual.delete([...actual.keys()][0]);expect(()=>assertFleetArtifactBytes(actual,expected)).toThrow(/producer differs/);});
it('rejects an extra native output',()=>expect(()=>assertFleetArtifactBytes(new Map([...expected,['unknown.png',Buffer.from('x')]]),expected)).toThrow(/roster/));
