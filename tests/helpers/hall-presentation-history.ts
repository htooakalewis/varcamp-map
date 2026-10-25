/** Genuine pre-treatment bytes retained independently of the current author. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export function beforeHallRaw(path:string):Buffer{
 const raw=readFileSync('tests/fixtures/hall-presentation/baseline.json');
 assert.equal(sha(raw),'0de497d125cd3b0475e0fc1e0ba5327c8ce72a25f1ae7fc1edf9f777a46539e5','Frozen pre-treatment hall envelope changed');
 const evidence=JSON.parse(raw.toString());assert.equal(evidence.head,'6f7f5d6cd72e3ee87414a1fc2722b4b209596b0d');
 const row=evidence.files[path];assert.ok(row,'Unknown pre-treatment hall input');
 const bytes=readFileSync(row.fixture);assert.equal(sha(bytes),row.sha256,'Frozen hall body changed: '+path);return bytes;
}
export const beforeHallJson=<T=any>(path:string):T=>JSON.parse(beforeHallRaw(path).toString());
