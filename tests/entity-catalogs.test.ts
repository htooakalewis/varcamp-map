import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import type { MapLayout } from '../tools/maps/types';

const fixture='tests/fixtures/workadventure-96d43a84/entity-catalogs/';
const text=(name:string)=>readFileSync(fixture+name,'utf8');
const json=(name:string)=>JSON.parse(text(name));
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const semantic=(value:unknown)=>sha(JSON.stringify(value));
const require=createRequire(import.meta.url);
const descriptors=JSON.parse(readFileSync('world/editor-collections.json','utf8'));
const historicalBuilderPins:Record<string,string>={"overworld": "a7aabbbb1986691f82deb6caf197d3ffa982f1315b99fe03c16312613f8d61cd", "constellation-shore": "7b968e10d076333eb636730543a4e29fe67da5f2b64152885588821b7f630614", "shipyard-beach": "07200965ed00e3497ea974adecf20ab8516021186eaace5b431c0277aa5cc939"};
const expected=['FurnitureCollection','OfficeCollection'].map(name=>({url:`https://varcamp.3-1-133-135.sslip.io/collections/${name}.json`,type:'file'}));

// Evaluate exact upstream declarations/methods, with only their actual module
// dependencies supplied. Store/fetch are the unit boundary, not application patches.
function evaluate(source:string,dependencies:(id:string)=>unknown=require,globals:Record<string,unknown>={}):any {
 const module={exports:{}};
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{module,exports:module.exports,require:dependencies,URL,Promise,console,...globals});
 return module.exports;
}
const typeSource=text('types.ts.txt');
const types=evaluate(typeSource.slice(0,typeSource.indexOf('export const WAMMetadata')));
const migration=evaluate(text('EntitiesFileMigration.ts.txt'),id=>id==='../types'?types:require(id)).entitiesFileMigration;
const raw=[json('FurnitureCollection.json'),json('OfficeCollection.json')];
const migrated=raw.map(collection=>migration.migrate(collection));
function managerBoundary(fetch:(url:string)=>Promise<unknown>) {
 const source=text('EntitiesCollectionsManager.ts.txt');
 const tree=ts.createSourceFile('upstream-manager.ts',source,ts.ScriptTarget.Latest,true);
 const subject=tree.statements.find(ts.isClassDeclaration)!;
 const names=['loadCollections','fetchRawCollection','parseRawCollection','parseRawEntityPrefab','getEntityPrefab'];
 const methods=subject.members.filter(member=>member.name&&names.includes(member.name.getText(tree))).map(member=>member.getText(tree));
 expect(methods).toHaveLength(names.length);
 const errors:unknown[][]=[],stores:any[][]=[];
 const {Subject}=evaluate(`export class Subject{${methods.join('\n')}}`,require,{entitiesFileMigration:migration,fetch,console:{error:(...args:unknown[])=>errors.push(args)}});
 const manager=new Subject();
 manager.tags=[];manager.currentCollection={collectionName:'All Object Collection',collection:[],tags:[]};
 manager.entitiesPrefabsStore={set:(rows:any[])=>stores.push(rows)};
 return {manager,errors,stores};
}

