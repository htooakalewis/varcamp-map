import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { TiledLayer, TiledMap } from './types';
/** Uses the pinned native Tiled renderer, retaining source pixels and native text behavior. */
export async function renderMap(map:TiledMap,outputPath:string):Promise<void> {
  await mkdir(dirname(resolve(outputPath)),{recursive:true});await mkdir('.qa',{recursive:true});
  const dir=await mkdtemp('.qa/native-render-');
  try {
    const rendered=structuredClone(map);
    for(const t of rendered.tilesets)if(t.image)t.image=resolve('maps',t.image);
    const resolveImages = (layers: TiledLayer[]): void => {
      for (const layer of layers) {
        if (layer.type === 'imagelayer') layer.image = resolve('maps', layer.image);
        if (layer.type === 'group') resolveImages(layer.layers);
      }
    };
    resolveImages(rendered.layers);
    const filename=resolve(dir,'map.tmj');await writeFile(filename,JSON.stringify(rendered));
    await promisify(execFile)(resolve('.tools/tiled-1.12.2/Tiled.app/Contents/MacOS/tmxrasterizer'),['--no-smoothing','--scale','1',filename,resolve(outputPath)],{maxBuffer:1024*1024});
  } finally { await rm(dir,{recursive:true,force:true}); }
}
