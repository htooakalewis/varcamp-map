import{loadTileCatalog}from'../art/catalog';
import type{MapLayout}from'./types';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { validateMap, validateWam } from './validate';
import { WORLD_CATALOG } from '../../src/world/catalog';
import { isSponsorTileset, readSponsorTileset } from './builder';
import {assertCurrentMapRoster} from './current-package';
import {assertCurrentNativeMap} from './current-native';
import type { TiledMap, TiledLayer } from './types';

/** Normal builds preserve native Tiled sources and only refresh validated previews. */
await mkdir('maps/preview',{recursive:true});
const currentFiles=await readdir('maps');assertCurrentMapRoster(currentFiles);
const previews:[string,string][]=[];
for(const file of currentFiles.filter(f=>f.endsWith('.tmj')).sort()) {
  const tmj=JSON.parse(await readFile(`maps/${file}`,'utf8')) as TiledMap;
  const wam=JSON.parse(await readFile(`maps/${file.replace('.tmj','.wam')}`,'utf8'));
  const layout=JSON.parse(await readFile(`world/layouts/${file.replace('.tmj','.json')}`,'utf8'))as MapLayout;assertCurrentNativeMap(file.slice(0,-4),tmj,layout,wam,loadTileCatalog());
  const issues=[...validateMap(tmj,WORLD_CATALOG),...validateWam(wam)];
  if(issues.length)throw new Error(`${file}: ${JSON.stringify(issues)}`);
  const preview=structuredClone(tmj);
  for(const t of tmj.tilesets)if(isSponsorTileset(t))readSponsorTileset(t);
  for(const p of preview.properties??[])if(p.name==='script')p.value='../'+p.value;
  for(const t of preview.tilesets)if(t.image)t.image='../'+t.image;
  function prepare(layers:TiledLayer[]):void {
    for(const l of layers){
      if(l.type==='group')prepare(l.layers);
      if(l.type==='imagelayer'){
        throw new Error(`Image layer unsupported by pinned WorkAdventure; use sponsor tile layers: ${l.name}`);
      }
      for(const p of l.properties??[]){if(p.name==='exitUrl')p.value=String(p.value).replace('.wam#','.tmj#');if(p.name==='playAudio')p.value='../'+String(p.value);}
    }
  }
  prepare(preview.layers);
  previews.push([file,JSON.stringify(preview)+'\n']);
}

// No preview body is written until every current source/domain check has passed.
for(const[file,body]of previews){await writeFile(`maps/preview/${file}`,body);console.log(`${file}: native Tiled source retained; validated WAM + refreshed preview.`);}
