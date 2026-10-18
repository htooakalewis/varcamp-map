import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {renderCoast} from './coast-raster';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex'),json=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
/** Forward authoring from the fixed reviewed shore, preserving all furniture and controls. */
export async function writeConstellationCoast(){
 const recipe=json('world/constellation-coast.json'),layout=json('tests/fixtures/constellation-coast/before-layout.json'),catalog=json('art/tile-catalog.json'),image='assets/tilesets/original/constellation-coast.png';
 const r=await renderCoast(recipe,{width:40,height:40,prefix:'constellation-coast',groundPrefix:'constellation-ground',image});
 for(const k of Object.keys(catalog))if(k.startsWith('constellation-coast-'))delete catalog[k];Object.assign(catalog,r.catalog);
 const docks=layout.placements.filter((p:any)=>p.layer==='terrain'&&p.sprite==='coast-dock-plank');
 const props=layout.placements.filter((p:any)=>p.layer!=='terrain'&&!p.sprite.startsWith('coast-foam-'));
 const overlaps=(a:any,b:any)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
 const protectedFootprints=[...props.filter((p:any)=>catalog[p.sprite].standingRole),...layout.entries,...layout.exits,...layout.areas,...(layout.signs??[])];
 const veils=r.ground.filter((p:any)=>p.sprite.startsWith('naval-water-')&&!protectedFootprints.some((q:any)=>overlaps(p,q))&&!docks.some((q:any)=>overlaps(p,q))).map((p:any)=>({...p,id:`constellation-veil-${p.x}-${p.y}`,sprite:'beach-sea-veil',layer:'architecture'}));
 layout.placements=[...r.ground,...docks,...veils,...props];
 writeFileSync(image,r.png);writeFileSync('art/tile-catalog.json',JSON.stringify(catalog,null,2)+'\n');writeFileSync('world/layouts/constellation-shore.json',JSON.stringify(layout,null,2)+'\n');
 const descriptor={schemaVersion:1,license:'CC-BY-SA-3.0',attribution:'Organic Constellation Shore by VarCamp, using unchanged LPC water pixels by Lanea Zimmerman (Sharm) and Liberated Pixel Cup contributors; complete AUTHORS retained. Shape/recipe CC0-1.0; derivative animated atlas CC-BY-SA-3.0.',image,width:r.width,height:r.height,frameMs:recipe.frameMs,atlasSha256:sha(r.png),inputs:['world/constellation-coast.json','tools/art/constellation-coast.ts','tools/art/coast-raster.ts','assets/tilesets/original/beach-lounge.png','assets/tilesets/lpc-water/water.png'].map(path=>({path,sha256:sha(readFileSync(path))})),cells:r.edges};
 writeFileSync('art/source/constellation-coast.json',JSON.stringify(descriptor,null,2)+'\n');
 const noticePath='assets/tilesets/lpc-water/CONSTELLATION-COAST.md',notice='# Constellation Shore\n\nThe separately named constellation-coast.png atlas is a CC-BY-SA 3.0 derivative of LPC water by Lanea Zimmerman (Sharm) and the Liberated Pixel Cup contributors. Full upstream AUTHORS and the CC-BY-SA 3.0 license are retained here.\n\nVarCamp / Codex, 2026: original hand-authored curved coastline, sand/wet-sand/foam treatment and native tide frames. Original sand/shape CC0; combined raster CC-BY-SA 3.0. Editable source: world/constellation-coast.json, tools/art/constellation-coast.ts and shared tools/art/coast-raster.ts. Original water and ship sources retain their original terms.\n';writeFileSync(noticePath,notice);
 const sources=json('art/sources.json'),water=sources['lpc-water'],files=[...descriptor.inputs.filter(f=>f.path.startsWith('tools/')||f.path.startsWith('world/')),{path:image,sha256:descriptor.atlasSha256},{path:noticePath,sha256:sha(Buffer.from(notice))}];
 for(const f of files){water.files=water.files.filter((x:any)=>x.path!==f.path);water.files.push(f);}water.changes=water.changes.replace(/ Constellation-coast\.png.*$/,'')+' Constellation-coast.png is a second separately named CC-BY-SA 3.0 curved coast derivative sharing the same deterministic producer; upstream water is unchanged.';writeFileSync('art/sources.json',JSON.stringify(sources,null,2)+'\n');
 return r;
}
