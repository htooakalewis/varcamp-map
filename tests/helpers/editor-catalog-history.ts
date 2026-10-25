import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {beforeSpeakerWam} from './speaker-presentation-history';

// Independent frozen 8dc37e1239456ca3165f3bbd7f47238735e27169 receipts.
// No git history or generated publication manifest is consulted at test runtime.
export const approvedEditorCollections = [
  { url: 'https://varcamp.3-1-133-135.sslip.io/collections/FurnitureCollection.json', type: 'file' },
  { url: 'https://varcamp.3-1-133-135.sslip.io/collections/OfficeCollection.json', type: 'file' },
];
const receipts: Record<string, readonly [string, string]> = {
  "air-district": [
    "c9346cc6898815907020fcb247e1d7f0afdd9a09cd7cd174fc22202c00bbc7bd",
    "9ad5194b7196c84ea49fb671d34728f36883f86a8060ede0b3df91ae127682ab"
  ],
  "campus-exploration": [
    "431244d4e600839906c92689c51fa23bf1dfd8a50b81b00eccf856d14d65edff",
    "44aab7af6ebfc20d385c56c411229bf03d05c9c85751ff9d232d0c0c3bf92e64"
  ],
  "comet-maze": [
    "a99a45e44e9482adf7ccac399f0eec87db2e331e5972df3d7d3ea6c0cf3a257e",
    "f5a3e2ac2ceefd0dbaa580bf64c246321c4fdfeb863bc7a8e327076d77b059b3"
  ],
  "constellation-shore": [
    "7cb3658de00abd13e7c9e8cec9fdabe18b5b4f0abdccb2e4311a4e539b68f3c9",
    "a72fc69ce9d9fa20da0df2b6dc412723b909dd9f29efe0825b8948ee408a2919"
  ],
  "earth-district": [
    "81837c79f31a2302732365397f72bbfcc7869740f8f0b888442f499caa77b6f8",
    "a5bc420b640d8231bed212b05536d428d4a2f626be4ef7e34dc82ab69798b160"
  ],
  "fa-ship": [
    "d039a754eb9fe7e31342ac90a1ce1ddc596eb8d8a6216bee2006f2c2e8534a42",
    "46545d9e6fa646093dda52c0089297da2047cefe4b677e10346126948a567c67"
  ],
  "fire-district": [
    "a44f366eded88694bf28d1c471f06077bcc72f5ac6b432867dbabadf33cdc539",
    "be91966d67f99967bb89bdd1ae44dd541c73c6bbe1937a07d5ed65faaa253ba8"
  ],
  "hidden-observatory": [
    "fbfe58f1b7146fc5ef9e7d5c4b2bb7e479f33e9806f248612023c866ebeaaad3",
    "d9bfd776db3cffc92d38bcce7ba6fa86163824b2446df079a1fdd970fd4bfd56"
  ],
  "lunar-hall": [
    "61bec60be5a75daeee0fe2374074c9585a528204139b90ee049fb277e8398962",
    "c95a8e7c455556755832db3618a5c056b5e48258bbfea54e395bc5f1cb760fd9"
  ],
  "moon-cafe": [
    "386302651b4cd1020887ec7360844b9ab6d4c457a687dbbf6dd9494dd1843a89",
    "0610ffced353750aaa1a7b7c60cb52064296b62d9aba83c1868586953963c328"
  ],
  "moon-grotto": [
    "eebc89cc34bf1a96282ac3a8ad4f3b51db0584fa811ca4d7d01d293ef50d7be6",
    "7ce0ac81c796798114b96aa4c33f6e719fb911c562242801fdb89e57cebd5662"
  ],
  "nebula-arcade": [
    "5517e34ea418b0bc9795d3032e496be8732176026dfccfcd0b1e1d7cb56b23b6",
    "611bfed6efd5411319fe8b5c46cbb07f9eab802863a8953fb13d97180644657d"
  ],
  "orbit-maze": [
    "5a9297f37c82ae771a08a6c95095d9364b9d1af3e910bc273354bed154c319be",
    "d68e937981c85baa78afcefe8c1307612cad57e6132846fa1751b0c3c8cd9251"
  ],
  "orbit-playground": [
    "684e635fa8db055c4c512ff53bfe525267ae9d992cd72ab15d0387fecacc2de0",
    "c7aa7d0d038fd9763fce9757555b8b93f259e029f4d719d4a3370827a3859eb6"
  ],
  "overworld": [
    "2cd15ea221dc094b2b46fac86729a196787621284adc181b8a5f5183a96d2fb9",
    "d814b31d260514f738f6a84bc6da27ce9f16daf7e2076209a79e7b17b9e047d2"
  ],
  "shipyard-beach": [
    "c3a03ca2620f43fe11abe50baf408d2129d1a4306d0d839ae61851a79d669887",
    "7cffc6dff554af782ae81458003778d0f35d2b9356145d4fb4c370386df62b4e"
  ],
  "solar-hall": [
    "0bd5476169b7754a9612bf2541e902e0a82071032c7cd153b37df996178e1306",
    "23149056245ef05a22c06655736d58a50582b779f76445a7d98eb45e0c8f6176"
  ],
  "speaker-aquarius": [
    "bf733e7b3da037f8d42e550fc21fc9f7e9dd3e4285ef98991284121f8890506f",
    "7e0d46f3514ed6b663ccb4725f068c4cc636db14ec392029df49065053fb95d1"
  ],
  "speaker-aries": [
    "193ca771e95f874613f3a7393c9661e4f1b73490fca46755ee848d3d2c53978f",
    "ec584a03754fd009a338375694616b3ac7f9351e88bcfe9893b939f56d614d40"
  ],
  "speaker-cancer": [
    "a51c410a24f93815e8149ecf73721e2c56ed34ec9b3009e52b1fa4bc42601daa",
    "a029c8454dff2871c0172818141869d9d9c22004485d4cf496c5c65617396cae"
  ],
  "speaker-capricorn": [
    "3f44d3aed415c0d9193d6c48a9e90ed9ca6c071eacba584654526cd99cb13de3",
    "12d751a197ac2842513032c711771e0fa7489ff9ca6118b1d573326c33866392"
  ],
  "speaker-gemini": [
    "097d23d2d270ec76c793e1c77247ce1b412e62629933d3e4aa3439c9d9cf48ad",
    "a42afd96b19ff908d3b1665e4e3db4a93028b44cfd5cc22060df95043b190fab"
  ],
  "speaker-leo": [
    "b3f0d9a28b9a78b89c3b6a1c14ad7f7055508ee9a25e6346d4edf89e5f306bd3",
    "efee8fd7e92d1860e44f70521639f37caffbe0c9ea64932f492929c7dc82716b"
  ],
  "speaker-libra": [
    "7004793f7fba65b99385f1a6fbfb342ea99a3e485fdd94d75fc2071135848819",
    "fc3e846886e11aee9b5d4e4fd287d1f94daa906d2cac86820ece07f175b792a5"
  ],
  "speaker-pisces": [
    "74f6e370a0c37ccb50ccaf457eed7da872f632e08b88bb6b15029a22b7e34b91",
    "f559db88a591a2f118238e40f230fe18355761a536a60732ef536e1adf866b04"
  ],
  "speaker-sagittarius": [
    "f2b39026f85dc4867056f4c737cb833a96fa0aa637f313a7f2bdd609c9dfe28f",
    "14b7fb98c741e69fba9c4fd7896cd58d7980514b229457bafc2c0335b3762ed5"
  ],
  "speaker-scorpio": [
    "fb4a65daf284bd1dba8d6d2ba03827c8cbacd5befa31a1b39e24eec8a558da66",
    "bcc3ec3c751bedc375f0ee359ef4df46a16b6b5576fee1e2765ccf984021971d"
  ],
  "speaker-taurus": [
    "77c56e35a16fbc939d4c0175da4250338ef5a959e6af25e822fbc019e79a9c03",
    "861742d58ce8e1ec6949568445b1faab344c52fa79ae23b2c6116938ff7783a7"
  ],
  "speaker-virgo": [
    "954d6b9830a2dbf28f5d2aad9b0d3054f84d5a20f85871c7b4d73b41f8f636f9",
    "891c00d5767bba1afa9947bb75dc017da5bdd48a9ad453ab184553c0bc21c554"
  ],
  "star-garden": [
    "a50a470d8d4954e03ae829be50510a1342f32bc567e293ac04a7db133258c3a6",
    "fd97d137f29f7bc2f98018a244cea88a775fb2850be554785c274178be488c4b"
  ],
  "stargazer-terrace": [
    "e26c12c05558247e31781570d4c0d5dcaa1803ce4d2f2679d19125f450cbeba8",
    "a248ba10a1ed61b1116858c92dde3b8ae77a9f163b2a8306c321fc542d3aab20"
  ],
  "water-district": [
    "154422eb4d85bc01102ec4f8b09a6851acc2821450e1557c2eb5ba490d63d16e",
    "939f000409811b01298155b5a8ac55fe63bc7551ec34e35b93be2dd16223d2d1"
  ],
  "zodiac-festival-park": [
    "18d255c54c48ee0de8cffcbf0f4ed223db6a9aeed4d3bffd8942bd93de63ed5c",
    "78bb80e1bb3dc09ac8b32582bd81b21dfd77b291ba56361784b65428493fdd95"
  ]
};
const digest = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
function requireEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}
export const editorCatalogHistoryMaps = Object.keys(receipts);

