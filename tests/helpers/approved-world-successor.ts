/** Test-only finite forward epoch. Genuine historical bytes are never inferred
 * from current receipts, stripped current objects or a producer's own output. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {WORLD_CATALOG} from '../../src/world/catalog';
import type {MapLayout,TiledMap} from '../../tools/maps/types';

const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
/** Pins from the separately reviewed original18-file fleet source epoch. The
 * ten generated exports are verified by their pure producer instead. */
export const approvedFleetStaticPins:Record<string,string>={
 'art/source/plaza-fleet-original/NOTICE.txt':'48d58c59629c4b2e82ba91d085c1c91dfdecd47031af9a17212799090b2c407f',
 'art/source/plaza-fleet-original/camera-generated-master.png':'b5a8e018bac965c4cf142cf643696e95d39ac1b1938d211a2f0f9aa63edf1820',
 'art/source/plaza-fleet-original/delivery-generated-master.png':'2927e60ebbe6afd41c7f903d2811b42614360050f721ef48fde5df79a7bc261b',
 'art/source/plaza-fleet-original/prompts.json':'01508859019a2669ffce68048e00257018d1933a7934a84817ffa504523a0b26',
 'art/source/plaza-fleet-original/survey-generated-master.png':'ed9734eb1de8b895676a49e08131e9fb48b5db453f7305efc8bc3983c9e38908',
 'art/source/plaza-fleet-recipe.json':'343db1ef1f79eaf111759651092ae82efeaa61ae152fe971c5f30ce4d41f78f3',
};
/** Pins from the reviewed expo epoch: the static booth sticker sheet and its master, the
 * only rows the expo added to the closed `original` source registry so far. */
export const approvedExpoStaticPins:Record<string,string>={
 'art/source/booth-stickers.svg':'839720ee00ad4c94b1358698d89f59ddd867065a55031004c3d7c874908c9c72',
 'assets/tilesets/original/booth-stickers.png':'b319354b5e5b8dbd1b549fa98af6d77280361fff907aee5dc03d4b0c84535241',
};
/** Where those two rows sit inside the otherwise unchanged `original` registry order. */
export const approvedExpoStaticRows:Record<string,number>={'art/source/booth-stickers.svg':0,'assets/tilesets/original/booth-stickers.png':46};
/** The expo caption family (hall epoch): descriptor, SVG master and glyph PNG rendered by the
 * caption producer from the twelve linked overworld booth nameplates, registered in path order. */
