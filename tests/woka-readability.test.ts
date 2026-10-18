import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { DESIGN, DIRECTIONS, Pixels, color, png, renderFrame, renderSheet, type Pose } from '../tools/wokas/readable-v2';

const root = path.resolve(import.meta.dirname, '..');
const design = JSON.parse(readFileSync(path.join(root, 'art/source/wokas-readable-v2/native-design.json'), 'utf8'));
const candidate = path.join(root, 'public/wokas', existsSync(path.join(root, 'public/wokas/varcamp-zodiac-v2')) ? 'varcamp-zodiac-v2' : 'varcamp-zodiac-v1');

async function frontBounds(file: string): Promise<{ width: number; height: number }> {
  const rgba = await sharp(file).ensureAlpha().raw().toBuffer();
  let left = 32, top = 32, right = -1, bottom = -1;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (rgba[(y * 96 + x + 32) * 4 + 3] === 0) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { width: right - left + 1, height: bottom - top + 1 };
}

describe('native readable zodiac avatar contract', () => {
  it('front identities occupy the written design target at actual32px size', async () => {
    const facts = [];
    for (const sign of design.signs) for (const gender of ['male', 'female']) {
      const file = `${sign.id}-${gender}.png`;
      const bounds = await frontBounds(path.join(candidate, file));
      facts.push({ file, ...bounds });
      expect.soft(bounds.width, `${file} width`).toBeGreaterThanOrEqual(design.frame.frontTarget.minimumWidth);
      expect.soft(bounds.width, `${file} width`).toBeLessThanOrEqual(design.frame.frontTarget.maximumWidth);
      expect.soft(bounds.height, `${file} height`).toBeGreaterThanOrEqual(design.frame.frontTarget.minimumHeight);
      expect.soft(bounds.height, `${file} height`).toBeLessThanOrEqual(design.frame.frontTarget.maximumHeight);
    }
    console.log('ACTUAL_FRONT_BOUNDS', JSON.stringify(facts));
  });

  it('every complete7x7 chest/back glyph remains visible through costume and hair', () => {
    for (const sign of DESIGN.signs) for (const gender of ['male', 'female'] as const) for (const direction of ['down', 'up'] as const) for (const pose of [0, 1, 2] as const) {
      const frame = renderFrame(sign.id, gender, direction, pose);
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (sign.glyph[y][x] === '#') {
        expect.soft([...frame.rgba.subarray(((19 + y) * 32 + 12 + x) * 4, ((19 + y) * 32 + 12 + x) * 4 + 4)], `${sign.id}/${gender}/${direction}/${pose} glyph${x},${y}`).toEqual(color('#fff8e8'));
      }
    }
  });

  it('all24 native PNGs are exact96x128 RGBA and replay byte-exact from authored pixels', async () => {
    const manifest = JSON.parse(readFileSync(path.join(candidate, 'manifest.json'), 'utf8'));
    expect(manifest.version).toBe(2);
    expect(manifest.assets).toHaveLength(24);
    for (const sign of DESIGN.signs) for (const gender of ['male', 'female'] as const) {
      const file = `${sign.id}-${gender}.png`, raw = readFileSync(path.join(candidate, file));
      const image = sharp(raw), metadata = await image.metadata();
      expect([metadata.width, metadata.height, metadata.channels]).toEqual([96, 128, 4]);
      const source = renderSheet(sign.id, gender);
      expect(await image.ensureAlpha().raw().toBuffer()).toEqual(source.rgba);
      expect(await png(source)).toEqual(raw);
      const receipt = manifest.assets.find((row: { file: string }) => row.file === file);
      expect(receipt.sha256).toBe(createHash('sha256').update(raw).digest('hex'));
      expect(receipt.rgbaSha256).toBe(createHash('sha256').update(source.rgba).digest('hex'));
      expect(receipt.bytes).toBe(raw.length);
    }
  });

  it('all288 native frames have binary alpha, clear borders, feet30 and three real poses', () => {
    const sha = (frame: Pixels): string => createHash('sha256').update(frame.rgba).digest('hex');
    for (const sign of DESIGN.signs) for (const gender of ['male', 'female'] as const) for (const direction of DIRECTIONS) {
      const poses = [0, 1, 2].map(pose => renderFrame(sign.id, gender, direction, pose as Pose));
      expect(new Set(poses.map(sha)).size, `${sign.id}/${gender}/${direction} three poses`).toBe(3);
      for (let pose = 0; pose < 3; pose++) {
        const frame = poses[pose];
        let bottom = -1;
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
          const offset = (y * 32 + x) * 4, alpha = frame.rgba[offset + 3];
          expect(alpha === 0 || alpha === 255).toBe(true);
          if (alpha) bottom = Math.max(bottom, y);
          else expect([...frame.rgba.subarray(offset, offset + 4)]).toEqual([0, 0, 0, 0]);
          if (x === 0 || x === 31 || y === 0 || y === 31) expect(alpha).toBe(0);
        }
        expect(bottom, `${sign.id}/${gender}/${direction}/${pose} feet`).toBe(DESIGN.frame.feetBaseline);
      }
      expect(sha(poses[0])).not.toBe(sha(poses[1].mirrored()));
      expect(sha(poses[2])).not.toBe(sha(poses[1].mirrored()));
    }
  });

  it('actual side eyes/noses stay side-facing for every pose and UP is the back of a human head', () => {
    const white = color('#fff8e8');
    const skins = new Set(['#ffc39a', '#dd8c70', '#ffe0b4', '#d89166', '#a85e46', '#f0b981', '#f5bb91', '#cc8269', '#ffdeb0'].map(value => color(value).slice(0, 3).join(',')));
    const pixel = (frame: Pixels, x: number, y: number): number[] => [...frame.rgba.subarray((y * 32 + x) * 4, (y * 32 + x) * 4 + 4)];
    for (const sign of DESIGN.signs) for (const gender of ['male', 'female'] as const) for (const pose of [0, 1, 2] as const) {
      const left = renderFrame(sign.id, gender, 'left', pose), right = renderFrame(sign.id, gender, 'right', pose), up = renderFrame(sign.id, gender, 'up', pose);
      expect(pixel(right, 22, 12)).toEqual(white);
      expect(pixel(left, 9, 12)).toEqual(white);
      expect(skins.has(pixel(right, 23, 13).slice(0, 3).join(','))).toBe(true);
      expect(skins.has(pixel(left, 8, 13).slice(0, 3).join(','))).toBe(true);
      for (let y = 10; y < 16; y++) for (let x = 10; x < 22; x++) expect(skins.has(pixel(up, x, y).slice(0, 3).join(',')), `${sign.id}/${gender} UP must not contain central face skin`).toBe(false);
    }
  });

  it('all12 actual front head silhouettes differ and male/female share their exact sign palette', () => {
    const headMasks = [];
    for (const sign of DESIGN.signs) {
      const male = renderFrame(sign.id, 'male', 'down', 1), female = renderFrame(sign.id, 'female', 'down', 1);
      const alpha = [];
      for (let y = 0; y < 18; y++) for (let x = 0; x < 32; x++) alpha.push(male.rgba[(y * 32 + x) * 4 + 3]);
      headMasks.push(createHash('sha256').update(Buffer.from(alpha)).digest('hex'));
      expect(male.rgba.equals(female.rgba)).toBe(false);
      for (const gender of ['male', 'female'] as const) for (const direction of DIRECTIONS) {
        const frame = renderFrame(sign.id, gender, direction, 1), primary = Buffer.from(color(sign.palette.primary));
        let primaryPixels = 0;
        for (let index = 0; index < frame.rgba.length; index += 4) if (frame.rgba.subarray(index, index + 4).equals(primary)) primaryPixels++;
        expect(primaryPixels, `${sign.id}/${gender}/${direction} primary identity`).toBeGreaterThan(0);
      }
    }
    expect(new Set(headMasks).size).toBe(12);
  });

  it('preserves the24 current texture IDs and collection name while using separate v2 resources', () => {
    const before = JSON.parse(readFileSync(path.join(root, 'public/wokas/varcamp-zodiac-v1/collection.template.json'), 'utf8'));
    const after = JSON.parse(readFileSync(path.join(candidate, 'collection.template.json'), 'utf8'));
    expect(after).toEqual(before);
    expect(after.assetBaseUrl).toBeNull();
    expect(new Set(after.collection.textures.map((row: { id: string }) => row.id)).size).toBe(24);
  });
});
