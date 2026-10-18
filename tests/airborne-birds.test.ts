import{readFileSync}from'node:fs';
import{expect,it}from'vitest';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const rows=[['shipyard-beach','coast-life-harbor-gull-north'],['shipyard-beach','coast-life-harbor-gull-south'],['constellation-shore','coast-life-shore-gull-north'],['constellation-shore','coast-life-shore-gull-south'],['fa-ship','world-ambient-fa-ship-gull-1']];
it.each(rows)('%s/%s is a real end-of-stack airborne bird, rather than beneath scenery',(id,name)=>{
 const layout=read(`world/layouts/${id}.json`),map=read(`maps/${id}.tmj`),o=layout.animatedOverlays.find((o:any)=>o.name===name),own=rows.filter(r=>r[0]===id).map(r=>r[1]);
 expect(o.level).toBe('aboveScenery');expect(map.layers.slice(-own.length).map((l:any)=>l.name)).toEqual(own);
});

import{createRequire}from'node:module';
import{resolve}from'node:path';
import{createHash}from'node:crypto';
import sharp from'sharp';
import{AIRBORNE_BIRDS,assertNativeAirborne,visitAirborneNativePhases}from'../tools/maps/airborne';
import{assertAnimatedDecorationSource,currentDecorationRoles}from'../tools/maps/animated-decoration';
import{assertCurrentNativeMap}from'../tools/maps/current-native';
import{decodeAirborneRgbaPng,decodeArtRgbaPng}from'../tools/art/native-png';
import{buildMap}from'../tools/maps/builder';
import{reconcileNativeProjection}from'../tools/maps/native-projection';
import type{MapLayout}from'../tools/maps/types';
const parse=createRequire(import.meta.url)(resolve('docs/qa/coastal-flight-2026-10-16/prototype/upstream/phaser/src/tilemaps/parsers/tiled/ParseTilesets.js'));
const catalog=read('art/tile-catalog.json');
const current=(id:string)=>({map:read(`maps/${id}.tmj`),layout:read(`world/layouts/${id}.json`)});
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const originalPngs=['bc70e62b8137e867bcf40b32b354e9a5cf443259d60ab25406fad2f46b182f24','d845f9067f30d06a9e2426cdf8ec592cfc9e6ed13aba9a236ec8c63782f5cb04','d56ebae4e90b20a2a7417653ce8979d0cafab04b6a6bb6ee8a1039d0d9e2ea81','146fa37f45feb41ec4a6c648b9153cca32a3b078ed3e766b0a4d9407f4f627e9','f34e22dbb01dd56f3d869557bf5d38e2c550470fac697483487876a0814fdc79'];
it('mandatory current classes contain exactly133 lower, two actual owning-upper and five finite airborne roles',()=>{
 const classes=Object.values(currentDecorationRoles()).flat();expect(classes).toHaveLength(140);expect(classes.filter(r=>r.role==='avatarForeground')).toHaveLength(133);expect(classes.filter(r=>r.role==='opaqueOwnerUpper')).toHaveLength(2);expect(classes.filter(r=>r.role==='airborne')).toHaveLength(5);
});
it.each(AIRBORNE_BIRDS)('$name actual Phaser phases and wrap equal consumed nativeRGBA, preserving the approved PNG bytes',async r=>{
 const{map,layout}=current(r.map),o=layout.animatedOverlays.find((o:any)=>o.name===r.name),set=map.tilesets.find((s:any)=>s.name===r.name),native=parse(structuredClone(map)).tilesets.find((s:any)=>s.name===r.name),bytes=readFileSync(o.image),index=AIRBORNE_BIRDS.indexOf(r),image=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 expect(sha(bytes)).toBe(originalPngs[index]);let phases=0;
 visitAirborneNativePhases(map,o,(actual,t)=>{
  const expected=Buffer.alloc(actual.length),w=o.width*32;
  for(let cell=0;cell<o.carrierTileIds.length;cell++){
   const local=native.getAnimatedTileId(set.firstgid+o.carrierTileIds[cell],t)-set.firstgid,sx=local%16*32,sy=Math.floor(local/16)*32;
   for(let y=0;y<32;y++)image.data.copy(expected,((Math.floor(cell/o.width)*32+y)*w+cell%o.width*32)*4,((sy+y)*image.info.width+sx)*4,((sy+y)*image.info.width+sx+32)*4);
  }expect(actual.equals(expected)).toBe(true);phases++;
 });expect(phases).toBe(16000/r.stepMs+1);
 expect(()=>assertNativeAirborne(map,layout)).not.toThrow();
},10000);
it.each(['shipyard-beach','constellation-shore','fa-ship'])('%s actual current normal/release boundary accepts complete airborne projection',id=>{
 const{map,layout}=current(id);expect(()=>assertCurrentNativeMap(id,map,layout,read(`maps/${id}.wam`),catalog)).not.toThrow();
},15000);
it.each(['old-unsafe-lane','lower','implicit','unknown-airborne','missing','functional-overlap','label-overlap','land-terrain'])('rejects unsafe source class: %s',kind=>{
 const{layout}=current('shipyard-beach'),o=layout.animatedOverlays.find((o:any)=>o.name==='coast-life-harbor-gull-north');
 if(kind==='old-unsafe-lane'){o.x=2;o.y=10;}
 if(kind==='lower')o.level='belowAvatar';if(kind==='implicit')delete o.level;
 if(kind==='unknown-airborne')layout.animatedOverlays.find((o:any)=>o.name==='coastal-flight').level='aboveScenery';
 if(kind==='missing')layout.animatedOverlays=layout.animatedOverlays.filter((p:any)=>p!==o);
 if(kind==='functional-overlap')layout.entries.push({name:'unsafe',x:o.x,y:o.y,width:1,height:1});
 if(kind==='label-overlap')layout.signs.push({name:'unsafe',text:'unsafe',x:o.x,y:o.y,width:1,height:1});
 if(kind==='land-terrain')layout.placements.push({id:'unsafe',sprite:'ground-grass',layer:'terrain',x:o.x,y:o.y,width:1,height:1});
 expect(()=>assertAnimatedDecorationSource(layout)).toThrow(/airborne|animation safety/i);
});
it.each(['before-scenery','hidden','opacity','offset','flip','frame','clock','walkable'])('rejects unsafe actual native airborne projection: %s',kind=>{
 const{map,layout}=current('shipyard-beach'),name='coast-life-harbor-gull-north',o=layout.animatedOverlays.find((o:any)=>o.name===name),layer=map.layers.find((l:any)=>l.name===name),set=map.tilesets.find((s:any)=>s.name===name),cell=o.y*map.width+o.x;
 if(kind==='before-scenery'){map.layers=map.layers.filter((l:any)=>l!==layer);map.layers.splice(map.layers.findIndex((l:any)=>l.name==='floorLayer')+1,0,layer);}
 if(kind==='hidden')layer.visible=false;if(kind==='opacity')layer.opacity=0;if(kind==='offset')layer.offsetx=32;
 if(kind==='flip')layer.data[cell]=(layer.data[cell]|0x80000000)>>>0;
 if(kind==='frame')set.tiles[0].animation[0].tileid++;
 if(kind==='clock')set.tiles[0].animation[0].duration++;
 if(kind==='walkable')map.layers.find((l:any)=>l.name==='physical-collisions').data[cell]=0;
 expect(()=>assertNativeAirborne(map,layout)).toThrow(/airborne safety/i);
});
it('the separate strict aerial decoder accepts actual atlas geometry without widening the owner cap',()=>{
 const path='assets/tilesets/original/coast-life-harbor-gull-north.png',bytes=readFileSync(path);expect(()=>decodeArtRgbaPng(bytes,512,1120)).toThrow(/PNG/);expect(decodeAirborneRgbaPng(bytes,512,1120).rgba.length).toBe(2293760);
 expect(()=>decodeAirborneRgbaPng(bytes,512,1152)).toThrow(/PNG/);expect(()=>decodeAirborneRgbaPng(Buffer.concat([bytes,Buffer.alloc(196608)]),512,1120)).toThrow(/PNG/);
 const corrupt=Buffer.from(bytes);corrupt[50]^=1;expect(()=>decodeAirborneRgbaPng(corrupt,512,1120)).toThrow(/PNG/);
});
it('generic source reconciliation keeps deferred paint after all protected nonfloor layers without changing their bodies/order',()=>{
 const layout={id:'unit-diagnostic',width:4,height:4,placements:[],entries:[],exits:[],areas:[],inspectionZones:[],signs:[{name:'low-sign',text:'clear',x:3,y:3,width:1,height:1}],animatedOverlays:[{name:'generic-air',image:'assets/tilesets/original/guides.png',sourceId:'original',level:'aboveScenery',x:0,y:0,width:1,height:1,carrierTileIds:[0],animations:[{id:0,frames:[{tileid:1,duration:100}]}]}]}as unknown as MapLayout;
 const source=buildMap(layout,catalog).tmj,native=structuredClone(source),air=native.layers.pop()!;native.layers.splice(native.layers.findIndex(l=>l.name==='floorLayer')+1,0,air);const protectedBefore=native.layers.filter(l=>l.type!=='tilelayer'),rebuilt=reconcileNativeProjection(native,source);
 expect(rebuilt.layers.at(-1)?.name).toBe('generic-air');expect(rebuilt.layers.filter(l=>l.type!=='tilelayer')).toEqual(protectedBefore);
});