export function historicalEditorWamBytes(id: string, supplied?: Buffer | string): Buffer {
  if (!Object.hasOwn(receipts, id)) throw new Error('Unknown frozen editor WAM');
  const current = id.startsWith('speaker-') ? beforeSpeakerWam(id,supplied).toString() : supplied === undefined ? readFileSync(`maps/${id}.wam`, 'utf8') : supplied.toString();
  const value = JSON.parse(current);
  requireEqual(value.entityCollections, approvedEditorCollections, 'Unapproved editor collection registration');
  requireEqual(JSON.parse(readFileSync('world/editor-collections.json', 'utf8')), approvedEditorCollections, 'Unapproved editor collection defaults');
  // Find the ROOT property with a lexical scan; nested vendor keys never become
  // migration targets. JSON.parse above validates syntax; scan preserves bytes.
  let depth = 0, quoted = false, escaped = false, start = -1, end = -1;
  for (let i = 0; i < current.length; i++) {
    const ch = current[i];
    if (quoted) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') quoted = false; continue; }
    if (ch === '"') {
      if (depth === 1 && current.startsWith('"entityCollections"', i)) {
        const after = i + '"entityCollections"'.length;
        const prefix = /^\s*:\s*\[/.exec(current.slice(after));
        if (!prefix || start !== -1) throw new Error('Ambiguous root editor collection span');
        start = after + prefix[0].length - 1;
      }
      quoted = true;
    } else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') { depth--; if (ch === ']' && depth === 1 && start !== -1 && end === -1) end = i + 1; }
  }
  if (start < 0 || end < start) throw new Error('Missing root editor collection span');
  const restored = Buffer.from(current.slice(0, start) + '[]' + current.slice(end));
  if (digest(restored) !== receipts[id][0] || digest(JSON.stringify(JSON.parse(restored.toString()))) !== receipts[id][1]) {
    throw new Error('WAM changed outside exact approved editor collection registration');
  }
  return restored;
}

