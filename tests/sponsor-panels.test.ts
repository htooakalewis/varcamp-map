import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { build } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WORLD_CATALOG } from '../src/world/catalog';
import { buildMap, readSponsorTileset } from '../tools/maps/builder';
import { renderMap } from '../tools/maps/render';
import type { MapLayout, TiledMap, TiledLayer } from '../tools/maps/types';
import type { TileCatalog } from '../tools/art/catalog';
import {syntheticReleasePlugin} from './helpers/synthetic-release-plugin';

const project = process.cwd();
const fingerprint = (path: string, bytes: Buffer = readFileSync(path)) => path.replace(/\.png$/, `.${createHash('sha256').update(bytes).digest('hex')}.png`);
const logo = 'assets/sponsors/demo-01.png';
const image = { name: 'sponsor-demo-orbit', image: logo, x: 2, y: 3, width: 6, height: 2 };
const tiles: TileCatalog = { 'floor-charcoal': { sheet: 'assets/tilesets/original/floor.png', rect: { x: 0, y: 0, width: 1, height: 1 }, blockingCells: [], level: 'belowAvatar', sourceId: 'original' } };
function layout(overrides: Record<string, unknown> = {}): MapLayout {
  return { id: 'overworld', width: 12, height: 10, placements: [], entries: [], exits: [], areas: [], inspectionZones: [], images: [{ ...image, ...overrides }] } as MapLayout;
}
async function png(path: string, width = 192, height = 64, color = '#00d58f'): Promise<void> {
  await sharp({ create: { width, height, channels: 4, background: color } }).png().toFile(path);
}
let fixture: string;
beforeEach(async () => {
  fixture = mkdtempSync(resolve(tmpdir(), 'varcamp-sponsor-'));
  for (const path of ['art', 'assets/sponsors', 'assets/tilesets/original', 'maps', 'world/layouts', 'src', 'docs/dependencies']) mkdirSync(resolve(fixture, path), { recursive: true });
  writeFileSync(resolve(fixture, 'art/sources.json'), JSON.stringify({ original: { attribution: 'Fixture author', license: 'CC0', licenseFile: 'assets/tilesets/original/LICENSE.txt', changes: 'Fixture', url: 'https://example.com' } }));
  writeFileSync(resolve(fixture, 'assets/tilesets/original/LICENSE.txt'), 'CC0 fixture');
  writeFileSync(resolve(fixture, 'assets/tilesets/original/ATTRIBUTION.md'), 'Fixture author');
  writeFileSync(resolve(fixture, 'docs/dependencies/LICENSE.starter'), 'MIT fixture');
  writeFileSync(resolve(fixture, 'src/main.ts'), 'console.log("fixture runtime")');
  writeFileSync(resolve(fixture, 'art/sponsors.json'), JSON.stringify({ license: 'CC0-1.0', attribution: 'Original fictional demo marks' }));
  await png(resolve(fixture, logo));
  await png(resolve(fixture, tiles['floor-charcoal'].sheet), 64, 32, '#102030');
  symlinkSync(resolve(project, '.tools'), resolve(fixture, '.tools'));
  mkdirSync(resolve(fixture,'public/wokas'),{recursive:true});
  cpSync(resolve(project,'public/wokas/varcamp-zodiac-v1'),resolve(fixture,'public/wokas/varcamp-zodiac-v1'),{recursive:true});
  process.chdir(fixture);
});
afterEach(() => { process.chdir(project); rmSync(fixture, { recursive: true, force: true }); });

