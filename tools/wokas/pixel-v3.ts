/** VarCamp zodiac WOKAs v3: original native 32px RPG pixel sprites.
 *
 * Every pixel is painted from the hand-authored ASCII templates in this file,
 * resolved through literal palettes from art/source/wokas-pixel-v3/native-design.json.
 * Templates are layered: hair-back, accessory-back, legs, torso, head,
 * hair-front, accessory-front, chest badge. LEFT frames mirror RIGHT frames.
 * No stock or generated sprite pixels are sampled, traced or composited.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DESIGN_PATH = 'art/source/wokas-pixel-v3/native-design.json';
export const OUTPUT_DIR = 'public/wokas/varcamp-zodiac-v3';
export const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
export type Direction = typeof DIRECTIONS[number];
export type View = 'down' | 'right' | 'up';
export type Gender = 'male' | 'female';
export type Pose = 0 | 1 | 2;
export type RGBA = readonly [number, number, number, number];
export const HAIR_STYLES = ['tousled', 'crop', 'spiky', 'curly', 'mane', 'swept', 'slick', 'topknot', 'shaggy', 'buzz', 'wavy', 'lowtail',
  'long', 'bob', 'twintail', 'hightail', 'lionmane', 'buns', 'hime', 'braid', 'pixie', 'curlylong', 'waves', 'sidetail'] as const;
type HairStyle = typeof HAIR_STYLES[number];
interface Look { hair: HairStyle; hairColor: string; skin: number; eyes: string; garment: string }
export interface SignDesign {
  id: string; title: string;
  palette: { primary: string; shade: string; light: string };
  trim: string; pants: string; accent: string;
  accessory: { description: string; ramp: string };
  male: Look; female: Look;
  glyph: string[];
}
export interface NativeDesign {
  schema: string;
  frame: { width: number; height: number; rows: string[]; poseOrder: string[]; sheet: { width: number; height: number }; frontTarget: { minimumWidth: number; maximumWidth: number; minimumHeight: number; maximumHeight: number }; feetBaseline: number };
  badge: { x: number; y: number; size: number; glyphX: number; glyphY: number; glyph: string; fieldLightness: number };
  skins: { id: string; ramp: [string, string, string, string]; mouth: string; blush: string }[];
  eyes: Record<string, string>;
  signs: SignDesign[];
}

export const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'] as const;
export const DESIGN = JSON.parse(await readFile(path.join(ROOT, DESIGN_PATH), 'utf8')) as NativeDesign;
if (DESIGN.schema !== 'varcamp-native-pixel-woka-design-v3' || DESIGN.frame.width !== 32 || DESIGN.frame.height !== 32 || JSON.stringify(DESIGN.signs.map(x => x.id)) !== JSON.stringify(SIGNS)) throw new Error('Exact reviewed v3 design required');
for (const sign of DESIGN.signs) if (sign.glyph.length !== 7 || sign.glyph.some(row => !/^[.#]{7}$/.test(row))) throw new Error(`Exact 7x7 glyph required for ${sign.id}`);
{ // Every one of the 24 characters wears its own hairstyle.
  const styles = DESIGN.signs.flatMap(sign => [sign.male.hair, sign.female.hair]);
  if (new Set(styles).size !== 24 || styles.some(style => !(HAIR_STYLES as readonly string[]).includes(style))) throw new Error('24 distinct known hairstyles required');
}

// ---------------------------------------------------------------- colour --
export function color(hex: string): RGBA {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`Literal opaque RGB palette required: ${hex}`);
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
}
function toHsl([r, g, b]: RGBA): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h: number, s: number, l: number): RGBA {
  h = ((h % 360) + 360) % 360; s = Math.min(1, Math.max(0, s)); l = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255), 255];
}
/** Rotate hue toward a target by at most `amount` degrees (hue shifting). */
function towards(h: number, target: number, amount: number): number {
  const delta = ((target - h + 540) % 360) - 180;
  return h + Math.sign(delta) * Math.min(Math.abs(delta), amount);
}
/** Four-tone material ramp lit from the top left: [outline, shade, base, light].
 * Shadows shift toward violet-blue, lights toward warm yellow, outlines are
 * dark hue-shifted versions of the material rather than pure black. */
export function ramp(hex: string): [RGBA, RGBA, RGBA, RGBA] {
  const base = color(hex), [h, s, l] = toHsl(base);
  const light = fromHsl(towards(h, 55, 12), s * 0.95, l + (1 - l) * 0.38);
  const shade = fromHsl(towards(h, 250, 14), Math.min(1, s * 1.08 + 0.04), l * 0.74);
  const outline = fromHsl(towards(h, 265, 24), Math.min(1, s * 0.85 + 0.1), Math.max(0.07, l * 0.36));
  return [outline, shade, base, light];
}

/** Even blend of two literal palette colours (used for the soft mouth tone). */
function mix(a: RGBA, b: RGBA): RGBA { return [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2), Math.round((a[2] + b[2]) / 2), 255]; }

// ---------------------------------------------------------------- pixels --
export class Pixels {
  readonly rgba: Buffer;
  constructor(readonly width = 32, readonly height = 32) { this.rgba = Buffer.alloc(width * height * 4); }
  px(x: number, y: number, fill: RGBA): void {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.width || y >= this.height) throw new Error(`Native pixel outside canvas: ${x},${y}`);
    const o = (y * this.width + x) * 4;
    this.rgba[o] = fill[0]; this.rgba[o + 1] = fill[1]; this.rgba[o + 2] = fill[2]; this.rgba[o + 3] = fill[3];
  }
  get(x: number, y: number): RGBA {
    const o = (y * this.width + x) * 4;
    return [this.rgba[o], this.rgba[o + 1], this.rgba[o + 2], this.rgba[o + 3]];
  }
  rect(x: number, y: number, width: number, height: number, fill: RGBA): void {
    for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) this.px(xx, yy, fill);
  }
  over(source: Pixels, x = 0, y = 0): void {
    for (let yy = 0; yy < source.height; yy++) for (let xx = 0; xx < source.width; xx++) {
      const i = (yy * source.width + xx) * 4;
      if (source.rgba[i + 3]) this.px(x + xx, y + yy, [source.rgba[i], source.rgba[i + 1], source.rgba[i + 2], source.rgba[i + 3]]);
    }
  }
  mirrored(): Pixels {
    const output = new Pixels(this.width, this.height);
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const i = (y * this.width + x) * 4;
      output.px(this.width - 1 - x, y, [this.rgba[i], this.rgba[i + 1], this.rgba[i + 2], this.rgba[i + 3]]);
    }
    return output;
  }
}

// ------------------------------------------------------------- templates --
/** A template is a block of 32-column rows starting at frame row `y`.
 * Rows are written either as full 32-character rows or as `x:tokens`, where
 * `x` is the first column and tokens are literal runs (`OhhgO`) or repeats
 * (`h*7`), separated by spaces. '.' leaves a pixel untouched; every other
 * character is a palette key resolved per character (see `characterFor`). */
interface Template { y: number; rows: string[] }
type Layer = Template | Template[] | undefined;
function row(spec: string): string {
  const match = /^(\d+):(.*)$/.exec(spec);
  const body = match ? '.'.repeat(Number(match[1])) + match[2].split(' ').filter(Boolean).map(token => {
    const repeat = /^(.)\*(\d+)$/.exec(token);
    return repeat ? repeat[1].repeat(Number(repeat[2])) : token;
  }).join('') : spec;
  if (body.length > 32) throw new Error(`Template row wider than 32 columns (${body.length}): ${spec}`);
  return body.padEnd(32, '.');
}
function T(y: number, ...specs: string[]): Template { return { y, rows: specs.map(row) }; }
/** Mirror the left half onto the right about the body axis x=15. */
function sym(template: Template): Template {
  return { y: template.y, rows: template.rows.map(line => {
    const out = line.split('');
    for (let x = 0; x < 15; x++) if (line[x] !== '.' && out[30 - x] === '.') out[30 - x] = line[x];
    return out.join('');
  }) };
}
/** Full horizontal mirror about the body axis x=15. */
function flip(template: Template): Template {
  return { y: template.y, rows: template.rows.map(line => {
    const out = Array<string>(32).fill('.');
    for (let x = 0; x < 31; x++) out[30 - x] = line[x];
    if (line[31] !== '.') throw new Error('Cannot flip a pixel in column 31');
    return out.join('');
  }) };
}
function shift(template: Template, dx: number, dy = 0): Template {
  return { y: template.y + dy, rows: template.rows.map(line => {
    const out = Array<string>(32).fill('.');
    for (let x = 0; x < 32; x++) if (line[x] !== '.') {
      if (x + dx < 0 || x + dx > 31) throw new Error('Shift moves a pixel off the frame');
      out[x + dx] = line[x];
    }
    return out.join('');
  }) };
}

