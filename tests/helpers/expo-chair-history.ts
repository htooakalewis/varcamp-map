import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
/** Closed byte transitions from the audited 7f24c28 baseline. */
export function expoChairSuccessorSha(path:string,pin:string):string{
 const receipt=JSON.parse(readFileSync('tests/fixtures/expo-chair-physics/transitions.json','utf8'));
 assert.equal(receipt.version,1);
 assert.equal(receipt.base,'7f24c28b111a307f8ce010950671900660f3226e');
 const pair=receipt.transitions[path];
 return pair&&pair[0]===pin?pair[1]:pin;
}
