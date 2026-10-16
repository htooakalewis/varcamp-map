import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import type { TiledMap } from '../tools/maps/types';
const root='tests/fixtures/phaser-tileset-binding';
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const source=readFileSync(`${root}/TilemapTilesetMethods.js.txt`);
const provenance=JSON.parse(readFileSync(`${root}/provenance.json`,'utf8'));
const methods=runInNewContext(source.toString(),{Formats:{TILED_JSON:1}}) as Record<'getIndex'|'getTilesetIndex'|'addTilesetImage',(...args:unknown[])=>unknown>;
interface BoundSet {name:string;firstgid:number;image?:{key:string};}
const parse=createRequire(import.meta.url)(resolve('docs/qa/coastal-flight-2026-10-16/prototype/upstream/phaser/src/tilemaps/parsers/tiled/ParseTilesets.js')) as (map:TiledMap)=>{tilesets:BoundSet[]};
function requireCorrectBinding(map:TiledMap):void {
 const parsed=parse(structuredClone(map));
 const textures=new Map(map.tilesets.map(t=>[t.image,{key:t.image,source:[{width:t.imagewidth,height:t.imageheight}],get:()=>({width:t.imagewidth,height:t.imageheight,source:{glTexture:{}}}),getFrameBounds:()=>({x:0,y:0,width:t.imagewidth,height:t.imageheight})}]));
 const context={...methods,tilesets:parsed.tilesets,format:1,scene:{sys:{textures:{exists:(key:string)=>textures.has(key),get:(key:string)=>textures.get(key)}}}};
 // Pinned WorkAdventure GameScene invokes this actual Phaser method by name,
 // not by firstgid. Real Tileset.setImage/updateTileData run with texture stubs.
 for(const t of map.tilesets){const bound=methods.addTilesetImage.call(context,t.name,t.image,t.tilewidth,t.tileheight,t.margin,t.spacing) as BoundSet|null;
  if(!bound||bound.firstgid!==t.firstgid)throw Error(`Tileset binding mismatch: ${t.name} expected firstgid ${t.firstgid}, bound ${bound?.firstgid}`);
 }
 for(const t of parsed.tilesets)if(!t.image)throw Error(`Unbound atlas: ${t.name} firstgid ${t.firstgid}`);
}
it.each(['maps','maps/preview'])('binds every %s atlas to its own firstgid through actual pinned Phaser methods',dir=>{
 expect(hash(source)).toBe(provenance.methodExcerptSha256);
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.tmj')))requireCorrectBinding(JSON.parse(readFileSync(`${dir}/${file}`,'utf8')));
});
it('rejects the deployed duplicate-name defect even when both PNGs load successfully',()=>{
 const broken=JSON.parse(readFileSync('maps/shipyard-beach.tmj','utf8')) as TiledMap;
 const lounge=broken.tilesets.find(t=>t.image?.includes('/beach-lounge'))!;lounge.name='art-1';
 expect(()=>requireCorrectBinding(broken)).toThrow(`Tileset binding mismatch: art-1 expected firstgid ${lounge.firstgid}, bound 19`);
});