async function release(map: TiledMap): Promise<string> {
  for (const [id,definition] of Object.entries(WORLD_CATALOG)) {
    const source=structuredClone(map);source.width=definition.width;source.height=definition.height;
    const identity=source.properties?.find(p=>p.name==='worldMapId');if(!identity)throw Error('Synthetic sponsor map must retain its source identity');identity.value=id;
    const resize=(layers:TiledLayer[]):void=>{for(const layer of layers){if(layer.type==='group')resize(layer.layers);else if(layer.type==='tilelayer'){const before=layer.data,width=layer.width,height=layer.height;layer.width=definition.width;layer.height=definition.height;layer.data=Array.from({length:definition.width*definition.height},(_,i)=>{const x=i%definition.width,y=Math.floor(i/definition.width);return x<width&&y<height?before[y*width+x]:0;});}}};resize(source.layers);
    writeFileSync(`world/layouts/${id}.json`,JSON.stringify({id,width:definition.width,height:definition.height,placements:[],entries:[],exits:[],areas:[],inspectionZones:[]}));
    writeFileSync(`maps/${id}.tmj`, JSON.stringify(source));
    writeFileSync(`maps/${id}.wam`, JSON.stringify({ version: '2.1.0', mapUrl: `${id}.tmj`, entities: {}, areas: [], entityCollections: [] }));
  }
  await build({ configFile: false, publicDir: false, logLevel: 'silent', plugins: [syntheticReleasePlugin()], build: { outDir: 'release', rollupOptions: { input: { 'src-main': resolve('src/main.ts') } } } });
  return resolve('release');
}

