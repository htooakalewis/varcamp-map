import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { DESIGN, DIRECTIONS, Pixels, buildPixelPackage, characterFor, color, png, renderFrame, renderSheet, type Pose } from '../tools/wokas/pixel-v3';

const root = path.resolve(import.meta.dirname, '..');
const candidate = path.join(root, 'public/wokas/varcamp-zodiac-v3');
const GENDERS = ['male', 'female'] as const;
const sha = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const pixel = (frame: Pixels, x: number, y: number): number[] => [...frame.rgba.subarray((y * 32 + x) * 4, (y * 32 + x) * 4 + 4)];
const same = (a: Pixels, b: Pixels): number => { let n = 0; for (let i = 0; i < a.rgba.length; i += 4) if (a.rgba.readUInt32BE(i) !== b.rgba.readUInt32BE(i)) n++; return n; };

describe('pixel v3 zodiac WOKA sheet contract', () => {
  it('all 24 PNGs are exact 96x128 RGBA sheets that replay byte-exact from the templates', async () => {
    const manifest = JSON.parse(readFileSync(path.join(candidate, 'manifest.json'), 'utf8'));
    expect(manifest.version).toBe(3);
    expect(manifest.format).toEqual({ sheet: [96, 128], frame: [32, 32], rows: ['down', 'left', 'right', 'up'], poseOrder: ['stride-a', 'idle', 'stride-b'], footBaseline: 30, walk: { rate: 10, frames: [0, 1, 2, 1] } });
    expect(manifest.source.sha256).toBe(sha(readFileSync(path.join(root, 'tools/wokas/pixel-v3.ts'))));
    expect(manifest.source.designSha256).toBe(sha(readFileSync(path.join(root, 'art/source/wokas-pixel-v3/native-design.json'))));
    expect(manifest.assets).toHaveLength(24);
    for (const sign of DESIGN.signs) for (const gender of GENDERS) {
      const file = `${sign.id}-${gender}.png`, raw = readFileSync(path.join(candidate, file));
      const image = sharp(raw), metadata = await image.metadata();
      expect([metadata.width, metadata.height, metadata.channels]).toEqual([96, 128, 4]);
      const source = renderSheet(sign.id, gender);
      expect(await image.ensureAlpha().raw().toBuffer()).toEqual(source.rgba);
      expect(await png(source)).toEqual(raw);
      const receipt = manifest.assets.find((row: { file: string }) => row.file === file);
      expect(receipt).toMatchObject({ id: `varcamp-zodiac-v1-${sign.id}-${gender}`, sign: sign.id, gender, bytes: raw.length, sha256: sha(raw), rgbaSha256: sha(source.rgba) });
    }
  });

  it('all 288 frames have binary alpha, a clear 1px border, feet on row 30 and three distinct poses', () => {
    for (const sign of DESIGN.signs) for (const gender of GENDERS) for (const direction of DIRECTIONS) {
      const poses = [0, 1, 2].map(pose => renderFrame(sign.id, gender, direction, pose as Pose));
      expect(new Set(poses.map(frame => sha(frame.rgba))).size, `${sign.id}/${gender}/${direction} poses`).toBe(3);
      // Walk frames are real paintings: neither stride is the idle frame or its mirror.
      for (const stride of [poses[0], poses[2]]) {
        expect(same(stride, poses[1]), `${sign.id}/${gender}/${direction} stride vs idle`).toBeGreaterThan(20);
        expect(stride.rgba.equals(poses[1].mirrored().rgba)).toBe(false);
      }
      expect(same(poses[0], poses[2]), `${sign.id}/${gender}/${direction} stride-a vs stride-b`).toBeGreaterThan(6);
      for (const [pose, frame] of poses.entries()) {
        let bottom = -1;
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
          const offset = (y * 32 + x) * 4, alpha = frame.rgba[offset + 3];
          expect(alpha === 0 || alpha === 255).toBe(true);
          if (alpha) bottom = Math.max(bottom, y);
          else expect([...frame.rgba.subarray(offset, offset + 4)]).toEqual([0, 0, 0, 0]);
          if (x === 0 || x === 31 || y === 0 || y === 31) expect(alpha, `${sign.id}/${gender}/${direction}/${pose} border ${x},${y}`).toBe(0);
        }
        expect(bottom, `${sign.id}/${gender}/${direction}/${pose} feet`).toBe(DESIGN.frame.feetBaseline);
      }
    }
  });

  it('front idle silhouettes sit inside the written size target', async () => {
    const target = DESIGN.frame.frontTarget;
    for (const sign of DESIGN.signs) for (const gender of GENDERS) {
      const rgba = await sharp(path.join(candidate, `${sign.id}-${gender}.png`)).ensureAlpha().raw().toBuffer();
      let left = 32, top = 32, right = -1, bottom = -1;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (rgba[(y * 96 + x + 32) * 4 + 3]) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      const width = right - left + 1, height = bottom - top + 1;
      expect.soft(width, `${sign.id}/${gender} width`).toBeGreaterThanOrEqual(target.minimumWidth);
      expect.soft(width, `${sign.id}/${gender} width`).toBeLessThanOrEqual(target.maximumWidth);
      expect.soft(height, `${sign.id}/${gender} height`).toBeGreaterThanOrEqual(target.minimumHeight);
      expect.soft(height, `${sign.id}/${gender} height`).toBeLessThanOrEqual(target.maximumHeight);
    }
  });
});