// Palette keys
//  hair      O outline  g shade  h base  H light
//  skin      o outline  d shade  s base  S light   r blush  m mouth
//  eyes      E lash/pupil  e iris  i lower iris  w highlight
//  coat      K outline  c shade  a base  A light   (sign colour)
//  trim      t shade  T light (shirt, cuffs, collar, cap band)
//  trousers  q outline  p shade  P base
//  boots     j outline  k shade  b base  n light   (also leather quiver)
//  belt      L strap  l buckle
//  gold      z shade  y base  Y light
//  accessory 1 outline 2 shade 3 base 4 light   (sign accessory ramp)
//  gem       7 red  8 highlight
//  sleeves   F light  f base  G shade   (coat colours, or shirt for vest/tunic)
//  accent    5 shade  6 base  9 light   (scarf, cuffs, hem trim, sash)
//  crest     X near-black field  (light glyph painted separately)

// ----- heads -----
const HEAD: Record<View, Template> = {
  down: T(4,
    '9:o*13',
    '8:o S S s*11 o',
    '8:o S s*11 d o',
    '8:o s*12 d o',
    '8:o s*12 d o',
    '7:o d s s E E s*5 E E s d d o',
    '7:o d s s w E s*5 w E s d d o',
    '8:o S s e e s*5 e e s d o',
    '8:o s r i i s*5 i i r d o',
    '8:o s*12 d o',
    '8:o s*6 m s*5 d o',
    '9:o d s*9 d o',
    '10:o*11',
  ),
  right: T(4,
    '10:o*11',
    '9:o s*11 o',
    '9:o s*12 o',
    '9:o s*12 o',
    '9:o s*12 o',
    '9:o s*8 E E s s o',
    '9:o s*8 w E s s o',
    '9:o s*8 e e s s o',
    '9:o s*8 i i s*3 o',
    '11:o s*5 r s*4 o',
    '11:o s*8 m o',
    '12:o d s*5 d o',
    '13:o*7',
  ),
  // Back of the head: the skull is painted in hair shade so no face skin can
  // show through; only the nape and neck are skin.
  up: T(4,
    '9:g*13',
    '8:g*15', '8:g*15', '8:g*15', '8:g*15', '8:g*15', '8:g*15',
    '9:g*13', '9:g*13',
    '10:g*11',
    '11:o d*7 o',
    '11:o d*7 o',
    '12:o*7',
  ),
};
const FEMALE_LASH = T(9, '10:E.........E');

// ----- hair -----
type HairSet = { front: Partial<Record<View, Layer>>; back?: Partial<Record<View, Layer>> };
const PARTED_TOP = T(1,
  '12:O*7',
  '10:O O h H H h h h h O O',
  '8:O O h H H H h*7 O O',
  '7:O h H H H h*10 g O',
  '6:O h H H h*12 g g O',
  '6:O h H h*6 g h*7 g O',
  '6:O h H h*5 g d g h*6 g O',
  '6:O h H h h g O d*5 O g h h h g O',
);
const SMOOTH_SIDE = T(1,
  '10:O*6',
  '9:O h H H h h h O O',
  '8:O h H H H h*5 O O',
  '7:O h H H h*9 O',
  '7:O h H h*11 O',
  '6:O h H h*12 g O',
  '6:O h*14 g O',
  '6:O h*11 g h g d o',
);
const EAR_SIDE = T(9,
  '6:O h*5 O d d o',
  '6:O h*5 O d s o',
  '6:O h*5 O o o',
  '6:O h*4 g O',
  '7:O g g g O',
);
const SMOOTH_BACK_TOP = T(1,
  '12:O*7',
  '10:O O h H H h h h h O O',
  '8:O O h H H H h*7 O O',
  '7:O h H H H h*10 g O',
  '6:O h H H h*12 g g O',
  '6:O h H h*13 g g O',
  '6:O h H h*4 g h*8 g g O',
  '6:O h h h h g h h h h h g h h h h g g O',
);
const TWIN_TAIL = T(4,
  '4:O O',
  '3:O h H O',
  '2:O h H h 3',
  '2:O h h g 3',
  '1:O h H h g O',
  '1:O h h h g O',
  '1:O h H g g O',
  '1:O h h g O',
  '1:O h g g O',
  '2:O h g O',
  '2:O h g O',
  '2:O g g O',
  '3:O g O',
  '4:O',
);
const BRAID = (y: number, x: number, length: number): Template => {
  const rows: string[] = [];
  for (let i = 0; i < length; i++) rows.push(`${x}:${i % 2 ? 'O g h h O' : 'O h H g O'}`);
  rows.push(`${x}:O 3 3 3 O`, `${x + 1}:O h O`, `${x + 1}:O g O`, `${x + 2}:O`);
  return T(y, ...rows);
};

