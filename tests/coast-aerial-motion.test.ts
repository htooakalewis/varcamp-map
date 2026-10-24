import{readFileSync}from'node:fs';
import{createRequire}from'node:module';
import{resolve}from'node:path';
import{expect,it}from'vitest';
import sharp from'sharp';
import{renderCoastalFlight}from'../tools/art/coastal-flight';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const parse=createRequire(import.meta.url)(resolve('docs/qa/coastal-flight-2026-10-16/prototype/upstream/phaser/src/tilemaps/parsers/tiled/ParseTilesets.js'));
const clean=(b:Buffer)=>{for(let i=0;i<b.length;i+=4)if(b[i+3]===0)b.fill(0,i,i+4);return b;};
it('all244 aircraft and992 gull native phases retain exact approved pixels at the separate lower-plane and above-scenery bird depths, including wraps',async()=>{
 const flight=await renderCoastalFlight(),art=clean(await sharp(flight.art).ensureAlpha().raw().toBuffer()),recipe=read('art/source/coast-life-tracks.json');let checked=0;
 for(const id of ['shipyard-beach','constellation-shore']){
  const map=read(`maps/${id}.tmj`),layout=read(`world/layouts/${id}.json`),engine=parse(structuredClone(map)),floor=map.layers.findIndex((l:any)=>l.name==='floorLayer');
  const rows=recipe.maps[id].filter((r:any)=>r.kind==='gull');const expectedBirds=(id==='shipyard-beach'?['coast-life-harbor-gull-north','coast-life-harbor-gull-south']:['coast-life-shore-gull-north','coast-life-shore-gull-south']);expect(rows.map((r:any)=>r.name)).toEqual(expectedBirds);expect(map.layers.slice(-2).map((l:any)=>l.name)).toEqual(expectedBirds);
  if(id==='shipyard-beach')rows.unshift({name:'coastal-flight',rect:{x:0,y:11,width:48,height:3},stepMs:100,periodMs:24400});
  for(const row of rows){
   const layer=map.layers.find((l:any)=>l.name===row.name),set=map.tilesets.find((s:any)=>s.name===row.name),native=engine.tilesets.find((s:any)=>s.firstgid===set.firstgid),w=row.rect.width*32,h=row.rect.height*32;
   if(row.name==='coastal-flight'){expect(map.layers.indexOf(layer),row.name).toBeLessThan(floor);expect(layout.animatedOverlays.find((o:any)=>o.name===row.name).level).toBe('belowAvatar');}else{expect(expectedBirds).toContain(row.name);expect(map.layers.indexOf(layer),row.name).toBeGreaterThan(floor);expect(layout.animatedOverlays.find((o:any)=>o.name===row.name).level).toBe('aboveScenery');}
   const atlas=clean(await sharp(readFileSync(resolve('maps',set.image))).ensureAlpha().raw().toBuffer());
   const strip=row.name==='coastal-flight'?null:await sharp(readFileSync(`art/source/coast-life-${row.poseGroup}-poses.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const phases=row.periodMs/row.stepMs;
   for(let phase=0;phase<=phases;phase++){
    const expected=Buffer.alloc(w*h*4),actual=Buffer.alloc(w*h*4),index=phase%phases;
    if(row.name==='coastal-flight'){
     const travel=512+index*8,position=travel<1536?travel:travel-1952,src=Math.max(0,-position),dst=Math.max(0,position),length=Math.min(416-src,1536-dst);
     for(let y=0;y<96;y++)if(length>0)art.copy(expected,(y*w+dst)*4,(y*416+src)*4,(y*416+src+length)*4);
     // Its source-space band is352..447: the upper-middle beach rows11-13.
     expect(row.rect.y*32).toBe(352);
    }else{
     const[pw,ph]=row.poseSize;
     for(const track of row.tracks){const s=track.samples[index];if(s.pose===null)continue;for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){const dx=s.x+x,dy=s.y+y,src=(y*strip!.info.width+s.pose*pw+x)*4;if(dx<0||dx>=w||dy<0||dy>=h||strip!.data[src+3]===0)continue;strip!.data.copy(expected,(dy*w+dx)*4,src,src+4);}}
    }
    for(let y=0;y<row.rect.height;y++)for(let x=0;x<row.rect.width;x++){
     const gid=native.getAnimatedTileId(layer.data[(row.rect.y+y)*map.width+row.rect.x+x],phase*row.stepMs);expect(gid).not.toBeNull();const local=gid-set.firstgid,sx=local%set.columns*32,sy=Math.floor(local/set.columns)*32;
     for(let py=0;py<32;py++)atlas.copy(actual,((y*32+py)*w+x*32)*4,((sy+py)*set.imagewidth+sx)*4,((sy+py)*set.imagewidth+sx+32)*4);
    }
    expect(actual.equals(expected),`${id}/${row.name}@${phase*row.stepMs}ms`).toBe(true);checked++;
   }
  }
 }
 expect(checked).toBe(1241);
},20000);
