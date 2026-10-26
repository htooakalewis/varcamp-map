import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {expect,it} from 'vitest';
import {renderFountainMotion} from '../tools/art/fountain-motion';
import {applyFountainMotion,restoreFountainMotion} from '../tools/maps/fountain-motion';
import {priorFountainProvenance} from '../tools/maps/fountain-motion-provenance';
import {beforeFountainJson} from './helpers/fountain-motion-history';
import type {MapLayout} from '../tools/maps/types';
import {assertNativeAnimationSafety} from '../tools/maps/animated-decoration';
import {assertCurrentNativeMap} from '../tools/maps/current-native';
import {loadTileCatalog} from '../tools/art/catalog';

it('animates water in both fountain depths without changing the gold, plants or silhouette',async()=>{
 const base=readFileSync('assets/tilesets/original/plaza-fountain.png');
 expect(createHash('sha256').update(base).digest('hex')).toBe('cec850cca9c6f9e1e2c523314105dc201500d8009db29e15022e8fc382d97af4');
 const pixels=await sharp(base).ensureAlpha().raw().toBuffer(),result=await renderFountainMotion();
 expect(result.resources.map(r=>r.overlay.level)).toEqual(['belowAvatar','aboveAvatar']);
 for(const r of result.resources){
  expect(r.overlay).toMatchObject({x:49,y:59,width:4,height:3});
  const image=await sharp(r.png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const phaseImages=new Set<string>();let painted=0;
  for(let phase=0;phase<12;phase++){
   const rgba=Buffer.alloc(128*96*4);
   for(const [cell,id] of r.overlay.carrierTileIds.entries()){
    const frames=r.overlay.animations.find(a=>a.id===id)!.frames;let elapsed=phase*120,frame=frames[0];
    for(const f of frames){frame=f;if(elapsed<f.duration)break;elapsed-=f.duration;}
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
     const sx=frame.tileid%16*32+x,sy=Math.floor(frame.tileid/16)*32+y,src=(sy*image.info.width+sx)*4;
     if(!image.data[src+3])continue;
     const px=cell%4*32+x,py=Math.floor(cell/4)*32+y,dst=(py*128+px)*4;
     expect(pixels[dst+3]).toBe(255);
     expect(pixels[dst+2]).toBeGreaterThan(pixels[dst]+20);
     expect(r.overlay.level==='aboveAvatar'?py<32:py>=32).toBe(true);
     image.data.copy(rgba,dst,src,src+4);painted++;
    }
   }
   phaseImages.add(createHash('sha256').update(rgba).digest('hex'));
  }
  expect(painted).toBeGreaterThan(50);expect(phaseImages.size).toBeGreaterThanOrEqual(4);
  expect(r.overlay.animations.every(a=>a.frames.reduce((s,f)=>s+f.duration,0)===1440)).toBe(true);
 }
});

it('rejects native upper water outside the owning fountain and coherent omission of both effects',()=>{
 const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),map=read('maps/overworld.tmj'),layout=read('world/layouts/overworld.json'),catalog=loadTileCatalog();
 const layer=map.layers.find((l:any)=>l.name==='plaza-fountain-water-upper');
 layer.data[59*128+49]=layer.data[59*128+50];
 expect(()=>assertNativeAnimationSafety(map,layout,catalog)).toThrow(/owning alpha255 support/);
 const clean=read('maps/overworld.tmj');
 layout.animatedOverlays=layout.animatedOverlays.filter((o:any)=>!o.name.startsWith('plaza-fountain-water'));
 clean.layers=clean.layers.filter((l:any)=>!l.name.startsWith('plaza-fountain-water'));
 clean.tilesets=clean.tilesets.filter((s:any)=>!s.name.startsWith('plaza-fountain-water'));
 expect(()=>assertCurrentNativeMap('overworld',clean,layout,read('maps/overworld.wam'),catalog)).toThrow(/Fountain motion|Leo lion head/);
});

it('adds only the two fountain effects and retains every physical and chat setting',()=>{
 const before=beforeFountainJson<MapLayout>('world/layouts/overworld.json'),after=applyFountainMotion(before);
 expect(priorFountainProvenance(restoreFountainMotion(after))).toEqual(before);
 const {animatedOverlays,...rest}=after,{animatedOverlays:old,...oldRest}=before;
 expect(rest).toEqual(oldRest);expect(animatedOverlays).toHaveLength(old!.length+2);
 const missing=structuredClone(after);missing.animatedOverlays!.pop();expect(()=>restoreFountainMotion(missing)).toThrow(/fountain/i);
 const moved=structuredClone(after);moved.placements.find(p=>p.id==='plaza-fountain')!.x++;expect(()=>restoreFountainMotion(moved)).toThrow(/fountain/i);
});
