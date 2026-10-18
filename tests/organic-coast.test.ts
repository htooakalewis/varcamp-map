import {publishedEpochJson} from './helpers/published-map-epoch';
import{reconcileNativeProjection}from'../tools/maps/native-projection';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {WORLD_CATALOG} from '../src/world/catalog';
import {expect,it} from 'vitest';
import sharp from 'sharp';
import {buildMap} from '../tools/maps/builder';
import {attachOrganicCoast} from '../tools/maps/organic-coast';
import {loadTileCatalog} from '../tools/art/catalog';
const json=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const source=()=>json('world/layouts/shipyard-beach.json');
const native=()=>json('maps/shipyard-beach.tmj');
const old=()=>json('tests/fixtures/organic-coast/before-native.tmj');
function surface(l:any,withDocks=true){const a=Array(l.width*l.height).fill('');for(const p of l.placements.filter((p:any)=>p.layer==='terrain'&&(withDocks||p.sprite!=='naval-dock')))for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++)a[y*l.width+x]=p.sprite;return a;}
const land=(s:string)=>s.startsWith('beach-sand-')||s.startsWith('organic-coast-land-');
const longest=(a:number[])=>{let n=0,max=0,last=-1;for(const x of a){n=x===last?n+1:1;last=x;max=Math.max(max,n);}return max;};
it('uses genuinely varied land and water terrain contours instead of a long rectangular sand body',()=>{
 const l=source(),a=surface(l,false),north=Array.from({length:34},(_,i)=>{const x=i+7;for(let y=0;y<30;y++)if(land(a[y*48+x]))return y;return -1;}),south=Array.from({length:34},(_,i)=>{const x=i+7;for(let y=31;y>=0;y--)if(land(a[y*48+x]))return y;return -1;});
 expect(longest(north),'northern sandy headlands/coves').toBeLessThanOrEqual(6);
 expect(new Set(south).size,'southern tongues of sand').toBeGreaterThanOrEqual(8);
 expect(longest(south),'no broad southern rectangle').toBeLessThanOrEqual(6);
 expect(a.filter(land).length).toBeGreaterThan(650);
 expect(l.placements.filter((p:any)=>p.sprite==='naval-dock'&&p.width>5).every((p:any)=>p.height<=3)).toBe(true);
});
it('keeps every existing portal and protected solid prop base while making actual sea cells impassable',()=>{
 const m=native(),before=old(),l=source(),catalog=loadTileCatalog(),mask=m.layers.find((l:any)=>l.name==='physical-collisions').data;
 for(const layer of before.layers.filter((l:any)=>l.name.startsWith('exit-')||l.properties?.some((p:any)=>p.name==='startLayer')))expect(m.layers.find((l:any)=>l.name===layer.name)).toEqual(layer);
 const seen=new Set<number>(),q=[6*48+23];for(let h=0;h<q.length;h++){const i=q[h];if(mask[i]||seen.has(i))continue;seen.add(i);const x=i%48,y=i/48|0;for(const[xx,yy]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(xx>=0&&yy>=0&&xx<48&&yy<48)q.push(yy*48+xx);}
 for(const r of [...l.entries,...l.exits,...l.areas])for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)expect(seen.has(y*48+x),r.name).toBe(true);
 for(const p of l.placements.filter((p:any)=>p.layer!=='terrain'))for(const[x,y]of catalog[p.sprite].blockingCells)expect(mask[(p.y+y)*48+p.x+x],p.id).not.toBe(0);
 const a=surface(l);for(let i=0;i<a.length;i++)if(a[i].startsWith('naval-water')||a[i].startsWith('organic-coast-water'))expect(mask[i],`water ${i%48},${i/48|0}`).not.toBe(0);
});
it('moves shoreline pixels along the actual irregular native coast below avatars and retains quiet looping surf audio',async()=>{
 const m=native(),set=m.tilesets.find((t:any)=>t.image==='../assets/tilesets/original/organic-coast.png');expect(set,'new contour art must be engine-consumable native tiles').toBeDefined();
 const frameHashes=new Set<string>(),png=await sharp('assets/tilesets/original/organic-coast.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let frame=0;frame<4;frame++){const chunks:Buffer[]=[];for(const tile of set.tiles){const id=tile.animation[frame].tileid;for(let y=0;y<32;y++){const start=((Math.floor(id/set.columns)*32+y)*png.info.width+id%set.columns*32)*4;chunks.push(png.data.subarray(start,start+128));}}frameHashes.add(createHash('sha256').update(Buffer.concat(chunks)).digest('hex'));}
 expect(frameHashes.size).toBe(4);expect(set.tiles.length).toBeGreaterThan(80);expect(set.tiles.every((t:any)=>t.animation.length===4&&t.animation.every((f:any)=>f.duration>=200))).toBe(true);
 const floor=m.layers.findIndex((l:any)=>l.name==='floorLayer');for(const layer of m.layers.filter((l:any)=>l.type==='tilelayer'&&l.data.some((g:number)=>g>=set.firstgid&&g<set.firstgid+set.tilecount)))expect(m.layers.indexOf(layer)).toBeLessThan(floor);
 expect(m.layers.filter((l:any)=>l.name.startsWith('beach-surf-'))).toHaveLength(0);
 const props=Object.fromEntries(m.layers.find((l:any)=>l.name==='terrain').properties.map((p:any)=>[p.name,p.value]));expect(props).toMatchObject({audioLoop:true,audioVolume:0.2,playAudio:'../assets/audio/ocean-loop.mp3'});
 const l=source(),built=buildMap(l,loadTileCatalog()).tmj;attachOrganicCoast(built,l);expect(built.tilesets.find((t:any)=>t.image==='../assets/tilesets/original/organic-coast.png')?.tiles).toEqual(set.tiles);
});

import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {assertNativeOrganicCoast} from '../tools/maps/organic-coast';
it('animates actual shoreline GIDs through the pinned Phaser parser and returns to the first frame after one tide',()=>{
 const parse=createRequire(import.meta.url)(resolve('docs/qa/coastal-flight-2026-10-16/prototype/upstream/phaser/src/tilemaps/parsers/tiled/ParseTilesets.js'));
 const m=native(),atlas=m.tilesets.find((t:any)=>t.name==='organic-coast'),e=parse(structuredClone(m)).tilesets.find((t:any)=>t.firstgid===atlas.firstgid),gids=m.layers.find((l:any)=>l.name==='terrain').data.filter((g:number)=>g>=atlas.firstgid&&g<atlas.firstgid+atlas.tilecount);
 const rows=[0,520,1040,1560,2080].map(t=>gids.map((gid:number)=>e.getAnimatedTileId(gid,t)));expect(new Set(rows.slice(0,4).map(r=>JSON.stringify(r))).size).toBe(4);expect(rows[4]).toEqual(rows[0]);
 const stopped=structuredClone(m);delete stopped.tilesets.find((t:any)=>t.name==='organic-coast').tiles;const s=parse(stopped).tilesets.find((t:any)=>t.firstgid===atlas.firstgid);expect(gids.map((g:number)=>s.getAnimatedTileId(g,0))).toEqual(gids.map((g:number)=>s.getAnimatedTileId(g,1040)));
});
it('normal build validation refuses a stopped tide or a moved coast cell',()=>{
 const l=source();for(const kind of ['stopped','clock','cell']){const m=native(),atlas=m.tilesets.find((t:any)=>t.name==='organic-coast');if(kind==='stopped')delete atlas.tiles;if(kind==='clock')atlas.tiles[0].animation[0].duration=999;if(kind==='cell'){const terrain=m.layers.find((l:any)=>l.name==='terrain'),i=terrain.data.findIndex((g:number)=>g===atlas.firstgid);terrain.data[i]=0;}expect(()=>assertNativeOrganicCoast(m,l),kind).toThrow(/Organic coast/);}
});
it('forward authoring preserves the actual ocean audio properties and is idempotent without mutating its inputs',()=>{
 const l=source(),before=publishedEpochJson('outputs/varcamp-coast-natural-life/maps/shipyard-beach.tmj'),raw=JSON.stringify(before),built=buildMap(l,loadTileCatalog()).tmj;attachOrganicCoast(built,l);const result=reconcileNativeProjection(before,built);expect(JSON.stringify(before)).toBe(raw);expect(result).toEqual(native());expect(reconcileNativeProjection(result,built)).toEqual(result);
 expect(result.layers.find((l:any)=>l.name==='terrain')!.properties).toEqual(before.layers.find((l:any)=>l.name==='terrain').properties);
});
it('keeps every existing non-terrain prop in place and changes only authorized terrain, scenery and collisions',()=>{
 const l=publishedEpochJson('world/layouts/shipyard-beach.json'),before=json('tests/fixtures/organic-coast/before-layout.json'),m=publishedEpochJson('maps/shipyard-beach.tmj'),nativeBefore=old();const props=(l:any)=>l.placements.filter((p:any)=>p.layer!=='terrain'&&p.sprite!=='beach-sea-veil');expect(props(l)).toEqual(props(before));
 expect(l.entries).toEqual(before.entries);expect(l.exits).toEqual(before.exits);expect(l.areas).toEqual(before.areas);expect(l.signs).toEqual(before.signs);expect(l.standingSigns).toEqual(before.standingSigns);expect(m.properties).toEqual(nativeBefore.properties);
 for(const layer of nativeBefore.layers.filter((l:any)=>!['terrain','physical-collisions'].includes(l.name)&&!l.name.startsWith('scenery-')&&!l.name.startsWith('beach-surf-')))expect(m.layers.find((l:any)=>l.id===layer.id),layer.name).toEqual(layer);
 // Collision-only historical oracle: these visual overlays never supply collision.
 const intended=buildMap({...l,animatedOverlays:[]},publishedEpochJson('art/tile-catalog.json')).tmj;expect(m.layers.find((l:any)=>l.name==='physical-collisions').data.map(Boolean)).toEqual((intended.layers.find((l:any)=>l.name==='physical-collisions') as any).data.map(Boolean));
});
it('normal build validation rejects dry-terrain drift and a noncolliding replacement for a sea wall',()=>{
 for(const kind of ['dry-terrain','mask']){const m=native(),l=source();if(kind==='dry-terrain')m.layers.find((a:any)=>a.name==='terrain').data[20*48+24]=0;else m.layers.find((a:any)=>a.name==='physical-collisions').data[0]=m.tilesets.find((t:any)=>t.name==='navigation-mask').firstgid;expect(()=>assertNativeOrganicCoast(m,l),kind).toThrow(/Organic coast/);}
});
it('current shipyard validation refuses all missing coast source cells while historical authoring and the other maps stay explicit',()=>{
 const l=source();l.placements=l.placements.filter((p:any)=>!p.sprite.startsWith('organic-coast-'));expect(()=>assertNativeOrganicCoast(native(),l)).toThrow(/Organic coast/);
 const historical=json('tests/fixtures/organic-coast/before-layout.json'),before=old();expect(()=>attachOrganicCoast(before,historical)).not.toThrow();
 for(const id of Object.keys(WORLD_CATALOG).filter(id=>id!=='shipyard-beach'))expect(()=>assertNativeOrganicCoast(json(`maps/${id}.tmj`),json(`world/layouts/${id}.json`))).not.toThrow();
});

it('current coast cannot opt out by renaming its layout or removing the native map identity',()=>{const l=source();l.id='fa-ship';expect(()=>assertNativeOrganicCoast(native(),l)).toThrow(/Organic coast/);const m=native();m.properties=m.properties.filter((p:any)=>p.name!=='worldMapId');expect(()=>assertNativeOrganicCoast(m,source())).toThrow(/Organic coast/);});