// Shared hair parts. Each of the 24 characters gets its own style id (see
// native-design.json); styles are assembled from tops, sides and tails.
const BANGS_TOP = T(1,
  '12:O*7',
  '10:O O h H H h h h h O O',
  '8:O O h H H H h*7 O O',
  '7:O h H H H h*10 g O',
  '6:O h H H h*12 g g O',
  '6:O h H h*13 g g O',
  '6:O h H h*13 g g O',
  '6:O h h g*13 h g O',
);
const BANGS_SIDE = T(1,
  '10:O*6',
  '9:O h H H h h h O O',
  '8:O h H H H h*5 O O',
  '7:O h H H h*9 O',
  '7:O h H h*11 O',
  '6:O h H h*12 g O',
  '6:O h*14 g O',
  '6:O h*11 g g g g O',
);
const SHORT_SIDES = T(9, '6:Ohhg...........ghhO', '7:Ohg...........ghO', '7:Og.............gO');
const SHORT_BACK = T(9,
  '6:O h h h g h h h h h h g h h h g g g O',
  '7:O h h g h h h h h h h g h h g g O',
  '8:O g h g h h h h h g h g g g O',
  '9:O g*11 O',
  '10:O*11',
);
const LONG_SIDES = T(9,
  '6:Ohhg...........ghhO',
  '6:OhHg...........ghhO',
  '6:Ohhg...........ghhO',
  '6:OhHg...........gghO',
  '6:Ohhg...........ghhO',
  '6:Ohhg...........ghhO',
  '6:OhhgO.........OghhO',
  '6:OhHhO.........OhhhO',
  '6:OhhgO.........OghhO',
  '6:OghgO.........OghgO',
  '7:OgO...........OgO',
  '8:O.............O',
);
const LONG_SIDE_VIEW = T(9,
  '6:O h*7 g O',
  '6:O h H h*5 g O',
  '6:O h*7 g O',
  '6:O h H h*4 g O',
  '6:O h*6 g O',
  '7:O h*5 g O',
  '7:O h*4 g O',
  '8:O g g g O',
);
const LONG_BACK_LAYER = T(9,
  '5:O h*6 g O',
  '5:O h H h h h g g O',
  '5:O h*5 g g O',
  '5:O h H h h h g g O',
  '5:O h h g h g g g O',
  '5:O h H h g g g O',
  '5:O h h g h g O',
  '5:O h h g g g O',
  '5:O h g h g O',
  '5:O h g g O',
  '6:O g O',
  '6:O.O',
);
// Back view of long hair: strand clusters separated by shade lines, a sheen
// band of highlights, and a jagged tip line.
const LONG_BACK = T(9,
  '6:O h H h g h h H h g h h H h g h h g O',
  '6:O h h h g h h h h g h h h h g h g g O',
  '6:O h h g h h h h g h h h h g h h g g O',
  '6:O h h g h h h g h h h h g h h h g g O',
  '6:O h H g h h h g h h H h g h h g g g O',
  '6:O h h g h H h g h h h h g h h g g g O',
  '6:O h h g h h h g h h h g h h h g g g O',
  '6:O g h g h h g h h h g h h h g g g g O',
  '6:O g h g h h g h h h g h h g g g g g O',
  '7:O g h g h g h h g h h g h g g g O',
  '7:O g g O g h g O g h g O g g g g O',
  '8:O..OgO.OgO..O',
);
const WAVY_SIDES = T(9,
  '6:Ohhg...........ghhO',
  '6:Oghh...........hhgO',
  '6:Ohhg...........ghhO',
  '6:OghhO.........OhhgO',
  '7:OhgO.........OghO',
  '7:OgO...........OgO',
);
// Long waves: the silhouette swings out and back every three rows.
const WAVE_LONG_SIDES = T(9,
  '6:Ohhg...........ghhO',
  '5:OhHhg...........ghHhO',
  '5:Ohhgg...........gghhO',
  '6:Ohhg...........ghhO',
  '6:OhhgO.........OghhO',
  '5:OhHhgO.........OghHhO',
  '5:OhhggO.........OgghhO',
  '6:OhhgO.........OghhO',
  '6:OhhgO.........OghhO',
  '5:OhHgg...........ggHhO',
  '6:OggO...........OggO',
  '7:OO.............OO',
);
const WAVE_BACK = T(9,
  '6:O h H h g h h H h g h h H h g h h g O',
  '5:O h h h g h h h h g h h h h g h h g g O',
  '5:O h h g h h h h g h h h h g h h h g g O',
  '6:O h g h h h g h h h h g h h h g g O O',
  '6:O h g h h h g h h h h g h h h g g g O',
  '5:O h H g h h h g h h H h g h h h g g g O',
  '5:O h h g h H h g h h h h g h h h g g g O',
  '6:O h g h h h g h h h g h h h g g g g O',
  '6:O g g h h g h h h g h h h g g g g g O',
  '5:O g h g h h g h h h g h h h g h g g g O',
  '6:O g O g g O g g O g g O g g O g g g O',
  '7:O...O...O...O...O',
);
const CURLY_DOWN = T(1,
  '10:O O . O O . O O . O O',
  '8:O O h H O h h O h h O h g O O',
  '7:O h H h g h H h g h h h g h h g O',
  '7:O H h g h H h g h H h g h h g g O',
  '6:O h g h H h g h H h g h h h g h g g O',
  '6:O H h g h H h g h H h g h h g h g g O',
  '6:O h g h g h g h g h g h g h g h g g O',
  '6:O g O g d O g d O g d O g d O g O g O',
  '6:Ohg.............ghO',
  '7:Og.............gO',
);
const CURLY_SIDE = T(1,
  '10:O O . O O . O O',
  '8:O O h H O h h O h O O',
  '7:O h H h g h H h g h h O',
  '6:O h H h g h H h g h H h g h O',
  '5:O h g h H h g h H h g h h h g h O',
  '5:O H h g h H h g h H h g h h g h O',
  '5:O h g h g h g h g h g h g h g h g O',
  '5:O g h g h g h g h g h g h g g d d o',
  '5:O h g h g h g O d d o',
  '5:O g h g h g h O d s o',
  '5:O h g h g h g O o o',
  '6:O g h g h g O',
  '7:O g O g O',
);
const CURLY_UP = T(1,
  '10:O O . O O . O O . O O',
  '8:O O h H O h h O h h O h g O O',
  '7:O h H h g h H h g h h h g h h g O',
  '7:O H h g h H h g h H h g h h g g O',
  '6:O h g h H h g h H h g h h h g h g g O',
  '6:O H h g h H h g h H h g h h g h g g O',
  '6:O h g h H h g h H h g h H h g h g g O',
  '6:O H h g h H h g h H h g h h g h g g O',
  '6:O h g h g h g h g h g h g h g h g g O',
  '7:O g h g h g h g h g h g h g g g O',
  '8:O g g h g g h g g h g g g g O',
  '9:O g O g g O g g O g g O O',
);
const BUN_TOP = T(1, '13:O*5', '12:O h H h h g O', '12:O g h h g g O');
const BUN_SIDE = T(4, '4:O O O', '3:O h H h O', '3:O H h g 3', '3:O h g g 3', '4:O O O');
const SIDE_TAIL = T(7,
  '5:O 3 3 O',
  '4:O h H h O',
  '4:O h h g O',
  '4:O h H g O',
  '4:O h h g O',
  '4:O h g g O',
  '5:O h g O',
  '5:O h g O',
  '5:O g g O',
  '5:O g O',
  '6:O',
);
const TOUSLED_DOWN = T(1,
  '11:O.OO.O',
  '9:OOhOhhOhOO',
  '8:OhhHhhHhhhhOO',
  '7:OhHHhHHhhhghhgO',
  '7:OhHHhHhhhghhhhgO',
  '7:OhHhhhhhghhhhhggO',
  '7:OhhhhhghhhhhghhgO',
  '7:OhhghgdhhgdhgdhgO',
  '7:OgO....Og.....OgO',
);
const TOUSLED_SIDE = T(1,
  '11:OO.OO',
  '9:OOhhOhhOO',
  '8:OhhHHhhhhhOO',
  '7:OhhHHHhhhhhhhO',
  '7:OhHHhhhhhghhhhO',
  '6:OhhHhhhhghhhhhhgO',
  '6:O h h h g h*10 g O',
  '6:O h*11 g h g d o',
);
const TOUSLED_UP = T(1,
  '11:O.OO.O',
  '9:OOhOhhOhOO',
  '8:OhhHhhHhhhhOO',
  '7:OhHHhHHhhhghhgO',
  '7:OhHHhHhhhghhhhgO',
  '7:OhHhhhhhghhhhhggO',
  '7:OhHhhhghhhhghhhgO',
  '7:OhhhhghhhhhghhhgO',
  '7:OhhhghhhhhhghhggO',
  '7:OghhhhhghhhhhgggO',
  '8:OgghhhhhhhhhggO',
  '8:OggghhghhghgggO',
  '9:OgggggggggggO',
  '10:OOgOgOgOgOO',
);
const CROP_DOWN = T(2,
  '10:O*9',
  '8:O O h H H H h*5 O O',
  '7:O h H H H h*8 g O',
  '7:O h H H h*10 g O',
  '7:O h H h*11 g g O',
  '7:O h*14 g O',
);
const CROP_SIDE = T(2,
  '9:O*8',
  '8:O h H H H h*4 O O',
  '7:O h H H H h*7 O',
  '7:O h H H h*9 O',
  '6:O h h H h*11 g O',
  '6:O h*14 g O',
  '6:O h*12 g d d o',
);
const CROP_UP = T(2,
  '10:O*9',
  '8:O O h H H H h*5 O O',
  '7:O h H H H h*8 g O',
  '7:O h H H h*10 g O',
  '7:O h H h*11 g g O',
  '7:O h H h*10 g g g O',
  '7:O h h h h g h h h h h h g h g g O',
  '7:O h h h g h h h h h h g h h g g O',
  '7:O g h h g h h h h h g h h g g g O',
  '8:O g g h*9 g g O',
  '8:O g*13 O',
  '9:O*13',
);
const MANE_DOWN = T(1,
  '9:O..O..O..O..O',
  '8:OHOOhOOhOOhOOgO',
  '7:O h H h h H h*9 g O',
  '5:O O h H H h h H H h*9 g O O',
  '5:O h H H h h H h*11 g g O',
  '4:O O h H h*15 g g O O',
  '5:O h H h h h g h h h h g h h h h g h h g O',
  '5:O h h g h g d h h g d h g d h g d h g h O',
  '5:O h h g O...........O g h h O',
  '4:O h h h g O...........O g h h h O',
  '5:O h h g O...........O g h h O',
  '4:O h H h g O...........O g h h h O',
  '5:O h h g O...........O g h h O',
  '5:O h g g O...........O g g h O',
  '6:O g O.............O g O',
  '7:O...............O',
);
const MANE_SIDE = T(1,
  '8:O..O..O..O',
  '7:O H O O h O O h O O h O O',
  '6:O h H h h H h*9 O',
  '4:O O h H H h h H H h*8 O',
  '4:O h H H h h H h*11 O',
  '3:O O h H h*14 g O',
  '4:O h H h*11 g h g h O',
  '4:O h*13 g h d d o',
  '3:O h*8 g O',
  '4:O h*7 g O',
  '3:O h*8 g O',
  '4:O h*6 g g O',
  '4:O h*5 g g O',
  '5:O h g h g g O',
  '5:O g O g O',
  '6:O.O',
);
const MANE_UP = T(1,
  '9:O..O..O..O..O',
  '8:OHOOhOOhOOhOOgO',
  '7:O h H h h H h*9 g O',
  '5:O O h H H h h H H h*9 g O O',
  '5:O h H H h h H h*11 g g O',
  '4:O O h H h*15 g g O O',
  '5:O h H h h h g h h h h g h h h h g h h g O',
  '4:O h h H h h g h h h h h g h h h h h g h g g O',
  '5:O h h g h h h h g h h h h g h h h g h g O',
  '4:O h h h g h h h h g h h h h g h h h g h g g O',
  '5:O h h g h h h h g h h h h g h h h g g g O',
  '4:O h h h g h h h g h h h h h g h h h g g g g O',
  '5:O h g g h h h g h h h h h g h h h g g g O',
  '5:O g g g h h g g h h h h g g h h g g g g O',
  '6:O g g O g g g O g g g O g g g O g g O',
  '7:O...O...O...O...O',
);
const MANE_LOCKS = sym(T(15, '5:O h h g O', '5:O h H g O', '5:O h g g O', '5:O h g O', '6:O g O', '7:O'));