describe('replaceable WorkAdventure sponsor tile layers', () => {
  it('exports all 12 native cells through the pinned renderer tilelayer/tileset boundary', () => {
    const result = buildMap(layout(), tiles);
    expect(result.tmj.layers.some(l => l.type === 'imagelayer')).toBe(false);
    const sheet = result.tmj.tilesets.find(t => t.image === '../assets/sponsors/demo-01.png');
    expect(sheet).toMatchObject({ name: 'sponsor-demo-orbit', firstgid: 5, tilewidth: 32, tileheight: 32, columns: 6, tilecount: 12, imagewidth: 192, imageheight: 64 });
    const panel = result.tmj.layers.find(l => l.name === 'sponsor-demo-orbit');
    expect(panel).toMatchObject({ type: 'tilelayer', x: 0, y: 0, width: 12, height: 10, visible: true, opacity: 1 });
    if (panel?.type !== 'tilelayer') throw new Error('Sponsor must be a renderer-consumable tilelayer');
    expect(panel.data.map((gid, i) => gid ? [i, gid] : null).filter(Boolean)).toEqual([[38,5],[39,6],[40,7],[41,8],[42,9],[43,10],[50,11],[51,12],[52,13],[53,14],[54,15],[55,16]]);
    expect(result.wam.areas).toEqual([]);
    expect(buildMap({ ...layout(), images: undefined } as MapLayout, tiles).tmj.tilesets.some(t => t.image?.includes('/sponsors/'))).toBe(false);
  });
  it('reserves navigation and every sponsor GID range without overlap', () => {
    const authored = layout();
    authored.images = [1,2,3].map(n => ({ ...image, name: `panel-${n}`, y: 1 + (n-1)*3 }));
    authored.entries = [{ name: 'start', x: 0, y: 0, width: 1, height: 1, isDefault: true }];
    const map = buildMap(authored, tiles).tmj;
    const occupied = new Set<number>();
    for (const sheet of map.tilesets) for (let gid=sheet.firstgid;gid<sheet.firstgid+sheet.tilecount!;gid++) {
      expect(occupied.has(gid), `overlapping GID ${gid}`).toBe(false); occupied.add(gid);
    }
    const entry = map.layers.find(l => l.name === 'start');
    if (entry?.type !== 'tilelayer') throw new Error('Missing native entry');
    const nav = map.tilesets.find(t => t.name === 'navigation-mask')!;
    expect(entry.data[0]).toBe(nav.firstgid);
    expect(map.tilesets.filter(t => t.image?.includes('/sponsors/'))).toHaveLength(3);
  });
  it.each(['../outside.png', '/tmp/outside.png', 'assets/sponsors/../demo-01.png', 'assets/tilesets/original/floor.png', 'https://example.com/demo.png', 'assets/sponsors/demo-01.png?x=1'])('rejects invalid layout image path %s', path => {
    expect(() => buildMap(layout({ image: path }), tiles)).toThrow(/sponsor.*path/i);
  });
  it('rejects missing PNGs', () => { expect(() => buildMap(layout({ image: 'assets/sponsors/missing.png' }), tiles)).toThrow(/sponsor.*missing/i); });
  it('rejects symlinks escaping the sponsor asset directory', () => {
    symlinkSync(resolve('assets/tilesets/original/floor.png'), 'assets/sponsors/escape.png');
    expect(() => buildMap(layout({ image: 'assets/sponsors/escape.png' }), tiles)).toThrow(/sponsor.*outside/i);
  });
  it.each([{ width: 5 }, { height: 3 }, { x: 8 }, { x: 1.5 }, { width: 4, height: 1 }, { width: 3, height: 2 }, { width: 8, height: 2 }])('rejects scaling or invalid image bounds %j', value => {
    expect(() => buildMap(layout(value), tiles)).toThrow(/sponsor.*(native|bounds)/i);
  });
  it('accepts the 4×2 compact expo footprint only with a native 128×64 PNG, exactly per entry', async () => {
    const compact = 'assets/sponsors/compact-01.png';
    await png(compact, 128, 64, '#2f6fde');
    const authored = layout({ name: 'compact-mark', image: compact, width: 4, height: 2 });
    authored.images!.push({ ...image, y: 6 });
    const map = buildMap(authored, tiles).tmj;
    expect(map.tilesets.find(t => t.name === 'compact-mark')).toMatchObject({ firstgid: 5, columns: 4, tilecount: 8, imagewidth: 128, imageheight: 64, image: '../assets/sponsors/compact-01.png', properties: [{ name: 'sponsorPanel', type: 'bool', value: true }, expect.anything()] });
    expect(map.tilesets.find(t => t.name === image.name)).toMatchObject({ firstgid: 13, columns: 6, tilecount: 12, imagewidth: 192, imageheight: 64 });
    const panel = map.layers.find(l => l.name === 'compact-mark');
    if (panel?.type !== 'tilelayer') throw new Error('Compact mark must be a tilelayer');
    expect(panel.data.map((gid, i) => gid ? [i, gid] : null).filter(Boolean)).toEqual([[38,5],[39,6],[40,7],[41,8],[50,9],[51,10],[52,11],[53,12]]);
    expect(() => buildMap(layout({ name: 'compact-mark', image: compact }), tiles)).toThrow(/sponsor.*192.*64/i);
    expect(() => buildMap(layout({ width: 4, height: 2 }), tiles)).toThrow(/sponsor.*128.*64/i);
    expect(() => readSponsorTileset({ ...map.tilesets.find(t => t.name === 'compact-mark')!, columns: 6, tilecount: 12, imagewidth: 192 })).toThrow(/sponsor.*192.*64/i);
    expect(() => readSponsorTileset({ ...map.tilesets.find(t => t.name === 'compact-mark')!, columns: 2, tilecount: 8, imagewidth: 64 })).toThrow(/6×2 or 4×2/);
    expect(readSponsorTileset(map.tilesets.find(t => t.name === 'compact-mark')!).bytes).toEqual(readFileSync(compact));
    const root = await release(map);
    expect(readFileSync(resolve(root, fingerprint(compact)))).toEqual(readFileSync(compact));
    await png(compact, 192, 64);
    await expect(release(map)).rejects.toThrow(/sponsor.*128.*64/i);
  });
  it('rejects non-PNG bytes and wrong native PNG dimensions', async () => {
    writeFileSync(logo, 'not a PNG');
    expect(() => buildMap(layout(), tiles)).toThrow(/sponsor.*PNG/i);
    await png(logo, 96, 32);
    expect(() => buildMap(layout(), tiles)).toThrow(/sponsor.*192.*64/i);
  });
  it.each([24, 33])('rejects a plausible native PNG truncated to %i bytes', length => {
    writeFileSync(logo, readFileSync(logo).subarray(0, length));
    expect(() => buildMap(layout(), tiles)).toThrow(/sponsor.*(PNG|decode)/i);
  });
  it('rejects a complete PNG container whose compressed image pixels are corrupt', () => {
    const bytes = readFileSync(logo);
    bytes[bytes.indexOf(Buffer.from('IDAT')) + 4] = 0;
    writeFileSync(logo, bytes);
    expect(() => buildMap(layout(), tiles)).toThrow(/sponsor.*(PNG|decode)/i);
  });
  it('rejects a corrupt replacement during release even after validating earlier bytes', async () => {
    const map = buildMap(layout(), tiles).tmj;
    const bytes = readFileSync(logo);
    bytes[bytes.indexOf(Buffer.from('IDAT')) + 4] = 0;
    writeFileSync(logo, bytes);
    await expect(release(map)).rejects.toThrow(/sponsor.*(PNG|decode)/i);
  });
  it('rejects a PNG missing its terminal end chunk', () => {
    writeFileSync(logo, readFileSync(logo).subarray(0, -12));
    expect(() => buildMap(layout(), tiles)).toThrow(/sponsor.*(PNG|IEND)/i);
  });
  it('bounds native sponsor file size before decoding', () => {
    writeFileSync(logo, Buffer.alloc(2 * 1024 * 1024 + 1));
    expect(() => buildMap(layout(), tiles)).toThrow(/sponsor.*2 MiB/i);
  });
  it('accepts a valid same-path indexed PNG replacement', async () => {
    buildMap(layout(), tiles);
    const replacement = await sharp({ create: { width: 192, height: 64, channels: 4, background: '#af7bcc' } }).png({ palette: true }).toBuffer();
    writeFileSync(logo, replacement);
    const root = await release(buildMap(layout(), tiles).tmj);
    expect(readFileSync(resolve(root, fingerprint(logo, replacement)))).toEqual(replacement);
  });
  it('ships the referenced PNG verbatim, including nested sponsor tile layers', async () => {
    const map = buildMap(layout(), tiles).tmj;
    const layer = map.layers.find(l => l.name === image.name)!;
    map.layers = map.layers.filter(l => l !== layer);
    map.layers.push({ id: 500, name: 'sponsor-group', type: 'group', visible: true, opacity: 1, x: 0, y: 0, layers: [layer] });
    const root = await release(map);
    expect(readFileSync(resolve(root, fingerprint(logo)))).toEqual(readFileSync(logo));
    const output = JSON.parse(readFileSync(resolve(root, 'maps/overworld.tmj'), 'utf8')) as TiledMap;
    expect(output.layers.find(l => l.type === 'group')).toMatchObject({ layers: [{ name: image.name, type: 'tilelayer' }] });
    expect(output.tilesets.some(t => t.image === `../${fingerprint(logo)}`)).toBe(true);
    expect(JSON.parse(readFileSync(resolve(root, 'credits/sponsors.json'), 'utf8')).license).toBe('CC0-1.0');
  });
  it('packages replacement bytes without regenerating or freezing the logo', async () => {
    const map = buildMap(layout(), tiles).tmj, original = readFileSync(logo);
    await png(logo, 192, 64, '#ffba66');
    const replacement = readFileSync(logo);
    expect(replacement.equals(original)).toBe(false);
    const root = await release(map);
    expect(readFileSync(resolve(root, fingerprint(logo, replacement)))).toEqual(replacement);
    expect(readFileSync(logo)).toEqual(replacement);
    expect(buildMap(layout(), tiles).tmj.tilesets.find(t => t.image === '../assets/sponsors/demo-01.png')).toMatchObject({ columns: 6, tilecount: 12 });
  });
  it('includes all three actual referenced DEMO logos byte-for-byte in the release', async () => {
    const authored = layout();
    authored.images = [1, 2, 3].map(n => ({ ...image, name: `sponsor-demo-0${n}`, image: `assets/sponsors/demo-0${n}.png`, y: 1 + (n - 1) * 3 }));
    for (const item of authored.images) writeFileSync(item.image, readFileSync(resolve(project, item.image)));
    const root = await release(buildMap(authored, tiles).tmj);
    for (const item of authored.images) expect(readFileSync(resolve(root, fingerprint(item.image)))).toEqual(readFileSync(resolve(project, item.image)));
  });
  it.each(['../../outside.png', '/tmp/outside.png', '../assets/tilesets/original/floor.png', '../assets/sponsors/missing.png'])('rejects invalid native release image reference %s', async path => {
    const map = buildMap(layout(), tiles).tmj;
    map.tilesets.find(t => t.image === '../assets/sponsors/demo-01.png')!.image = path;
    await expect(release(map)).rejects.toThrow(/sponsor/i);
  });
  it('rejects replacement dimension mismatch when packaging an already-authored TMJ', async () => {
    const map = buildMap(layout(), tiles).tmj;
    await png(logo, 64, 64);
    await expect(release(map)).rejects.toThrow(/sponsor.*192.*64/i);
  });
  it('renders all 12 PNG cells in native order through nested tile layers', async () => {
    const cells = await Promise.all(Array.from({ length: 12 }, async (_, i) => ({ input: await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 16+i*16, g: 200-i*10, b: 80, alpha: 1 } } }).png().toBuffer(), left: i%6*32, top: Math.floor(i/6)*32 })));
    await sharp({ create: { width: 192, height: 64, channels: 4, background: '#00000000' } }).composite(cells).png().toFile(logo);
    const map = buildMap(layout(), tiles).tmj;
    const panel = map.layers.find(l => l.name === image.name)!;
    map.layers = map.layers.filter(l => l !== panel);
    map.layers.push({ id: 50, name: 'nested', type: 'group', visible: true, opacity: 1, x: 0, y: 0, layers: [panel] });
    await renderMap(map, 'render.png');
    const { data, info } = await sharp('render.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
    for (let i=0;i<12;i++) expect(at(64+i%6*32+16, 96+Math.floor(i/6)*32+16)).toEqual([16+i*16,200-i*10,80,255]);
    expect(at(256,160)).not.toEqual([192,90,80,255]);
    expect(map.tilesets.find(t => t.name === image.name)?.image).toBe('../assets/sponsors/demo-01.png');
  });
  it('rejects unsupported native image-only panels during packaging', async () => {
    const map = buildMap({ ...layout(), images: undefined } as MapLayout, tiles).tmj;
    map.layers.push({ id: 50, name: 'unsupported-logo', type: 'imagelayer', image: '../assets/sponsors/demo-01.png' });
    await expect(release(map)).rejects.toThrow(/image.*layer.*(unsupported|tile)/i);
  });
  it('provides three distinct native transparent DEMO assets', async () => {
    const buffers = [];
    for (const name of ['demo-01', 'demo-02', 'demo-03']) {
      const bytes = readFileSync(resolve(project, `assets/sponsors/${name}.png`));
      const metadata = await sharp(bytes).metadata();
      expect(metadata).toMatchObject({ width: 192, height: 64, format: 'png', hasAlpha: true });
      const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
      const alpha = [...data].filter((_, i) => i % info.channels === info.channels - 1);
      expect(alpha.some(a => a === 0)).toBe(true);
      expect(alpha.some(a => a === 255)).toBe(true);
      buffers.push(bytes);
    }
    expect(buffers[0].equals(buffers[1])).toBe(false);
    expect(buffers[1].equals(buffers[2])).toBe(false);
  });
});
