import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeZodiacWheel } from '../tools/maps/zodiac-wheel';
import { WORLD_CATALOG } from '../src/world/catalog';
import { validateMap, validateWam } from '../tools/maps/validate';
import type { MapLayout, TiledMap, TiledProperty } from '../tools/maps/types';
import { uiReleaseIdentity } from '../tools/release';
import { pinnedTilesetValidation } from './helpers/pinned-tileset-validator';

const root = resolve('dist');
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const files = existsSync(root) ? readdirSync(root, { recursive: true }).map(String).filter(p => !p.endsWith('/')) : [];
const ids = Object.keys(WORLD_CATALOG);
const layouts=composeZodiacWheel(readdirSync('world/layouts').filter(f=>f.endsWith('.json')).map(f=>json(`world/layouts/${f}`) as MapLayout));
function reference(from: string, value: string): string {
  return resolve(dirname(from), decodeURIComponent(value.split('#')[0].split('?')[0]));
}
const nativeImage = (value: string) => value.replace(/\.[a-f0-9]{64}(?=\.png$)/, '');

describe('finished release artifact (run npm run buildmap first)', () => {
  it('passes the actual pinned archive tileset validator for all 34 emitted maps', async () => {
    const maps = Object.fromEntries(ids.map(id => [`maps/${id}.tmj`, json(resolve(root, `maps/${id}.tmj`))]));
    expect(await pinnedTilesetValidation(maps, files)).toEqual({ rejectedReferences: 0, mapsRejected: 0 });
  });
  it('ships arrival sponsors through the pinned WorkAdventure tilelayer/tileset renderer boundary', () => {
    const map = json(resolve(root, 'maps/overworld.tmj')) as TiledMap;
    expect(map.layers.some(l => l.type === 'imagelayer')).toBe(false);
    const ranges = map.tilesets.map(t => ({ first: t.firstgid, end: t.firstgid + t.tilecount! })).sort((a,b)=>a.first-b.first);
    for(let i=1;i<ranges.length;i++)expect(ranges[i].first).toBeGreaterThanOrEqual(ranges[i-1].end);
    for(const [n,x] of [[1,53],[2,60],[3,67]]) {
      const asset = `../assets/sponsors/demo-0${n}.png`;
      const sheet = map.tilesets.find(t => t.image && nativeImage(t.image) === asset);
      expect(sheet).toMatchObject({ columns: 6, tilecount: 12, tilewidth: 32, tileheight: 32, imagewidth: 192, imageheight: 64 });
      const panel = map.layers.find(l => l.name === `Sponsors / Demo 0${n}`);
      expect(panel).toMatchObject({ type: 'tilelayer', visible: true, opacity: 1 });
      if(panel?.type!=='tilelayer'||!sheet)throw new Error('Sponsor missing renderer-consumable sheet/layer');
      expect(panel.data.filter(Boolean)).toHaveLength(12);
      for(let y=0;y<2;y++)for(let dx=0;dx<6;dx++)expect(panel.data[(55+y)*map.width+x+dx]).toBe(sheet.firstgid+y*6+dx);
      expect(readFileSync(reference(resolve(root,'maps/overworld.tmj'),sheet.image!))).toEqual(readFileSync(`assets/sponsors/demo-0${n}.png`));
    }
  });
  it('ships exactly the 34 catalog map pairs, excluding previews and samples', () => {
    expect(files.filter(p => p.endsWith('.tmj')).sort()).toEqual(ids.map(id => `maps/${id}.tmj`).sort());
    expect(files.filter(p => p.endsWith('.wam')).sort()).toEqual(ids.map(id => `maps/${id}.wam`).sort());
  });
  it.each(ids)('%s resolves its assets, runtime, routes, native schema and inspection zones', id => {
    const path = resolve(root, `maps/${id}.tmj`);
    expect(existsSync(path)).toBe(true);
    const map: TiledMap = json(path);
    expect(validateMap(map, WORLD_CATALOG)).toEqual([]);
    const source: TiledMap = json(`maps/${id}.tmj`);
    const canonicalScript = source.properties!.find(p => p.name === 'script')!;
    canonicalScript.value = map.properties!.find(p => p.name === 'script')!.value;
    for (const [index, tileset] of source.tilesets.entries()) {
      const original = tileset.image!;
      const bytes = readFileSync(reference(resolve(`maps/${id}.tmj`), original));
      expect(map.tilesets[index].image).toBe(original.replace(/\.png$/, `.${createHash('sha256').update(bytes).digest('hex')}.png`));
      tileset.image = map.tilesets[index].image;
    }
    for(const layer of source.layers)for(const p of layer.properties??[])if(p.name==='playAudio'){const original=String(p.value),bytes=readFileSync(reference(resolve(`maps/${id}.tmj`),original)),hash=createHash('sha256').update(bytes).digest('hex');p.value=original.replace(/\.mp3$/,`.${hash}.mp3`);expect(readFileSync(reference(path,String(p.value)))).toEqual(bytes);}
    expect(JSON.stringify(map)).toBe(JSON.stringify(source));
    expect(existsSync(resolve(root, `maps/${id}.wam`))).toBe(true);
    const wam = json(resolve(root, `maps/${id}.wam`));
    expect(validateWam(wam)).toEqual([]);
    expect(wam.mapUrl).toBe(`${id}.tmj?v=${createHash('sha256').update(readFileSync(path)).digest('hex')}`);
    expect({ ...wam, mapUrl: json(`maps/${id}.wam`).mapUrl }).toEqual(json(`maps/${id}.wam`));
    expect(reference(resolve(root, `maps/${id}.wam`), wam.mapUrl)).toBe(path);
    const layout = layouts.find(l=>l.id===id)!;
    const inspection = map.layers.find(l => l.type === 'objectgroup' && l.name === 'inspection-zones');
    expect(inspection?.type).toBe('objectgroup');
    if (inspection?.type === 'objectgroup') {
      const expected=layout.inspectionZones.map(z=>z.name);
      expect(inspection.objects.map(o => o.name).sort()).toEqual(expected.sort());
    }
    const images = map.layers.flatMap(layer => layer.type === 'imagelayer' ? [layer.image] : []);
    const refs = [...map.tilesets.map(t => t.image!), ...images, ...(map.properties?.filter(p => p.name === 'script').map(p => String(p.value)) ?? [])];
    const missing = refs.filter(v => !existsSync(reference(path, v)) || relative(root, reference(path, v)).startsWith('..'));
    expect(missing).toEqual([]);
    for (const asset of [...map.tilesets.map(t=>t.image!),...images]) expect(readFileSync(reference(path, asset)).equals(readFileSync(reference(resolve(`maps/${id}.tmj`), nativeImage(asset)))), `${id} changed image ${asset}`).toBe(true);
    expect(refs.some(v => v.endsWith('.js'))).toBe(true);
    for (const tileset of map.tilesets) expect((tileset.properties as TiledProperty[] | undefined)?.find(p => p.name === 'tilesetCopyright')?.value).toBeTruthy();
    for (const layer of map.layers) for (const p of layer.properties ?? []) if (p.name === 'exitUrl') {
      const [destination, entry] = String(p.value).split('#');
      expect(existsSync(reference(path, destination))).toBe(true);
      const target = json(reference(path, destination.replace('.wam', '.tmj')));
      expect(target.layers.some((l: {name: string}) => l.name === entry)).toBe(true);
    }
  });
  it('includes usable journal and all separate source notices, without secrets or raw source scripts', () => {
    const html = readFileSync(resolve(root, 'src/journal/index.html'), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (!/^(https?:|#)/.test(match[1])) expect(existsSync(reference(resolve(root, 'src/journal/index.html'), match[1]))).toBe(true);
    }
    for (const path of ['credits/index.html','credits/LICENSE.starter','credits/workadventure/LICENSE.assets','credits/lpc-office/LICENSE-OGA-BY-3.0.txt','credits/lpc-office/Credits.txt','credits/lpc-space/LICENSE-CC-BY-SA-4.0.txt','credits/original/LICENSE.txt']) expect(existsSync(resolve(root,path)),path).toBe(true);
    expect(files.filter(p => /(^|\/)(\.env|private|rehearsal|sample)([./]|$)|\.(pem|key|ts)$/.test(p))).toEqual([]);
  });
  it('closes both versioned HTML gateways and every local HTML/dependency/credits reference', () => {
    const identity = uiReleaseIdentity();
    const chunks = files.filter(path => path.endsWith('.js')).map(path => readFileSync(resolve(root, path), 'utf8'));
    for (const entry of ['journal', 'npc']) {
      expect(chunks.some(code => code.includes(`../src/${entry}/index.html?v=${identity}`))).toBe(true);
    }
    for (const file of files.filter(path => path.endsWith('.html'))) {
      const path = resolve(root, file);
      for (const [, value] of readFileSync(path, 'utf8').matchAll(/(?:src|href)="([^"]+)"/g)) {
        if (/^https?:/.test(value)) continue;
        const target = reference(path, value);
        expect(existsSync(target), `${file}: ${value}`).toBe(true);
        if (file === 'credits/index.html') expect(new URL(value, 'https://maps.example/credits/index.html').searchParams.get('v')).toBe(createHash('sha256').update(readFileSync(target)).digest('hex'));
        else expect(value).toMatch(/-[\w-]{8}\.(?:js|css)$/);
      }
    }
    for (const file of files.filter(path => path.endsWith('.js'))) {
      const code = readFileSync(resolve(root, file), 'utf8');
      for (const [, value] of code.matchAll(/(?:from|import)["'](\.[^"']+)["']/g)) expect(existsSync(reference(resolve(root, file), value)), `${file}: ${value}`).toBe(true);
    }
  });
});