const HAIR: Record<HairStyle, HairSet> = {
  // ---- masculine styles ----
  tousled: { front: { down: TOUSLED_DOWN, right: [TOUSLED_SIDE, EAR_SIDE], up: TOUSLED_UP } },
  crop: { front: {
    down: [CROP_DOWN, T(8, '7:O h g O d d d h*8 g O', '7:Og.............gO')],
    right: [CROP_SIDE, EAR_SIDE],
    up: CROP_UP,
  } },
  spiky: { front: {
    down: T(1,
      '9:O...O...O...O',
      '8:OHO.OhO.OhO.OgO',
      '7:OhHhOhhhOhhhOhggO',
      '7:O h H H h h h h h h h h h h h g O',
      '7:O h H h h h h h h h h h h h g g O',
      '7:O h h h h g h h h h g h h h g g O',
      '7:O h h g h g d h g d h g d h g g O',
      '7:O g O . . O g . . . O g . . . g O',
    ),
    right: [T(1,
      '9:O...O...O',
      '8:OhO.OhO.OhO',
      '7:OhHhOhhhOhhO',
      '6:O h H H h h h h h h h h h h O',
      '6:O h H h h h h h h h h h h h h O',
      '6:O h h h h h g h h h h h h h g O',
      '6:O h*14 g O',
      '6:O h*11 g h g d o',
    ), EAR_SIDE],
    up: [TOUSLED_UP, T(1,
      '9:O...O...O...O',
      '8:OHO.OhO.OhO.OgO',
      '7:OhHhOhhhOhhhOhggO',
    )],
  } },
  curly: { front: { down: CURLY_DOWN, right: CURLY_SIDE, up: CURLY_UP } },
  mane: { front: { down: MANE_DOWN, right: MANE_SIDE, up: MANE_UP } },
  swept: { front: {
    down: [CROP_DOWN, T(8, '7:O h h h h h h g O d d d d d d g O', '7:O h h g O..........gO', '7:O h g O', '7:O g O')],
    right: [CROP_SIDE, T(9, '6:O h*5 O d d o', '6:O h*5 O d s o', '6:O h*5 O o o', '6:O h*5 g O', '6:O h h h g g O', '7:O g g O')],
    up: [CROP_UP, T(13, '9:O g*11 O', '10:O g O g O g O g O g O')],
  } },
  slick: { front: {
    down: T(2,
      '10:O*9',
      '8:O O h H H H h*5 O O',
      '7:O h H H H h*8 g O',
      '7:O h H h h g h h g h h g h h g g O',
      '7:O h g O d*10 O g O',
      '7:OhO...........OgO',
      '7:Og.............gO',
    ),
    right: [T(2,
      '9:O*8',
      '8:O h H H H h*4 O O',
      '7:O h H H H h*7 O',
      '7:O h H h g h h g h g O O',
      '6:O h h h g h h g h O d o',
      '6:O h h g h h h h g O',
      '6:O h*7 g O',
    ), EAR_SIDE],
    up: CROP_UP,
  } },
  // Hair pulled back into a knot on the crown, widow's peak hairline.
  topknot: { front: {
    down: T(1,
      '13:O*5',
      '12:O h H h h g O',
      '10:O O g h h g g O O',
      '8:O O h H H h h h h h h O O',
      '7:O h H h h g h h h g h h h g g g O',
      '7:O h g O d d d d g d d d d O g g O',
      '7:OhO...........OgO',
      '7:Og.............gO',
    ),
    right: [T(1, '8:O*4', '7:O h H h O', '7:O g h g O O O O', '7:O O h H H h h h O', '7:O h H h g h h g h O O', '6:O h h h g h h g h O d o', '6:O h h g h h h h g O', '6:O h*7 g O'), EAR_SIDE],
    up: [CROP_UP, BUN_TOP],
  } },
  shaggy: { front: {
    down: [TOUSLED_DOWN, T(9, '7:Ohg...........ghO', '7:Ohg...........ghO', '7:Ogh...........hgO', '7:Ohg...........ghO', '7:OgO...........OgO', '8:O.............O')],
    right: [TOUSLED_SIDE, T(9, '6:O h*6 g O', '6:O h H h h h g O', '6:O h*6 g O', '6:O h h h h g g O', '6:O g h g g O', '7:O g O')],
    up: [TOUSLED_UP, T(13, '8:O g g h g g h g g h g g g g O', '8:O g h g g h g g h g g h g g O', '9:O g O g g O g g O g O g O', '10:O.O..O..O.O')],
  } },
  buzz: { front: {
    down: T(3,
      '10:O*11',
      '9:O h g h g h g h g h g h O',
      '8:O g h g h g h g h g h g h g O',
      '8:O h g h g h g h g h g h g g O',
      '8:O g O d d d d d d d d d O g O',
      '8:OO...........OO',
    ),
    right: T(3,
      '10:O*8',
      '8:O O g h g h g h g O O',
      '7:O g h g h g h g h g h O',
      '7:O h g h g h g h g h g h O',
      '7:O g h g h g h g h g O',
      '7:O h g h g h g h O',
      '7:O g h g h O d d o',
      '7:O h g h g O d s o',
      '7:O g h g h O o o',
      '8:O g h g O',
      '9:O O O',
    ),
    up: T(3,
      '10:O*11',
      '9:O h g h g h g h g h g h O',
      '8:O g h g h g h g h g h g h g O',
      '8:O h g h g h g h g h g h g g O',
      '8:O g h g h g h g h g h g h g O',
      '8:O h g h g h g h g h g h g g O',
      '8:O g h g h g h g h g h g h g O',
      '8:O h g h g h g h g h g h g g O',
      '9:O g h g h g h g h g h g O',
      '10:O g h g h g h g h g O',
      '11:O*9',
    ),
  } },
  wavy: { front: {
    down: [PARTED_TOP, WAVY_SIDES],
    right: [SMOOTH_SIDE, T(9, '6:O h g h h g O', '6:O g h h g h O', '6:O h h g h g O', '6:O g h g h h g O', '7:O g h g g O', '7:O g O g O')],
    up: [SMOOTH_BACK_TOP, T(9,
      '6:O h h g h h g h h h g h h g h h g g O',
      '6:O g h h g h h g h h h g h h g h g g O',
      '6:O h h g h h g h h h g h h g h h g g O',
      '6:O g h h g h h g h g h h g h g h g g O',
      '7:O g h g g h g g h g g h g g g O',
      '7:O g O g O g O g O g O g O g O',
    )],
  } },
  lowtail: {
    front: {
      down: [PARTED_TOP, SHORT_SIDES],
      right: [SMOOTH_SIDE, EAR_SIDE],
      up: [SMOOTH_BACK_TOP, SHORT_BACK, T(12, '13:O 3 3 3 O', '13:O h H g O', '13:O h h g O', '14:O h g O', '14:O h g O', '14:O g O', '15:O')],
    },
    back: { right: T(10, '5:O 3 O', '4:O h h O', '3:O h H g O', '3:O h h g O', '3:O h g O', '3:O g g O', '4:O g O', '4:O O') },
  },
  // ---- feminine styles ----
  long: {
    front: { down: [PARTED_TOP, LONG_SIDES], right: [SMOOTH_SIDE, LONG_SIDE_VIEW], up: [SMOOTH_BACK_TOP, LONG_BACK] },
    back: { right: LONG_BACK_LAYER },
  },
  bob: { front: {
    down: [BANGS_TOP, T(9,
      '6:Ohhg...........ghhO',
      '6:OhHg...........ghhO',
      '6:Ohhg...........ghhO',
      '6:Ohhg...........gghO',
      '6:OhhgO.........OghhO',
      '6:OhhhgO.......OghhhO',
      '7:OgggO.......OgggO',
      '8:OOO.........OOO',
    )],
    right: [BANGS_SIDE, T(9,
      '6:O h*7 g O',
      '6:O h*7 g O',
      '6:O h H h*5 g O',
      '6:O h*7 g O',
      '6:O h*7 g O',
      '6:O g h h h h h g g O',
      '7:O g*6 O',
      '8:O*6',
    )],
    up: [SMOOTH_BACK_TOP, T(9,
      '6:O h h h g h h h h h h g h h h g g g O',
      '6:O h H h g h h H h h h g h H h g g g O',
      '6:O h h g h h h h h h h h g h h g g g O',
      '6:O h h g h h h h h h h h g h h g g g O',
      '6:O g h g h h h h h h h h g h g g g g O',
      '6:O g g g g h h h h h h g g g g g g g O',
      '7:O g*15 O',
      '8:O*15',
    )],
  } },
  twintail: {
    front: { down: [PARTED_TOP, SHORT_SIDES, sym(TWIN_TAIL)], right: [SMOOTH_SIDE, EAR_SIDE], up: [SMOOTH_BACK_TOP, SHORT_BACK, sym(TWIN_TAIL)] },
    back: { right: T(5, '5:O 3 3', '4:O h 3 3', '3:O h H h O', '2:O h H h g O', '2:O h h h g O', '2:O h H g g O', '2:O h h g O', '2:O h g g O', '2:O h g O', '3:O h g O', '3:O g g O', '4:O g O', '4:O O') },
  },
  hightail: {
    front: {
      down: [PARTED_TOP, SHORT_SIDES],
      right: [SMOOTH_SIDE, EAR_SIDE],
      up: [SMOOTH_BACK_TOP, SHORT_BACK, T(3, '13:O 3 3 3 O', '13:O h H g O', '13:O h h g O', '13:O h H g O', '13:O h h g O', '13:O g h g O', '13:O h g g O', '14:O h g O', '14:O h g O', '14:O g O', '14:O g O', '15:O')],
    },
    back: {
      down: T(5, '23:O O', '23:O h O', '23:O h g O', '23:O h h O', '23:O h g O', '24:O h O', '24:O g O', '24:O g O', '25:O'),
      right: T(2, '5:O O 3', '4:O h h 3', '3:O h H h O', '2:O h h g O', '2:O h H g O', '2:O h g O', '2:O h g O', '3:O h g O', '3:O g O', '3:O g O', '4:O'),
    },
  },
  lionmane: {
    front: { down: [MANE_DOWN, MANE_LOCKS], right: MANE_SIDE, up: [MANE_UP, MANE_LOCKS] },
    back: { right: T(13, '4:O h h g O', '4:O h H g O', '4:O h h g O', '4:O h g g O', '4:O h g O', '5:O g O', '5:O g O', '6:O') },
  },
  buns: {
    front: { down: [PARTED_TOP, SHORT_SIDES, sym(BUN_SIDE)], right: [SMOOTH_SIDE, EAR_SIDE], up: [SMOOTH_BACK_TOP, SHORT_BACK, sym(BUN_SIDE)] },
    back: { right: T(3, '5:O O O', '4:O h H h O', '4:O h h g O', '4:O h g g O', '5:O O O') },
  },
  // Hime cut: blunt bangs, side locks cut square at the chin, long hair over
  // the shoulders and a straight-cut hem at the back.
  hime: {
    front: {
      down: [BANGS_TOP, T(9,
        '6:Ohhg...........ghhO',
        '6:OhHg...........gHhO',
        '6:Ohhg...........ghhO',
        '6:OhHg...........gHhO',
        '6:Ohhg...........ghhO',
        '6:Ohhg...........ghhO',
        '6:OgggO.........OgggO',
        '5:OhhgO...........OghhO',
        '5:OhHgO...........OgHhO',
        '5:OhhgO...........OghhO',
        '5:OhhgO...........OghhO',
        '5:OgggO...........OgggO',
        '5:OOOOO...........OOOOO',
      )],
      right: [BANGS_SIDE, LONG_SIDE_VIEW],
      up: [SMOOTH_BACK_TOP, T(9,
        '6:O h H h g h h H h g h h H h g h h g O',
        '6:O h h h g h h h h g h h h h g h g g O',
        '6:O h h g h h h h g h h h h g h h g g O',
        '6:O h h g h h h g h h h h g h h h g g O',
        '6:O h H g h h h g h h H h g h h g g g O',
        '6:O h h g h H h g h h h h g h h g g g O',
        '6:O h h g h h h g h h h g h h h g g g O',
        '6:O g h g h h g h h h g h h h g g g g O',
        '6:O g h g h h g h h h g h h g g g g g O',
        '6:O g g g g g g g g g g g g g g g g g O',
        '6:O*19',
      )],
    },
    back: { right: T(9, '5:O h*6 g O', '5:O h H h h h g g O', '5:O h*5 g g O', '5:O h H h h h g g O', '5:O h h g h g g g O', '5:O h H h g g g O', '5:O h h g h g g O', '5:O h h g g g g O', '5:O h g h g g O', '5:O g g g g g O', '5:O*7') },
  },
  braid: {
    front: {
      down: [PARTED_TOP, T(9, '6:Ohhg...........ghhO', '6:OhHg...........ghO', '6:Ohhg...........gO', '6:OhhgO'), BRAID(13, 5, 6)],
      right: [SMOOTH_SIDE, EAR_SIDE],
      up: [SMOOTH_BACK_TOP, SHORT_BACK, BRAID(14, 13, 8)],
    },
    back: { right: BRAID(9, 5, 10) },
  },
  pixie: { front: {
    down: [TOUSLED_DOWN, T(9, '7:OhgO.........OghO', '7:OgO...........OgO', '8:O.............O')],
    right: [TOUSLED_SIDE, EAR_SIDE, T(9, '17:O', '16:O g', '16:O')],
    up: TOUSLED_UP,
  } },
  curlylong: { front: {
    down: [CURLY_DOWN, T(10, '6:Ohgh...........hghO', '6:Oghg...........ghgO', '6:Ohgh...........hghO', '6:Oghg...........ghgO', '6:OhghO.........OhghO', '7:OghO.........OhgO', '8:OO...........OO')],
    right: [CURLY_SIDE, T(12, '5:O h g h g h O', '5:O g h g h O', '5:O h g h g O', '5:O g h g O', '6:O g O g O')],
    up: [CURLY_UP, T(13, '7:O h g h g h g h g h g h g h g h O', '7:O g h g h g h g h g h g h g g O', '8:O g h g h g h g h g h g g O', '9:O g O g g O g g O g O')],
  } },
  waves: {
    front: { down: [PARTED_TOP, WAVE_LONG_SIDES], right: [SMOOTH_SIDE, LONG_SIDE_VIEW], up: [SMOOTH_BACK_TOP, WAVE_BACK] },
    back: { right: LONG_BACK_LAYER },
  },
  sidetail: { front: {
    down: [PARTED_TOP, SHORT_SIDES, SIDE_TAIL],
    right: [SMOOTH_SIDE, EAR_SIDE, T(9, '13:O 3 O', '12:O h H O', '12:O h g O', '12:O h h O', '12:O h g O', '12:O g g O', '13:O g O', '13:O g O', '14:O')],
    up: [SMOOTH_BACK_TOP, SHORT_BACK, flip(SIDE_TAIL)],
  } },
};

