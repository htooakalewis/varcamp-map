import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export function preCove(path:string):any{
 const bytes=readFileSync('tests/fixtures/tropical-cove/baseline.json');
 if(hash(bytes)!=='afe5738dac6f0d815bf36ec0929e81f60b4230505d9cea67982f6120b37405e0')throw Error('Pre-cove receipt changed');
 const row=JSON.parse(bytes.toString()).files[path];if(!row)throw Error('Pre-cove file not registered');
 const body=readFileSync(row.fixture);if(hash(body)!==row.sha256)throw Error('Pre-cove body changed');return JSON.parse(body.toString());
}
