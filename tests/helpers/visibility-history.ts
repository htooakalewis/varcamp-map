// Frozen 17d4 receipts and the independently approved 133+24 role transformation.
// This inverse first verifies current visual semantics, then restores ONLY scenery
// data/explicit added layers and proves the entire original native/layout receipt.
// Historical tests apply their older start/robot/Roadster inverses only afterward.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { buildMap } from '../../tools/maps/builder';
import { loadTileCatalog } from '../../tools/art/catalog';
import type { MapLayout, TiledMap } from '../../tools/maps/types';
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const json=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const scenery=(l:any)=>/^scenery-(belowAvatar|aboveAvatar)-\d+$/.test(l.name);
function requireEqual(actual:unknown,expected:unknown,why:string){if(!isDeepStrictEqual(actual,expected))throw Error(why);}
const receipts = {
  "air-district": {
    "roles": {
      "west-lamp": "grounded",
      "east-lamp": "grounded",
      "shrine-lamp-west": "grounded",
      "shrine-lamp-east": "grounded",
      "shrine-zodiac-west": "grounded",
      "shrine-zodiac-east": "grounded",
      "studio-wall-chart": "grounded",
      "studio-display": "grounded",
      "studio-cyan-west": "grounded",
      "studio-cyan-east": "grounded"
    },
    "native": "54a4e75b35ca5f78b6cae1aef16ed5eff263228d20ca0970f33d249e2f64a5e0",
    "layout": "c8c73ba0c1041df481f383815cf384cec341afab161a1673f31aaad6f2fa9b25",
    "addedLayers": [],
    "nativeBytes": "705f495d712e43cc50332ec9690f904c8bdeeed9d0fee4267ec6d0016e736808",
    "layoutEncoding": "ascii",
    "layoutBytes": "378aedecefe87dea292a6ddb3ccf929d91ed283a95089e7cc829e06e0a4fc05f"
  },
  "campus-exploration": {
    "roles": {
      "fire-wall": "cutaway",
      "air-wall": "cutaway",
      "earth-wall": "cutaway",
      "water-wall": "cutaway",
      "star-garden-wall": "cutaway",
      "moon-cafe-wall": "cutaway",
      "moon-grotto-wall": "cutaway",
      "stargazer-terrace-wall": "cutaway",
      "directory-screen": "grounded",
      "court-light-west": "grounded",
      "court-light-east": "grounded",
      "directory-screen-content": "grounded"
    },
    "native": "6a0c17498b9a0938d96b53e34e5a65ef9514dc36a0acb8c4647e0a1e742b58dd",
    "layout": "c14eb459f43db5ea9e566251773207e83e8a31a450381066bf28a85ff4ac682e",
    "addedLayers": [],
    "nativeBytes": "4639e7a9d5df6003fd81808f83461255abd298a165d3f8ad00ddcced50eb5e0f",
    "layoutEncoding": "ascii",
    "layoutBytes": "9ba7d0fe00c512003e23c5433279e4a058011ae386d9095600768302e995c807"
  },
  "comet-maze": {
    "roles": {
      "finish-light-west": "grounded",
      "lobby-light-west": "grounded",
      "finish-light-east": "grounded",
      "lobby-light-east": "grounded",
      "finish-stars": "grounded"
    },
    "native": "eda31556f69606df4710529b3fb857860b11478ce0af7a886e6c07e7daf83844",
    "layout": "7ab5415db269965598a34ecba6812ca01447e36a82d5bc18b52f54cf96cf4fe2",
    "addedLayers": [],
    "nativeBytes": "ecd4bb38ad032e6d54a7769dde86d10fbc12fe3be4f27be2f22f78e115bbbcf7",
    "layoutEncoding": "ascii",
    "layoutBytes": "6da54aaf8722ea2d7ba21d169895a427c3ec3af24d52d8e73ac4bb80662cde07"
  },
  "earth-district": {
    "roles": {
      "west-lamp": "grounded",
      "east-lamp": "grounded",
      "shrine-lamp-west": "grounded",
      "shrine-lamp-east": "grounded",
      "shrine-zodiac-west": "grounded",
      "shrine-zodiac-east": "grounded",
      "archive-wall-chart": "grounded"
    },
    "native": "620b7925b65f1bdea1b382a0f607d344818eb326002eec24de5b33053a644c04",
    "layout": "e3b61cc627c7cd041b890cc00943fb3800daa87723844e73de7acc1dca9bbca1",
    "addedLayers": [],
    "nativeBytes": "b8d84d07fe529d7088f0e1ac21560bd248207424678ece64d6e0ac4dc8c96720",
    "layoutEncoding": "ascii",
    "layoutBytes": "cdffde19bce99cde3527405730c81dce7dcbd76222d19f23b34bc1cabfea6205"
  },
  "fire-district": {
    "roles": {
      "west-lamp": "grounded",
      "east-lamp": "grounded",
      "shrine-lamp-west": "grounded",
      "shrine-lamp-east": "grounded",
      "shrine-zodiac-west": "grounded",
      "shrine-zodiac-east": "grounded",
      "forge-wall-display": "grounded"
    },
    "native": "7a847653daeff7076f3048db2c96178ea5507ce9fd03c84715c9590a97093ffa",
    "layout": "31949b36f104c3fb6dfe7fe465bf99532aa37f7369cd96ece69f25db95968f8f",
    "addedLayers": [],
    "nativeBytes": "b7569b25a36492c3b66c20eba49701086b8ac4c4fd20e0165f4bb8973ca667d2",
    "layoutEncoding": "ascii",
    "layoutBytes": "8854c245cbb1d8dfc695510a107dc396df5fece72e7cca82a4fd5283d0827be6"
  },
  "hidden-observatory": {
    "roles": {
      "west-lamp": "grounded",
      "east-lamp": "grounded",
      "shrine-light-west": "grounded",
      "shrine-light-east": "grounded",
      "court-light-west": "grounded",
      "court-light-east": "grounded"
    },
    "native": "cbdf1fbd641c5ecef7410a20a6865517c3a8f5633e59af5034505d4421fa181f",
    "layout": "4811d9fd23440081afa3e4669fe254fa4da06ebc61bcb947a21098d4ff64072a",
    "addedLayers": [],
    "nativeBytes": "ff9085f0631e4354ba9af65e2f0771992e2ff15fcaca9945049194b2f32aacee",
    "layoutEncoding": "ascii",
    "layoutBytes": "9a9346d9875673c177372dbbaaedb2221b9b554906ea28297f4cb6b66d8e73ad"
  },
  "moon-cafe": {
    "roles": {
      "cafe-window-west": "grounded",
      "cafe-window-east": "grounded"
    },
    "native": "966b6afa49a691978e7ecb14828409589b40f0d9635cd4180fd9e2e5453bbe11",
    "layout": "c1dd164ac0f2ed976c3c762fd1bda3a896ac218ace7bba21d67ceddb1232a473",
    "addedLayers": [],
    "nativeBytes": "5b1ace9d5bd6b33e43adb9d68490b82bc8346acb9c76e0ff7e9467c5527ccbdc",
    "layoutEncoding": "ascii",
    "layoutBytes": "8e0b8d3be4180a6e969e078e3e43abe2680cb8f7cc69db466aaae9e602a7f1c2"
  },
  "nebula-arcade": {
    "roles": {
      "tournament-screen": "grounded",
      "cabinet-light-west0": "grounded",
      "cabinet-light-east0": "grounded",
      "cabinet-light-west1": "grounded",
      "cabinet-light-east1": "grounded",
      "cabinet-light-west2": "grounded",
      "cabinet-light-east2": "grounded"
    },
    "native": "8f9cf8b1b4849b7ebb1822718a6bb78965a2e55626eb9c9a9cb45cbf19b6375e",
    "layout": "2cf046795a4f45b3b2d34572858904d31fbe5d34132859d9677115cb5849a006",
    "addedLayers": [],
    "nativeBytes": "d16cbb4a57f937ea934ce9c7d43072ce2346f2ca4caec2b430e16a880be005e5",
    "layoutEncoding": "ascii",
    "layoutBytes": "d62f803cf934faa28fabd549e528f9715506852b9ebfedbce3d61e0c5fcf9362"
  },
  "orbit-maze": {
    "roles": {
      "exterior-lamp-0": "grounded",
      "exterior-lamp-1": "grounded",
      "comet-gate-light-right": "grounded",
      "social-reading-light": "grounded",
      "quiet-lamp": "grounded",
      "exterior-lamp-2": "grounded",
      "cell-light-10-10": "grounded",
      "cell-light-22-10": "grounded",
      "cell-light-34-10": "grounded",
      "cell-light-46-10": "grounded",
      "cell-light-58-10": "grounded",
      "cell-light-70-10": "grounded",
      "cell-light-10-22": "grounded",
      "cell-light-22-22": "grounded",
      "cell-light-34-22": "grounded",
      "cell-light-46-22": "grounded",
      "cell-light-58-22": "grounded",
      "cell-light-70-22": "grounded",
      "cell-light-10-34": "grounded",
      "cell-light-22-34": "grounded",
      "cell-light-34-34": "grounded",
      "cell-light-46-34": "grounded",
      "cell-light-58-34": "grounded",
      "cell-light-70-34": "grounded",
      "cell-light-10-46": "grounded",
      "cell-light-34-46": "grounded",
      "cell-light-46-46": "grounded",
      "cell-light-58-46": "grounded",
      "cell-light-70-46": "grounded",
      "cell-light-10-58": "grounded",
      "cell-light-22-58": "grounded",
      "cell-light-34-58": "grounded",
      "cell-light-46-58": "grounded",
      "cell-light-58-58": "grounded",
      "cell-light-70-58": "grounded",
      "comet-gate-light-left": "grounded",
      "social-glass": "cutaway"
    },
    "native": "83089e4f3bde8114a9d6af7a740b4d188507197045cbd7a1ce2040e5e755dc96",
    "layout": "8a92902e9b87c5f037a70af0495363440ec7f832d579a9dc3cd39e3fd5892d1a",
    "addedLayers": [],
    "nativeBytes": "14b350d8dae381776dd60f9a4140c682874f20d42d10238877ec99eb9f143528",
    "layoutEncoding": "ascii",
    "layoutBytes": "a6a237bca783012fa1b3f7f30e653e21b63a7692c977736ece06789eeb918b0c"
  },
  "overworld": {
    "roles": {
      "gate-plaza-return-maze": "grounded",
      "gate-plaza-return-solar": "grounded",
      "gate-plaza-return-lunar": "grounded",
      "gate-plaza-return-festival": "grounded",
      "gate-plaza-return-shipyard": "grounded",
      "gate-plaza-return-campus": "grounded",
      "exterior-road-sign-north": "grounded",
      "exterior-road-sign-west": "grounded",
      "exterior-road-sign-east": "grounded",
      "varcamp-nameplate": "grounded",
      "arrival-direction-crosspost": "grounded",
      "welcome-control-sign": "grounded",
      "reception-screen": "grounded",
      "directory-prompt": "grounded",
      "arrival-position-label": "grounded",
      "exterior-road-sign-south": "grounded",
      "capricorn-bold-nameplate": "grounded",
      "sagittarius-bold-nameplate": "grounded",
      "aquarius-bold-nameplate": "grounded",
      "scorpio-bold-nameplate": "grounded",
      "pisces-bold-nameplate": "grounded",
      "libra-bold-nameplate": "grounded",
      "aries-bold-nameplate": "grounded",
      "reception-screen-content": "grounded",
      "virgo-bold-nameplate": "grounded",
      "taurus-bold-nameplate": "grounded",
      "leo-bold-nameplate": "grounded",
      "gemini-bold-nameplate": "grounded",
      "cancer-bold-nameplate": "grounded",
      "aries-building": "grounded",
      "aries-zodiac-emblem": "grounded",
      "taurus-building": "grounded",
      "taurus-zodiac-emblem": "grounded",
      "gemini-building": "grounded",
      "gemini-zodiac-emblem": "grounded",
      "cancer-building": "grounded",
      "cancer-zodiac-emblem": "grounded",
      "leo-building": "grounded",
      "leo-zodiac-emblem": "grounded",
      "virgo-building": "grounded",
      "virgo-zodiac-emblem": "grounded",
      "libra-building": "grounded",
      "libra-zodiac-emblem": "grounded",
      "scorpio-building": "grounded",
      "scorpio-zodiac-emblem": "grounded",
      "sagittarius-building": "grounded",
      "sagittarius-zodiac-emblem": "grounded",
      "capricorn-building": "grounded",
      "capricorn-zodiac-emblem": "grounded",
      "aquarius-building": "grounded",
      "aquarius-zodiac-emblem": "grounded",
      "pisces-building": "grounded",
      "pisces-zodiac-emblem": "grounded"
    },
    "native": "0db4628a372f469fa3b0d97ef652e67b89bc4e33d3f463edec74b1e1566aab0a",
    "layout": "943978ebbfa55740095e122a92138d879fe5db5592c61f43304023e4c1e52d1c",
    "addedLayers": [
      {
        "name": "scenery-belowAvatar-2",
        "id": 58
      }
    ],
    "nativeBytes": "87e88dd082910b789578188147e9b91b1f060c9d62309c158b785c2bf4cbbaad",
    "layoutEncoding": "literal",
    "layoutBytes": "6e1ba3eaec7223e9b64bbd7aff48863bbfe2992a84ff199c7574857c781e533e"
  },
  "stargazer-terrace": {
    "roles": {
      "terrace-star-west": "grounded",
      "terrace-star-east": "grounded"
    },
    "native": "513ae77cf3c79b5ce226750df0a149481f9bce99bcdfb3ceb64fa8a9e9cf2521",
    "layout": "b4b86e17f90338e0f4e18be1db64c8edefbbe4b5fb9e724ca6a6b5b7e0f9722d",
    "addedLayers": [],
    "nativeBytes": "a2e31b225d8c0344b8fcae8fcb1fcaf8c6c132badfa4c9b099ff0fe34bc3ff1f",
    "layoutEncoding": "ascii",
    "layoutBytes": "9d0b0fe5e19ea377592dde259f889314a4bf3f904152218c55d93651f134ffa6"
  },
  "water-district": {
    "roles": {
      "west-lamp": "grounded",
      "east-lamp": "grounded",
      "shrine-lamp-west": "grounded",
      "shrine-lamp-east": "grounded",
      "shrine-zodiac-west": "grounded",
      "shrine-zodiac-east": "grounded",
      "water-wall-feature": "grounded"
    },
    "native": "0783ca62991ec3eba7043997a6d20ce7fae248e1f03c67492c6776dd174589f6",
    "layout": "d6d4aa862bf2c62fea2a0350383675d97ab552333ae92dd8e10e7428942febf0",
    "addedLayers": [],
    "nativeBytes": "ce7f4a6382107554150cbb8a77a6e6effe53877aaef39adefff9df31b5a9bafb",
    "layoutEncoding": "ascii",
    "layoutBytes": "9c201d5b29a3b1950004a33dfded632aaba43e2ef6aed0e9428913b99965e8dd"
  },
  "zodiac-festival-park": {
    "roles": {
      "arcade-wall": "cutaway",
      "playground-wall": "cutaway"
    },
    "native": "785c07763a9f57bb358d16bd2be7a65461019891da316b17c307bf712820983a",
    "layout": "62ffec86e96def8694e3e669fd41a1339a8653d1a2aa508b2b714c3c66124d0a",
    "addedLayers": [],
    "nativeBytes": "1cf56aeb12bcd58a2696a8f677205a3d0f66b4cf27ae210f730f6803aebf7d79",
    "layoutEncoding": "ascii",
    "layoutBytes": "280254ac2a60208da078f964fa0d4201cad24f325b321026d875b32d5dd36a9c"
  }
};

