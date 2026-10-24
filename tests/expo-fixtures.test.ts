import{cpSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync,existsSync}from'node:fs';
import{tmpdir}from'node:os';
import{dirname,join}from'node:path';
import{describe,expect,it,afterEach}from'vitest';
import{buildMap}from'../tools/maps/builder';
import{loadTileCatalog}from'../tools/art/catalog';
import{validateStandingSigns}from'../tools/maps/solid-props';
import{assertNativeStandingCaptions}from'../tools/maps/standing-captions';
import{captionFamily,writeStandingCaptions,readStandingCaptions,CAPTION_IMAGE,EXPO_CAPTION_IMAGE}from'../tools/art/standing-captions';
import{EXPO_MARKS,EXPO_CAPTION_ATLAS}from'../tools/maps/native-ownership-context';
import{EXPO_MARK_IDS,EXPO_STICKERS,expoLogoImage,expoSticker,expoCaption,withExpoCaption}from'../tools/maps/expo-fixtures';
import type{MapLayout,TileLayer}from'../tools/maps/types';
const catalog=loadTileCatalog(),project=process.cwd();
const base=():MapLayout=>({id:'overworld',width:40,height:24,placements:[{id:'floor',sprite:'floor-charcoal',layer:'terrain',x:0,y:0,width:40,height:24}],entries:[{name:'start',x:1,y:1,width:1,height:1,isDefault:true}],exits:[],areas:[],inspectionZones:[]});
afterEach(()=>process.chdir(project));
describe('expo logo inlays',()=>{
 it('returns the registered tileset name, PNG and exact 6×2 or 4×2 floor footprint for every mark',()=>{
  expect(EXPO_MARK_IDS).toHaveLength(16);
  for(const id of EXPO_MARK_IDS){const image=expoLogoImage(id,3,5);expect(image).toEqual({name:EXPO_MARKS[id].name,image:`assets/sponsors/${id}.png`,x:3,y:5,width:EXPO_MARKS[id].columns,height:2,standing:false});expect(existsSync(image.image)).toBe(true);}
  expect(EXPO_MARK_IDS.filter(id=>EXPO_MARKS[id].columns===6)).toEqual(['demo-01','demo-03']);
  expect(()=>expoLogoImage('demo-02' as never,0,0)).toThrow(/unregistered/i);
 });
 it('compiles every mark as its own embedded panel with the matching column count and no scaling',()=>{
  const l=base();l.images=EXPO_MARK_IDS.map((id,i)=>expoLogoImage(id,1+(i%6)*6,2+Math.floor(i/6)*3));
  const map=buildMap(l,catalog).tmj;
  for(const image of l.images){const sheet=map.tilesets.find(t=>t.name===image.name)!,panel=map.layers.find(x=>x.name===image.name)as TileLayer;
   expect(sheet).toMatchObject({columns:image.width,tilecount:image.width*2,imagewidth:image.width*32,imageheight:64,image:'../'+image.image});
   expect(panel.data.filter(Boolean)).toHaveLength(image.width*2);expect(map.layers.indexOf(panel)).toBeLessThan(map.layers.findIndex(x=>x.name==='floorLayer'));
   const png=readFileSync(image.image);expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([image.width*32,64]);}
  const wrong=base();wrong.images=[{...expoLogoImage('hub-01',1,1),width:6}];expect(()=>buildMap(wrong,catalog)).toThrow(/192×64/);
  const narrow=base();narrow.images=[{...expoLogoImage('demo-01',1,1),width:4}];expect(()=>buildMap(narrow,catalog)).toThrow(/128×64/);
 });
});
describe('expo stickers',()=>{
 it('places one walkable floor decal per call from the six registered sticker sprites',()=>{
  expect(EXPO_STICKERS).toEqual(['sticker-star','sticker-heart','sticker-bolt','sticker-pin','sticker-smile','sticker-leaf']);
  for(const sprite of EXPO_STICKERS)expect(catalog[sprite]).toMatchObject({sheet:'assets/tilesets/original/booth-stickers.png',blockingCells:[],level:'belowAvatar',rect:{width:1,height:1}});
  const l=base();l.placements.push(...EXPO_STICKERS.map((s,i)=>expoSticker(`decal-${i}`,s,2+i,4)));
  const map=buildMap(l,catalog).tmj,sheet=map.tilesets.find(t=>t.image==='../assets/tilesets/original/booth-stickers.png')!;
  expect(sheet).toMatchObject({columns:6,tilecount:6,imagewidth:192,imageheight:32});expect(/^art-\d+$/.test(sheet.name!)).toBe(true);
  const mask=map.layers.find(x=>x.name==='physical-collisions')as TileLayer;for(let i=0;i<6;i++)expect(mask.data[4*40+2+i]).toBe(0);
  expect(()=>expoSticker('x','sigil-fire' as never,0,0)).toThrow(/unregistered/i);
 });
});
describe('expo captions',()=>{
 it('assembles a fascia face, one blocking post per column and the linked centred caption text',()=>{
  const c=expoCaption('booth-design-guild','DESIGN GUILD',4,6,4);
  expect(c.face).toEqual({id:'booth-design-guild-fascia',sprite:'expo-fascia',layer:'props',x:4,y:6,width:4,height:1});
  expect(c.supports).toEqual([0,1,2,3].map(i=>({id:`booth-design-guild-fascia-post-${i}`,sprite:'expo-fascia-post',layer:'props',x:4+i,y:7,width:1,height:1})));
  expect(c.sign).toEqual({name:'booth-design-guild',text:'DESIGN GUILD',x:4,y:6,width:4,height:1,fontSize:18,color:'#f1d9a0',align:'center',padding:1});
  expect(c.standingSign).toEqual({face:'booth-design-guild-fascia',supports:c.supports.map(s=>s.id),text:'booth-design-guild'});
  expect(catalog['expo-fascia']).toEqual({sheet:'assets/tilesets/original/magic.png',rect:{x:0,y:0,width:1,height:1},blockingCells:[],level:'aboveAvatar',sourceId:'original',standingRole:'face'});
  expect(catalog['expo-fascia-post']).toEqual({sheet:'assets/tilesets/original/magic.png',rect:{x:0,y:1,width:1,height:1},blockingCells:[[0,0]],level:'belowAvatar',sourceId:'original',upperCells:[],standingRole:'support'});
  expect(catalog['wall-navy']).toMatchObject({sheet:'assets/tilesets/original/magic.png',rect:{x:0,y:0,width:1,height:2}});
  for(const text of ['DEMO ORBIT','DEMO NOVA','CODE CIRCLE','DEMO ATLAS','DEMO VECTOR','DATA CLUB','DEMO LUMEN','OPEN SOURCE'])expect(()=>expoCaption('b',text,0,0,4)).not.toThrow();
  expect(()=>expoCaption('b','GAME JAM',0,0,3)).not.toThrow();
  expect(()=>expoCaption('b','DESIGN GUILD',0,0,3)).toThrow(/fit/);expect(()=>expoCaption('b','☃',0,0,4)).toThrow(/glyph/);expect(()=>expoCaption('Bad Id','A',0,0,1)).toThrow(/slug/);expect(()=>expoCaption('b','A',0,0,17)).toThrow(/1-16/);
 });
 it('links into a layout once and refuses duplicates or altered assemblies',()=>{
  const c=expoCaption('booth-a','DEMO ORBIT',4,6,4),l=withExpoCaption(base(),c);
  expect(()=>validateStandingSigns(l,catalog)).not.toThrow();expect(l.signs).toEqual([c.sign]);expect(l.standingSigns).toEqual([c.standingSign]);expect(l.placements.slice(-5)).toEqual([c.face,...c.supports]);
  expect(()=>withExpoCaption(l,c)).toThrow(/already/);
  expect(()=>withExpoCaption(base(),{...c,supports:c.supports.slice(1)})).toThrow(/altered/);
  const loose=structuredClone(c);loose.face.sprite='wall-navy';expect(()=>withExpoCaption(base(),loose)).toThrow(/altered/);
 });
 it('renders overworld captions into the separate expo atlas, never into the full shared beach sheet',async()=>{
  expect(captionFamily('overworld')).toMatchObject({id:'expo',image:EXPO_CAPTION_IMAGE});expect(captionFamily('shipyard-beach')).toMatchObject({id:'shared',image:CAPTION_IMAGE});expect(captionFamily('constellation-shore').image).toBe(CAPTION_IMAGE);
  expect('../'+EXPO_CAPTION_IMAGE).toBe(EXPO_CAPTION_ATLAS.image);
  const dir=mkdtempSync(join(tmpdir(),'varcamp-expo-captions-'));
  try{
   for(const file of ['art/source/hub-nameplates.json','tools/art/standing-captions.ts','assets/tilesets/original/magic.png','art/sources.json']){mkdirSync(join(dir,dirname(file)),{recursive:true});cpSync(file,join(dir,file));}
   mkdirSync(join(dir,'world/layouts'),{recursive:true});mkdirSync(join(dir,'maps'));
   const l=withExpoCaption(withExpoCaption(base(),expoCaption('booth-a','DEMO ORBIT',4,6,4)),expoCaption('booth-b','GAME JAM',12,6,3));
   writeFileSync(join(dir,'world/layouts/overworld.json'),JSON.stringify(l));
   process.chdir(dir);
   expect(()=>readStandingCaptions(l)).toThrow();// linked captions without the expo family files
   await writeStandingCaptions();
   expect(existsSync(EXPO_CAPTION_IMAGE)).toBe(true);expect(existsSync('art/source/expo-captions.json')).toBe(true);expect(existsSync(CAPTION_IMAGE)).toBe(false);
   const meta=JSON.parse(readFileSync('art/source/expo-captions.json','utf8'));expect(meta.specs.map((s:any)=>s.map)).toEqual(['overworld','overworld']);
   const resource=readStandingCaptions(l)!;expect(resource.image).toBe(EXPO_CAPTION_IMAGE);expect([resource.width,resource.height]).toEqual([512,32]);expect(resource.rows.map(r=>[r.atlasX,r.atlasY,r.sign.width])).toEqual([[0,0,4],[4,0,3]]);
   const map=buildMap(l,catalog).tmj,atlas=map.tilesets.find(t=>t.name==='standing-captions')!;
   expect(atlas).toMatchObject({image:EXPO_CAPTION_ATLAS.image,columns:16,tilecount:16,imagewidth:512,imageheight:32});expect(atlas.properties!.find(p=>p.name==='captionAtlasSha256')!.value).toBe(meta.pngSha256);
   expect(()=>assertNativeStandingCaptions(map,l)).not.toThrow();
   expect(map.layers.filter(x=>x.name.startsWith('standing-caption-')).map(x=>x.name)).toEqual(['standing-caption-booth-a','standing-caption-booth-b']);
   expect((map.layers.find(x=>x.name==='wayfinding-text')as any).objects).toEqual([]);
   const png=readFileSync(EXPO_CAPTION_IMAGE);expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([512,32]);
  }finally{process.chdir(project);rmSync(dir,{recursive:true,force:true});}
 },20000);
});
