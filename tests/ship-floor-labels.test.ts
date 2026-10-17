import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {it,expect} from 'vitest';
import {loadTileCatalog} from '../tools/art/catalog';
import {readShipFloorLabels} from '../tools/maps/beach-ship';
it('keeps every actual upper-deck direction glyph clear of original upper rigging art',async()=>{
 const map=JSON.parse(readFileSync('maps/fa-ship.tmj','utf8')),layout=JSON.parse(readFileSync('world/layouts/fa-ship.json','utf8')),catalog=loadTileCatalog(),floor=map.layers.findIndex((l:any)=>l.name==='floorLayer'),resource=JSON.parse(readFileSync('art/source/ship-interior.json','utf8')),cache=new Map<string,Awaited<ReturnType<typeof pixels>>>();
 async function pixels(path:string){return sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});}
 async function image(path:string){if(!cache.has(path))cache.set(path,await pixels(path));return cache.get(path)!;}
 expect(readShipFloorLabels(map,layout,catalog)).toHaveLength(2);
 for(const label of resource.floorLabels){const placement=layout.placements.find((p:any)=>p.sprite===label.sprite),sprite=catalog[label.sprite],source=await image(sprite.sheet);let glyphs=0,covered=0;
  for(let y=0;y<placement.height*32;y++)for(let x=0;x<placement.width*32;x++){const sourceIndex=((sprite.rect.y*32+y)*source.info.width+sprite.rect.x*32+x)*4;if(source.data[sourceIndex]!==241||source.data[sourceIndex+1]!==217||source.data[sourceIndex+2]!==160||!source.data[sourceIndex+3])continue;glyphs++;const mx=placement.x+Math.floor(x/32),my=placement.y+Math.floor(y/32);let obscured=false;
   for(const layer of map.layers.slice(floor+1)){if(layer.type!=='tilelayer'||layer.opacity===0||layer.visible===false)continue;const gid=layer.data[my*map.width+mx];if(!gid)continue;const atlas=[...map.tilesets].reverse().find((t:any)=>t.firstgid<=gid),id=gid-atlas.firstgid,art=await image('maps/'+atlas.image),index=((Math.floor(id/atlas.columns)*32+y%32)*art.info.width+id%atlas.columns*32+x%32)*4;if(art.data[index+3])obscured=true;}if(obscured)covered++;
  }
  expect(glyphs,label.text+' has actual native glyph pixels').toBeGreaterThan(100);expect(covered,label.text+' obscured glyph pixels').toBe(0);
 }
});