import{mkdtempSync,mkdirSync,rmSync,writeFileSync}from'node:fs';
import{tmpdir}from'node:os';
it('actual alpha rejects a coherently rehashed bird pixel inside the possible attendee margin despite a wholly blocked lane',async()=>{
 const{map,layout}=current('constellation-shore'),o=layout.animatedOverlays.find((o:any)=>o.name==='coast-life-shore-gull-north'),set=map.tilesets.find((s:any)=>s.name===o.name),carrier=o.carrierTileIds[10],local=set.tiles.find((t:any)=>t.id===carrier).animation[0].tileid,bytes=readFileSync(o.image),raw=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const pixel=(Math.floor(local/16)*32*raw.info.width+local%16*32)*4;raw.data.set([255,0,0,255],pixel);const mutated=await sharp(raw.data,{raw:{width:raw.info.width,height:raw.info.height,channels:4}}).png().toBuffer();o.provenance.atlasSha256=sha(mutated);
 const project=process.cwd(),fixture=mkdtempSync(resolve(tmpdir(),'bird-alpha-only-'));try{mkdirSync(resolve(fixture,'assets/tilesets/original'),{recursive:true});writeFileSync(resolve(fixture,o.image),mutated);process.chdir(fixture);expect(()=>assertNativeAirborne(map,layout)).toThrow(/actual bird alpha can hide an attendee/);}finally{process.chdir(project);rmSync(fixture,{recursive:true,force:true});}
});
it.each(['shipyard-beach','constellation-shore','fa-ship'])('%s actual current boundary cannot opt out by removing all source and native birds',id=>{
 const{map,layout}=current(id);layout.animatedOverlays=layout.animatedOverlays.filter((o:any)=>!o.name.includes('gull'));map.layers=map.layers.filter((l:any)=>!l.name.includes('gull'));
 expect(()=>assertCurrentNativeMap(id,map,layout,read(`maps/${id}.wam`),catalog)).toThrow(/coast life|world ambient|animation safety|airborne safety/i);
});
