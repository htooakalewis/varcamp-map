import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import revision from '../../world/speaker-presentation.json';
import {beforeAriesWam} from './aries-presentation-history';

/** Genuine pre-rollout bytes plus a closed inverse of the named area successor. */
export function beforeSpeakerWam(id:string,supplied?:Buffer|string):Buffer{
 if(id==='speaker-aries')return beforeAriesWam(supplied);
 const fixture=readFileSync('tests/fixtures/speaker-presentation/before-wams.json');
 assert.equal(createHash('sha256').update(fixture).digest('hex'),'472673071ae2ce517a25cc5a3cacb10a288e6277bb57f91cb33ccaa7af499b00');
 const history=JSON.parse(fixture.toString()),spec=(revision.rooms as Record<string,any>)[id];
 assert.ok(spec&&Object.hasOwn(history.rooms,id),'Unknown historical speaker room');
 const raw=Buffer.from(history.rooms[id]),old=JSON.parse(raw.toString()),current=JSON.parse((supplied??readFileSync(`maps/${id}.wam`)).toString());
 for(const area of spec.areas){
  const matches=current.areas.filter((a:any)=>a.id===area.id);assert.equal(matches.length,1);
  assert.deepEqual(matches[0],{id:area.id,name:area.name,visible:true,x:area.x*32,y:area.y*32,width:area.width*32,height:area.height*32,properties:area.properties},'Unreviewed speaker area');
 }
 current.areas=current.areas.filter((a:any)=>a.id!==spec.areas[1].id).map((a:any)=>a.id===spec.areas[0].id?old.areas.find((a:any)=>a.id===spec.areas[0].id):a);
 assert.deepEqual(current,old,'Speaker WAM changed outside its named area successor');return raw;
}