describe('builder catalog defaults',()=>{
 const catalog=loadTileCatalog(),before=json('builder-before.json');
 it('uses exactly the two existing same-origin native file catalogs',()=>{
  expect(descriptors).toEqual(expected);
 });
 for(const [id,proof]of Object.entries(before.maps) as [string,any][]){
  it(`${id} adds native catalogs while preserving every other builder output${id==='overworld'?' of its frozen historical input':''}`,()=>{
   // This catalog-only receipt predates the separate return-navigation release.
   const raw=readFileSync(id==='overworld'?'tests/fixtures/overworld-history/pre-return-layout.json':id==='constellation-shore'?'tests/fixtures/solid-props/before-constellation-shore.json':['fa-ship','shipyard-beach'].includes(id)?`tests/fixtures/beach-composition/before-${id}.json`:`world/layouts/${id}.json`,'utf8');
   if(id==='overworld')expect(sha(raw)).toBe('49d0f002a11c0966550eb9025c2c3ce0e7f023605960ea6c91341decce506093');
   if(id==='fa-ship')expect(sha(raw)).toBe('5b72da42a573909ef4d7a016b11a74f69b8798a7d35c07bd8f968a4d753dc7a4');
   if(id==='shipyard-beach')expect(sha(raw)).toBe('dc9b379a2955e015c684baf6720fd59d30d8e25533c0ee9bfcacae46be043ac4');
   if(['overworld','constellation-shore','shipyard-beach'].includes(id)){
    const path=`tests/fixtures/solid-props/historical-catalog-builder-${id}.json`,saved=JSON.parse(readFileSync(path,'utf8'));
    expect(sha(readFileSync(path))).toBe(historicalBuilderPins[id]);
    expect(semantic(saved.tmj)).toBe(proof.native);expect(semantic(saved.wamExceptEntityCollections)).toBe(proof.wamExceptEntityCollections);
    const current=buildMap(JSON.parse(readFileSync(`world/layouts/${id}.json`,'utf8')),catalog).wam;
    expect(current.entityCollections).toEqual(descriptors);
    const{entityCollections,...currentRest}=current;expect(semantic(currentRest)).toBe(proof.wamExceptEntityCollections);
    return;
   }
   const layout=JSON.parse(raw) as MapLayout;
   const{tmj,wam}=buildMap(layout,catalog),{entityCollections,...rest}=wam;
   expect(entityCollections).toEqual(descriptors);
   expect(semantic(tmj)).toBe(proof.native);
   expect(semantic(rest)).toBe(proof.wamExceptEntityCollections);
  });
 }
 it('returns fresh arrays and descriptor objects for each authored map',()=>{
  const layout=JSON.parse(readFileSync('world/layouts/speaker-aries.json','utf8')) as MapLayout;
  const first=buildMap(layout,catalog).wam,second=buildMap(layout,catalog).wam;
  expect(first.entityCollections).not.toBe(second.entityCollections);
  expect(first.entityCollections[0]).not.toBe(second.entityCollections[0]);
  first.entityCollections[0].url='mutated-only-in-test';first.entityCollections.pop();
  expect(second.entityCollections).toEqual(expected);
  expect(buildMap(layout,catalog).wam.entityCollections).toEqual(expected);
  expect(JSON.parse(readFileSync('world/editor-collections.json','utf8'))).toEqual(expected);
 });
});