describe('pixel v3 zodiac readability', () => {
  it('every DOWN frame shows the complete 7x7 glyph on a parchment badge with a separate rim', () => {
    const { x: bx, y: by, glyphX, glyphY } = DESIGN.badge, fill = color(DESIGN.badge.fill);
    for (const sign of DESIGN.signs) for (const gender of GENDERS) for (const pose of [0, 1, 2] as const) {
      const frame = renderFrame(sign.id, gender, 'down', pose), ch = characterFor(sign.id, gender), dy = pose === 1 ? 0 : 1;
      const rim = pixel(frame, bx + 4, by + dy);
      expect(rim).not.toEqual([...ch.glyphInk]);
      expect(rim).not.toEqual([...fill]);
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        expect(pixel(frame, glyphX + x, glyphY + y + dy), `${sign.id}/${gender}/${pose} glyph ${x},${y}`).toEqual(sign.glyph[y][x] === '#' ? [...ch.glyphInk] : [...fill]);
      }
    }
  });

  it('glyph ink contrasts strongly with the parchment for every sign', () => {
    const luminance = ([r, g, b]: readonly number[]): number => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    for (const sign of DESIGN.signs) {
      const ink = characterFor(sign.id, 'male').glyphInk;
      expect(luminance(color(DESIGN.badge.fill)) - luminance(ink), sign.id).toBeGreaterThan(0.6);
    }
  });

  it('all 12 glyphs are pairwise distinguishable (at least 6 differing pixels)', () => {
    for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) {
      const ga = DESIGN.signs[a].glyph.join(''), gb = DESIGN.signs[b].glyph.join('');
      let diff = 0; for (let i = 0; i < ga.length; i++) if (ga[i] !== gb[i]) diff++;
      expect(diff, `${DESIGN.signs[a].id} vs ${DESIGN.signs[b].id}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('each sign accessory is painted in every direction for both genders', () => {
    for (const sign of DESIGN.signs) for (const gender of GENDERS) for (const direction of DIRECTIONS) {
      const withAccessory = renderFrame(sign.id, gender, direction, 1), without = renderFrame(sign.id, gender, direction, 1, { accessory: false });
      expect(same(withAccessory, without), `${sign.id}/${gender}/${direction} accessory pixels`).toBeGreaterThanOrEqual(8);
    }
  });

  it('side frames face their direction and UP frames show the back of the head', () => {
    const highlight = [...color('#fffaf0')];
    for (const sign of DESIGN.signs) for (const gender of GENDERS) for (const pose of [0, 1, 2] as const) {
      const dy = pose === 1 ? 0 : 1;
      const right = renderFrame(sign.id, gender, 'right', pose), left = renderFrame(sign.id, gender, 'left', pose), up = renderFrame(sign.id, gender, 'up', pose);
      expect(pixel(right, 18, 10 + dy), `${sign.id}/${gender} right eye`).toEqual(highlight);
      expect(pixel(left, 13, 10 + dy), `${sign.id}/${gender} left eye`).toEqual(highlight);
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) expect(pixel(up, x, y), `${sign.id}/${gender} UP has no eye`).not.toEqual(highlight);
    }
  });

  it('front head silhouettes are distinct across signs and male/female differ', () => {
    const masks = new Set<string>();
    for (const sign of DESIGN.signs) {
      const male = renderFrame(sign.id, 'male', 'down', 1), female = renderFrame(sign.id, 'female', 'down', 1);
      expect(same(male, female), `${sign.id} male vs female`).toBeGreaterThan(40);
      const alpha: number[] = [];
      for (let y = 0; y < 17; y++) for (let x = 0; x < 32; x++) alpha.push(male.rgba[(y * 32 + x) * 4 + 3]);
      masks.add(sha(Buffer.from(alpha)));
    }
    expect(masks.size).toBe(12);
  });

  it('outlines are hue-shifted material darks: no pure #000000 pixel anywhere', () => {
    for (const file of readdirSync(candidate).filter(name => name.endsWith('.png'))) {
      const sheet = renderSheet(file.split('-')[0], file.includes('female') ? 'female' : 'male');
      for (let i = 0; i < sheet.rgba.length; i += 4) if (sheet.rgba[i + 3]) expect(sheet.rgba.readUInt32BE(i) >>> 8, file).not.toBe(0);
    }
  });
});

describe('pixel v3 package', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'varcamp-pixel-v3-'));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  it('regenerates deterministically: a fresh build matches the committed package byte for byte', async () => {
    await buildPixelPackage(scratch);
    const committed = readdirSync(candidate).sort();
    expect(readdirSync(scratch).sort()).toEqual(committed);
    for (const file of committed) expect(readFileSync(path.join(scratch, file)).equals(readFileSync(path.join(candidate, file))), file).toBe(true);
  });

  it('keeps the 24 existing texture IDs and collection name; only URLs move to v3', () => {
    const v2 = JSON.parse(readFileSync(path.join(root, 'public/wokas/varcamp-zodiac-v2/collection.template.json'), 'utf8'));
    const v3 = JSON.parse(readFileSync(path.join(candidate, 'collection.template.json'), 'utf8'));
    expect(v3).toEqual(v2);
    expect(v3.assetBaseUrl).toBeNull();
    expect(new Set(v3.collection.textures.map((row: { id: string }) => row.id)).size).toBe(24);
  });
});