export function historicalEditorWam(id: string): Record<string, any> {
  return JSON.parse(historicalEditorWamBytes(id).toString());
}

const metadataReceipts: Record<string, readonly [string,string]> = {
  "art/source/roadster.json": [
    "4b1a87bfbfde83818f67b31932fabf51d3d03599ce32d6fe6878e1d4fe8f1650",
    "551d8e333b327e77307138ae596729de0b5c6b486faf54e7695cc9b75b7b528d"
  ],
  "art/source/coastal-flight.json": [
    "b3926b21a9b5c1ac0c668204154f2f1621a632681f2f8580fbcbd1bb23309526",
    "876bb78e98d92055d493eb7a34c1235e53bef481caedd79b2a636599687e51c9"
  ],
  "world/layouts/overworld.json": [
    "0545bd3f6b7bc9cce661f2914e4f17bb55ec45889587dabe4b71784c5f2f5deb",
    "12c3f896bc7719ff4f71b02df083cb68da169348429fdb41033a475bce32397e"
  ],
  "world/layouts/shipyard-beach.json": [
    "2da9c7fa27c41580337cdc81786fd588b73f0c66f8293d93b428e6203b39466b",
    "07969974d714804c20542b9dad7e006ca7387d508f69e090193afd875ccd37bd"
  ]
};
const oldBuilderPin = '03e48ed4e32bdb9a6d001c52456787459e72229be8d59c7422403dde72f4d1bb';
const currentBuilderPin = 'b4c8e8c6fcd6e0fcdc8b2685214c18bf412fbd1f510b2ad73820632e7755ed69';
export const editorMetadataHistoryPaths = Object.keys(metadataReceipts);
export function historicalEditorMetadataBytes(path: string, supplied?: Buffer | string): Buffer {
  if (!Object.hasOwn(metadataReceipts,path)) throw new Error('Unapproved editor metadata path');
  const text=(supplied??readFileSync(path)).toString();
  if(text.split(currentBuilderPin).length!==2 || text.includes(oldBuilderPin)) throw new Error('Unapproved exact builder pin change');
  const restored=Buffer.from(text.replace(currentBuilderPin,oldBuilderPin));
  if(digest(restored)!==metadataReceipts[path][0] || digest(JSON.stringify(JSON.parse(restored.toString())))!==metadataReceipts[path][1]) throw new Error('Metadata changed outside exact editor builder pin');
  return restored;
}
// Semantic input supplied by existing drift tests: require exact raw8dc source
// first, then apply ONLY its approved hash inverse to the caller's object. The
// caller's existing17d4 semantic receipt still independently checks every field.
export function historicalEditorLayout<T>(id:string, value:T):T {
  if(id!=='overworld' && id!=='shipyard-beach')return structuredClone(value);
  historicalEditorMetadataBytes(`world/layouts/${id}.json`);
  const text=JSON.stringify(value);
  if(text.split(currentBuilderPin).length!==2)throw new Error('Unapproved authored builder pin');
  return JSON.parse(text.replace(currentBuilderPin,oldBuilderPin));
}
// Called only AFTER the17d4 whole-layout receipt passed. Original art compiler
// requires its current source pin even when computing historical scenery GIDs.
export function editorCompilerProofCopy<T>(id:string, provenHistorical:T):T {
  if(id!=='overworld')return structuredClone(provenHistorical);
  historicalEditorMetadataBytes('world/layouts/overworld.json');
  historicalEditorMetadataBytes('art/source/roadster.json');
  const text=JSON.stringify(provenHistorical);
  if(text.split(oldBuilderPin).length!==2)throw new Error('Missing proven historical builder pin');
  return JSON.parse(text.replace(oldBuilderPin,currentBuilderPin));
}
