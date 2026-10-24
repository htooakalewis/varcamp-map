import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import { renderCoastalFlight } from '../tools/art/coastal-flight';
import type { CoastalFlightMetadata } from '../tools/art/coastal-flight';
import type { LayoutAnimatedOverlay, MapLayout, TileLayer, TiledMap } from '../tools/maps/types';

const base = (): MapLayout => ({ id: 'shipyard-beach', width: 48, height: 16, placements: [], entries: [], exits: [], areas: [], inspectionZones: [] });
const tinyOverlay = (): LayoutAnimatedOverlay => ({ name: 'coastal-flight-probe', image: 'assets/tilesets/original/guides.png', sourceId: 'original', x: 0, y: 6, width: 1, height: 1, carrierTileIds: [0], animations: [{ id: 0, frames: [{ tileid: 1, duration: 100 }, { tileid: 2, duration: 100 }] }] });
const hash = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const fixtureRoot = 'docs/qa/coastal-flight-2026-10-16/prototype';
interface EngineTileset { firstgid: number; getAnimatedTileId(gid: number, time: number): number | null; }
const parse = createRequire(import.meta.url)(resolve(fixtureRoot, 'upstream/phaser/src/tilemaps/parsers/tiled/ParseTilesets.js')) as (map: TiledMap) => { tilesets: EngineTileset[] };
const engineCache = new WeakMap<TiledMap, EngineTileset>();
const zeroTransparent = (raw: Buffer): Buffer => { for (let i = 0; i < raw.length; i += 4) if (raw[i + 3] === 0) raw.fill(0, i, i + 4); return raw; };
function sample(map: TiledMap, atlas: Buffer, width: number, time: number): Buffer {
 const layer = map.layers.find(l => l.name === 'coastal-flight') as TileLayer;
 const set = map.tilesets.find(s => s.name === 'coastal-flight')!;
 let engine = engineCache.get(map);
 if (!engine) { engine = parse(structuredClone(map)).tilesets.find(s => s.firstgid === set.firstgid)!; engineCache.set(map, engine); }
 const output = Buffer.alloc(1536 * 96 * 4);
 for (let y = 0; y < 3; y++) for (let x = 0; x < 48; x++) {
  const gid = engine.getAnimatedTileId(layer.data[(y + metadata.overlay.y) * 48 + x], time);
  if (gid === null) throw new Error('Pinned Phaser could not resolve native animation frame');
  const local = gid - set.firstgid, sx = local % set.columns! * 32, sy = Math.floor(local / set.columns!) * 32;
  for (let row = 0; row < 32; row++) atlas.copy(output, ((y * 32 + row) * 1536 + x * 32) * 4, ((sy + row) * width + sx) * 4, ((sy + row) * width + sx + 32) * 4);
 }
 return output;
}
function centroid(raw: Buffer, color?: number[]): number {
 let count = 0, total = 0;
 // The top14px contains aircraft pixels only: the editable banner begins aty14.
 // Measure its alpha geometry rather than an obsolete plane paint color.
 for (let i = 0; i < raw.length; i += 4) if (color?color.every((v, channel) => raw[i + channel] === v):Math.floor(i/4/1536)<14&&raw[i+3]>0) { count++; total += i / 4 % 1536; }
 if (!count) throw new Error('Plane/banner identifying pixels absent');
 return total / count;
}
function displacement(map: TiledMap, raw: Buffer, width: number): { body: number[]; banner: number[] } {
 const frames = [0, 1200, 2400].map(t => sample(map, raw, width, t));
 const body = frames.map(f => centroid(f));
 const banner = frames.map(f => centroid(f, [233, 184, 94, 255]));
 return { body: [body[1] - body[0], body[2] - body[1]], banner: [banner[1] - banner[0], banner[2] - banner[1]] };
}
function requireMotion(result: { body: number[]; banner: number[] }): void {
 if (![...result.body, ...result.banner].every(delta => Math.abs(delta - 96) < 1e-6)) throw new Error(`Whole plane/banner world displacement must be96px: ${JSON.stringify(result)}`);
}
let flight: Awaited<ReturnType<typeof renderCoastalFlight>>, metadata: CoastalFlightMetadata, map: TiledMap, atlas: Buffer, art: Buffer;
beforeAll(async () => {
 for (const entry of JSON.parse(readFileSync(`${fixtureRoot}/source-manifest.json`, 'utf8')) as { path: string; sha256: string }[]) expect(hash(readFileSync(`${fixtureRoot}/${entry.path}`))).toBe(entry.sha256);
 flight = await renderCoastalFlight(); metadata = flight.metadata;
 map = buildMap({ ...base(), animatedOverlays: [metadata.overlay] }, loadTileCatalog()).tmj;
 atlas = zeroTransparent(await sharp(flight.png).ensureAlpha().raw().toBuffer());
 art = zeroTransparent(await sharp(flight.art).ensureAlpha().raw().toBuffer());
});

