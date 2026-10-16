import {renderRoadster} from './roadster';
import {renderCoastalFlight} from './coastal-flight';
import {renderExteriorGates} from './exterior-gates';
import { renderHubMasters } from './hub-art';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { loadTileCatalog, type TileCatalog } from './catalog';
import { SIGN_IDS, ELEMENT_IDS } from '../../src/world/catalog';

/** Returns all actionable asset errors without overwriting outputs or repairing corrupt data. */
interface SourceRecord { attribution: string; url: string; license: string; licenseFile: string; changes: string; files: { path: string; sha256: string }[]; }
export async function checkArt(catalog: TileCatalog = loadTileCatalog()): Promise<string[]> {
  const errors: string[]=[];
  const sources=JSON.parse(readFileSync('art/sources.json','utf8')) as Record<string,SourceRecord>;
  for (const id of [...SIGN_IDS.flatMap(sign=>[`glyph-${sign}`,`constellation-${sign}`]), ...ELEMENT_IDS.map(el=>`sigil-${el}`), 'telescope','quest-shrine','door-open','npc-guide','npc-maze-keeper','npc-dockmaster']) {
    if(!catalog[id]) errors.push(`${id}: missing required sprite`);
  }
  for (const [id,s] of Object.entries(sources)) {
    if(!s.attribution || !s.license || !s.url || !s.changes || !existsSync(s.licenseFile)) errors.push(`${id}: missing provenance or retained license`);
    for(const file of s.files) {
      if(!existsSync(file.path)) { errors.push(`${file.path}: missing source sheet`); continue; }
      if(createHash('sha256').update(readFileSync(file.path)).digest('hex')!==file.sha256) errors.push(`${file.path}: source hash mismatch; update changes and record only after review`);
    }
  }
  for (const [id,s] of Object.entries(catalog)) {
    if(!sources[s.sourceId]) errors.push(`${id}: unknown source ${s.sourceId}`);
    else if(!sources[s.sourceId].files.some(file=>file.path===s.sheet)) errors.push(`${id}: sheet absent from source manifest`);
    if(!existsSync(s.sheet)) { errors.push(`${id}: missing PNG ${s.sheet}`); continue; }
    let meta;
    try { meta=await sharp(s.sheet).metadata(); } catch { errors.push(`${id}: unreadable PNG`); continue; }
    const {x,y,width,height}=s.rect;
    if(![x,y,width,height].every(Number.isInteger) || x<0 || y<0 || width<1 || height<1) errors.push(`${id}: rectangle must use positive integer tile sizes and nonnegative positions`);
    if((x+width)*32>meta.width! || (y+height)*32>meta.height!) errors.push(`${id}: rectangle exceeds PNG bounds`);
    if(meta.format!=='png' || meta.width!%32 || meta.height!%32) errors.push(`${id}: sheet is not a PNG on a 32px grid`);
    for(const [cx,cy] of s.blockingCells) if(!Number.isInteger(cx) || !Number.isInteger(cy) || cx<0 || cy<0 || cx>=width || cy>=height) errors.push(`${id}: invalid blocking cell ${cx},${cy}`);
    if(!['belowAvatar','aboveAvatar'].includes(s.level)) errors.push(`${id}: invalid drawing level`);
  }
  if(readFileSync('art/source/exterior-gates.svg','utf8')!==renderExteriorGates())errors.push('exterior-gates: SVG differs from deterministic native gate master');
  const hubMasters=renderHubMasters(JSON.parse(readFileSync('art/source/hub-nameplates.json','utf8')));
  for(const [name,expected] of Object.entries({'hub-labels':hubMasters.labels,'hub-buildings':hubMasters.buildings}))if(readFileSync(`art/source/${name}.svg`,'utf8')!==expected)errors.push(`${name}: SVG differs from deterministic hub-art master`);
  for(const name of ['zodiac','magic','campus','amenities','guides','wayfinding','hub-buildings','hub-labels', 'coastal','exterior-gates','naval-details','beach-lounge','beach-surf']) {
    const png=`assets/tilesets/original/${name}.png`;
    if(!existsSync(png)) { errors.push(`${name}: missing custom PNG export`); continue; }
    const expected=await sharp(`art/source/${name}.svg`,{density:72}).ensureAlpha().raw().toBuffer();
    const actual=await sharp(png).ensureAlpha().raw().toBuffer();
    if(!expected.equals(actual)) errors.push(`${name}: PNG differs from native SVG export`);
    const stats=await sharp(png).stats();
    if(stats.isOpaque) errors.push(`${name}: custom sheet must retain transparency`);
  }
  const flight=await renderCoastalFlight();
  if(!readFileSync('assets/tilesets/original/coastal-flight.png').equals(flight.png))errors.push('coastal-flight: native animated PNG differs from deterministic source');
  if(JSON.stringify(JSON.parse(readFileSync('art/source/coastal-flight.json','utf8')))!==JSON.stringify(flight.metadata))errors.push('coastal-flight: metadata differs from deterministic source');
  const roadster=await renderRoadster();
  if(!readFileSync('assets/tilesets/original/roadster.png').equals(roadster.png))errors.push('roadster: animated PNG differs from compiled original poses');
  if(JSON.stringify(JSON.parse(readFileSync('art/source/roadster.json','utf8')))!==JSON.stringify(roadster.metadata))errors.push('roadster: metadata differs from compiled original poses');
  return errors;
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const errors=await checkArt();
  if(errors.length) { console.error(errors.join('\n')); process.exitCode=1; }
  else console.log(`Art check passed: ${Object.keys(loadTileCatalog()).length} sprites; bounds, licenses, source hashes, transparent native exports.`);
}
