import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const checker = resolve('publication/verify-source.mjs');
const revisionPath = 'publication/revisions/2026-10-16-shared-guides.json';
const navigationRevisionPath = 'publication/revisions/2026-10-17-return-approaches.json';
const beachRevisionPath='publication/revisions/2026-10-17-beach-composition.json';
const closureRevisionPath='publication/revisions/2026-10-17-beach-ci-closure.json';
const propsRevisionPath='publication/revisions/2026-10-17-solid-props.json';
const propsClosurePath='publication/revisions/2026-10-17-solid-props-ci-closure.json';
const captionsPath='publication/revisions/2026-10-18-standing-captions.json';
const captionsClosurePath='publication/revisions/2026-10-18-standing-captions-ci-closure.json';
const currentNative=readFileSync('maps/overworld.tmj','utf8');
const currentLayout=readFileSync('world/layouts/overworld.json','utf8');
const baselineHash = '4b654bd1437066b13498661f3ca14774daf1066d072036beffaf06f0c014250e';
const replacement = 'reviewed replacement\n';
const replacementHash = createHash('sha256').update(replacement).digest('hex');
const originalPaths = Object.keys(JSON.parse(readFileSync('publication/source-manifest.json', 'utf8')).sourceInventory);
const reviewed = () => ({ path: 'src/main.ts', fromSha256: baselineHash, toSha256: replacementHash, reason: 'Authorized fixture replacement' });

