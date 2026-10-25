import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import spec from '../../world/aries-presentation.json';

/** Genuine saved history, reached only through the finite Aries area successor. */
export function beforeAriesWam(supplied?: Buffer|string): Buffer {
 const raw=readFileSync('tests/fixtures/aries-presentation/before.wam');
 assert.equal(createHash('sha256').update(raw).digest('hex'),'e9e697714a7ae9eebb0e2c24aec7b5292a5dbfe21ce503396ac29dbb1b840f21');
 const old=JSON.parse(raw.toString()),current=JSON.parse((supplied??readFileSync('maps/speaker-aries.wam')).toString());
 const native=(a:any)=>({id:a.id,name:a.name,visible:true,x:a.x*32,y:a.y*32,width:a.width*32,height:a.height*32,properties:a.properties});
 for(const area of spec.areas){
  const matches=current.areas.filter((a:any)=>a.id===area.id);
  assert.equal(matches.length,1,'Missing or duplicate Aries successor area');
  assert.deepEqual(matches[0],native(area),'Unreviewed Aries successor area');
 }
 current.areas=current.areas.filter((a:any)=>a.id!=='aries-audience').map((a:any)=>a.id==='meeting-aries'?old.areas.find((a:any)=>a.id==='meeting-aries'):a);
 assert.deepEqual(current,old,'Aries WAM changed outside the named area successor');
 return raw;
}
