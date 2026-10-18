import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { readSponsorImage } from '../maps/builder';
import type { LayoutAnimatedOverlay, TileAnimationFrame } from '../maps/types';
import { COASTAL_FLIGHT_RECT } from '../maps/coast-aerial';

const planePath = 'art/source/coastal-flight-plane.png';
const sponsorPath = 'assets/sponsors/demo-01.png';
const atlasPath = 'assets/tilesets/original/coastal-flight.png';
const metadataPath = 'art/source/coastal-flight.json';
const corridorWidth = 48, corridorHeight = 3, artWidth = 416, artHeight = 96;
const stepPixels = 8, frameDurationMs = 100, initialOriginX = 512;
const digest = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
export interface CoastalFlightMetadata {
  version: 1;
  inputs: { plane: { path: string; sha256: string }; sponsor: { path: string; sha256: string } };
  artPixels: { width: number; height: number };
  parts: { plane: { x: number; y: number; width: number; height: number }; banner: { x: number; y: number; width: number; height: number } };
  stepPixels: number; frameDurationMs: number; initialOriginX: number; phaseCount: number; cycleMs: number;
  atlas: { width: number; height: number; columns: number; tilecount: number; sha256: string; decodedRgbaBytes: number; sharedFrameTiles: number };
  overlay: LayoutAnimatedOverlay;
}

/** PNG is the editable source of truth; the SVG is its initial authoring reference only.
 * Pure render: exact native pixels, no scaling and no writes. Shared by export and parity checks. */
export async function renderCoastalFlight(): Promise<{ png: Buffer; metadata: CoastalFlightMetadata; art: Buffer }> {
  const plane = readFileSync(planePath), sponsor = readSponsorImage(sponsorPath);
  const planeInfo = await sharp(plane).metadata();
  if (planeInfo.width !== 192 || planeInfo.height !== 96) throw new Error('Flight plane source must remain native 192×96');
  const frame = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="416" height="96" shape-rendering="crispEdges"><path d="M194 48H225" stroke="#ead6a3" stroke-width="2"/><path d="M2 14H194L196 16V80L194 82H2L0 80V16Z" fill="#e9b85e"/><path d="M3 17H193V79H3Z" fill="#173b52"/></svg>');
  const art = await sharp(frame, { density: 72 }).composite([{ input: sponsor, left: 2, top: 16 }, { input: plane, left: 224, top: 0 }]).png().toBuffer();
  const raw = await sharp(art).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < raw.length; i += 4) if (raw[i + 3] === 0) raw.fill(0, i, i + 4);
  const blank = Buffer.alloc(32 * 32 * 4), tiles: Buffer[] = [blank], known = new Map([[digest(blank), 0]]);
  const phaseCount = (corridorWidth * 32 + artWidth) / stepPixels;
  const sequences: number[][] = Array.from({ length: corridorWidth * corridorHeight }, () => []);
  for (let phase = 0; phase < phaseCount; phase++) {
    const strip = Buffer.alloc(corridorWidth * 32 * artHeight * 4);
    const position = (phase * stepPixels + initialOriginX + artWidth) % (corridorWidth * 32 + artWidth) - artWidth;
    const sourceX = Math.max(0, -position), destinationX = Math.max(0, position), pixels = Math.min(artWidth - sourceX, corridorWidth * 32 - destinationX);
    for (let y = 0; y < artHeight; y++) if (pixels > 0) raw.copy(strip, (y * corridorWidth * 32 + destinationX) * 4, (y * artWidth + sourceX) * 4, (y * artWidth + sourceX + pixels) * 4);
    for (let y = 0; y < corridorHeight; y++) for (let x = 0; x < corridorWidth; x++) {
      const tile = Buffer.alloc(32 * 32 * 4);
      for (let row = 0; row < 32; row++) strip.copy(tile, row * 128, ((y * 32 + row) * corridorWidth * 32 + x * 32) * 4, ((y * 32 + row) * corridorWidth * 32 + x * 32 + 32) * 4);
      const hash = digest(tile); let id = known.get(hash);
      if (id === undefined) { id = tiles.length; known.set(hash, id); tiles.push(tile); }
      sequences[y * corridorWidth + x].push(id);
    }
  }
  const sharedFrameTiles = tiles.length, animations: LayoutAnimatedOverlay['animations'] = [], carrierTileIds: number[] = [];
  for (const sequence of sequences) {
    const id = tiles.length, frames: TileAnimationFrame[] = [];
    carrierTileIds.push(id); tiles.push(Buffer.from(tiles[sequence[0]]));
    for (const tileid of sequence) {
      const last = frames.at(-1);
      if (last?.tileid === tileid) last.duration += frameDurationMs; else frames.push({ tileid, duration: frameDurationMs });
    }
    animations.push({ id, frames });
  }
  const columns = 16, rows = Math.ceil(tiles.length / columns), width = columns * 32, height = rows * 32;
  const pixels = Buffer.alloc(width * height * 4);
  for (const [id, tile] of tiles.entries()) for (let row = 0; row < 32; row++) tile.copy(pixels, (((Math.floor(id / columns) * 32 + row) * width) + (id % columns) * 32) * 4, row * 128, (row + 1) * 128);
  const png = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const metadata: CoastalFlightMetadata = { version: 1, inputs: { plane: { path: planePath, sha256: digest(plane) }, sponsor: { path: sponsorPath, sha256: digest(sponsor) } }, artPixels: { width: artWidth, height: artHeight }, parts: { plane: { x: 224, y: 0, width: 192, height: 96 }, banner: { x: 0, y: 14, width: 196, height: 68 } }, stepPixels, frameDurationMs, initialOriginX, phaseCount, cycleMs: phaseCount * frameDurationMs, atlas: { width, height, columns, tilecount: columns * rows, sha256: digest(png), decodedRgbaBytes: pixels.length, sharedFrameTiles }, overlay: { name: 'coastal-flight', image: atlasPath, sourceId: 'original', level: 'belowAvatar', ...COASTAL_FLIGHT_RECT, carrierTileIds, animations } };
  metadata.overlay.provenance = { metadataPath, atlasSha256: digest(png), inputs: [planePath, sponsorPath, 'tools/art/coastal-flight.ts', 'tools/maps/coast-aerial.ts','tools/maps/animated-decoration.ts','tools/maps/animated-decoration-contract.json', 'tools/maps/builder.ts', 'tools/maps/types.ts'].map(path => ({ path, sha256: digest(readFileSync(path)) })) };
  return { png, metadata, art };
}

/** Standalone source compiler; shared art export invokes it without changing unrelated atlases. */
export async function writeCoastalFlight(): Promise<void> {
  const result = await renderCoastalFlight();
  await mkdir('assets/tilesets/original', { recursive: true });
  await writeFile(atlasPath, result.png);
  await writeFile(metadataPath, JSON.stringify(result.metadata, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await writeCoastalFlight();
