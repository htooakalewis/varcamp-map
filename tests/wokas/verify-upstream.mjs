/** Run actual pinned WorkAdventure schema, animation and local ID resolver.
 * The upstream code is never modified in place. Only its module import path is
 * rebound in a temporary compiled test copy; the real fs read and method bodies
 * execute. This proves a source integration boundary, not a live server route.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const args=Object.fromEntries(process.argv.slice(2).reduce((out,v,i,a)=>i%2===0?[...out,[v,a[i+1]]]:out,[]));
for(const key of ['--core-source','--dependency-root','--typescript','--evidence']) assert.ok(args[key],`Missing ${key}`);
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const fixture=JSON.parse(await fs.readFile(path.join(root,'art/source/wokas/native-format-contract.json'),'utf8'));
const core=path.resolve(args['--core-source']),deps=path.resolve(args['--dependency-root']);
const require=createRequire(import.meta.url),ts=require(path.resolve(args['--typescript']));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const source={};for(const [name,pin] of Object.entries(fixture.sourceFiles)){const raw=await fs.readFile(path.join(core,name));assert.equal(raw.length,pin.bytes);assert.equal(digest(raw),pin.sha256);source[name]=raw.toString('utf8');}
const native=await fs.readFile(path.join(core,'play/public/resources/characters/pipoya/Male 01-1.png'));assert.equal(digest(native),fixture.actualExistingWoka.sha256);assert.equal(native.length,fixture.actualExistingWoka.bytes);assert.deepEqual([native.readUInt32BE(16),native.readUInt32BE(20)],[96,128]);
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'varcamp-woka-upstream-'));
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
try{
 await fs.symlink(deps,path.join(temp,'node_modules'),'dir');
 await fs.writeFile(path.join(temp,'PlayerTextures.mjs'),transpile(source['libs/messages/src/JsonMessages/PlayerTextures.ts']));
 const original=source['play/src/pusher/services/LocalWokaService.ts'];assert.equal(original.split('from "@workadventure/messages"').length-1,2);
 const rebound=original.replaceAll('from "@workadventure/messages"','from "../../../PlayerTextures.mjs"');
 const services=path.join(temp,'play/pusher/services');await fs.mkdir(services,{recursive:true});await fs.mkdir(path.join(temp,'play/pusher/data'));
 await fs.writeFile(path.join(services,'LocalWokaService.mjs'),transpile(rebound));
 await fs.writeFile(path.join(temp,'Animation.mjs'),transpile(source['play/src/front/Phaser/Player/Animation.ts']));
 const {wokaList}=await import(pathToFileURL(path.join(temp,'PlayerTextures.mjs')).href);
 const originalCatalogPath=path.join(core,'play/src/pusher/data/woka.json');const originalCatalogRaw=await fs.readFile(originalCatalogPath);const originalCatalog=JSON.parse(originalCatalogRaw);
 const bound=path.join(temp,'bound.json');const binding=spawnSync('python3',[path.join(root,'tools/wokas/bind_collection.py'),'--catalog',originalCatalogPath,'--asset-base-url','https://venue.example.test/wokas/varcamp-zodiac-v1/','--output',bound],{encoding:'utf8'});assert.equal(binding.status,0,binding.stderr);
 const catalog=JSON.parse(await fs.readFile(bound,'utf8'));wokaList.parse(catalog);
 const newCollection=catalog.woka.collections.at(-1);assert.equal(newCollection.textures.length,24);
 assert.deepEqual(catalog.woka.collections.slice(0,-1),originalCatalog.woka.collections);
 for(const [key,value] of Object.entries(originalCatalog))if(key!=='woka')assert.deepEqual(catalog[key],value);
 const dataPath=path.join(temp,'play/pusher/data/woka.json');await fs.writeFile(dataPath,JSON.stringify(catalog));
 const {localWokaService}=await import(pathToFileURL(path.join(services,'LocalWokaService.mjs')).href);
 assert.deepEqual(await localWokaService.getWokaList('unused-room','unused-token'),catalog);
 let selected=0;
 for(const texture of newCollection.textures){assert.deepEqual(await localWokaService.fetchWokaDetails([texture.id]),[{id:texture.id,url:texture.url}]);selected++;}
 assert.equal(await localWokaService.fetchWokaDetails(['varcamp-zodiac-v1-unknown']),undefined);
 assert.equal(await localWokaService.fetchWokaDetails([newCollection.textures[0].id,'unknown']),undefined);
 assert.equal(await localWokaService.fetchWokaDetails([newCollection.textures[0].id,newCollection.textures[0].id]),undefined);
 const oldTexture=originalCatalog.woka.collections[0].textures[0];assert.deepEqual(await localWokaService.fetchWokaDetails([oldTexture.id]),[{id:oldTexture.id,url:oldTexture.url}]);
 const changed=structuredClone(catalog);changed.woka.collections.at(-1).textures.pop();await fs.writeFile(dataPath,JSON.stringify(changed));assert.equal(await localWokaService.fetchWokaDetails([newCollection.textures.at(-1).id]),undefined,'Actual resolver reloads changed catalog DATA');
 const malformed=structuredClone(catalog);delete malformed.woka.collections.at(-1).textures[0].url;assert.equal(wokaList.safeParse(malformed).success,false);
 const {getPlayerAnimations}=await import(pathToFileURL(path.join(temp,'Animation.mjs')).href);const animations=getPlayerAnimations('avatar');
 assert.deepEqual(animations.slice(0,4).map(x=>x.frames),[[0,1,2,1],[3,4,5,4],[6,7,8,7],[9,10,11,10]]);assert.deepEqual(animations.slice(4).map(x=>x.frames),[[1],[4],[7],[10]]);
 assert.equal(digest(await fs.readFile(originalCatalogPath)),digest(originalCatalogRaw),'Upstream source/catalog unchanged');
 const report={status:'PASS_SOURCE_INTEGRATION_NOT_LIVE_SELECTION',actualSchema:true,actualExistingNativeTexture:true,actualLocalResolver:true,actualFilesystemReload:true,selected24:selected,unknownPartialDuplicateRejected:true,defaultSelectionPreserved:true,originalCatalogSha256:digest(originalCatalogRaw),animations,sourcePins:fixture.sourceFiles,dependencyVersions:{zod:require(path.join(deps,'zod/package.json')).version,zodOpenapi:require(path.join(deps,'@anatine/zod-openapi/package.json')).version}};
 await fs.writeFile(path.resolve(args['--evidence']),JSON.stringify(report,null,2)+'\n');console.log('PASS: actual pinned schema + all24 actual local resolver selections + default preservation + unknown/partial/duplicate rejection + reload + D/L/R/U native animation contract. Live service selection remains a separate gate.');
}finally{await fs.rm(temp,{recursive:true,force:true});}