describe('pinned native entity fixtures',()=>{
 it('retains exact upstream schema, migration, loader, UI and license provenance',()=>{
  const provenance=json('provenance.json');
  expect(provenance.sourceCommit).toBe('96d43a841766b22418c061744e7ed2aafd9870d3');
  for(const[name,source]of Object.entries(provenance.sources) as [string,any][]){
   expect(sha(readFileSync(fixture+name)),name).toBe(source.sha256);
   expect(source.url).toBe(`https://raw.githubusercontent.com/workadventure/workadventure/${provenance.sourceCommit}/${source.upstreamPath}`);
  }
  expect(sha(readFileSync(fixture+'LICENSE.txt'))).toBe(provenance.license.sha256);
  expect(text('LICENSE.txt')).toContain('Commons Clause');
  expect(sha(readFileSync(fixture+'http-closure.json'))).toBe(provenance.httpClosureSha256);
  expect(sha(readFileSync(fixture+'builder-before.json'))).toBe(provenance.builderBaselineSha256);
 });
 it('validates all75 furniture and35 office variants through the real native migration/schema',()=>{
  expect(migrated.map(c=>c.collection.length)).toEqual([75,35]);
  for(const c of migrated)expect(types.EntityCollectionRaw.safeParse(c).success).toBe(true);
  const ids=migrated.flatMap(c=>c.collection.map((p:any)=>p.id));
  expect(new Set(ids).size).toBe(110);
  expect(migrated.flatMap(c=>c.collection).every((p:any)=>!Object.hasOwn(p,'properties'))).toBe(true);
 });
 it('keeps native chair variants, table collision/depth and decorative plants',()=>{
  const chairs=migrated[0].collection.filter((p:any)=>p.name==='Basic Chair');
  expect(chairs).toHaveLength(20);
  expect([...new Set(chairs.map((p:any)=>p.direction))].sort()).toEqual(['Down','Left','Right','Up']);
  const table=migrated[0].collection.find((p:any)=>p.name==='Basic Wood Table');
  expect(JSON.stringify(table.collisionGrid)).toBe('[[0,0],[1,1],[1,1]]');expect(table.depthOffset).toBe(-64);
  expect(migrated[1].collection.some((p:any)=>p.name==='Plant')).toBe(true);
 });
 it('rejects malformed prefab shapes and unsupported Tiled-style entity actions',()=>{
  const p=migrated[0].collection[0];
  for(const bad of[{...p,direction:'Diagonal'},{...p,imagePath:null},{...p,id:undefined}])expect(types.EntityRawPrefab.safeParse(bad).success).toBe(false);
  expect(types.EntityDataProperty.safeParse({id:'fixture',type:'collides',value:true}).success).toBe(false);
 });
 it('validates real interactive actions on placed WAM entities and their native editor controls',()=>{
  const prefab=migrated[1].collection.find((p:any)=>p.name==='Computer Screen');
  const entity={x:64,y:96,name:'Native fixture',prefabRef:{collectionName:migrated[1].collectionName,id:prefab.id},properties:[
   {id:'web',type:'openWebsite',link:'https://docs.workadventu.re/',newTab:true,application:'website'},
   {id:'audio',type:'playAudio',audioLink:'https://varcamp.3-1-133-135.sslip.io/static/audio/recording/en-US_recording-start.mp3',volume:1},
   {id:'description',type:'entityDescriptionProperties',description:'Native editor fixture',searchable:true},
  ]};
  expect(types.WAMEntityData.safeParse(entity).success).toBe(true);
  for(const type of['openWebsite','playAudio','openFile'])expect(text('EntityPropertiesEditor.svelte.txt')).toContain(`property="${type}"`);
  expect(text('EntityPropertiesEditor.svelte.txt')).toContain('entityDescriptionProperties');
 });
 it('pins complete safe relative image resolution and all110 previously verified self-hosted PNGs',()=>{
  const closure=json('http-closure.json');
  expect(closure.frontendOrigin).toBe('https://varcamp.3-1-133-135.sslip.io');
  expect(closure.assets).toHaveLength(110);expect(closure.officialAssets).toHaveLength(110);
  for(const asset of closure.assets){
   expect(asset.status).toBe(200);expect(asset.finalUrl).toBe(asset.url);
   expect(asset.matchesPinnedOfficialBytes).toBe(true);expect(asset.contentType).toMatch(/^image\/png/);
   expect(new URL(asset.url).origin).toBe(closure.frontendOrigin);
   expect(closure.officialAssets.find((a:any)=>a.sha256===asset.sha256)?.exactPinnedSourceBytes).toBe(true);
  }
  for(let index=0;index<migrated.length;index++)for(const p of migrated[index].collection){
   expect(p.imagePath).not.toMatch(/^(?:[a-z]+:|\/)|(?:^|\/)\.\.(?:\/|$)/i);
   const url=new URL(p.imagePath,descriptors[index].url).href;
   expect(closure.assets.some((a:any)=>a.url===url),url).toBe(true);
   const image=closure.officialAssets.find((a:any)=>a.path.endsWith('/'+p.imagePath));
   if(p.collisionGrid){expect(p.collisionGrid).toHaveLength(image.pngDimensions[1]/32);for(const row of p.collisionGrid){expect(row).toHaveLength(image.pngDimensions[0]/32);expect(row.every((cell:unknown)=>cell===0||cell===1)).toBe(true);}}
  }
 });
});

describe('actual native collection loader',()=>{
 const custom='https://maps.3-1-133-135.sslip.io/assets/entities/entities.json';
 it('keeps all110 default objects available when the optional custom catalog returns404',async()=>{
  const{manager,errors,stores}=managerBoundary(async url=>url===custom?{ok:false,statusText:'Not Found'}:{ok:true,json:async()=>structuredClone(raw[descriptors.findIndex((d:any)=>d.url===url)])});
  manager.loadCollections([...descriptors.map((d:any)=>({...d,type:'Default'})),{url:custom,type:'Custom'}]);
  const prefab=await manager.getEntityPrefab(migrated[0].collectionName,migrated[0].collection[0].id);
  expect(prefab.type).toBe('Default');expect(stores.at(-1)).toHaveLength(110);
  expect(errors).toHaveLength(1);expect(errors[0].slice(0,2)).toEqual(['Error while loading entity collection',custom]);
 });
 it('reproduces the empty editor store from no default descriptors plus custom404',async()=>{
  const{manager,errors,stores}=managerBoundary(async()=>({ok:false,statusText:'Not Found'}));
  manager.loadCollections([{url:custom,type:'Custom'}]);
  expect((await manager.entitiesPrefabsMapPromise).size).toBe(0);expect(stores.at(-1)).toHaveLength(0);expect(errors).toHaveLength(1);
 });
});

// Root owns the separate source/live WAM migration. This assertion is intentionally
// distinct from builder defaults; generated data is never a live organizer overwrite.
it('source WAM registrations match the reviewed shared data policy',()=>{
 const paths=readdirSync('maps').filter(name=>name.endsWith('.wam'));expect(paths).toHaveLength(33);
 for(const path of paths){const wam=JSON.parse(readFileSync('maps/'+path,'utf8'));expect(wam.entityCollections,path).toEqual(descriptors);}
});