describe('native coastal flight', () => {
 it('keeps generic explicitly optional overlay behavior independent of the mandatory coast policy', () => {
  const { tmj } = buildMap({ ...base(), animatedOverlays: [tinyOverlay()] }, loadTileCatalog());
  const layer = tmj.layers.find(l => l.name === 'coastal-flight-probe') as TileLayer | undefined;
  expect(layer, 'builder must not silently omit authored animation').toBeDefined();
  const set = tmj.tilesets.find(t => t.name === 'coastal-flight-probe');
  expect(set?.tiles?.[0].animation).toEqual([{ tileid: 1, duration: 100 }, { tileid: 2, duration: 100 }]);
  expect(layer?.data[6 * 48]).toBe(set?.firstgid);
  expect(tmj.layers.indexOf(layer!)).toBeGreaterThan(tmj.layers.findIndex(l => l.name === 'floorLayer'));
  expect(set?.tiles?.[0].properties).toEqual([{ name: 'collides', type: 'bool', value: false }]);
 });
 it('refuses stale editable plane/compiler input provenance before native authoring', () => {
  const overlay = { ...metadata.overlay, provenance: { metadataPath: 'art/source/coastal-flight.json', atlasSha256: metadata.atlas.sha256, inputs: [{ path: metadata.inputs.plane.path, sha256: '0'.repeat(64) }] } };
  expect(() => buildMap({ ...base(), animatedOverlays: [overlay] }, loadTileCatalog())).toThrow(/input changed/);
 });
 it('leaves layouts without the optional overlay byte-equivalent', () => {
  expect(buildMap({ ...base(), animatedOverlays: [] }, loadTileCatalog())).toEqual(buildMap(base(), loadTileCatalog()));
 });
 it('translates both the detailed plane body and attached editable demo banner96px per1.2seconds', () => {
  requireMotion(displacement(map, atlas, metadata.atlas.width));
  expect(hash(readFileSync(metadata.overlay.image))).toBe(hash(flight.png));
 });
 it('rejects the original stationary-plane behavior even with a complete native sprite', () => {
  const stationary = structuredClone(map);
  for (const set of stationary.tilesets) for (const tile of set.tiles ?? []) delete tile.animation;
  const stopped = displacement(stationary, atlas, metadata.atlas.width);
  expect(stopped.body).toEqual([0, 0]); expect(stopped.banner).toEqual([0, 0]);
  expect(() => requireMotion(stopped)).toThrow(/world displacement/);
 });
 it('preserves the whole plane/banner pixels, seams and loop across every native phase of the built TMJ', () => {
  expect(metadata.phaseCount).toBe(244);
  for (let phase = 0; phase <= 244; phase++) {
   const actual = sample(map, atlas, metadata.atlas.width, phase * 100), expected = Buffer.alloc(1536 * 96 * 4);
   // Independent physical contract:80px/s, reset fully outside the left edge only after exiting right.
   const travel = 512 + phase * 8, position = travel < 1536 ? travel : travel - 1952;
   const sourceX = Math.max(0, -position), destinationX = Math.max(0, position), length = Math.min(416 - sourceX, 1536 - destinationX);
   for (let row = 0; row < 96; row++) if (length > 0) art.copy(expected, (row * 1536 + destinationX) * 4, (row * 416 + sourceX) * 4, (row * 416 + sourceX + length) * 4);
   expect(actual.equals(expected), `whole-art frame at${phase * 100}ms`).toBe(true);
  }
  expect(sample(map, atlas, metadata.atlas.width, 0)).toEqual(sample(map, atlas, metadata.atlas.width, 24400));
 });
 it('starts the whole aircraft and banner inside the arrival camera horizontal band', () => {
  const pixels = sample(map, atlas, metadata.atlas.width, 0), xs: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3]) xs.push(i / 4 % 1536);
  expect(Math.min(...xs)).toBeGreaterThanOrEqual(14 * 32);
  expect(Math.max(...xs)).toBeLessThan(34 * 32);
 });
 it('keeps validated source pixels native and emits a bounded sparse, noncolliding peripheral band', async () => {
  const overlay = map.layers.find(l => l.name === 'coastal-flight') as TileLayer;
  expect(overlay.data.filter(Boolean)).toHaveLength(144);
  expect(metadata.overlay).toMatchObject({ x: 0, y: 5, width: 48, height: 3, level: 'aboveScenery' });
  expect(metadata.atlas.decodedRgbaBytes).toBeLessThanOrEqual(4 * 1024 * 1024);
  const source = await sharp(readFileSync(metadata.inputs.plane.path)).ensureAlpha().raw().toBuffer();
  const sponsor = await sharp(readFileSync(metadata.inputs.sponsor.path)).ensureAlpha().raw().toBuffer();
  for (const [pixels, width, x, y] of [[source, 192, 224, 0], [sponsor, 192, 2, 16]] as const) {
   for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] === 255) expect(art.subarray(((Math.floor(i / 4 / width) + y) * 416 + i / 4 % width + x) * 4, ((Math.floor(i / 4 / width) + y) * 416 + i / 4 % width + x) * 4 + 4)).toEqual(pixels.subarray(i, i + 4));
  }
  const set = map.tilesets.find(t => t.name === 'coastal-flight')!;
  expect(set.tiles).toHaveLength(144);
  expect(new Set(set.tiles!.map(t => t.animation!.reduce((sum, f) => sum + f.duration, 0)))).toEqual(new Set([24400]));
  expect(set.tiles!.every(t => t.properties?.every(p => p.name !== 'collides' || p.value === false))).toBe(true);
 });
 it.each([
  ['out-of-map rectangle', (o: LayoutAnimatedOverlay) => ({ ...o, x: 48 })],
  ['unregistered source', (o: LayoutAnimatedOverlay) => ({ ...o, sourceId: 'unknown' })],
  ['source outside original atlas directory', (o: LayoutAnimatedOverlay) => ({ ...o, image: '../../private/flight.png' })],
  ['missing animation', (o: LayoutAnimatedOverlay) => ({ ...o, animations: [] })],
  ['out-of-atlas frame', (o: LayoutAnimatedOverlay) => ({ ...o, animations: [{ id: 0, frames: [{ tileid: 999999, duration: 100 }] }] })],
  ['recursive carrier frame', (o: LayoutAnimatedOverlay) => ({ ...o, animations: [{ id: 0, frames: [{ tileid: 0, duration: 100 }] }] })],
  ['sub100ms duration', (o: LayoutAnimatedOverlay) => ({ ...o, animations: [{ id: 0, frames: [{ tileid: 1, duration: 50 }] }] })],
 ] as const)('rejects invalid optional overlay: %s', (_name, mutate) => {
  expect(() => buildMap({ ...base(), animatedOverlays: [mutate(tinyOverlay())] }, loadTileCatalog())).toThrow();
 });
});
