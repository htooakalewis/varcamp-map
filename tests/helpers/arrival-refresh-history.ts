import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
let cached:{version:number;base:string;components:Record<string,{raw:string;bytes:number;sha256:string}>;pins:Record<string,string>;assets:Record<string,string>;protected:Record<string,string>}|undefined;
export function beforeArrival(){
 if(cached)return cached;
 const raw=readFileSync('tests/fixtures/arrival-refresh/before.json.gz');assert.equal(sha(raw),'d8ec4dac36d852c287777a0e93a265ebedec145a5e3a198b12eae2397488184a','Genuine pre-arrival fixture changed');
 const data=JSON.parse(gunzipSync(raw,{maxOutputLength:32*1024*1024}).toString());assert.equal(data.version,1);assert.equal(data.base,'809a1d0645ae385d918d12a3d6eaffffe3c0fe8a');cached=data;return cached!;
}
export function beforeArrivalRaw(path:string):Buffer{const row=beforeArrival().components[path];assert.ok(row,'Unknown genuine pre-arrival input '+path);assert.equal(Buffer.byteLength(row.raw),row.bytes);assert.equal(sha(row.raw),row.sha256);return Buffer.from(row.raw);}
export const beforeArrivalJson=<T=any>(path:string):T=>JSON.parse(beforeArrivalRaw(path).toString());
/** Explicit byte successor, chained after earlier immutable epoch receipts. */
export function arrivalSuccessorSha(path:string,pin:string):string{
 const table=JSON.parse(readFileSync('tests/fixtures/arrival-refresh/transitions.json','utf8'));assert.equal(table.version,1);assert.equal(table.base,beforeArrival().base);
 const row=table.transitions[path]as[string,string]|undefined;if(!row||row[0]!==pin)return pin;
 assert.equal(row[0],beforeArrival().pins[path],'Arrival receipt must start at genuine pre-arrival bytes');return row[1];
}
