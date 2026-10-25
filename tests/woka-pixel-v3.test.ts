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
  }, 30_000);

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
        // Collect violations and assert once per frame (keeps the 295k-pixel scan fast).
        let bottom = -1;
        const problems: string[] = [];
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
          const offset = (y * 32 + x) * 4, alpha = frame.rgba[offset + 3];
          if (alpha !== 0 && alpha !== 255) problems.push(`soft alpha ${x},${y}`);
          if (alpha) bottom = Math.max(bottom, y);
          else if (frame.rgba.readUInt32BE(offset) !== 0) problems.push(`dirty transparent ${x},${y}`);
          if ((x === 0 || x === 31 || y === 0 || y === 31) && alpha) problems.push(`border ${x},${y}`);
        }
        expect(problems, `${sign.id}/${gender}/${direction}/${pose}`).toEqual([]);
        expect(bottom, `${sign.id}/${gender}/${direction}/${pose} feet`).toBe(DESIGN.frame.feetBaseline);
      }
    }
  }, 30_000);

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
  it('every DOWN frame shows the complete 7x7 light glyph on a tight dark crest', () => {
    const { x: bx, y: by, glyphX, glyphY } = DESIGN.badge;
    for (const sign of DESIGN.signs) for (const gender of GENDERS) for (const pose of [0, 1, 2] as const) {
      const frame = renderFrame(sign.id, gender, 'down', pose), ch = characterFor(sign.id, gender), dy = pose === 1 ? 0 : 1;
      const field = [...ch.palette.X];
      // One-pixel crest margin on all four sides of the glyph cell.
      for (const [x, y] of [[bx + 4, by], [bx + 4, by + 8], [bx, by + 4], [bx + 8, by + 4]]) expect(pixel(frame, x, y + dy), `${sign.id}/${gender}/${pose} margin`).toEqual(field);
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        expect(pixel(frame, glyphX + x, glyphY + y + dy), `${sign.id}/${gender}/${pose} glyph ${x},${y}`).toEqual(sign.glyph[y][x] === '#' ? [...ch.glyphInk] : field);
      }
    }
  });

  it('the crest has no mid-tones: light glyph on a near-black field for every sign', () => {
    const luminance = ([r, g, b]: readonly number[]): number => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    for (const sign of DESIGN.signs) {
      const ch = characterFor(sign.id, 'male');
      expect(luminance(ch.palette.X), sign.id).toBeLessThan(0.15);
      expect(luminance(ch.glyphInk) - luminance(ch.palette.X), sign.id).toBeGreaterThan(0.75);
    }
  });

  it('rendered glyphs are pairwise distinct: Hamming >= 8 and >= 5 under any 1px misalignment', () => {
    const { glyphX, glyphY } = DESIGN.badge;
    // Read each glyph back from the actual rendered DOWN idle frame.
    const bits = DESIGN.signs.map(sign => {
      const frame = renderFrame(sign.id, 'male', 'down', 1), ink = [...characterFor(sign.id, 'male').glyphInk];
      return Array.from({ length: 7 }, (_, y) => Array.from({ length: 7 }, (_, x) => pixel(frame, glyphX + x, glyphY + y).join() === ink.join()));
    });
    DESIGN.signs.forEach((sign, i) => expect(bits[i].map(r => r.map(v => (v ? '#' : '.')).join('')), sign.id).toEqual(sign.glyph));
    const distance = (a: boolean[][], b: boolean[][], dx: number, dy: number): number => {
      let d = 0;
      for (let y = -1; y < 8; y++) for (let x = -1; x < 8; x++) if ((a[y]?.[x] ?? false) !== (b[y + dy]?.[x + dx] ?? false)) d++;
      return d;
    };
    const facts: string[] = [];
    for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) {
      const pair = `${DESIGN.signs[a].id}/${DESIGN.signs[b].id}`;
      let shifted = Infinity;
      for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) shifted = Math.min(shifted, distance(bits[a], bits[b], dx, dy));
      facts.push(`${pair}:${distance(bits[a], bits[b], 0, 0)}/${shifted}`);
      expect(distance(bits[a], bits[b], 0, 0), pair).toBeGreaterThanOrEqual(8);
      expect(shifted, `${pair} shifted`).toBeGreaterThanOrEqual(5);
    }
    expect(facts.find(f => f.startsWith('virgo/scorpio'))).toBeDefined();
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
      let eyes = 0;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (pixel(up, x, y).join() === highlight.join()) eyes++;
      expect(eyes, `${sign.id}/${gender} UP has no eye`).toBe(0);
    }
  });

  it('all 24 characters wear distinct hairstyles (hair-pixel masks differ by at least 12 pixels)', () => {
    expect(new Set(DESIGN.signs.flatMap(sign => [sign.male.hair, sign.female.hair])).size).toBe(24);
    const masks: { id: string; mask: boolean[] }[] = [];
    for (const sign of DESIGN.signs) for (const gender of GENDERS) {
      const pal = characterFor(sign.id, gender).palette, hairColours = new Set(['O', 'g', 'h', 'H'].map(key => pal[key].join()));
      const mask: boolean[] = [];
      for (const direction of ['down', 'right', 'up'] as const) {
        const frame = renderFrame(sign.id, gender, direction, 1, { accessory: false });
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) mask.push(hairColours.has(pixel(frame, x, y).join()));
      }
      masks.push({ id: `${sign.id}/${gender}`, mask });
    }
    for (let a = 0; a < masks.length; a++) for (let b = a + 1; b < masks.length; b++) {
      let diff = 0; for (let i = 0; i < masks[a].mask.length; i++) if (masks[a].mask[i] !== masks[b].mask[i]) diff++;
      expect(diff, `${masks[a].id} vs ${masks[b].id}`).toBeGreaterThanOrEqual(12);
    }
  });

  it('outfits vary: men wear coats or vests, women dresses or tunics, each with accent trim', () => {
    const garments = DESIGN.signs.flatMap(sign => [sign.male.garment, sign.female.garment]);
    for (const garment of ['coat', 'vest', 'dress', 'tunic']) expect(garments.filter(g => g === garment).length, garment).toBeGreaterThanOrEqual(4);
    for (const sign of DESIGN.signs) for (const gender of GENDERS) for (const direction of DIRECTIONS) {
      const frame = renderFrame(sign.id, gender, direction, 1), accent = characterFor(sign.id, gender).palette['6'].join();
      let accentPixels = 0;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (pixel(frame, x, y).join() === accent) accentPixels++;
      expect(accentPixels, `${sign.id}/${gender}/${direction} accent trim`).toBeGreaterThanOrEqual(8);
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
      let black = 0;
      for (let i = 0; i < sheet.rgba.length; i += 4) if (sheet.rgba[i + 3] && sheet.rgba.readUInt32BE(i) >>> 8 === 0) black++;
      expect(black, file).toBe(0);
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
