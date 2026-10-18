import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import type { LayoutAnimatedOverlay } from '../maps/types';

const authoringPath = 'art/source/roadster-authoring.json';
const metadataPath = 'art/source/roadster.json';
const atlasPath = 'assets/tilesets/original/roadster.png';
const hash = (data: Buffer): string => createHash('sha256').update(data).digest('hex');
/** Compile the generated poses: crop by true alpha, uniform nearest-neighbor scale,
 * integer placement and native 32px carriers. No car drawing or runtime movement. */
export async function renderRoadster() {
 const spec = JSON.parse(readFileSync(authoringPath, 'utf8'));
 const source = readFileSync(spec.source.path);
 const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
 if (info.width !== 1254 || info.height !== 1254 || spec.poses.length !== 16 || spec.framePixels !== 160) throw Error('Roadster requires the reviewed 1254px 4×4 source and sixteen 160px frames');
 const pad = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" shape-rendering="crispEdges"><path d="M18 139H142V150H18Z" fill="#0d1721"/><path d="M20 137H140V146H20Z" fill="#263c4c"/><path d="M24 139H136V141H24Z" fill="#587481"/><path d="M22 139H32V142H22ZM128 139H138V142H128Z" fill="#8fd5df"/><path d="M40 135H120V139H40Z" fill="#102331"/></svg>')).ensureAlpha().raw().toBuffer();
 const frames: Buffer[] = [], crops = [];
 for (let i = 0; i < 16; i++) {
  const left = Math.floor(i % 4 * info.width / 4), top = Math.floor(Math.floor(i / 4) * info.height / 4);
  const right = Math.floor((i % 4 + 1) * info.width / 4), bottom = Math.floor((Math.floor(i / 4) + 1) * info.height / 4);
  let x0 = right, y0 = bottom, x1 = left - 1, y1 = top - 1;
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) if (data[(y * info.width + x) * 4 + 3] >= spec.alphaThreshold) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < x0) throw Error(`Empty Roadster pose ${i}`);
  const crop = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  const width = Math.round(crop.width * spec.scale), height = Math.round(crop.height * spec.scale);
  const x = Math.floor((160 - width) / 2), y = spec.poses[i].bottom - height;
  if (x < 0 || y < 0 || x + width > 160 || y + height > 160) throw Error(`Clipped Roadster pose ${i}`);
  const pixels = await sharp(source).extract(crop).resize(width, height, { kernel: 'nearest' }).ensureAlpha().raw().toBuffer();
  const frame = Buffer.from(pad);
  // Binary alpha removes resampling fringes; retain every chosen opaque RGB value.
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
   const offset = (py * width + px) * 4;
   if (pixels[offset + 3] < spec.alphaThreshold) continue;
   const dest = ((py + y) * 160 + px + x) * 4;
   pixels.copy(frame, dest, offset, offset + 3); frame[dest + 3] = 255;
  }
  frames.push(frame); crops.push({ cell: { left, top, width: right - left, height: bottom - top }, crop, target: { x, y, width, height }, ...spec.poses[i] });
 }
 const tiles: Buffer[] = [], sequences: number[][] = Array.from({ length: 25 }, () => []), known = new Map<string, number>();
 for (const frame of frames) for (let ty = 0; ty < 5; ty++) for (let tx = 0; tx < 5; tx++) {
  const tile = Buffer.alloc(4096);
  for (let row = 0; row < 32; row++) frame.copy(tile, row * 128, ((ty * 32 + row) * 160 + tx * 32) * 4, ((ty * 32 + row) * 160 + tx * 32 + 32) * 4);
  const digest = hash(tile); let id = known.get(digest);
  if (id === undefined) { id = tiles.length; known.set(digest, id); tiles.push(tile); }
  sequences[ty * 5 + tx].push(id);
 }
 const carrierTileIds: number[] = [], animations: LayoutAnimatedOverlay['animations'] = [];
 for (const sequence of sequences) {
  const id = tiles.length; carrierTileIds.push(id); tiles.push(Buffer.from(tiles[sequence[0]]));
  animations.push({ id, frames: sequence.map((tileid, i) => ({ tileid, duration: spec.poses[i].duration })) });
 }
 const columns = 16, width = columns * 32, height = Math.ceil(tiles.length / columns) * 32, raw = Buffer.alloc(width * height * 4);
 for (const [id, tile] of tiles.entries()) for (let row = 0; row < 32; row++) tile.copy(raw, ((Math.floor(id / columns) * 32 + row) * width + id % columns * 32) * 4, row * 128, (row + 1) * 128);
 const png = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
 const overlay: LayoutAnimatedOverlay = { name: 'roadster', image: atlasPath, sourceId: 'original', level: 'belowAvatar', ...spec.position, width: 5, height: 5, carrierTileIds, animations,
  provenance: { metadataPath, atlasSha256: hash(png), inputs: [spec.source.path, authoringPath, 'tools/art/roadster.ts', 'tools/maps/builder.ts', 'tools/maps/types.ts'].map(path => ({ path, sha256: hash(readFileSync(path)) })) } };
 const metadata = { version: 1, source: { ...spec.source, sha256: hash(source) }, framePixels: 160, alphaThreshold: spec.alphaThreshold, scale: spec.scale, crops, cycleMs: spec.poses.reduce((n: number, p: {duration:number}) => n + p.duration, 0), atlas: { width, height, columns, tilecount: width * height / 1024, sha256: hash(png) }, overlay };
 return { png, metadata, frames };
}
export async function writeRoadster(): Promise<void> {
 const { png, metadata } = await renderRoadster();
 await writeFile(atlasPath, png);
 await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await writeRoadster();
