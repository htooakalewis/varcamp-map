import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {writeOrganicCoast} from '../art/organic-coast';
import {refineBeachVisuals} from './refine-beach.mjs';
import {assertNativeOrganicCoast} from './organic-coast';
import {assertNativeOceanMap} from './beach-ship';
import {assertNativeStandingCaptions} from './standing-captions';
/** Intentional forward authoring from the reviewed immutable 2c16073 input, never an editor/WAM importer. */
const raw=readFileSync('tests/fixtures/organic-coast/before-native.tmj');
if(createHash('sha256').update(raw).digest('hex')!=='96e29d9fa3bec117d87b2b7037efbc6066007a6e97283b07e37150aaf204c679')throw Error('Reviewed coast baseline changed');
await writeOrganicCoast();
const layout=JSON.parse(readFileSync('world/layouts/shipyard-beach.json','utf8')),catalog=JSON.parse(readFileSync('art/tile-catalog.json','utf8'));
const result=refineBeachVisuals(JSON.parse(raw.toString()),layout,catalog);
assertNativeOrganicCoast(result.map,result.layout);assertNativeOceanMap(result.map,result.layout);assertNativeStandingCaptions(result.map,result.layout);
writeFileSync('world/layouts/shipyard-beach.json',JSON.stringify(result.layout,null,2)+'\n');writeFileSync('maps/shipyard-beach.tmj',JSON.stringify(result.map)+'\n');
