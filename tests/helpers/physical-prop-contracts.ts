import assert from 'node:assert/strict';
import type {Sprite,TileCatalog} from '../../tools/art/catalog';
import type {MapLayout,TiledMap,TileRect,Placement,TileLayer} from '../../tools/maps/types';
import {validateStandingSigns} from '../../tools/maps/solid-props';
export function assertVisual(actual:Sprite,original:Sprite):void {
 assert.ok(actual&&original,'Missing catalog visual');
 assert.deepEqual({sheet:actual.sheet,rect:actual.rect,sourceId:actual.sourceId},{sheet:original.sheet,rect:original.rect,sourceId:original.sourceId},'Catalog visual lineage changed');
}
export function standingFace(layout:MapLayout,catalog:TileCatalog,id:string,originalVisual:string):Placement {
 validateStandingSigns(layout,catalog);
 assert.equal(layout.standingSigns?.filter(s=>s.face===id&&s.faceKind===undefined).length,1,`Missing/duplicate declared face ${id}`);
 const rows=layout.placements.filter(p=>p.id===id);assert.equal(rows.length,1,`Missing/duplicate face placement ${id}`);
 assert.equal(catalog[rows[0].sprite]?.standingRole,'face');assertVisual(catalog[rows[0].sprite],catalog[originalVisual]);return rows[0];
}
export const arrivalFaces={
 'arrival-direction-crosspost':'hub-nav-arrival-crosspost',
 'exterior-road-sign-north':'exterior-road-north','exterior-road-sign-west':'exterior-road-west','exterior-road-sign-east':'exterior-road-east','exterior-road-sign-south':'exterior-road-south',
} as const;
export function arrivalPlaques(layout:MapLayout,catalog:TileCatalog):Placement[] {
 return Object.entries(arrivalFaces).map(([id,visual])=>standingFace(layout,catalog,id,visual));
}
export const cells=(r:TileRect,w:number)=>Array.from({length:r.width*r.height},(_,i)=>(r.y+Math.floor(i/r.width))*w+r.x+i%r.width);
export const sponsorBases=[[53,68],[58,68],[61,68],[66,68],[69,68],[74,68]] as const;
export function historicalSponsorSupportIds(layout:MapLayout,catalog:TileCatalog):Set<string> {
 validateStandingSigns(layout,catalog);
 const images=layout.images??[];assert.equal(images.length,3);const ids=new Set<string>(),coordinates:string[]=[];
 for(const image of images){assert.equal(image.standing,true);const assemblies=layout.standingSigns?.filter(s=>s.faceKind==='image'&&s.face===image.name)??[];assert.equal(assemblies.length,1);assert.equal(assemblies[0].supports.length,2);
  for(const id of assemblies[0].supports){assert.ok(!ids.has(id));ids.add(id);const p=layout.placements.find(p=>p.id===id)!;coordinates.push(`${p.x},${p.y}`);}
 }
 assert.deepEqual(coordinates.sort(),sponsorBases.map(c=>c.join(',')).sort(),'Only six approved sponsor base cells');return ids;
}
export function assertRaisedSponsorFootprints(layout:MapLayout,catalog:TileCatalog,map:TiledMap):void {
 const ids=historicalSponsorSupportIds(layout,catalog),base=new Set(sponsorBases.map(([x,y])=>y*map.width+x));
 for(const image of layout.images??[])for(const p of layout.placements.filter(p=>!['terrain','atmosphere'].includes(p.layer)&&!ids.has(p.id)))assert.ok(!(p.x<image.x+image.width&&p.x+p.width>image.x&&p.y<image.y+image.height&&p.y+p.height>image.y),`${image.name} unrelated prop overlap ${p.id}`);
 const mask=map.layers.find(l=>l.name==='physical-collisions') as TileLayer;assert.ok(mask?.type==='tilelayer');
 const start=layout.entries.find(e=>e.isDefault)!;assert.ok(start);const queue=[start.y*map.width+start.x],seen=new Set(queue);assert.equal(mask.data[queue[0]],0);
 for(let h=0;h<queue.length;h++){const n=queue[h],x=n%map.width,y=Math.floor(n/map.width);for(const [nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const cell=ny*map.width+nx;if(nx>=0&&ny>=0&&nx<map.width&&ny<map.height&&!mask.data[cell]&&!seen.has(cell)){seen.add(cell);queue.push(cell);}}}
 for(const r of [...layout.entries,...layout.exits,...layout.areas])for(const n of cells(r,map.width)){assert.equal(mask.data[n],0,`${r.name} blocked`);assert.ok(seen.has(n),`${r.name} disconnected`);}
 for(const image of layout.images??[])for(const n of cells(image,map.width)){if(base.has(n))assert.notEqual(mask.data[n],0,'Missing sponsor base collision');else{assert.equal(mask.data[n],0,`${image.name} unexpected collision`);assert.ok(seen.has(n),`${image.name} disconnected`);}}
 const floor=map.layers.findIndex(l=>l.name==='floorLayer');assert.ok(floor>=0);
 for(const id of ids){const p=layout.placements.find(p=>p.id===id)!,sprite=catalog[p.sprite],n=p.y*map.width+p.x;
  const assembly=layout.standingSigns!.find(s=>s.supports.includes(id))!,imageIndex=map.layers.findIndex(l=>l.name===assembly.face);assert.ok(imageIndex>floor,'Logo plane must remain raised');
  const sheet=map.tilesets.find(t=>t.image?.replace(/^\.\.\//,'')===sprite.sheet);assert.ok(sheet&&sheet.columns);
  const expected=sheet.firstgid+sprite.rect.y*sheet.columns+sprite.rect.x;
  const rendered=map.layers.flatMap((l,i)=>l.type==='tilelayer'&&l.data[n]===expected?[i]:[]);assert.ok(rendered.length>0,'Support visual missing');assert.ok(rendered.every(i=>i<floor&&i<imageIndex),'Support must draw below logo');
 }
}
export function sponsorSupportIds(layout:MapLayout,catalog:TileCatalog):Set<string>{
 validateStandingSigns(layout,catalog);assert.equal(layout.images?.length,15,'Exactly three sponsors, eleven expo booth logos and the event floor identity');
 assert.ok(layout.images!.every(i=>i.standing===false),'Every current logo is an explicit floor inlay');
 assert.ok(!layout.standingSigns?.some(s=>s.faceKind==='image'||s.face==='varcamp-nameplate'),'Floor logos have no standing assemblies');
 assert.ok(!layout.placements.some(p=>/^standing-sponsor-|^reception-post-brand-|^varcamp-nameplate$/.test(p.id)),'Retired logo posts/brand board remain');
 return new Set();
}
/** The eleven expo booth logos on the six-wide carpet reserves of the stalls n1-n6 and s1-s5
 * (tools/maps/expo-plaza.ts): the two admitted 6x2 marks fill DEMO ORBIT and DEMO ATLAS, every
 * other stall centres its 4x2 mark; the INFO DESK carries the owner-provided VarCamp lockup, s1-s3
 * the three owner-provided community partner marks; only the YOUR LOGO HERE stall has none. */
export const expoBoothLogos=[
 ['Expo / Demo Orbit','demo-01',41,76,6],['Expo / Demo Nova Compact','demo-02-compact',49,76,4],['Expo / Demo Atlas','demo-03',55,76,6],['Expo / Demo Vector','demo-04',68,76,4],['Expo / Demo Lumen','demo-05',75,76,4],['Expo / VarCamp','varcamp-horizontal',82,76,4],
 ['Expo / AWS User Group Myanmar','partner-aws-ug-mm',42,84,4],['Expo / BSides Myanmar','partner-bsides-mm',49,84,4],['Expo / OpenInfra User Group Myanmar','partner-openinfra-mm',56,84,4],['Expo / Code Circle','hub-01',68,84,4],['Expo / Design Guild','hub-02',75,84,4],
].map(([name,file,x,y,width])=>({name:String(name),image:`assets/sponsors/${file}.png`,x:Number(x),y:Number(y),width:Number(width),height:2,standing:false}));
/** Current floor representation has no physical posts; every actual cell must remain visible and connected. */
export function assertSponsorFootprints(layout:MapLayout,catalog:TileCatalog,map:TiledMap):void{
 sponsorSupportIds(layout,catalog);
 const images=layout.images!,expected=[
  ...[0,1,2].map(i=>({name:`Sponsors / Demo 0${i+1}`,image:`assets/sponsors/demo-0${i+1}.png`,x:53+i*8,y:67,width:6,height:2,standing:false})),
  ...expoBoothLogos,
  {name:'VarCamp 2026 Floor',image:'assets/sponsors/varcamp-2026.png',x:60,y:60,width:6,height:2,standing:false},
 ];assert.deepEqual(images,expected,'Current floor identity roster/position changed');
 const mask=map.layers.find(l=>l.name==='physical-collisions') as TileLayer;assert.ok(mask?.type==='tilelayer');
 const start=layout.entries.find(e=>e.isDefault)!;assert.ok(start);const queue=[start.y*map.width+start.x],seen=new Set(queue);assert.equal(mask.data[queue[0]],0);
 for(let h=0;h<queue.length;h++){const n=queue[h],x=n%map.width,y=Math.floor(n/map.width);for(const [nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const cell=ny*map.width+nx;if(nx>=0&&ny>=0&&nx<map.width&&ny<map.height&&!mask.data[cell]&&!seen.has(cell)){seen.add(cell);queue.push(cell);}}}
 for(const r of [...layout.entries,...layout.exits,...layout.areas,...images])for(const n of cells(r,map.width)){assert.equal(mask.data[n],0,`${r.name} blocked`);assert.ok(seen.has(n),`${r.name} disconnected`);}
 const floor=map.layers.findIndex(l=>l.name==='floorLayer');assert.ok(floor>=0);
 for(const image of images){
  for(const p of layout.placements.filter(p=>!['terrain','atmosphere'].includes(p.layer)))assert.ok(!(p.x<image.x+image.width&&p.x+p.width>image.x&&p.y<image.y+image.height&&p.y+p.height>image.y),`${image.name} unrelated prop overlap ${p.id}`);
  // A mark PNG may back both an arrival inlay and a booth inlay; each image owns the atlas and layer carrying its registered name.
  const layers=map.layers.filter(l=>l.name===image.name),atlases=map.tilesets.filter(t=>t.name===image.name&&t.image==='../'+image.image);assert.equal(layers.length,1);assert.equal(atlases.length,1);
  const l=layers[0] as TileLayer,t=atlases[0];assert.equal(l.type,'tilelayer');assert.ok(map.layers.indexOf(l)<floor,'Floor logo must be below avatar');assert.equal(l.visible,true);assert.equal(l.opacity,1);assert.equal(l.data.filter(Boolean).length,image.width*2);
  for(let y=0;y<2;y++)for(let x=0;x<image.width;x++)assert.equal(l.data[(image.y+y)*map.width+image.x+x],t.firstgid+y*image.width+x,'Floor logo actual native cell changed');
 }
}
