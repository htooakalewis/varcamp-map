import { readFileSync } from 'node:fs';
import type { TileRect } from '../maps/types';
export interface Sprite { sheet: string; rect: TileRect; blockingCells: [number, number][]; level: 'belowAvatar' | 'aboveAvatar'; sourceId: string; }
export type TileCatalog = Record<string, Sprite>;
export function loadTileCatalog(): TileCatalog { return JSON.parse(readFileSync(new URL('../../art/tile-catalog.json', import.meta.url), 'utf8')) as TileCatalog; }
