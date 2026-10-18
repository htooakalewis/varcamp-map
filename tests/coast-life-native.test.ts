import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {expect,it} from 'vitest';
import {assertNativeCoastLife} from '../tools/maps/coast-life';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const parse=createRequire(import.meta.url)(resolve('docs/qa/coastal-flight-2026-10-16/prototype/upstream/phaser/src/tilemaps/parsers/tiled/ParseTilesets.js'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
it.each(['shipyard-beach','constellation-shore'])('%s requires all current authored props and wildlife even when every source is removed',id=>{
 const map=read(`maps/${id}.tmj`),layout=read(`world/layouts/${id}.json`),catalog=read('art/tile-catalog.json');expect(()=>assertNativeCoastLife(map,layout,catalog)).not.toThrow();
 const missing=structuredClone(layout);missing.placements=missing.placements.filter((p:any)=>!p.sprite.startsWith('coast-life-'));missing.animatedOverlays=missing.animatedOverlays.filter((o:any)=>!o.name.startsWith('coast-life-'));expect(()=>assertNativeCoastLife(map,missing,catalog)).toThrow(/coast life/i);
 const wrongDepth=structuredClone(layout);wrongDepth.animatedOverlays.find((o:any)=>o.name.includes('fish')).level='aboveAvatar';expect(()=>assertNativeCoastLife(map,wrongDepth,catalog)).toThrow(/coast life/i);
 const missingNative=structuredClone(map);missingNative.layers=missingNative.layers.filter((l:any)=>!l.name.startsWith('coast-life-'));expect(()=>assertNativeCoastLife(missingNative,layout,catalog)).toThrow(/coast life/i);
 const identityless=structuredClone(map);identityless.properties=identityless.properties.filter((p:any)=>p.name!=='worldMapId');const wrongIdentity=structuredClone(layout);wrongIdentity.id='unrelated-map';expect(()=>assertNativeCoastLife(identityless,wrongIdentity,catalog)).toThrow(/coast life/i);
});
it('renders genuine original wildlife poses and world travel through the actual native Phaser consumer, including clip edges and quiet/full loop phases',async()=>{
 const recipe=read('art/source/coast-life-tracks.json');
 for(const [id,rows]of Object.entries(recipe.maps)as [string,any[]][]){const map=read(`maps/${id}.tmj`),engine=parse(structuredClone(map));for(const row of rows){
  const layer=map.layers.find((l:any)=>l.name===row.name),set=map.tilesets.find((t:any)=>t.name===row.name),native=engine.tilesets.find((t:any)=>t.firstgid===set.firstgid);
  const raw=await sharp(readFileSync(row.name?`assets/tilesets/original/${row.name}.png`:'')).ensureAlpha().raw().toBuffer();
  const strip=await sharp(readFileSync(`art/source/coast-life-${row.poseGroup}-poses.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const [pw,ph]=row.poseSize,w=row.rect.width*32,h=row.rect.height*32,phases=[0,1,8,10,Math.floor(row.periodMs/row.stepMs/2),row.periodMs/row.stepMs-1,row.periodMs/row.stepMs];const signatures=[];
  for(const phase of phases){const expected=Buffer.alloc(w*h*4),actual=Buffer.alloc(w*h*4),index=phase%(row.periodMs/row.stepMs);
   for(const track of row.tracks){const s=track.samples[index];for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){const dx=s.x+x,dy=s.y+y,src=(y*strip.info.width+s.pose*pw+x)*4;if(dx<0||dx>=w||dy<0||dy>=h||strip.data[src+3]===0)continue;strip.data.copy(expected,(dy*w+dx)*4,src,src+4);}}
   for(let cy=0;cy<row.rect.height;cy++)for(let cx=0;cx<row.rect.width;cx++){const gid=native.getAnimatedTileId(layer.data[(row.rect.y+cy)*map.width+row.rect.x+cx],phase*row.stepMs);expect(gid,row.name).not.toBeNull();const local=gid-set.firstgid,sx=local%set.columns*32,sy=Math.floor(local/set.columns)*32;for(let y=0;y<32;y++)raw.copy(actual,((cy*32+y)*w+cx*32)*4,((sy+y)*set.imagewidth+sx)*4,((sy+y)*set.imagewidth+sx+32)*4);}
   expect(actual.equals(expected),`${row.name}@${phase*row.stepMs}ms`).toBe(true);signatures.push(sha(actual));
  }
  expect(signatures[0],row.name).toBe(signatures.at(-1));expect(new Set(signatures).size,row.name).toBeGreaterThan(1);
  const floor=map.layers.findIndex((l:any)=>l.name==='floorLayer'),depth=map.layers.findIndex((l:any)=>l.name===row.name);expect(row.level==='belowAvatar'?depth<floor:depth>floor,row.name).toBe(true);
 }}
},20000);