// ----- bodies -----
// Keys: coat K c a A, sleeves F f G (coat or shirt colours per garment),
// accent 5 6 9 (scarf, cuffs, hem trim, sash), shirt T t, belt L l.
// FRONT torso rows 17..26: scarf 17, chest 18..23, accent cuffs 23, belt 24,
// coat skirt 25, accent hem trim 26. Arms x6..8 and x22..24.
const TORSO_DOWN_IDLE = T(17,
  '7:K F 5 9 6*9 5 5 G K',
  '6:K F f c 6 a*9 a c f G K',
  '6:K F f c 5 a*9 a c f G K',
  '6:K F f c A a*9 a c f G K',
  '6:K f G c A a*9 a c f G K',
  '6:K F f c A a*9 c c f G K',
  '6:K 9 6 c A a*9 c c 6 5 K',
  '6:o S s K L*5 l L*5 K s d o',
  '7:o o K A a*8 c c K o o',
  '9:5 9 6*9 6 5',
);
const TORSO_UP_IDLE = T(17,
  '7:K F 5 6*5 9 6*4 5 5 G K',
  '6:K F f c A a*4 c a*4 a c f G K',
  '6:K F f c A a*4 c a*4 a c f G K',
  '6:K F f c A a*4 c a*4 a c f G K',
  '6:K f G c A a*4 c a*4 a c f G K',
  '6:K F f c A a*4 c a*4 c c f G K',
  '6:K 9 6 c A a*4 c a*4 c c 6 5 K',
  '6:o S s K L*11 K s d o',
  '7:o o K A a*3 c a*4 c c K o o',
  '9:5 9 6*9 6 5',
);
/** Arm swing for front/back strides: the swinging arm's cuff and hand rise one
 * row (the arm foreshortens as it moves in depth), so walk frames are distinct
 * paintings rather than idle copies. */