describe('publication exact reviewed replacements', () => {
  let root: string;
  let manifest: { maps: number; wams: number; sourceFilesByteExact: number; sourceInventory: Record<string, string>; extensionInventory: Record<string, string> };
  let baselineManifest: typeof manifest;
  const touched=new Map<string,Buffer|undefined>();
  let track=false;
  function remember(path:string){if(track&&!touched.has(path))touched.set(path,existsSync(join(root,path))?readFileSync(join(root,path)):undefined);}
  function remove(path:string){remember(path);rmSync(join(root,path));}
  function write(path: string, content: string) {
    remember(path);
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  function pinRevisions(value: unknown = { schemaVersion: 1, revisions: [] }) {
    const bytes = JSON.stringify(value);
    write(revisionPath, bytes);
    manifest.extensionInventory[revisionPath] = createHash('sha256').update(bytes).digest('hex');
  }
  function pinNavigation(value:unknown={schemaVersion:1,revisions:[]}) {
    const bytes=JSON.stringify(value);write(navigationRevisionPath,bytes);
    manifest.extensionInventory[navigationRevisionPath]=createHash('sha256').update(bytes).digest('hex');
  }
  function pinBeach(value:unknown={schemaVersion:1,revisions:[]}) {
    const bytes=JSON.stringify(value);write(beachRevisionPath,bytes);
    manifest.extensionInventory[beachRevisionPath]=createHash('sha256').update(bytes).digest('hex');
  }
  function pinClosure(value:unknown={schemaVersion:1,revisions:[]}) {
    const bytes=JSON.stringify(value);write(closureRevisionPath,bytes);
    manifest.extensionInventory[closureRevisionPath]=createHash('sha256').update(bytes).digest('hex');
  }
  function pinProps(value:unknown={schemaVersion:1,revisions:[]}) {
    const bytes=JSON.stringify(value);write(propsRevisionPath,bytes);
    manifest.extensionInventory[propsRevisionPath]=createHash('sha256').update(bytes).digest('hex');
  }
  function pinPropsClosure(value:unknown={schemaVersion:1,revisions:[]}) {const bytes=JSON.stringify(value);write(propsClosurePath,bytes);manifest.extensionInventory[propsClosurePath]=createHash('sha256').update(bytes).digest('hex');}
  function pinCaptions(value:unknown={schemaVersion:1,revisions:[]}) {const bytes=JSON.stringify(value);write(captionsPath,bytes);manifest.extensionInventory[captionsPath]=createHash('sha256').update(bytes).digest('hex');}
  function pinCaptionsClosure(value:unknown={schemaVersion:1,revisions:[]}) {const bytes=JSON.stringify(value);write(captionsClosurePath,bytes);manifest.extensionInventory[captionsClosurePath]=createHash('sha256').update(bytes).digest('hex');}
  function verify() {
    write('publication/source-manifest.json', JSON.stringify(manifest));
    const result = spawnSync(process.execPath, [checker, root], { encoding: 'utf8' });
    return { status: result.status, output: result.stdout + result.stderr };
  }
  function rejects(message: string) {
    const result = verify();
    expect(result.status).not.toBe(0);
    expect(result.output).toContain(message);
  }
  it('accepts exact sixth document chaining and refuses a wrong prior hash',()=>{pinRevisions({schemaVersion:1,revisions:[reviewed()]});write('src/main.ts',replacement+'sixth');const next={...reviewed(),fromSha256:replacementHash,toSha256:createHash('sha256').update(replacement+'sixth').digest('hex')};pinPropsClosure({schemaVersion:1,revisions:[next]});expect(verify().status).toBe(0);pinPropsClosure({schemaVersion:1,revisions:[{...next,fromSha256:baselineHash}]});rejects('prior');});
  it('accepts exact seventh caption document and refuses wrong prior',()=>{pinRevisions({schemaVersion:1,revisions:[reviewed()]});write('src/main.ts',replacement+'captions');const next={...reviewed(),fromSha256:replacementHash,toSha256:createHash('sha256').update(replacement+'captions').digest('hex')};pinCaptions({schemaVersion:1,revisions:[next]});expect(verify().status).toBe(0);pinCaptions({schemaVersion:1,revisions:[{...next,fromSha256:baselineHash}]});rejects('prior');});
  it('accepts exact eighth caption observer document and refuses wrong prior',()=>{pinRevisions({schemaVersion:1,revisions:[reviewed()]});write('src/main.ts',replacement+'observer');const next={...reviewed(),fromSha256:replacementHash,toSha256:createHash('sha256').update(replacement+'observer').digest('hex')};pinCaptionsClosure({schemaVersion:1,revisions:[next]});expect(verify().status).toBe(0);pinCaptionsClosure({schemaVersion:1,revisions:[{...next,fromSha256:baselineHash}]});rejects('prior');});
  beforeAll(() => {
    // One immutable physical baseline; cases mutate and restore only touched files.
    root = mkdtempSync(join(tmpdir(), 'varcamp-revisions-'));
    manifest = {
      maps: 33, wams: 33, sourceFilesByteExact: 303,
      sourceInventory: Object.fromEntries(originalPaths.map(path => [path, baselineHash])),
      extensionInventory: { 'src/bots/reviewed.ts': baselineHash },
    };
    for (const path of originalPaths) write(path, 'baseline\n');
    write('src/bots/reviewed.ts', 'baseline\n');
    pinRevisions();
    pinNavigation();
    pinBeach();
    pinProps();
    pinClosure();
    pinPropsClosure();
    pinCaptions();
    pinCaptionsClosure();
    baselineManifest=structuredClone(manifest);track=true;
  });
  beforeEach(()=>{expect(touched.size).toBe(0);manifest=structuredClone(baselineManifest);});
  afterEach(()=>{
    for(const[path,bytes]of touched){
      if(bytes===undefined)rmSync(join(root,path),{force:true});
      else{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),bytes);}
    }
    touched.clear();
  });
  afterAll(()=>rmSync(root,{recursive:true,force:true}));

  it('accepts an empty pinned revision list with all original bytes unchanged', () => {
    expect(verify().status).toBe(0);
  });

  it('rejects changed baseline bytes without a reviewed record', () => {
    write('src/main.ts', replacement);
    rejects('Frozen source changed: src/main.ts');
  });

  it('accepts only the exact reviewed old-to-new replacement and reports it truthfully', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    write('src/main.ts', replacement);
    const result = verify();
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('302 unchanged source hashes and 1 exact reviewed replacement');
    expect(result.output).not.toContain('No source files were rewritten');
    expect(manifest.sourceInventory['src/main.ts']).toBe(baselineHash);
  });

  it('rejects an unrelated edit beside an exact reviewed replacement', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    write('src/main.ts', replacement);
    write('src/quests/model.ts', replacement);
    rejects('Frozen source changed: src/quests/model.ts');
  });

  it('requires the fixed revision file to be pinned in extensions', () => {
    delete manifest.extensionInventory[revisionPath];
    rejects('Reviewed revision file must be pinned in extensionInventory');
  });

  it('rejects a missing revision file', () => {
    remove(revisionPath);
    rejects(`Missing extension source: ${revisionPath}`);
  });

  it('rejects revision file bytes that disagree with their extension hash', () => {
    write(revisionPath, JSON.stringify({ schemaVersion: 1, revisions: [reviewed()] }));
    rejects(`Extension source changed: ${revisionPath}`);
  });

  it('rejects a missing reviewed source', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    remove('src/main.ts');
    rejects('Missing frozen source: src/main.ts');
  });

  it('checks the old digest against the original receipt even when replacement bytes match', () => {
    pinRevisions({ schemaVersion: 1, revisions: [{ ...reviewed(), fromSha256: replacementHash }] });
    write('src/main.ts', replacement);
    rejects('Reviewed revision baseline mismatch: src/main.ts');
  });

  it('rejects replacement bytes that disagree with the approved new digest', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    write('src/main.ts', 'unapproved\n');
    rejects('Reviewed source changed: src/main.ts');
  });

  it('rejects an approved replacement when the old bytes remain', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    rejects('Reviewed source changed: src/main.ts');
  });

  it('rejects duplicate revisions for the same source', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed(), reviewed()] });
    rejects('Duplicate reviewed revision: src/main.ts');
  });

  it.each(['src/unknown.ts', 'src/*.ts', '../src/main.ts', '/src/main.ts'])(
    'rejects a revision outside the exact original receipt: %s', path => {
      pinRevisions({ schemaVersion: 1, revisions: [{ ...reviewed(), path }] });
      rejects('Reviewed revision path is not an exact original source');
    },
  );

  it('rejects extension overlap with a revised original source', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    manifest.extensionInventory['src/main.ts'] = replacementHash;
    write('src/main.ts', replacement);
    rejects('Extension overlaps frozen source: src/main.ts');
  });

  it('rejects a revision of an extension file', () => {
    pinRevisions({ schemaVersion: 1, revisions: [{ ...reviewed(), path: 'src/bots/reviewed.ts' }] });
    rejects('Reviewed revision path is not an exact original source');
  });

  it('still rejects changed extensions beside an exact reviewed replacement', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    write('src/main.ts', replacement);
    write('src/bots/reviewed.ts', replacement);
    rejects('Extension source changed: src/bots/reviewed.ts');
  });

  it('still rejects unlisted additions beside an exact reviewed replacement', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    write('src/main.ts', replacement);
    write('src/unlisted.ts', replacement);
    rejects('Source inventory has missing or additional files');
  });

  it.each([
    null,
    [],
    { schemaVersion: 2, revisions: [] },
    { schemaVersion: 1, revisions: [], wildcard: true },
    { schemaVersion: 1, revisions: {} },
    { schemaVersion: 1 },
    { schemaVersion: 1, revisions: [null] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), unknown: true }] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), reason: '' }] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), reason: '  ' }] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), reason: 4 }] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), path: 4 }] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), fromSha256: 'wrong' }] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), toSha256: replacementHash.toUpperCase() }] },
    { schemaVersion: 1, revisions: [{ path: 'src/main.ts', fromSha256: baselineHash, toSha256: replacementHash }] },
  ])('rejects malformed or widened revision schema %#', value => {
    pinRevisions(value);
    rejects('Invalid reviewed revision schema');
  });
  it('composes the fixed second document from the exact prior effective receipt',()=>{
    const final='navigation replacement\n',digest=createHash('sha256').update(final).digest('hex');
    pinRevisions({schemaVersion:1,revisions:[reviewed()]});
    pinNavigation({schemaVersion:1,revisions:[{...reviewed(),fromSha256:replacementHash,toSha256:digest}]});
    write('src/main.ts',final);const result=verify();expect(result.status,result.output).toBe(0);
    expect(manifest.sourceInventory['src/main.ts']).toBe(baselineHash);
  });
  it('requires the second fixed document to be explicitly pinned',()=>{
    delete manifest.extensionInventory[navigationRevisionPath];
    rejects('Reviewed revision file must be pinned in extensionInventory');
  });
  it('rejects a wrong prior link even when the first document bytes still match',()=>{
    pinRevisions({schemaVersion:1,revisions:[reviewed()]});write('src/main.ts',replacement);
    pinNavigation({schemaVersion:1,revisions:[{...reviewed(),fromSha256:baselineHash}]});
    rejects('Reviewed revision prior mismatch: src/main.ts');
  });
  it('rejects duplicates within the second document, not legitimate cross-document succession',()=>{
    pinRevisions({schemaVersion:1,revisions:[reviewed()]});write('src/main.ts',replacement);
    const next={...reviewed(),fromSha256:replacementHash};pinNavigation({schemaVersion:1,revisions:[next,next]});
    rejects('Duplicate reviewed revision: src/main.ts');
  });
  it('rejects a missing second-document link to final replacement bytes',()=>{
    pinRevisions({schemaVersion:1,revisions:[reviewed()]});write('src/main.ts','unlinked next release\n');
    rejects('Reviewed source changed: src/main.ts');
  });
  it('rejects a second-document row for an unlisted source',()=>{
    pinNavigation({schemaVersion:1,revisions:[{...reviewed(),path:'src/unlisted.ts'}]});
    rejects('Reviewed revision path is not an exact original source');
  });
  it('rejects a missing second document even when every original byte is unchanged',()=>{
    remove(navigationRevisionPath);rejects(`Missing extension source: ${navigationRevisionPath}`);
  });
  it.each([null,{schemaVersion:2,revisions:[]},{schemaVersion:1,revisions:[],extra:true},{schemaVersion:1,revisions:[null]}])('enforces the unchanged closed schema for the second document %#',value=>{
    pinNavigation(value);rejects('Invalid reviewed revision schema');
  });
  it.each(['scenery','layer-order','collision','metadata','role','placement'])('actual publication CLI rejects %s drift after a positive current artifact baseline',kind=>{
    const rows=[['maps/overworld.tmj',currentNative],['world/layouts/overworld.json',currentLayout]].map(([path,raw])=>({path,fromSha256:baselineHash,toSha256:createHash('sha256').update(raw).digest('hex'),reason:'Exact current navigation artifact fixture'}));
    pinNavigation({schemaVersion:1,revisions:rows});write('maps/overworld.tmj',currentNative);write('world/layouts/overworld.json',currentLayout);
    const positive=verify();expect(positive.status,positive.output).toBe(0); // Establish genuine success BEFORE the mutation.
    const map=JSON.parse(currentNative),layout=JSON.parse(currentLayout);
    if(kind==='scenery'){const l=map.layers.find((l:{name:string})=>l.name==='scenery-belowAvatar-0');l.data[l.data.findIndex(Boolean)]=0;}
    if(kind==='layer-order'){const l=map.layers.find((l:{name:string})=>l.name==='scenery-belowAvatar-2');map.layers=map.layers.filter((x:unknown)=>x!==l);map.layers.push(l);}
    if(kind==='collision'){const l=map.layers.find((l:{name:string})=>l.name==='physical-collisions');l.data[65*128+63]=l.data.find(Boolean);}
    if(kind==='metadata')map.nextobjectid++;
    if(kind==='role')layout.placements.find((p:{id:string})=>p.id==='aries-building').renderRole='canopy';
    if(kind==='placement')layout.placements[0].x++;
    const path=kind==='role'||kind==='placement'?'world/layouts/overworld.json':'maps/overworld.tmj';
    write(path,JSON.stringify(path.endsWith('.tmj')?map:layout)+'\n');rejects('Reviewed source changed: '+path);
  });
  it('composes the fixed third beach document from the exact second receipt',()=>{
    pinRevisions({schemaVersion:1,revisions:[reviewed()]});
    const second='navigation bytes\n',secondHash=createHash('sha256').update(second).digest('hex');
    pinNavigation({schemaVersion:1,revisions:[{...reviewed(),fromSha256:replacementHash,toSha256:secondHash}]});
    const final='beach bytes\n';
    pinBeach({schemaVersion:1,revisions:[{...reviewed(),fromSha256:secondHash,toSha256:createHash('sha256').update(final).digest('hex')}]});
    write('src/main.ts',final);const result=verify();expect(result.status,result.output).toBe(0);
    pinBeach({schemaVersion:1,revisions:[{...reviewed(),fromSha256:replacementHash,toSha256:createHash('sha256').update(final).digest('hex')}]});
    rejects('Reviewed revision prior mismatch: src/main.ts');
  });
  it.each(['maps/fa-ship.tmj','maps/shipyard-beach.tmj','world/layouts/fa-ship.json','world/layouts/shipyard-beach.json'])('actual CLI rejects changed current beach artifact %s after a positive baseline',path=>{
    const raw=readFileSync(path,'utf8');pinBeach({schemaVersion:1,revisions:[{path,fromSha256:baselineHash,toSha256:createHash('sha256').update(raw).digest('hex'),reason:'Exact current beach artifact'}]});
    write(path,raw);const positive=verify();expect(positive.status,positive.output).toBe(0);
    const artifact=JSON.parse(raw);if(path.endsWith('.tmj'))artifact.nextobjectid++;else artifact.placements[0].x++;
    write(path,JSON.stringify(artifact));rejects('Reviewed source changed: '+path);
  });
  it('requires the fourth fixed document to link the exact prior beach receipt',()=>{
    pinBeach({schemaVersion:1,revisions:[reviewed()]});
    const final='canonical producer bytes\n',digest=createHash('sha256').update(final).digest('hex');
    pinClosure({schemaVersion:1,revisions:[{...reviewed(),fromSha256:replacementHash,toSha256:digest}]});
    write('src/main.ts',final);const accepted=verify();expect(accepted.status,accepted.output).toBe(0);
    pinClosure({schemaVersion:1,revisions:[{...reviewed(),fromSha256:baselineHash,toSha256:digest}]});
    rejects('Reviewed revision prior mismatch: src/main.ts');
  });

  it('composes the fixed fifth props document only from the actual prior effective receipt',()=>{
    pinRevisions({schemaVersion:1,revisions:[reviewed()]});
    const fourth='fourth release\n',fourthHash=createHash('sha256').update(fourth).digest('hex');
    pinClosure({schemaVersion:1,revisions:[{...reviewed(),fromSha256:replacementHash,toSha256:fourthHash}]});
    const final='physical props release\n',finalHash=createHash('sha256').update(final).digest('hex');
    pinProps({schemaVersion:1,revisions:[{...reviewed(),fromSha256:fourthHash,toSha256:finalHash}]});
    write('src/main.ts',final);const positive=verify();expect(positive.status,positive.output).toBe(0);
    pinProps({schemaVersion:1,revisions:[{...reviewed(),fromSha256:replacementHash,toSha256:finalHash}]});rejects('Reviewed revision prior mismatch: src/main.ts');
  });
  it.each(['maps/overworld.tmj','maps/constellation-shore.tmj','maps/shipyard-beach.tmj','world/layouts/overworld.json','world/layouts/constellation-shore.json','world/layouts/shipyard-beach.json'])('actual CLI rejects current physical support/scenery mutation %s after a positive baseline',path=>{
    const raw=readFileSync(path,'utf8');pinProps({schemaVersion:1,revisions:[{path,fromSha256:baselineHash,toSha256:createHash('sha256').update(raw).digest('hex'),reason:'Exact reviewed physical prop artifact'}]});
    write(path,raw);const positive=verify();expect(positive.status,positive.output).toBe(0);
    const changed=JSON.parse(raw);if(path.endsWith('.tmj')){const l=changed.layers.find((l:any)=>l.name==='physical-collisions'),i=l.data.findIndex((v:number)=>v!==0);l.data[i]=0;}else changed.standingSigns[0].supports=[];
    write(path,JSON.stringify(changed));rejects('Reviewed source changed: '+path);
  });

});