export const approvedExpoCaptionRows:Record<string,number>={'art/source/expo-captions.json':28,'art/source/expo-captions.svg':29,'assets/tilesets/original/expo-captions.png':62};
/** The one sentence the expo epoch appended to the `original` registry's change log. */
export const approvedExpoRegistryNote=' Expo-plaza addition: six original 32px booth sticker badges (star, heart, bolt, pin, smile, leaf) in the cream/teal/peach/lavender/amber palette with a thin cream outline, authored on the integer grid in booth-stickers.svg and exported natively to booth-stickers.png; no imported pixels copied.';
export const approvedBirdRecipePins:Record<string,string>={
 'art/source/coast-life-tracks.json':'bd0dbb1202ccd1e84a89f0e796ab839371f102ebec1de4cb67053c84a190e7f6',
 'art/source/world-ambient.json':'a890d78049e5f891358e11a3e8270ede2c2fb97ce5d3bd339686e3924a8ce8b7',
};
const changes:Record<string,readonly[string,string]>={
 'art/source/world-ambient.json':['c4c7651c3b7e31d7e5762ee0ede695209080ee9d76ed8f9ce27a44d404a596ad','a890d78049e5f891358e11a3e8270ede2c2fb97ce5d3bd339686e3924a8ce8b7'],
 'tools/art/world-ambient.ts':['0d1e1c1e2b9625c48e48a975ceea79375f2b58b6ddf77169d693ffecfe03efd1','46cbb04d3e4e016e72e8fea91f5c21bb67f13f219d4992996c3153a2735a6bac'],
 'tools/maps/animated-decoration-contract.json':['0be7d46784d2038890168d22e4dbf0c84d745d100e367a2f99fc592aa39ed189','fd6a605e785551d6709e60cd1c2ae5c477e5152169b9ae7e8b78ac4d14f4a4e0'],
 'tools/maps/animated-decoration.ts':['b775031225c80a635de80d0e99a3791938e1d809998a9d880abc7e00e52b78cf','b4e0788debcb53cbbac97488d88f6da2a3bdf0f0b2d6effe251f8552b4590621'],
 'tools/maps/native-projection.ts':['ddd3886d4549044efb7e82455c283e12e26089859b4a8aa05c9a222798c27554','adbdae3a54b2787d969d15d57a0933a114c0c9a8823a5a699f2525219343de48'],
 'tools/maps/native-ownership-context.ts':['3ded4e618c1e53e73a0afc3813bceae75a71460af6b3e06cd2b6ed3aa7571e50','21609175a04a025098b43eba47480938ef59162c341573f4b88edc4c3b3e51e6'],
 'tools/art/native-motion.ts':['8746ae341a730748115a051a7b8b6750689f9afac6bd5b59f4900aa2e730b9a6','4e6f0d41813fefc8a40dd5bf211866e5cd51eed882182bd97b93b220e13acf1a'],
 'tools/maps/builder.ts':['f7b58d120c5d97f63a3800bdd1d6c4aa1203402ef7d309da29b6d9c743197a50','7a9f2f5ed184e242f5b00d73051573038270a399c9ba64ee84621ed3a4e13d19'],
 'tools/maps/types.ts':['cf573467e8a0e086e6c96210881bd568da6e6dc048763ae8cd6e647d11974767','ab85fec8339f4df6a9051ca300a7cc2256af153de88471ff6fa1d4fafadf76bb'],
};
export const approvedUnchangedLayoutIds=Object.keys(WORLD_CATALOG).filter(id=>!['overworld','shipyard-beach','constellation-shore','fa-ship'].includes(id)).sort();
interface Component {path:string;bytes:number;sha256:string;raw:string}
function components():Map<string,Component>{
 const raw=readFileSync('tests/fixtures/approved-world-successor/before.json.gz');
 assert.equal(sha(raw),'70663c032ff1977885948e0e2e0eaf6f7f482cd8c0cb64a91cf44e5d20895407','Genuine pre-fleet fixture changed');
 const value=JSON.parse(gunzipSync(raw,{maxOutputLength:6*1024*1024}).toString());
 assert.equal(value.version,1);assert.equal(value.sourceInventorySha256,'d274c3e25dab2e5123a382db796b4a88980485aa6ee845a3d55baf83a8fc7080');
 assert.equal(approvedUnchangedLayoutIds.length,30);
 assert.deepEqual(value.components.map((r:Component)=>r.path),[...approvedUnchangedLayoutIds.map(id=>`world/layouts/${id}.json`),'maps/overworld.tmj','maps/overworld.wam']);
 const result=new Map<string,Component>();for(const c of value.components){assert.deepEqual(Object.keys(c).sort(),['bytes','path','raw','sha256']);assert.equal(Buffer.byteLength(c.raw),c.bytes);assert.equal(sha(c.raw),c.sha256);result.set(c.path,c);}
 assert.equal(result.size,32);return result;
}
export function approvedHistoricalRaw(path:string):Buffer{
 const c=components().get(path);assert.ok(c,'Unregistered historical component '+path);return Buffer.from(c.raw);
}
export function approvedHistoricalLayout(id:string):MapLayout{return JSON.parse(approvedHistoricalRaw(`world/layouts/${id}.json`).toString());}
export function approvedHistoricalPlaza():TiledMap{return JSON.parse(approvedHistoricalRaw('maps/overworld.tmj').toString());}
/** No field removal: only nine reviewed input SHA transitions, from exact old
 * values to independently reviewed current producer bytes, preserve every key.
 * The expo epoch advanced three of them (builder footprints, image type note,
 * expo reservation family); every other row is the fleet epoch value. */
export function advanceReviewedProvenance(layout:MapLayout):MapLayout{
 for(const[path,[,after]]of Object.entries(changes))assert.equal(sha(readFileSync(path)),after,'Reviewed producer epoch changed '+path);
 const result=structuredClone(layout);
 for(const overlay of result.animatedOverlays??[])for(const input of overlay.provenance?.inputs??[]){const pair=changes[input.path];if(pair){assert.equal(input.sha256,pair[0],'Unreviewed old provenance '+input.path);input.sha256=pair[1];}}
 return result;
}
export function assertApprovedLayoutSuccessor(id:string,current:MapLayout):void{
 assert.deepEqual(current,advanceReviewedProvenance(approvedHistoricalLayout(id)),'Only the finite reviewed producer fingerprints may advance '+id);
}