function swing(template: Template, side: 'left' | 'right'): Template {
  const rows = template.rows.map(line => line.split(''));
  for (const x of side === 'left' ? [6, 7, 8] : [22, 23, 24]) {
    rows[5][x] = rows[6][x]; rows[6][x] = rows[7][x]; rows[7][x] = rows[8][x]; rows[8][x] = '.';
  }
  return { y: template.y, rows: rows.map(line => line.join('')) };
}
const TORSO: Record<View, [Template, Template, Template]> = {
  down: [swing(TORSO_DOWN_IDLE, 'left'), TORSO_DOWN_IDLE, swing(TORSO_DOWN_IDLE, 'right')],
  up: [swing(TORSO_UP_IDLE, 'right'), TORSO_UP_IDLE, swing(TORSO_UP_IDLE, 'left')],
  right: [
    T(17,
      '12:K 6 6 9 6 6 K',
      '11:K A a K F f G K a K',
      '11:K A K F f G K a a K',
      '11:K K F f G K a a a K',
      '10:K F f G K a a a a c K',
      '10:K 9 6 K a a a a a c K',
      '9:o s d o K a a a a a c K',
      '10:o o K L*6 l K',
      '11:K A a a a a c c c K',
      '11:5 6*7 9 5',
    ),
    T(17,
      '12:K 6 6 9 6 6 K',
      '11:K A a K F f G K a K',
      '11:K A a K F f G K a K',
      '11:K A a K F f G K a K',
      '11:K a a K f f G K c K',
      '11:K a c K f G G K c K',
      '11:K a c K 9 6 5 K c K',
      '11:K L L o s d o L l K',
      '11:K A a c o o c c c K',
      '11:5 6*7 9 5',
    ),
    T(17,
      '12:K 6 6 9 6 6 K',
      '11:K A a K F f G K a K',
      '11:K A a a K F f G K K',
      '11:K a a a a K F f G K',
      '11:K a a a a a K F f G K',
      '11:K a a c c a K 9 6 5 K',
      '11:K a a c c c a o s d o',
      '11:K L*6 l o o',
      '11:K A a a a a c c c K',
      '11:5 6*7 9 5',
    ),
  ],
};
type Garment = 'coat' | 'vest' | 'dress' | 'tunic';
// Female garments: a sash replaces the belt; the dress flares into an A-line
// skirt to row 27, the tunic stops at row 26 over leggings.
const SASH: Record<View, Template> = {
  down: T(24, '9:5 9 6*9 6 5'),
  up: T(24, '9:5 6*9 9 6 5'),
  right: T(24, '12:5 6 6 6 9 6 5'),
};
const SASH_BOW = T(25, '20:9 5', '21:5');
const SKIRTS: Record<'dress' | 'tunic', Record<View, Template>> = {
  dress: {
    down: T(25, '7:o o K a*11 K o o', '7:K A a*13 c K', '6:5 9 6*15 9 5'),
    up: T(25, '7:o o K a*11 K o o', '7:K A a*13 c K', '6:5 9 6*15 9 5'),
    right: T(25, '11:K A a a a a a c K', '10:K A a*8 c K', '9:5 9 6*9 6 5'),
  },
  tunic: {
    down: T(25, '7:o o K a*11 K o o', '8:5 9 6*11 9 5'),
    up: T(25, '7:o o K a*11 K o o', '8:5 9 6*11 9 5'),
    right: T(25, '11:K A a*6 c K', '10:5 9 6*7 9 5'),
  },
};
const LEGS: Record<'trousers' | 'skirt', Record<View, [Template, Template, Template]>> = {
  trousers: {
    down: [
      T(28, '10:q P P p q . j n b k j', '10:j n b k j . j*5', '10:j*5'),
      T(27, '10:q P P p q . q P P p q', '10:q P P p q . q P p p q', '10:j n b k j . j n b k j', '10:j*5 . j*5'),
      T(28, '10:j n b k j . q P P p q', '10:j*5 . j n b k j', '16:j*5'),
    ],
    up: [
      T(28, '10:j k b k j . q P P p q', '10:j*5 . j k b k j', '16:j*5'),
      T(27, '10:q P P p q . q P P p q', '10:q P P p q . q P p p q', '10:j k b k j . j k b k j', '10:j*5 . j*5'),
      T(28, '10:q P P p q . j k b k j', '10:j k b k j . j*5', '10:j*5'),
    ],
    right: [
      T(28, '12:q p q . q P P q', '10:j k k k j . j n b b b j', '10:j*4 . . j*6'),
      T(27, '13:q P P p q', '13:q P P p q', '13:j n b b b j', '13:j*6'),
      T(28, '12:q P q . q p p q', '10:j n b b j . j k k k k j', '10:j*4 . . j*6'),
    ],
  },
  skirt: {
    down: [
      T(29, '11:j n b j . j*4', '11:j*4'),
      T(28, '11:q P p q . q P p q', '11:j n b j . j n b j', '11:j*4 . j*4'),
      T(29, '11:j*4 . j n b j', '16:j*4'),
    ],
    up: [
      T(29, '11:j*4 . j k b j', '16:j*4'),
      T(28, '11:q P p q . q P p q', '11:j k b j . j k b j', '11:j*4 . j*4'),
      T(29, '11:j k b j . j*4', '11:j*4'),
    ],
    right: [
      T(29, '11:j k k j . . j n b b j', '11:j*3 . . . j*5'),
      T(28, '14:q P p q', '14:j n b b j', '14:j*5'),
      T(29, '11:j n b j . . j k k k j', '11:j*3 . . . j*5'),
    ],
  },
};