export function historicalLayout(id:string,input:MapLayout=json(`world/layouts/${id}.json`)):MapLayout {
 const proof=receipts[id as keyof typeof receipts];if(!proof)throw Error(`No approved visibility receipt: ${id}`);
 requireEqual(Object.fromEntries(input.placements.filter(p=>p.renderRole).map(p=>[p.id,p.renderRole])),proof.roles,`${id}: unapproved role transformation`);
 const restored=structuredClone(input);for(const p of restored.placements)delete p.renderRole;
 requireEqual(sha(restored),proof.layout,`${id}: frozen 17d4 authored receipt`);return restored;
}
export function historicalNative(id:string,input:TiledMap=json(`maps/${id}.tmj`)):TiledMap {
 const proof=receipts[id as keyof typeof receipts];if(!proof)throw Error(`No approved visibility receipt: ${id}`);
 const current=json(`world/layouts/${id}.json`) as MapLayout,prior=historicalLayout(id,current),catalog=loadTileCatalog();
 const now=buildMap(current,catalog).tmj,old=buildMap(prior,catalog).tmj;
 function pixels(map:TiledMap,source:TiledMap,layer:any):number[]{
  const expected=source.layers.find(l=>l.name===layer.name) as any;
  return (expected?.data??Array(map.width*map.height).fill(0)).map((gid:number)=>{
   if(!gid)return 0;const atlas=[...source.tilesets].reverse().find(t=>t.firstgid<=gid)!;
   const target=map.tilesets.find(t=>t.image===atlas.image&&t.name!=='navigation-mask');if(!target)throw Error(`${id}: original scenery atlas missing`);
   return target.firstgid+gid-atlas.firstgid;
  });
 }
 // Never erase arbitrary native scenery drift by reconstructing it from authors.
 for(const l of input.layers.filter(scenery) as any[])requireEqual(l.data,pixels(input,now,l),`${id}/${l.name}: current approved scenery`);
 for(const l of now.layers.filter(scenery))if(!input.layers.some(n=>n.name===l.name))throw Error(`${id}: missing current scenery layer ${l.name}`);
 const restored=structuredClone(input);
 for(const added of proof.addedLayers){
  const actual=restored.layers.filter(l=>l.name===added.name);requireEqual(actual.length,1,`${id}: sole approved added visual layer`);
  const expected=now.layers.find(l=>l.name===added.name) as any;
  requireEqual(restored.layers.indexOf(actual[0])+1,restored.layers.findIndex(l=>l.name==='floorLayer'),`${id}: approved added layer position`);
  requireEqual(actual[0],{...expected,id:added.id,data:pixels(input,now,expected)},`${id}: exact approved layer metadata`);
  restored.layers=restored.layers.filter(l=>l.name!==added.name);restored.nextlayerid!--;
 }
 for(const l of restored.layers.filter(scenery) as any[])l.data=pixels(restored,old,l);
 requireEqual(sha(restored),proof.native,`${id}: frozen 17d4 complete native receipt`);return restored;
}
export const visibilityHistoryMaps=Object.keys(receipts);

// Original authored files used two explicit established serializers. Preserve the
// independent byte receipt as well as semantic equality; never repin to current.
export function historicalBytes(id:string,kind:'tmj'|'json'):Buffer {
 const proof=receipts[id as keyof typeof receipts];
 let text=kind==='tmj'?JSON.stringify(historicalNative(id))+'\n':JSON.stringify(historicalLayout(id),null,2)+'\n';
 if(kind==='json'&&proof.layoutEncoding==='ascii')text=text.replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
 const raw=Buffer.from(text);requireEqual(createHash('sha256').update(raw).digest('hex'),kind==='tmj'?proof.nativeBytes:proof.layoutBytes,`${id}: frozen 17d4 byte receipt`);return raw;
}
