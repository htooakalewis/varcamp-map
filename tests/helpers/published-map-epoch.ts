/** Exact published inputs keep historical assertions independent of current art. */
import{readFileSync,copyFileSync,mkdirSync}from'node:fs';
import{createHash}from'node:crypto';
import{dirname,resolve}from'node:path';
const receiptPath='tests/fixtures/published-491-map-epoch/receipt.json';
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export function publishedEpochRaw(path:string):Buffer{
 const raw=readFileSync(receiptPath);if(sha(raw)!=='a727ab4668ee550ae19ee87a3b53de2ffbc3a722b49cbc30b5e487769fca5923')throw Error('Historical491 receipt changed');
 const receipt=JSON.parse(raw.toString()),rows=receipt.inputs.filter((r:{sourcePath:string})=>r.sourcePath===path);if(receipt.version!==1||receipt.sourceCommit!=='491f506ebda2ccd904801ee0781e8a6b5f5a0c36'||receipt.inputs.length!==49||rows.length!==1)throw Error('Historical491 closed input missing/ambiguous: '+path);
 const row=rows[0],bytes=readFileSync(row.proposedPath);if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)throw Error('Historical491 body changed: '+path);return bytes;
}
export const publishedEpochJson=<T=any>(path:string):T=>JSON.parse(publishedEpochRaw(path).toString());
/** An explicitly historical CLI runs its actual old code/provenance, never a
 * current-source authority test with hashes bypassed. */
export function stageHistoricalCoastInputs(target:string):void{
 const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));publishedEpochRaw('art/tile-catalog.json');
 if(receipt.cliClosure.length!==42)throw Error('Historical CLI closure changed');
 for(const row of receipt.cliClosure){
  const bytes=readFileSync(row.storedPath);if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)throw Error('Historical CLI dependency changed: '+row.sourcePath);
  const dest=resolve(target,row.sourcePath);mkdirSync(dirname(dest),{recursive:true});copyFileSync(row.storedPath,dest);
 }
}