// ----- sign accessories -----
interface Accessory { back?: Partial<Record<View, Layer>>; front: Partial<Record<View, Layer>> }
const RAM_HORN = T(3,
  '3:1 1 1 1',
  '2:1 4 4 3 3 1',
  '1:1 4 3 1 1 2 1',
  '1:1 3 1 2 1 2 1',
  '1:1 3 1 1 2 1',
  '1:1 2 3 2 1',
  '2:1 1 1',
);
const BULL_HORN = T(1,
  '4:1',
  '3:1 4 1',
  '3:1 4 3 1',
  '3:1 3 3 2 1',
  '4:1 3 3 2 y 1',
  '5:1 1 1 z',
);
const STAR = T(3, '7:1', '6:1 4 1', '5:1 4 4 3 1', '6:1 3 1', '7:1');
const CLAW = T(3,
  '2:1 1',
  '2:1 4 1 . 1',
  '2:1 3 4 1 4 1',
  '2:1 3 3 1 3 1',
  '3:1 3 3 3 1',
  '4:1 2 2 1',
  '5:1 1',
);
const STINGER = T(1,
  '21:1 1 1',
  '20:1 4 4 3 1',
  '19:1 2 1 . 1 3 1',
  '19:1 1 . . 1 4 1',
  '23:1 3 1',
  '23:1 4 1',
  '23:1 3 1',
  '24:1',
);
const GOAT_HORN = T(1,
  '7:1 1',
  '6:1 4 1',
  '6:1 4 2 1',
  '7:1 3 4 1',
  '8:1 2 3 1',
  '9:1 4 3 1',
  '10:1 1',
);
const FIN = T(7,
  '2:1',
  '2:1 4 1',
  '2:1 3 4 1 1',
  '2:1 4 3 4 3 1',
  '3:1 3 4 3 1',
  '4:1 1 1',
);
const WAVES = T(4,
  '8:4 4 . . 4 4 . . 4 4 . . 4 4',
  '7:1 3 3 4 4 3 3 4 4 3 3 4 4 3 3 4 1',
  '7:1 2*15 1',
);
const CAP = T(1,
  '11:K*9',
  '9:K K A A a a a a a a a K K',
  '8:K A A a*10 c K',
  '7:K A a*12 c c K',
  '7:K T*15 K',
);
const FEATHER = T(1, '23:1 4 1', '22:1 4 3 1', '21:1 4 3 1', '20:1 3 1');
const ACCESSORIES: Record<string, Accessory> = {
  aries: { front: { down: sym(RAM_HORN), up: sym(RAM_HORN), right: shift(RAM_HORN, 9) } },
  taurus: {
    front: { down: sym(BULL_HORN), up: sym(BULL_HORN), right: T(1, '18:1', '17:1 4 1', '16:1 3 4 1', '15:1 2 3 3 1', '14:z y 2 3 3 1', '14:z 1 1 1 1') },
    back: { right: T(2, '10:1', '9:1 3 1', '9:1 2 2 1', '10:1 1 1') },
  },
  gemini: { front: { down: sym(STAR), up: sym(STAR), right: [shift(STAR, 1), T(1, '17:1', '16:1 4 1', '17:1')] } },
  cancer: { front: { down: sym(CLAW), up: sym(CLAW), right: shift(CLAW, 4) } },
  leo: { front: {
    down: T(5, '15:8', '8:z y*5 Y 7 Y y*5 z'),
    right: T(5, '21:8', '6:z y*13 Y 7'),
    up: T(6, '5:z y*19 z'),
  } },
  virgo: { front: {
    down: T(2, '10:4....4....4', '8:A4y4aA4y4Aa4y4A', '7:caA2acaA2AacA2Aac'),
    up: T(2, '10:4....4....4', '8:A4y4aA4y4Aa4y4A', '7:caA2acaA2AacA2Aac'),
    right: T(2, '10:4....4...4', '9:4 y 4 a A 4 y 4 A 4 y 4', '8:c A 2 a c a A 2 A a c 2 A'),
  } },
  libra: { front: {
    down: T(1, '15:Y', '8:z y*6 Y y*6 z', '8:z......y......z', '7:z.......y.......z', '5:zYyyz.....y.....zYyyz', '6:zzz.............zzz'),
    up: T(1, '15:Y', '8:z y*6 Y y*6 z', '8:z......y......z', '7:z.......y.......z', '5:zYyyz.....y.....zYyyz', '6:zzz.............zzz'),
    right: T(1, '14:Y', '10:z y y y Y y y y z', '9:z.........z', '8:zYyz.......zYyz', '9:zz.........zz'),
  } },
  scorpio: { front: { down: STINGER, up: flip(STINGER), right: flip(STINGER) } },
  sagittarius: {
    front: {
      down: [CAP, FEATHER],
      up: [CAP, FEATHER, T(13, '20:4 7 4', '20:7 4 7', '20:j b j', '19:j b k j', '18:j b k j', '17:j n k j', '16:j b k j', '15:j b k j', '14:j b k j', '14:j j j')],
      right: [T(1, '9:K*8', '8:K A A a*6 K', '7:K A a*9 c K', '6:K A a*11 c K', '6:K T*14 K K'), T(1, '4:1 4 1', '4:1 3 4 1', '5:1 3 4 1', '7:1 3 1')],
    },
    back: {
      right: T(13, '8:7 4', '7:4 7 4', '7:j b j', '7:j b k j', '7:j n k j', '7:j b k j', '7:j b k j', '7:j b k j', '7:j b k j', '7:j b k j', '7:j j j j'),
    },
  },
  capricorn: { front: {
    down: sym(GOAT_HORN), up: sym(GOAT_HORN),
    right: T(1, '9:1 1 1', '7:1 1 4 4 3 1', '6:1 4 3 1 1 2 3 1', '5:1 4 2 1 . . 1 3 1', '5:1 3 1 . . . 1 2 1', '5:1 2 1', '6:1'),
  } },
  aquarius: { front: {
    down: WAVES, up: WAVES,
    right: T(4, '7:4 4 . . 4 4 . . 4 4 . . 4', '6:1 3 3 4 4 3 3 4 4 3 3 4 4 3 1', '6:1 2*13 1'),
  } },
  pisces: { front: { down: sym(FIN), up: sym(FIN), right: shift(FIN, 8) } },
};

// ------------------------------------------------------------- rendering --
type Palette = Readonly<Record<string, RGBA>>;
function stamp(target: Pixels, layer: Layer, palette: Palette, dy = 0): void {
  if (!layer) return;
  for (const template of Array.isArray(layer) ? layer : [layer]) template.rows.forEach((line, i) => {
    for (let x = 0; x < 32; x++) {
      const key = line[x];
      if (key === '.') continue;
      const fill = palette[key];
      if (!fill) throw new Error(`Undeclared native paint '${key}' at ${x},${template.y + i + dy}`);
      target.px(x, template.y + i + dy, fill);
    }
  });
}

interface Character { sign: SignDesign; gender: Gender; look: Look; palette: Palette; glyphInk: RGBA }
export function characterFor(signId: string, gender: Gender): Character {
  const sign = DESIGN.signs.find(s => s.id === signId);
  if (!sign || (gender !== 'male' && gender !== 'female')) throw new Error('Closed 24 avatar identity');
  const look = sign[gender];
  const skin = DESIGN.skins[look.skin];
  if (!skin || !HAIR[look.hair]) throw new Error(`Unknown skin/hair for ${signId}/${gender}`);
  const eye = DESIGN.eyes[look.eyes];
  if (!eye) throw new Error(`Unknown eye colour ${look.eyes}`);
  const [O, g, h, H] = ramp(look.hairColor);
  const [o, d, s, S] = skin.ramp.map(color);
  const coat = ramp(sign.palette.primary);
  const [, t] = ramp(sign.trim);
  const [q, p, P] = ramp(sign.pants);
  const [j, k, b, n] = ramp('#7a5236');
  const [z, y, , Y] = ramp('#e2b03c');
  const [a1, a2, a3, a4] = ramp(sign.accessory.ramp);
  const [, accentShade, accent, accentLight] = ramp(sign.accent);
  const [eyeDark, , iris, irisLight] = ramp(eye);
  const garment = look.garment as Garment;
  if (!(gender === 'male' ? ['coat', 'vest'] : ['dress', 'tunic']).includes(garment)) throw new Error(`Unknown garment for ${signId}/${gender}`);
  const shirtSleeves = garment === 'vest' || garment === 'tunic';
  const crestHue = toHsl(color(sign.palette.primary))[0];
  const palette: Record<string, RGBA> = {
    O, g, h, H, o, d, s, S,
    r: gender === 'female' ? color(skin.blush) : s, m: mix(color(skin.mouth), s),
    E: fromHsl(toHsl(eyeDark)[0], 0.35, 0.12), e: iris, i: mix(iris, irisLight), w: color('#fffaf0'),
    K: coat[0], c: color(sign.palette.shade), a: color(sign.palette.primary), A: color(sign.palette.light),
    t, T: color(sign.trim),
    q, p, P, j, k, b, n,
    L: color('#4a2e22'), l: y,
    z, y, Y,
    '1': a1, '2': a2, '3': a3, '4': a4,
    '7': color('#d8404a'), '8': color('#ffb0a0'),
    '5': accentShade, '6': accent, '9': accentLight,
    // Sleeves: coat colours, or shirt colours for the vest and tunic garments.
    F: shirtSleeves ? color(sign.trim) : color(sign.palette.light),
    f: shirtSleeves ? mix(color(sign.trim), t) : color(sign.palette.primary),
    G: shirtSleeves ? t : color(sign.palette.shade),
    // Crest: a near-black field tinted with the sign hue under a light glyph.
    X: fromHsl(crestHue, 0.38, DESIGN.badge.fieldLightness),
  };
  return { sign, gender, look, palette, glyphInk: color(DESIGN.badge.glyph) };
}

