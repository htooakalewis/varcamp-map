import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {attachOrganicCoast} from './organic-coast.ts';
import {buildMap} from './builder.ts';
export function refineBeachVisuals(source,sourceLayout,catalog){
const base=structuredClone(source),layout=structuredClone(sourceLayout);
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
// Veil is decorative sea atmosphere. Navigation labels and controls own their
// footprints even where an opaque board happens to hide the underlying water.
const protectedFootprints=[...(layout.signs??[]),...layout.entries,...layout.exits,...(layout.images??[]),...layout.areas];
const sourcePlacements=layout.placements;
layout.placements=sourcePlacements.filter(p=>p.sprite!=='beach-sea-veil'||!protectedFootprints.some(r=>overlaps(p,r)));
const sourceChanged=layout.placements.length!==sourcePlacements.length;
const built=buildMap(layout,catalog).tmj;

// Reconcile the draft visuals against the existing native scene. Every pre-existing
// GID remains stable. Portal layers and all scene properties are retained verbatim.
let next=Math.max(...base.tilesets.map(t=>t.firstgid+t.tilecount));const key=t=>t.name==='navigation-mask'||t.name==='coastal-flight'||t.name.startsWith('beach-surf-')?t.name:t.image;const bykey=new Map(base.tilesets.map(t=>[key(t),t]));const remap=[];
// Native client binding is by tileset.name. A builder's positional art-N name
// cannot be reused when its sheet is appended to a differently ordered native map.
const stableNames=new Map([['../assets/tilesets/original/organic-coast.png','organic-coast'],['../assets/tilesets/original/constellation-coast.png','constellation-coast'],['../assets/tilesets/original/beach-lounge.png','beach-lounge'],['../assets/tilesets/lpc-water/water.png','lpc-water']]);
const beachAtlasName=t=>stableNames.get(t.image)??t.name;
for(const t of built.tilesets){
 let dest=bykey.get(key(t));
 if(!dest){
  dest={...structuredClone(t),name:beachAtlasName(t),firstgid:next};if(base.tilesets.some(old=>old.name===dest.name))throw Error(`Appended atlas name already exists: ${dest.name}`);base.tilesets.push(dest);bykey.set(key(t),dest);next+=t.tilecount;
 }else if(t.image==='../assets/tilesets/original/beach-lounge.png'){
  // Repair earlier appended aliases without renumbering a single GID.
  dest.name=beachAtlasName(t);
 }else if(t.name.startsWith('beach-surf-')){
  // The layout owns timing/frame definitions. Refresh reused atlas metadata while
  // retaining its reserved GID range, so descriptor edits survive reconciliation.
  for(const field of ['tilewidth','tileheight','columns','tilecount','imagewidth','imageheight'])
   if(dest[field]!==t[field])throw Error(`${t.name}: atlas geometry changed; reconcile its reserved native GID range explicitly before authoring`);
  const firstgid=dest.firstgid;Object.assign(dest,structuredClone(t),{firstgid});
 }
 remap.push({from:t.firstgid,to:dest.firstgid,count:t.tilecount});
}
function gid(v){if(!v)return 0;const r=remap.find(r=>v>=r.from&&v<r.from+r.count);if(!r)throw Error('unmapped GID '+v);return v-r.from+r.to;}
const visual=n=>n==='terrain'||n.startsWith('scenery-')||n.startsWith('beach-surf-')||n==='physical-collisions';let nextid=base.nextlayerid;
const replacements=built.layers.filter(l=>visual(l.name)).map(l=>{const old=base.layers.find(x=>x.name===l.name);return {...l,...(l.name==='terrain'&&old?.properties?{properties:structuredClone(old.properties)}:{}),id:old?.id??nextid++,data:l.data.map(gid)}});
// Retain the original avatar split and flight; insert added transparent surf below avatars.
const layers=[];
for(const old of base.layers){if(visual(old.name)){const n=replacements.find(x=>x.name===old.name);if(n)layers.push(n);}else layers.push(old);}
const extra=replacements.filter(n=>!base.layers.some(o=>o.name===n.name));const floor=layers.findIndex(l=>l.name==='floorLayer');layers.splice(floor,0,...extra.filter(n=>n.name.startsWith('scenery-below')||n.name.startsWith('beach-surf')));const flight=layers.findIndex(l=>l.name==='coastal-flight');layers.splice(flight<0?layers.length:flight,0,...extra.filter(n=>n.name.startsWith('scenery-above')));
base.layers=layers;base.nextlayerid=nextid;
attachOrganicCoast(base,layout);
return {map:base,layout,sourceChanged};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
const {map,layout,sourceChanged}=refineBeachVisuals(JSON.parse(fs.readFileSync('maps/shipyard-beach.tmj','utf8')),JSON.parse(fs.readFileSync('world/layouts/shipyard-beach.json','utf8')),JSON.parse(fs.readFileSync('art/tile-catalog.json','utf8')));
fs.writeFileSync('maps/shipyard-beach.tmj',JSON.stringify(map)+'\n');
if(sourceChanged)fs.writeFileSync('world/layouts/shipyard-beach.json',JSON.stringify(layout,null,2)+'\n');
console.log('Reconciled beach visuals while preserving native semantic layers and all existing GIDs.');
}
