import type { MapId } from '../../src/world/catalog';

/** All layout coordinates are integer tiles; Tiled/WAM object coordinates are pixels. */
export interface TileRect { x: number; y: number; width: number; height: number; }
/** Native sprite repeated without scaling. "terrain" replaces earlier ground; other layers preserve overlapping pixels. */
export interface Placement extends TileRect {
 id: string; sprite: string; layer: string;
 /** Grounded decor is below avatars; cutaways show low trim while retaining the original physical footprint. */
 renderRole?: 'grounded' | 'canopy' | 'cutaway';
}
export interface LayoutSign extends TileRect { name: string; text: string; fontSize?: number; color?: string; align?: 'left' | 'center'; padding?: number; }
/** Separate native PNG, exported as its own 6×2 (192×64) or 4×2 (128×64) sheet and tile layer for WorkAdventure. */
export interface LayoutImage extends TileRect { name: string; image: string; standing?: boolean; }
export interface TileAnimationFrame { tileid: number; duration: number; }
/** One bounded native atlas/clock, kept separate from scenery stacking and collision masks. */
export interface LayoutAnimatedOverlay extends TileRect {
  name: string; image: string; sourceId: string;
  /** Native depth policy. Current airborne roles explicitly render after scenery. Historical default is unchanged. */
  level?: 'belowAvatar' | 'aboveAvatar' | 'aboveScenery';
  carrierTileIds: number[];
  animations: { id: number; frames: TileAnimationFrame[] }[];
  provenance?: { metadataPath: string; atlasSha256: string; inputs: { path: string; sha256: string }[] };
}
export interface Entry extends TileRect { name: string; isDefault?: boolean; }
export interface Exit extends TileRect { name: string; destination: MapId; entry: string; }
export interface LayoutArea extends TileRect { id?: string; name: string; properties: WamAreaProperty[]; }
export interface InspectionZone extends TileRect { name: string; kind: 'room' | 'auxiliary' | 'landmark'; }
export interface MapLayout {
  id: MapId;
  width: number;
  height: number;
  placements: Placement[];
  entries: Entry[];
  exits: Exit[];
  areas: LayoutArea[];
  inspectionZones: InspectionZone[];
  standingSigns?: {face:string; supports:string[]; text?:string; faceKind?:'image'}[];
  signs?: LayoutSign[];
  images?: LayoutImage[];
  animatedOverlays?: LayoutAnimatedOverlay[];
}
export interface TiledProperty { name: string; type: string; value: unknown; }
export interface TiledObject {
  id: number; name: string; x: number; y: number; width: number; height: number;
  type?: string; rotation?: number; visible?: boolean; gid?: number; properties?: TiledProperty[];
  [key: string]: unknown;
}
export interface LayerBase {
  id: number; name: string; visible?: boolean; opacity?: number; x?: number; y?: number;
  offsetx?: number; offsety?: number; properties?: TiledProperty[];
}
export interface TileLayer extends LayerBase { type: 'tilelayer'; width: number; height: number; data: number[]; }
export interface ObjectLayer extends LayerBase { type: 'objectgroup'; objects: TiledObject[]; }
export interface GroupLayer extends LayerBase { type: 'group'; layers: TiledLayer[]; }
export interface ImageLayer extends LayerBase { type: 'imagelayer'; image: string; imagewidth?: number; imageheight?: number; }
export type TiledLayer = TileLayer | ObjectLayer | GroupLayer | ImageLayer;
export interface TiledTileset {
  firstgid: number; name?: string; source?: string; tilewidth?: number; tileheight?: number;
  tilecount?: number; columns?: number; image?: string; imagewidth?: number; imageheight?: number;
  properties?: TiledProperty[];
  tiles?: { id: number; properties?: TiledProperty[]; image?: string; animation?: TileAnimationFrame[]; [key: string]: unknown }[];
  [key: string]: unknown;
}
/** Finite, array-encoded TMJ format used by this world, per Tiled 1.12.2. */
export interface TiledMap {
  type: 'map'; version: string | number; tiledversion?: string; orientation: string;
  renderorder?: string; infinite: boolean; width: number; height: number; tilewidth: number; tileheight: number;
  nextlayerid?: number; nextobjectid?: number; properties?: TiledProperty[];
  layers: TiledLayer[]; tilesets: TiledTileset[];
  [key: string]: unknown;
}
/** Property variants follow the pinned upstream map-editor schema; native areas are added later. */
export interface WamAreaProperty { id: string; type: string; [key: string]: unknown; }
export interface WamArea { id: string; name: string; visible: boolean; x: number; y: number; width: number; height: number; properties: WamAreaProperty[]; }
export interface WamEntity {
  x: number; y: number; name?: string; properties?: WamAreaProperty[];
  prefabRef: { collectionName: string; id: string };
  [key: string]: unknown;
}
export interface WamFile {
  version: string;
  mapUrl: string;
  entities: Record<string, WamEntity>;
  areas: WamArea[];
  entityCollections: { url: string; type: 'file' | 'marketplace' }[];
  lastCommandId?: string;
  settings?: { megaphone?: Record<string, unknown>; recording?: Record<string, unknown> };
  metadata?: Record<string, unknown>;
  vendor?: unknown;
}
