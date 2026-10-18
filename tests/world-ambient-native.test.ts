import{readFileSync}from'node:fs';
import{createRequire}from'node:module';
import{resolve}from'node:path';
import{createHash}from'node:crypto';
import sharp from'sharp';
import{expect,it}from'vitest';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const parse=createRequire(import.meta.url)(resolve('docs/qa/coastal-flight-2026-10-16/prototype/upstream/phaser/src/tilemaps/parsers/tiled/ParseTilesets.js'));
it('renders all35 logical effects and every depth component through pinned native Phaser with exact raw union, real travel and loop closure',async()=>{
 const recipe=read('art/source/world-ambient.json');let count=0,components=0;
 for(const row of recipe.maps){const m=read(`maps/${row.id}.tmj`),engines=parse(structuredClone(m));let decoded=0,painted=0;
  for(const e of row.effects){count++;const main=read(`art/source/${e.name}.json`),metas=main.componentNames.map((name:string)=>read(`art/source/${name}.json`)),w=e.clip.width*32,h=e.clip.height*32,raw=await sharp(main.rawPoseStrip.path).ensureAlpha().raw().toBuffer({resolveWithObject:true}),phases=Array.from({length:main.diagnostics.phaseCount+1},(_,i)=>i),unions=phases.map(()=>Buffer.alloc(w*h*4)),centers:Record<number,number>={};painted+=main.rawMaxPaintedPixels;
   for(const meta of metas){components++;const name=meta.overlay.name,layer=m.layers.find((l:any)=>l.name===name),set=m.tilesets.find((s:any)=>s.name===name),engine=engines.tilesets.find((s:any)=>s.firstgid===set.firstgid),atlas=await sharp(meta.overlay.image).ensureAlpha().raw().toBuffer(),strip=await sharp(meta.poseStrip.path).ensureAlpha().raw().toBuffer({resolveWithObject:true}),pw=meta.poseStrip.width,ph=meta.poseStrip.height;decoded+=meta.diagnostics.decodedRgbaBytes;expect(meta.maxPaintedPixels).toBeLessThanOrEqual(1024);expect(meta.diagnostics.decodedRgbaBytes).toBeLessThanOrEqual(4*1024*1024);
    for(let at=0;at<phases.length;at++){const phase=phases[at],idx=phase%meta.diagnostics.phaseCount,expected=Buffer.alloc(w*h*4),actual=Buffer.alloc(w*h*4);
     for(const t of meta.tracks){const s=t.samples[idx];if(s.pose===null)continue;for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){const dx=s.x+x,dy=s.y+y,src=(y*strip.info.width+s.pose*pw+x)*4;if(dx<0||dy<0||dx>=w||dy>=h||strip.data[src+3]===0)continue;strip.data.copy(expected,(dy*w+dx)*4,src,src+4);}}
     for(let cy=0;cy<e.clip.height;cy++)for(let cx=0;cx<e.clip.width;cx++){const gid=engine.getAnimatedTileId(layer.data[(e.clip.y+cy)*m.width+e.clip.x+cx],phase*e.clock.stepMs);expect(gid,name).not.toBeNull();const local=gid-set.firstgid,sx=local%set.columns*32,sy=Math.floor(local/set.columns)*32;for(let y=0;y<32;y++)atlas.copy(actual,((cy*32+y)*w+cx*32)*4,((sy+y)*set.imagewidth+sx)*4,((sy+y)*set.imagewidth+sx+32)*4);}
     expect(actual.equals(expected),`${name}@${phase*e.clock.stepMs}`).toBe(true);for(let i=0;i<actual.length;i+=4)if(actual[i+3]){expect(unions[at][i+3],name+' no depth overlap').toBe(0);actual.copy(unions[at],i,i,i+4);}
    }
    const floor=m.layers.findIndex((l:any)=>l.name==='floorLayer'),depth=m.layers.findIndex((l:any)=>l.name===name);expect(meta.overlay.level==='belowAvatar'?depth<floor:depth>floor,name).toBe(true);
   }
   const signatures=unions.map(sha);expect(signatures[0],e.name).toBe(signatures.at(-1));expect(new Set(signatures).size,e.name).toBeGreaterThan(1);
   for(let at=0;at<phases.length;at++){const idx=phases[at]%main.diagnostics.phaseCount,expected=Buffer.alloc(w*h*4),pw=main.rawPoseStrip.width,ph=main.rawPoseStrip.height;for(const t of main.tracks){const s=t.samples[idx];if(s.pose===null)continue;for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){const dx=s.x+x,dy=s.y+y,src=(y*raw.info.width+s.pose*pw+x)*4;if(dx<0||dy<0||dx>=w||dy>=h||!raw.data[src+3])continue;raw.data.copy(expected,(dy*w+dx)*4,src,src+4);}}expect(unions[at].equals(expected),e.name+' native union').toBe(true);let total=0,n=0;for(let i=0;i<expected.length;i+=4)if(expected[i+3]){total+=i/4%w;n++;}if(n)centers[phases[at]]=total/n;}
   if(e.kind==='gull')expect(centers[24]-centers[8],e.name).toBeGreaterThan(80);if(e.kind==='fish')expect(Math.abs(centers[24]-centers[0]),e.name).toBeGreaterThan(32);if(e.kind==='leaves')expect(centers[24]-centers[8],e.name).toBeGreaterThan(6);
  }
  expect(decoded,row.id).toBeLessThanOrEqual(8*1024*1024);expect(painted,row.id).toBeLessThanOrEqual(m.width*m.height*1024*.005);
 }
 expect(count).toBe(35);expect(components).toBeGreaterThan(35);
},20000);