function viewOf(direction: Direction): View { return direction === 'left' ? 'right' : direction; }

/** `accessory: false` renders without the sign accessory (review/tests only). */
export function renderFrame(signId: string, gender: Gender, direction: Direction, pose: Pose, options: { accessory?: boolean } = {}): Pixels {
  if (!DIRECTIONS.includes(direction) || ![0, 1, 2].includes(pose)) throw new Error('Closed frame identity');
  const ch = characterFor(signId, gender), view = viewOf(direction), pal = ch.palette;
  // Stride frames lower the upper body one row (hips drop as the legs spread).
  const bob = pose === 1 ? 0 : 1;
  const hair = HAIR[ch.look.hair], accessory: Accessory = options.accessory === false ? { front: {} } : ACCESSORIES[signId];
  const frame = new Pixels();
  stamp(frame, hair.back?.[view], pal, bob);
  stamp(frame, accessory.back?.[view], pal, bob);
  const garment = ch.look.garment as Garment;
  stamp(frame, LEGS[garment === 'dress' ? 'skirt' : 'trousers'][view][pose], pal);
  stamp(frame, TORSO[view][pose], pal, bob);
  if (garment === 'dress' || garment === 'tunic') {
    stamp(frame, SASH[view], pal, bob);
    stamp(frame, SKIRTS[garment][view], pal, bob);
    if (view === 'down') stamp(frame, SASH_BOW, pal, bob);
  }
  stamp(frame, HEAD[view], pal, bob);
  if (gender === 'female' && view === 'down') stamp(frame, FEMALE_LASH, pal, bob);
  stamp(frame, hair.front[view], pal, bob);
  stamp(frame, accessory.front[view], pal, bob);
  if (view === 'down') paintBadge(frame, ch, bob);
  return direction === 'left' ? frame.mirrored() : frame;
}

/** Chest crest: a round dark brooch with a one-pixel margin around the 7x7
 * glyph and rounded corners, so the coat stays visible around it. */
const BADGE_SHAPE = ['..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..'];
function paintBadge(frame: Pixels, ch: Character, bob: number): void {
  const { x, y, glyphX, glyphY } = DESIGN.badge;
  BADGE_SHAPE.forEach((line, yy) => { for (let xx = 0; xx < line.length; xx++) if (line[xx] !== '.') frame.px(x + xx, y + yy + bob, ch.palette[line[xx]]); });
  ch.sign.glyph.forEach((line, yy) => { for (let xx = 0; xx < 7; xx++) if (line[xx] === '#') frame.px(glyphX + xx, glyphY + yy + bob, ch.glyphInk); });
}

export function renderSheet(signId: string, gender: Gender): Pixels {
  const sheet = new Pixels(96, 128);
  for (let row = 0; row < 4; row++) for (let pose = 0; pose < 3; pose++) sheet.over(renderFrame(signId, gender, DIRECTIONS[row], pose as Pose), pose * 32, row * 32);
  return sheet;
}

const sha = (raw: Buffer): string => createHash('sha256').update(raw).digest('hex');
export async function png(pixels: Pixels): Promise<Buffer> {
  return sharp(pixels.rgba, { raw: { width: pixels.width, height: pixels.height, channels: 4 } }).png({ compressionLevel: 9, adaptiveFiltering: false, palette: false }).toBuffer();
}

export async function buildPixelPackage(output = path.join(ROOT, OUTPUT_DIR)): Promise<void> {
  await mkdir(output, { recursive: true });
  const assets = [], textures = [];
  for (const sign of DESIGN.signs) for (const gender of ['male', 'female'] as const) {
    const file = `${sign.id}-${gender}.png`, sheet = renderSheet(sign.id, gender), raw = await png(sheet);
    await writeFile(path.join(output, file), raw);
    const id = `varcamp-zodiac-v1-${sign.id}-${gender}`; // Existing selected identities are stable.
    assets.push({ id, file, sign: sign.id, gender, bytes: raw.length, sha256: sha(raw), rgbaSha256: sha(sheet.rgba) });
    textures.push({ id, name: `${sign.id[0].toUpperCase() + sign.id.slice(1)} · ${gender === 'male' ? 'Male' : 'Female'}`, file });
  }
  const source = await readFile(fileURLToPath(import.meta.url));
  const designRaw = await readFile(path.join(ROOT, DESIGN_PATH));
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({
    version: 3, status: 'SOURCE_PACKAGE_NOT_LIVE_SELECTION',
    format: { sheet: [96, 128], frame: [32, 32], rows: DIRECTIONS, poseOrder: ['stride-a', 'idle', 'stride-b'], footBaseline: 30, walk: { rate: 10, frames: [0, 1, 2, 1] } },
    source: { renderer: 'tools/wokas/pixel-v3.ts', sha256: sha(source), design: DESIGN_PATH, designSha256: sha(designRaw), method: 'original hand-authored native RGBA pixel templates; no stock, generated or rescaled sprite pixels', license: 'MIT' },
    assets,
  }, null, 2) + '\n');
  await writeFile(path.join(output, 'collection.template.json'), JSON.stringify({ version: 1, category: 'woka', assetBaseUrl: null, collection: { name: 'VarCamp Zodiac 2026', textures } }, null, 2) + '\n');
  await writeFile(path.join(output, 'README.md'), README);
}

const README = `# VarCamp Zodiac 2026 pixel artwork v3

24 original native 32px RPG characters: 12 signs, male/female pairs, twelve frames each.
Each 96x128 PNG uses DOWN/LEFT/RIGHT/UP rows and stride-a/idle/stride-b columns,
32x32 frames, feet on row 30 and a transparent one-pixel border (same contract as v2).

v3 replaces v2's flat block style with layered hand-authored pixel templates:
hue-shifted material outlines, four-tone ramps lit from the top left, two-pixel
eyes with highlights, 24 distinct hairstyles, alternating legs and swinging
arms, real side profiles and back-of-head views. Outfits: coat or vest (men),
A-line dress or tunic with sash (women), with accent scarf, cuffs and hem trim,
belt and boots. Every DOWN frame carries a round dark chest crest with the
sign's light 7x7 glyph drawn after the Unicode zodiac symbol, and each sign
keeps a small identifying accessory in every direction.

Existing varcamp-zodiac-v1-* texture IDs are intentionally preserved; only the
resource folder moves to v3. The unbound template is not a live catalog;
publish/bind only through the separately reviewed operator.

Reproduce from the repo with node node_modules/tsx/dist/cli.mjs
tools/wokas/pixel-v3.ts. All pixels are painted by the TypeScript templates and
sharp encodes them losslessly. Palettes, glyphs and accessory notes live in
art/source/wokas-pixel-v3/native-design.json; hashes are in manifest.json.
Original artwork is supplied under the repository MIT license.

No deployment or live selection outcome is claimed by this package.
`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildPixelPackage();
  console.log('Wrote 24 v3 native skins; no live catalog changed.');
}
