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
 'varcamp-nameplate':'hub-nav-brand','welcome-control-sign':'hub-nav-welcome','arrival-direction-crosspost':'hub-nav-arrival-crosspost','directory-prompt':'hub-nav-directory','arrival-position-label':'hub-nav-you-are-here',
 'exterior-road-sign-north':'exterior-road-north','exterior-road-sign-west':'exterior-road-west','exterior-road-sign-east':'exterior-road-east','exterior-road-sign-south':'exterior-road-south',
} as const;
export function arrivalPlaques(layout:MapLayout,catalog:TileCatalog):Placement[] {
 return Object.entries(arrivalFaces).map(([id,visual])=>standingFace(layout,catalog,id,visual));
}
export const cells=(r:TileRect,w:number)=>Array.from({length:r.width*r.height},(_,i)=>(r.y+Math.floor(i/r.width))*w+r.x+i%r.width);
export const sponsorBases=[[53,68],[58,68],[61,68],[66,68],[69,68],[74,68]] as const;
export function sponsorSupportIds(layout:MapLayout,catalog:TileCatalog):Set<string> {
 validateStandingSigns(layout,catalog);
 const images=layout.images??[];assert.equal(images.length,3);const ids=new Set<string>(),coordinates:string[]=[];
 for(const image of images){assert.equal(image.standing,true);const assemblies=layout.standingSigns?.filter(s=>s.faceKind==='image'&&s.face===image.name)??[];assert.equal(assemblies.length,1);assert.equal(assemblies[0].supports.length,2);
  for(const id of assemblies[0].supports){assert.ok(!ids.has(id));ids.add(id);const p=layout.placements.find(p=>p.id===id)!;coordinates.push(`${p.x},${p.y}`);}
 }
 assert.deepEqual(coordinates.sort(),sponsorBases.map(c=>c.join(',')).sort(),'Only six approved sponsor base cells');return ids;
}
export function assertSponsorFootprints(layout:MapLayout,catalog:TileCatalog,map:TiledMap):void {
 const ids=sponsorSupportIds(layout,catalog),base=new Set(sponsorBases.map(([x,y])=>y*map.width+x));
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
