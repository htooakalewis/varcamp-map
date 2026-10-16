import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { loadTileCatalog } from './catalog';
import type { TiledMap, TiledLayer, TiledTileset } from '../maps/types';

export interface SamplePlacement { id: string; x: number; y: number; }
export interface ArtSample { sign: 'aries' | 'libra'; width: number; height: number; placements: SamplePlacement[]; destinations: [number, number][]; }
/** Two art scale studies only; the nine-map layout builder is a separate task. */
export function createArtSample(sign: 'aries' | 'libra'): ArtSample {
  const placements: SamplePlacement[] = [];
  const put = (id: string, x: number, y: number) => placements.push({ id, x, y });
  const fire = sign === 'aries';
  for (let y=0;y<18;y++) for (let x=0;x<24;x++) put('floor-charcoal',x,y);
  // Warm wood forms the presentation wall and audience zones, with quiet open circulation.
  for (let y=2;y<4;y++) for (let x=2;x<22;x++) put('floor-wood-long',x,y);
  for (const left of [3,13]) for (let y=6;y<14;y++) for (let x=left;x<left+8;x++) put(fire?'floor-wood-long':'floor-wood',x,y);
  for (let x=0;x<24;x++) put('wall-navy',x,0);
  for (let y=2;y<16;y+=2) { put('wall-navy',0,y); put('wall-navy',23,y); }
  for (const x of [1,20]) put('glass-partition',x,0);
  for (const x of [8,15]) put(fire?'light-amber':'light-cyan',x,0);
  put(fire?'forge-wall-relief':'balance-wall-relief',5,0);
  put(`constellation-${sign}`,16,0);
  put('screen-presentation',9,0);
  put(`label-${sign}`,10,3);
  put('lectern',16,3); put('laptop',16,3);
  put('plant-tree',2,3); put('plant-tree',21,3);
  // Chairs show their backs to the entrance and face the single display at the front.
  const rows = fire
    ? [{y:6,x:[5,7,9,14,16,18]}, {y:9,x:[4,6,8,15,17,19]}, {y:12,x:[3,5,7,9,14,16,18,20]}]
    : [{y:6,x:[4,6,8,10,13,15,17,19]}, {y:9,x:[4,6,8,10,13,15,17,19]}, {y:12,x:[4,6,8,10,13,15,17,19]}];
  for (const row of rows) for (const x of row.x) put(fire?'chair-north-slate':'chair-north-cream',x,row.y);
  put('rune-threshold',10,16); put('door-open',10,16);
  for (let x=0;x<24;x++) if(x<10 || x>13) put('wall-navy',x,16);
  put(`glyph-${sign}`,9,16); put(`glyph-${sign}`,14,16);
  return { sign, width:24, height:18, placements, destinations:[[11,4],[15,4],[5,8],[18,11],[11,15]] };
}

export async function writeArtSamples(): Promise<void> {
  const catalog=loadTileCatalog();
  const sources=JSON.parse(await readFile('art/sources.json','utf8'));
  await mkdir('docs/qa/samples',{recursive:true});
  const avatar=await sharp('.tools/art-reference/wa-avatar.png').extract({left:32,top:0,width:32,height:32}).png().toBuffer();
  for (const sign of ['aries','libra'] as const) {
    const sample=createArtSample(sign), tilesets:TiledTileset[]=[], sheetRefs=new Map<string,{gid:number;columns:number}>();
    let nextGid=1;
    for (const {id} of sample.placements) {
      const sprite=catalog[id];
      if(sheetRefs.has(sprite.sheet)) continue;
      const meta=await sharp(sprite.sheet).metadata();
      const columns=meta.width!/32, tilecount=columns*(meta.height!/32);
      sheetRefs.set(sprite.sheet,{gid:nextGid,columns});
      tilesets.push({firstgid:nextGid,name:sprite.sheet,tilewidth:32,tileheight:32,tilecount,columns,image:relative('docs/qa/samples',sprite.sheet),imagewidth:meta.width,imageheight:meta.height,properties:[{name:'tilesetCopyright',type:'string',value:sources[sprite.sourceId].attribution+'; '+sources[sprite.sourceId].license}]});
      nextGid+=tilecount;
    }
    const layers:TiledLayer[]=sample.placements.map((p,index)=>{
      const sprite=catalog[p.id],ref=sheetRefs.get(sprite.sheet)!,data=Array(sample.width*sample.height).fill(0);
      for(let y=0;y<sprite.rect.height;y++) for(let x=0;x<sprite.rect.width;x++) data[(p.y+y)*sample.width+p.x+x]=ref.gid+(sprite.rect.y+y)*ref.columns+sprite.rect.x+x;
      return {id:index+1,name:p.id,type:'tilelayer',width:sample.width,height:sample.height,data,visible:true,opacity:1};
    });
    const map:TiledMap={type:'map',version:'1.10',tiledversion:'1.12.2',orientation:'orthogonal',renderorder:'right-down',infinite:false,width:sample.width,height:sample.height,tilewidth:32,tileheight:32,layers,tilesets,nextlayerid:layers.length+1,nextobjectid:1};
    const filename=`docs/qa/samples/${sign}.tmj`;
    await writeFile(filename,JSON.stringify(map));
    const result=spawnSync('.tools/tiled-1.12.2/Tiled.app/Contents/MacOS/tmxrasterizer',['--no-smoothing','--scale','1',filename,`docs/qa/${sign}-tiled-native.png`],{encoding:'utf8'});
    if(result.error || result.status!==0) throw new Error(`Tiled sample render failed: ${result.error?.message ?? result.stderr}`);
    // In-composition avatar reference only; source character sheet is intentionally not redistributed.
    await sharp(`docs/qa/${sign}-tiled-native.png`).composite([{input:avatar,left:11*32,top:13*32},{input:avatar,left:15*32,top:4*32}]).png().toFile(`docs/qa/${sign}-sample.png`);
    await writeFile(`docs/qa/samples/${sign}-placements.json`,JSON.stringify(sample,null,2)+'\n');
    console.log(`${sign}: Tiled 1.12.2 rendered 768×576 native pixels; two actual 32×32 WorkAdventure avatar references added.`);
  }
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) await writeArtSamples();
