/** Original native32px paintings. Every visible pixel is authored here.
 * No generated-sheet sampling, SVG, fonts or image rescaling make the skins.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
export type Direction = typeof DIRECTIONS[number];
export type Gender = 'male' | 'female';
export type Pose = 0 | 1 | 2;
export type RGBA = readonly [number, number, number, number];
type Point = readonly [number, number];
export interface SignDesign {
  id: string; title: string;
  palette: { primary: string; shade: string; light: string };
  headgear: string; glyph: string[];
}
export interface NativeDesign {
  schema: string;
  frame: { width: number; height: number; rows: string[]; poseOrder: string[]; sheet: { width: number; height: number }; frontTarget: { minimumWidth: number; maximumWidth: number; minimumHeight: number; maximumHeight: number }; feetBaseline: number };
  signs: SignDesign[];
}
export const DESIGN = JSON.parse(await readFile(path.join(ROOT, 'art/source/wokas-readable-v2/native-design.json'), 'utf8')) as NativeDesign;
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
if (DESIGN.schema !== 'varcamp-native-readable-woka-design-v2' || DESIGN.frame.width !== 32 || DESIGN.frame.height !== 32 || JSON.stringify(DESIGN.signs.map(x => x.id)) !== JSON.stringify(SIGNS)) throw new Error('Exact reviewed native design required');
for (const sign of DESIGN.signs) if (sign.glyph.length !== 7 || sign.glyph.some(row => !/^[.#]{7}$/.test(row))) throw new Error('Exact original7x7 sign glyph required');

export function color(hex: string): RGBA {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error('Literal opaque RGB palette required');
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
}
const INK = color('#172336');
const PANEL = color('#15263d');
const WHITE = color('#fff8e8');
const CREAM = color('#ffe9bc');
const HORN_SHADE = color('#bba18d');
const SKINS = [
  ['#ffc39a', '#dd8c70', '#ffe0b4'],
  ['#d89166', '#a85e46', '#f0b981'],
  ['#f5bb91', '#cc8269', '#ffdeb0'],
] as const;
const HAIRS = [
  ['#39272e', '#201e29', '#70454a'],
  ['#5a342d', '#2d2329', '#995444'],
  ['#2b3549', '#202238', '#4d617a'],
  ['#594235', '#2b2931', '#987457'],
] as const;

export class Pixels {
  readonly rgba: Buffer;
  constructor(readonly width = 32, readonly height = 32) { this.rgba = Buffer.alloc(width * height * 4); }
  px(x: number, y: number, fill: RGBA): void {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.width || y >= this.height) throw new Error(`Native pixel outside canvas: ${x},${y}`);
    const offset = (y * this.width + x) * 4;
    this.rgba[offset] = fill[0]; this.rgba[offset + 1] = fill[1]; this.rgba[offset + 2] = fill[2]; this.rgba[offset + 3] = fill[3];
  }
  rect(x: number, y: number, width: number, height: number, fill: RGBA): void {
    for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) this.px(xx, yy, fill);
  }
  line(points: readonly Point[], fill: RGBA, thickness = 1): void {
    for (let i = 1; i < points.length; i++) {
      let [x, y] = points[i - 1]; const [xx, yy] = points[i];
      const dx = Math.abs(xx - x), sx = x < xx ? 1 : -1, dy = -Math.abs(yy - y), sy = y < yy ? 1 : -1;
      let error = dx + dy;
      for (;;) {
        this.rect(x, y, thickness, thickness, fill);
        if (x === xx && y === yy) break;
        const e = 2 * error;
        if (e >= dy) { error += dy; x += sx; }
        if (e <= dx) { error += dx; y += sy; }
      }
    }
  }
  ellipse(x: number, y: number, width: number, height: number, fill: RGBA): void {
    for (let yy = 0; yy < height; yy++) for (let xx = 0; xx < width; xx++) {
      const dx = (2 * xx + 1 - width) / width, dy = (2 * yy + 1 - height) / height;
      if (dx * dx + dy * dy <= 1) this.px(x + xx, y + yy, fill);
    }
  }
  polygon(points: readonly Point[], fill: RGBA): void {
    const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
    const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < (xj - xi) * (y + 0.5 - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.px(x, y, fill);
    }
    this.line([...points, points[0]], fill);
  }
  stamp(rows: readonly string[], x: number, y: number, palette: Readonly<Record<string, RGBA>>): void {
    for (let yy = 0; yy < rows.length; yy++) for (let xx = 0; xx < rows[yy].length; xx++) {
      const key = rows[yy][xx];
      if (key === '.') continue;
      if (!palette[key]) throw new Error(`Undeclared native paint ${key}`);
      this.px(x + xx, y + yy, palette[key]);
    }
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

function outlined(p: Pixels, draw: (target: Pixels, fill: RGBA) => void, fill: RGBA): void {
  const mask = new Pixels(); draw(mask, fill);
  // One intentional native pixel outline, with no soft pixels or antialias.
  for (let y = 1; y < 31; y++) for (let x = 1; x < 31; x++) if (mask.rgba[(y * 32 + x) * 4 + 3]) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (x + dx > 0 && x + dx < 31 && y + dy > 0 && y + dy < 31) p.px(x + dx, y + dy, INK);
  }
  p.over(mask);
}

export function headgear(sign: SignDesign, direction: Direction, foreground = false): Pixels {
  const p = new Pixels(), primary = color(sign.palette.primary), shade = color(sign.palette.shade), light = color(sign.palette.light);
  const side = direction === 'left' || direction === 'right';
  if (foreground) {
    if (side) {
      p.rect(11, 8, 12, 2, shade); p.rect(14, 8, 8, 1, primary); p.rect(21, 8, 2, 2, light);
    } else {
      const y = sign.id === 'leo' ? 7 : 8;
      p.rect(8, y, 16, 2, shade); p.rect(10, y, 12, 1, primary);
      p.rect(14, y, 4, 2, light);
    }
    return direction === 'left' ? p.mirrored() : p;
  }
  const mirror = (points: readonly Point[]): Point[] => points.map(([x, y]) => [31 - x, y]);
  switch (sign.id) {
    case 'aries':
      for (const x of [2, 21]) {
        outlined(p, (m, c) => m.ellipse(x, 3, 9, 10, c), CREAM);
        p.ellipse(x + 2, 7, 5, 5, HORN_SHADE); p.ellipse(x + 3, 8, 3, 3, INK);
        p.rect(x + 2, 5, 4, 2, WHITE); p.rect(x + 6, 8, 2, 3, CREAM);
      }
      p.rect(10, 2, 12, 6, primary); p.rect(12, 2, 8, 2, light);
      break;
    case 'taurus': {
      const horn: Point[] = [[2, 2], [4, 2], [4, 6], [9, 8], [10, 10], [6, 11], [3, 9], [2, 6]];
      for (const points of [horn, mirror(horn)]) outlined(p, (m, c) => m.polygon(points, c), CREAM);
      p.line([[3, 4], [4, 7], [7, 9]], HORN_SHADE); p.line([[28, 4], [27, 7], [24, 9]], HORN_SHADE);
      p.rect(9, 5, 14, 5, primary); p.rect(11, 5, 10, 1, light);
      break;
    }
    case 'gemini':
      outlined(p, (m, c) => { m.rect(5, 2, 6, 7, c); m.rect(21, 2, 6, 7, c); m.rect(8, 7, 16, 3, c); }, primary);
      p.rect(4, 1, 8, 2, light); p.rect(20, 1, 8, 2, light);
      p.rect(6, 3, 2, 4, light); p.rect(22, 3, 2, 4, light);
      p.rect(7, 8, 18, 2, shade);
      break;
    case 'cancer': {
      const claw: Point[] = [[2, 4], [4, 2], [5, 5], [8, 2], [10, 5], [10, 9], [7, 12], [3, 10], [2, 8]];
      for (const points of [claw, mirror(claw)]) outlined(p, (m, c) => m.polygon(points, c), primary);
      p.line([[3, 5], [4, 8], [6, 9]], light, 2); p.line([[27, 5], [26, 8], [24, 9]], light, 2);
      p.rect(10, 6, 12, 4, shade); p.rect(12, 6, 8, 2, primary);
      break;
    }
    case 'leo':
      outlined(p, (m, c) => m.ellipse(3, 2, 26, 21, c), primary);
      for (const x of [5, 21]) {
        outlined(p, (m, c) => m.ellipse(x, 2, 6, 6, c), primary);
        p.ellipse(x + 2, 4, 3, 3, light);
      }
      p.polygon([[11, 2], [16, 1], [20, 3], [18, 7], [12, 7]], light);
      p.line([[5, 11], [4, 16], [7, 19]], shade, 2); p.line([[26, 11], [27, 16], [24, 19]], shade, 2);
      break;
    case 'virgo':
      for (const points of [ [[2, 7], [6, 4], [12, 7], [8, 10]] as Point[], [[29, 7], [25, 4], [19, 7], [23, 10]] as Point[] ]) outlined(p, (m, c) => m.polygon(points, c), primary);
      p.line([[4, 7], [9, 8]], light); p.line([[27, 7], [22, 8]], light);
      outlined(p, (m, c) => { m.rect(13, 1, 6, 8, c); m.rect(11, 3, 10, 4, c); }, WHITE);
      p.rect(14, 4, 4, 3, color('#f2b436')); p.rect(15, 4, 2, 1, CREAM);
      break;
    case 'libra':
      outlined(p, (m, c) => { m.rect(3, 4, 26, 2, c); m.rect(14, 2, 4, 7, c); }, primary);
      p.rect(4, 4, 24, 1, light); p.rect(15, 1, 2, 2, WHITE);
      for (const x of [3, 21]) {
        p.line([[x + 1, 6], [x, 10]], shade); p.line([[x + 6, 6], [x + 7, 10]], shade);
        outlined(p, (m, c) => m.polygon([[x, 10], [x + 8, 10], [x + 6, 13], [x + 2, 13]], c), light);
        p.rect(x + 1, 10, 6, 1, WHITE);
      }
      break;
    case 'scorpio':
      outlined(p, (m, c) => m.line([[25, 15], [27, 11], [26, 6], [22, 2], [16, 2], [13, 5], [16, 7]], c, 3), primary);
      p.line([[25, 10], [24, 6], [21, 3], [17, 3]], light);
      p.polygon([[15, 6], [20, 6], [18, 10]], shade); p.px(18, 8, WHITE);
      p.rect(7, 6, 17, 4, shade);
      break;
    case 'sagittarius':
      outlined(p, (m, c) => m.line([[7, 10], [22, 2]], c, 3), primary);
      outlined(p, (m, c) => m.polygon([[20, 1], [27, 1], [27, 8], [24, 6], [21, 9]], c), light);
      p.line([[9, 9], [22, 3]], WHITE);
      p.rect(6, 8, 18, 2, shade);
      break;
    case 'capricorn': {
      const horn: Point[] = [[5, 3], [7, 1], [10, 1], [13, 4], [12, 9], [9, 11], [9, 6], [8, 4], [6, 5]];
      for (const points of [horn, mirror(horn)]) outlined(p, (m, c) => m.polygon(points, c), HORN_SHADE);
      p.line([[7, 2], [9, 2], [11, 4], [11, 7]], CREAM);
      p.line([[24, 2], [22, 2], [20, 4], [20, 7]], CREAM);
      p.rect(6, 7, 19, 3, shade); p.rect(12, 7, 7, 2, primary);
      break;
    }
    case 'aquarius':
      for (const offset of [0, 5]) {
        outlined(p, (m, c) => m.line([[3, 5 + offset], [7, 2 + offset], [11, 2 + offset], [15, 5 + offset], [19, 2 + offset], [23, 2 + offset], [27, 5 + offset]], c, 2), primary);
        p.line([[4, 5 + offset], [8, 3 + offset], [10, 3 + offset], [15, 6 + offset], [20, 3 + offset], [22, 3 + offset], [26, 5 + offset]], light);
      }
      break;
    case 'pisces':
      for (const x of [2, 20]) {
        outlined(p, (m, c) => m.ellipse(x, 4, 10, 7, c), primary);
        p.polygon(x === 2 ? [[10, 5], [13, 3], [13, 11], [10, 9]] : [[21, 5], [18, 3], [18, 11], [21, 9]], light);
        p.polygon([[x + 3, 4], [x + 5, 1], [x + 7, 5]], primary);
        p.rect(x + (x === 2 ? 2 : 6), 6, 2, 2, WHITE); p.px(x + (x === 2 ? 2 : 7), 7, INK);
        p.rect(x + 3, 9, 4, 1, shade);
      }
      p.rect(11, 7, 10, 3, shade);
      break;
    default: throw new Error('Closed12 headgear identities');
  }
  if (!side) return p;
  // Authored perspective projection of ornaments only, never the human face or
  // a walk pose. The directional body/face below is an actual side painting.
  const projected = new Pixels();
  for (let y = 0; y < 24; y++) for (let x = 1; x < 31; x++) {
    const i = (y * 32 + x) * 4;
    if (p.rgba[i + 3]) projected.px(8 + Math.floor((x - 1) * 19 / 30), y, [p.rgba[i], p.rgba[i + 1], p.rgba[i + 2], 255]);
  }
  return direction === 'left' ? projected.mirrored() : projected;
}

function human(p: Pixels, sign: SignDesign, gender: Gender, direction: Direction, pose: Pose): void {
  const index = SIGNS.indexOf(sign.id), primary = color(sign.palette.primary), shade = color(sign.palette.shade), light = color(sign.palette.light);
  const [skinHex, skinShadeHex, skinLightHex] = SKINS[(index + (gender === 'female' ? 1 : 0)) % SKINS.length];
  const skin = color(skinHex), skinShade = color(skinShadeHex), skinLight = color(skinLightHex);
  const hairSet = gender === 'female' && (index === 6 || index === 10) ? ['#e8ce92', '#8c7562', '#fff0bf'] : HAIRS[index % HAIRS.length];
  const hair = color(hairSet[0]), hairShade = color(hairSet[1]), hairLight = color(hairSet[2]);
  const side = direction === 'left' || direction === 'right';
  const body = new Pixels();
  // Legs are painted as two articulated limbs in each pose; boots always end
  // at30. Strides change knee/boot placements and opposite arms, not idle copies.
  if (side) {
    if (pose === 1) {
      body.rect(13, 25, 5, 5, INK); body.rect(18, 25, 4, 5, INK);
      body.rect(14, 25, 3, 4, shade); body.rect(19, 26, 2, 3, primary);
      body.rect(12, 29, 7, 2, INK); body.rect(17, 29, 7, 2, INK);
      body.rect(14, 29, 4, 1, primary); body.rect(19, 29, 4, 1, light);
    } else {
      const front = pose === 0;
      body.polygon(front ? [[14, 25], [18, 25], [22, 29], [20, 30], [17, 28], [14, 28]] : [[14, 25], [18, 25], [15, 29], [10, 30], [9, 28], [13, 27]], INK);
      body.polygon(front ? [[18, 25], [21, 25], [16, 29], [11, 30], [9, 29], [14, 27]] : [[18, 25], [21, 25], [24, 29], [23, 30], [19, 28]], INK);
      body.line(front ? [[15, 26], [17, 27], [20, 29]] : [[15, 26], [13, 28], [11, 29]], primary, 2);
      body.line(front ? [[19, 26], [16, 28], [12, 29]] : [[19, 26], [21, 28], [23, 29]], light);
      body.rect(9, 30, 6, 1, INK); body.rect(20, 30, 6, 1, INK);
    }
    body.rect(12, 18, 11, 9, INK); body.rect(13, 19, 9, 7, primary);
    body.rect(13, 19, 3, 6, shade); body.rect(20, 19, 2, 6, light); body.rect(12, 25, 11, 2, light);
    const armX = pose === 0 ? 19 : pose === 2 ? 10 : 16;
    body.rect(armX, 19, 4, 6, INK); body.rect(armX + 1, 20, 2, 4, primary);
    body.rect(armX, 24, 4, 3, INK); body.rect(armX + 1, 24, 2, 2, light);
    body.rect(16, 18, 5, 2, WHITE);
    // Side head: one eye toward the leading edge and a real projecting nose.
    body.rect(10, 8, 12, 10, INK); body.rect(12, 9, 11, 8, skin);
    body.rect(22, 12, 3, 3, INK); body.rect(22, 12, 2, 2, skinLight);
    body.rect(14, 16, 8, 2, skinShade); body.rect(20, 15, 3, 1, skin);
    body.rect(20, 11, 3, 1, hairShade); body.rect(21, 12, 2, 3, INK); body.px(22, 12, WHITE);
    body.rect(11, 8, 11, 3, hair); body.rect(10, 10, 5, 6, hairShade); body.rect(12, 11, 3, 3, hair);
    body.rect(12, 13, 2, 3, skinShade); body.rect(12, 13, 1, 2, skin);
    body.rect(12, 9, 7, 1, hairLight);
    if (gender === 'female') {
      body.rect(8, 10, 4, 11, INK); body.rect(9, 10, 3, 10, hair); body.rect(8, 18, 5, 4, hairShade);
      body.rect(10, 12, 1, 7, hairLight); body.px(21, 16, color('#b75064'));
      body.rect(12, 16, 1, 2, light);
    } else { body.rect(11, 10, 2, 4, hair); body.rect(16, 17, 4, 1, hairShade); }
    p.over(direction === 'left' ? body.mirrored() : body);
    return;
  }

  // Rear hair silhouette is painted before clothing and human face.
  if (gender === 'female') {
    body.rect(6, 10, 5, 13, INK); body.rect(21, 10, 5, 13, INK);
    body.rect(7, 11, 4, 11, hair); body.rect(21, 11, 4, 11, hair);
    body.rect(7, 20, 4, 3, hairShade); body.rect(21, 20, 4, 3, hairShade);
    body.rect(8, 13, 1, 7, hairLight); body.rect(22, 13, 1, 7, hairLight);
  }
  const leftLift = pose === 0 ? 1 : 0, rightLift = pose === 2 ? 1 : 0;
  body.rect(10, 25, 6, 5 - leftLift, INK); body.rect(17, 25, 5, 5 - rightLift, INK);
  body.rect(11, 26, 4, 3 - leftLift, primary); body.rect(18, 26, 3, 3 - rightLift, shade);
  body.rect(pose === 0 ? 8 : 9, 29 - leftLift, 7, 2, INK);
  body.rect(pose === 2 ? 18 : 17, 29 - rightLift, 7, 2, INK);
  body.rect(pose === 0 ? 9 : 10, 29 - leftLift, 5, 1, light);
  body.rect(pose === 2 ? 19 : 18, 29 - rightLift, 5, 1, primary);
  if (pose === 0) body.rect(17, 30, 7, 1, INK);
  if (pose === 2) body.rect(9, 30, 7, 1, INK);
  body.rect(9, 18, 14, 9, INK); body.rect(10, 19, 12, 7, primary);
  body.rect(10, 20, 2, 5, shade); body.rect(20, 19, 2, 6, light);
  body.rect(10, 26, 12, 1, WHITE);
  const leftArm = pose === 0 ? 1 : pose === 2 ? -1 : 0;
  const rightArm = -leftArm;
  body.rect(5, 19 + leftArm, 5, 7, INK); body.rect(22, 19 + rightArm, 5, 7, INK);
  body.rect(6, 20 + leftArm, 3, 5, primary); body.rect(23, 20 + rightArm, 3, 5, shade);
  body.rect(5, 24 + leftArm, 5, 3, INK); body.rect(22, 24 + rightArm, 5, 3, INK);
  body.rect(6, 24 + leftArm, 3, 2, light); body.rect(23, 24 + rightArm, 3, 2, primary);
  body.rect(8, 18, 4, 2, WHITE); body.rect(20, 18, 4, 2, WHITE);
  // Seven complete native pixels per glyph row on a deliberately quiet panel.
  body.rect(11, 18, 9, 8, PANEL);
  body.stamp(sign.glyph, 12, 19, { '#': WHITE });
  body.rect(8, 8, 16, 10, INK); body.rect(9, 9, 14, 8, hair);
  body.rect(7, 12, 3, 4, INK); body.rect(22, 12, 3, 4, INK);
  body.rect(8, 12, 2, 3, skinShade); body.rect(22, 12, 2, 3, skinShade);
  if (direction === 'up') {
    body.rect(9, 9, 14, 8, hair);
    body.rect(10, 9, 4, 1, hairLight); body.rect(15, 10, 5, 1, hairLight);
    body.rect(10, 15, 12, 3, hairShade);
    if (gender === 'female') {
      body.rect(8, 10, 4, 11, hair); body.rect(20, 10, 4, 11, hair);
      body.rect(13, 16, 6, 2, light); body.rect(14, 17, 4, 2, hair);
    }
  } else {
    body.rect(10, 10, 12, 7, skin); body.rect(11, 10, 10, 1, skinLight);
    body.rect(10, 16, 12, 2, skinShade); body.rect(12, 16, 8, 1, skin);
    body.rect(10, 9, 12, 2, hair); body.rect(9, 10, 3, 3, hair);
    body.rect(19, 10, 4, 2, hair); body.rect(11, 9, 5, 1, hairLight);
    body.rect(11, 12, 2, 3, INK); body.rect(19, 12, 2, 3, INK);
    body.px(11, 12, WHITE); body.px(19, 12, WHITE);
    body.rect(10, 11, 3, 1, hairShade); body.rect(19, 11, 3, 1, hairShade);
    body.px(15, 15, skinShade); body.rect(15, 16, 2, 1, color('#ad5b59'));
    if (gender === 'female') {
      body.rect(9, 10, 2, 7, hair); body.rect(21, 11, 2, 6, hair);
      body.px(10, 15, color('#ed9b99')); body.px(21, 15, color('#ed9b99'));
      body.px(15, 16, color('#c35970')); body.px(21, 17, light);
    } else { body.px(10, 13, hairShade); body.px(21, 13, hairShade); }
  }
  p.over(body);
}

export function renderFrame(signId: string, gender: Gender, direction: Direction, pose: Pose): Pixels {
  const sign = DESIGN.signs.find(value => value.id === signId);
  if (!sign || !['male', 'female'].includes(gender) || !DIRECTIONS.includes(direction) || ![0, 1, 2].includes(pose)) throw new Error('Closed actual24 avatar/frame identity');
  const frame = new Pixels();
  frame.over(headgear(sign, direction));
  human(frame, sign, gender, direction, pose);
  frame.over(headgear(sign, direction, true));
  return frame;
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

// Preview labels are tiny original fixed bitmaps, never used in Woka pixels.
const LETTERS: Record<string, string[]> = {
  A:['.##.','#..#','####','#..#','#..#'], B:['###.','#..#','###.','#..#','###.'], C:['.###','#...','#...','#...','.###'],
  D:['###.','#..#','#..#','#..#','###.'], E:['####','#...','###.','#...','####'], F:['####','#...','###.','#...','#...'],
  G:['.###','#...','#.##','#..#','.###'], H:['#..#','#..#','####','#..#','#..#'], I:['###','.#.','.#.','.#.','###'],
  J:['..##','...#','...#','#..#','.##.'], K:['#..#','#.#.','##..','#.#.','#..#'], L:['#...','#...','#...','#...','####'],
  M:['#...#','##.##','#.#.#','#...#','#...#'], N:['#..#','##.#','#.##','#..#','#..#'], O:['.##.','#..#','#..#','#..#','.##.'],
  P:['###.','#..#','###.','#...','#...'], Q:['.##.','#..#','#..#','#.##','.###'], R:['###.','#..#','###.','#.#.','#..#'],
  S:['.###','#...','.##.','...#','###.'], T:['#####','..#..','..#..','..#..','..#..'], U:['#..#','#..#','#..#','#..#','.##.'],
  V:['#..#','#..#','#..#','.##.','.##.'], W:['#...#','#...#','#.#.#','##.##','#...#'], X:['#..#','#..#','.##.','#..#','#..#'],
  Y:['#...#','.#.#.','..#..','..#..','..#..'], Z:['####','...#','..#.','.#..','####'], ' ':['..','..','..','..','..'],
};
function label(pixels: Pixels, text: string, x: number, y: number, fill: RGBA): void {
  for (const char of text.toUpperCase()) {
    const rows = LETTERS[char]; if (!rows) throw new Error('Closed preview label');
    pixels.stamp(rows, x, y, { '#': fill }); x += rows[0].length + 1;
  }
}
export async function writePreviews(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  for (const [name, background] of [['navy', '#13243c'], ['sand', '#efd5a0']] as const) {
    const sheet = new Pixels(432, 208); sheet.rect(0, 0, sheet.width, sheet.height, color(background));
    for (let signIndex = 0; signIndex < 12; signIndex++) {
      const x = (signIndex % 6) * 72, y = Math.floor(signIndex / 6) * 104;
      label(sheet, DESIGN.signs[signIndex].id, x + 3, y + 3, name === 'navy' ? WHITE : INK);
      sheet.over(renderFrame(DESIGN.signs[signIndex].id, 'male', 'down', 1), x + 3, y + 15);
      sheet.over(renderFrame(DESIGN.signs[signIndex].id, 'female', 'down', 1), x + 37, y + 15);
      sheet.over(renderFrame(DESIGN.signs[signIndex].id, 'male', 'up', 1), x + 3, y + 56);
      sheet.over(renderFrame(DESIGN.signs[signIndex].id, 'female', 'up', 1), x + 37, y + 56);
    }
    const raw = await png(sheet);
    await writeFile(path.join(directory, `identities-${name}-1x.png`), raw);
    await writeFile(path.join(directory, `identities-${name}-4x.png`), await sharp(raw).resize(sheet.width * 4, sheet.height * 4, { kernel: 'nearest' }).png().toBuffer());
  }
  const all = new Pixels(96 * 4, 128 * 6);
  all.rect(0, 0, all.width, all.height, color('#13243c'));
  for (let i = 0; i < 24; i++) all.over(renderSheet(SIGNS[Math.floor(i / 2)], i % 2 ? 'female' : 'male'), (i % 4) * 96, Math.floor(i / 4) * 128);
  await writeFile(path.join(directory, 'all288frames-2x.png'), await sharp(await png(all)).resize(all.width * 2, all.height * 2, { kernel: 'nearest' }).png().toBuffer());
  for (const sign of DESIGN.signs) {
    const pair = new Pixels(192, 128); pair.rect(0, 0, pair.width, pair.height, color('#13243c'));
    pair.over(renderSheet(sign.id, 'male')); pair.over(renderSheet(sign.id, 'female'), 96, 0);
    await writeFile(path.join(directory, `${sign.id}-all12-4x.png`), await sharp(await png(pair)).resize(768, 512, { kernel: 'nearest' }).png().toBuffer());
  }
}

export async function buildReadablePackage(output = path.join(ROOT, 'public/wokas/varcamp-zodiac-v2')): Promise<void> {
  await mkdir(output, { recursive: true });
  const assets = [], textures = [];
  for (const sign of DESIGN.signs) for (const gender of ['male', 'female'] as const) {
    const file = `${sign.id}-${gender}.png`, raw = await png(renderSheet(sign.id, gender));
    await writeFile(path.join(output, file), raw);
    const id = `varcamp-zodiac-v1-${sign.id}-${gender}`; // Existing selected identities are stable.
    assets.push({ id, file, sign: sign.id, gender, bytes: raw.length, sha256: sha(raw), rgbaSha256: sha(renderSheet(sign.id, gender).rgba) });
    textures.push({ id, name: `${sign.id[0].toUpperCase() + sign.id.slice(1)} · ${gender === 'male' ? 'Male' : 'Female'}`, file });
  }
  const source = await readFile(fileURLToPath(import.meta.url));
  const designRaw = await readFile(path.join(ROOT, 'art/source/wokas-readable-v2/native-design.json'));
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ version: 2, status: 'SOURCE_PACKAGE_NOT_LIVE_SELECTION', format: { sheet: [96, 128], frame: [32, 32], rows: DIRECTIONS, poseOrder: ['stride-a', 'idle', 'stride-b'], footBaseline: 30, walk: { rate: 10, frames: [0, 1, 2, 1] } }, source: { renderer: 'tools/wokas/readable-v2.ts', sha256: sha(source), design: 'art/source/wokas-readable-v2/native-design.json', designSha256: sha(designRaw), method: 'original hand-authored native RGBA pixels; no cropped/rescaled generated walk sheets', license: 'MIT' }, assets }, null, 2) + '\n');
  await writeFile(path.join(output, 'collection.template.json'), JSON.stringify({ version: 1, category: 'woka', assetBaseUrl: null, collection: { name: 'VarCamp Zodiac 2026', textures } }, null, 2) + '\n');
  await writeFile(path.join(output, 'README.md'), '# VarCamp Zodiac2026 readable native artwork v2\n\n24 original native32px human avatars:12 signs, male/female pairs, twelve frames each.\nThe96x128 PNG uses DOWN/LEFT/RIGHT/UP rows and stride-a/idle/stride-b columns.\nNo core framing, collisions or camera changes are required.\n\nExisting varcamp-zodiac-v1-* texture IDs are intentionally preserved. This resource\nfolder is versioned v2 so a later reviewed catalog can change URLs without losing\npeople\'s chosen identity or appending duplicate choices. The unbound template is\nnot a live catalog; publish/bind only through the separately reviewed operator.\n\nReproduce from the reviewed repo with node node_modules/tsx/dist/cli.mjs\n tools/wokas/readable-v2.ts. All pixels are painted directly by the TypeScript\nsource and sharp encodes them losslessly. Source/glyph/palette provenance is in\nmanifest.json. Original artwork is supplied under the repository MIT license.\n\nNo deployment or live selection outcome is claimed by this package.\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildReadablePackage();
  await writePreviews(path.resolve(ROOT, '../zodiac-readable-v2-review/previews'));
  console.log('Wrote24 native skins and source-only previews; no live catalog changed.');
}
