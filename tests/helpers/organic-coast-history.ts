import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
/** Authentic prior release inputs. Current coast behavior is tested against current native art separately. */
export function historicalBeach(kind:'native'|'layout'){
 const row=kind==='native'?['before-native.tmj','96e29d9fa3bec117d87b2b7037efbc6066007a6e97283b07e37150aaf204c679']:['before-layout.json','fd2ae22c43494fb3c58702c256467b9e1dacc6acc8fa6f07389c12151aac6fa2'];
 const bytes=readFileSync('tests/fixtures/organic-coast/'+row[0]);if(createHash('sha256').update(bytes).digest('hex')!==row[1])throw Error('Organic coast historical baseline changed');return JSON.parse(bytes.toString());
}
