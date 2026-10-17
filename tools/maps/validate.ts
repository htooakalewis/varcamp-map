import { emittedWamSchema } from './wam-schema';
import overworldLayout from '../../world/layouts/overworld.json';
import type { MapId, WORLD_CATALOG } from '../../src/world/catalog';
import { tiledMapSchema } from './schema';
import type { TiledLayer, TiledProperty, TileLayer } from './types';

export interface ValidationIssue { code: string; mapId: string; location: string; message: string; }
const property = (properties: TiledProperty[] | undefined, name: string) => properties?.find(p => p.name === name)?.value;
// Tiled reserves all four upper bits for flip/rotation flags, even on orthogonal maps.
const gid = (value: number) => (value & 0x0fffffff) >>> 0;

export function validateMap(map: unknown, catalog: typeof WORLD_CATALOG): ValidationIssue[] {
  const parsed = tiledMapSchema.safeParse(map);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => ({ code: 'SCHEMA_INVALID', mapId: 'unknown', location: issue.path.join('.') || '$', message: issue.message }));
  }
  const tmj = parsed.data;
  const identity = property(tmj.properties, 'worldMapId');
  const mapId = typeof identity === 'string' ? identity : 'unknown';
  const issues: ValidationIssue[] = [];
  const add = (code: string, location: string, message: string) => issues.push({ code, mapId, location, message });
  const definition = Object.hasOwn(catalog, mapId) ? catalog[mapId as MapId] : undefined;
  if (!definition) add('UNKNOWN_MAP', 'properties.worldMapId', 'Set worldMapId to a catalog map ID');
  if (tmj.orientation !== 'orthogonal' || tmj.tilewidth !== 32 || tmj.tileheight !== 32 || tmj.infinite) {
    add('MAP_FORMAT', '$', 'World maps must be finite orthogonal maps with 32×32 pixel tiles');
  }
  if (definition && (tmj.width !== definition.width || tmj.height !== definition.height)) {
    add('MAP_DIMENSIONS', '$', `Expected ${definition.width}×${definition.height} tiles`);
  }
  const layers: { layer: TiledLayer; path: string; offsetX: number; offsetY: number }[] = [];
  function flatten(children: TiledLayer[], path = 'layers', parentX = 0, parentY = 0): void {
    children.forEach((layer, i) => {
      const offsetX = parentX + (layer.x ?? 0) + (layer.offsetx ?? 0) / tmj.tilewidth;
      const offsetY = parentY + (layer.y ?? 0) + (layer.offsety ?? 0) / tmj.tileheight;
      const location = `${path}.${i}`;
      if (layer.type === 'group') flatten(layer.layers, `${location}.layers`, offsetX, offsetY);
      else layers.push({ layer, path: location, offsetX, offsetY });
    });
  }
  flatten(tmj.layers);
  if (!layers.some(({ layer }) => layer.name === 'floorLayer' && layer.type === 'objectgroup')) {
    add('FLOOR_LAYER_MISSING', 'layers', 'A floorLayer object group is required');
  }
  const ranges: { first: number; end: number }[] = [];
  const collisionGids = new Set<number>();
  const tilesetNames = new Set<string>();
  tmj.tilesets.forEach((tileset, i) => {
    const path = `tilesets.${i}`;
    if(tileset.name){
      if(tilesetNames.has(tileset.name))add('TILESET_NAME_DUPLICATE',`${path}.name`,'Tileset names must be unique: WorkAdventure binds atlas images by name, not firstgid');
      tilesetNames.add(tileset.name);
    }
    if (tileset.source) add('EXTERNAL_TILESET', `${path}.source`, 'Embed tileset definitions instead of external TSX/TSJ references');
    if (!tileset.source && (!tileset.name || !tileset.tilecount || tileset.tilewidth !== 32 || tileset.tileheight !== 32)) {
      add('TILESET_FORMAT', path, 'Embedded tilesets require a name, tilecount and 32×32 tiles');
    }
    if (tileset.tilecount) ranges.push({ first: tileset.firstgid, end: tileset.firstgid + tileset.tilecount });
    for (const tile of tileset.tiles ?? []) {
      const collides = tile.properties?.find(p => p.name === 'collides');
      if (collides && (collides.type !== 'bool' || typeof collides.value !== 'boolean')) {
        add('COLLISION_PROPERTY', `${path}.tiles.${tile.id}.properties.collides`, 'collides must be a boolean Tiled property');
      }
      if (collides?.value === true && collides.type === 'bool') collisionGids.add(tileset.firstgid + tile.id);
    }
  });
  const isEmbeddedGid = (value: number) => ranges.some(range => gid(value) >= range.first && gid(value) < range.end);
  const blocked = new Set<string>();
  const exits = new Set<string>();
  const spawnLayers: { layer: TileLayer; path: string; cells: string[] }[] = [];
  for (const { layer, path, offsetX, offsetY } of layers) {
    if (layer.type === 'objectgroup') {
      layer.objects.forEach((object, index) => {
        if (object.gid !== undefined && !isEmbeddedGid(object.gid)) {
          add('INVALID_GID', `${path}.objects.${index}.gid`, `GID ${gid(object.gid)} does not resolve to an embedded tile`);
        }
      });
    }
    if (layer.type !== 'tilelayer') continue;
    const isSpawn = layer.name === 'start' || property(layer.properties, 'start') === true || property(layer.properties, 'startLayer') === true;
    if (layer.data.length !== layer.width * layer.height) add('TILE_DATA_LENGTH', `${path}.data`, 'Tile data length must equal layer width × height');
    if (layer.width !== tmj.width || layer.height !== tmj.height) add('LAYER_DIMENSIONS', path, 'Finite tile layers must match map dimensions');
    const cells: string[] = [];
    for (const [index, value] of layer.data.entries()) {
      const tileGid = gid(value);
      if (tileGid === 0) continue;
      if (!isEmbeddedGid(value)) add('INVALID_GID', `${path}.data.${index}`, `GID ${tileGid} does not resolve to an embedded tile`);
      const x = index % layer.width + offsetX;
      const y = Math.floor(index / layer.width) + offsetY;
      if (isSpawn) {
        if (!Number.isInteger(x) || !Number.isInteger(y)) add('SPAWN_POSITION', `${path}.data.${index}`, `Spawn position ${x},${y} must align to integer tiles`);
        else if (x < 0 || y < 0 || x >= tmj.width || y >= tmj.height) add('SPAWN_BOUNDS', `${path}.data.${index}`, `Spawn position ${x},${y} is outside map bounds`);
      }
      const cell = `${x},${y}`;
      cells.push(cell);
      if (collisionGids.has(tileGid)) blocked.add(cell);
      if (typeof property(layer.properties, 'exitUrl') === 'string') exits.add(cell);
    }
    if (isSpawn) {
      spawnLayers.push({ layer, path, cells });
      if (cells.length === 0) add('SPAWN_EMPTY', path, 'Spawn layers must contain at least one tile');
    }
  }
  if (!spawnLayers.some(({ layer }) => layer.name === 'start' || property(layer.properties, 'start') === true)) add('DEFAULT_SPAWN_MISSING', 'layers', 'A nonempty default start layer is required');
  for (const entry of definition?.entries ?? []) {
    if (!spawnLayers.some(({ layer }) => layer.name === entry)) add('ENTRY_MISSING', 'layers', `Missing named start layer ${entry}`);
  }
  for (const { path, cells } of spawnLayers) {
    for (const cell of cells) {
      if (blocked.has(cell)) add('SPAWN_BLOCKED', path, `Spawn tile ${cell} overlaps collision`);
      if (exits.has(cell)) add('SPAWN_EXIT_OVERLAP', path, `Spawn tile ${cell} immediately triggers an exit`);
    }
  }
  // These public/legacy hashes are one closed wayfinding contract. Validate the
  // emitted tiles in BOTH author exports and native-preserving builds, so an
  // alias can never silently drift to the wrong side of a decorative gate.
  if (mapId === 'overworld') {
    const families = {
      solar: ['from-solar'], lunar: ['from-lunar'], maze: ['from-maze'],
      festival: ['from-festival', 'from-arcade'], shipyard: ['from-shipyard'],
      campus: ['from-campus', 'from-fire', 'from-earth', 'from-air', 'from-water', 'from-observatory'],
    };
    const expected = Object.values(families).flat().sort();
    const actual = spawnLayers.filter(s => s.layer.name.startsWith('from-') && !s.layer.name.startsWith('from-speaker-'));
    if (JSON.stringify(actual.map(s => s.layer.name).sort()) !== JSON.stringify(expected)) {
      add('RETURN_ALIAS_SET', 'layers', 'Public return aliases must match the closed six gate families');
    }
    for (const [family, aliases] of Object.entries(families)) {
      const gates = layers.filter(({ layer }) => layer.name === `exit-${family}` && layer.type === 'tilelayer');
      if (gates.length !== 1) { add('RETURN_APPROACH', family, 'Require one concrete gate aperture'); continue; }
      const gate = gates[0];
      const layer = gate.layer as TileLayer;
      // A named painted aperture alone is not a working destination. The
      // authored exit owns its route; the existing catalog owns valid entries.
      const authored = overworldLayout.exits.find(exit => exit.name === family);
      const destination = authored && Object.hasOwn(catalog, authored.destination) ? catalog[authored.destination as MapId] : undefined;
      const urls = layer.properties?.filter(p => p.name === 'exitUrl') ?? [];
      if (!authored || !destination?.entries.some(entry => entry === authored.entry) || urls.length !== 1 || urls[0].type !== 'string' || urls[0].value !== `${authored.destination}.wam#${authored.entry}`) {
        add('RETURN_DESTINATION', layer.name, 'Gate must retain its authored destination and a catalog entry');
      }
      const targets = new Set(layer.data.flatMap((v, i) => v ? [`${i % layer.width + gate.offsetX},${Math.floor(i / layer.width) + gate.offsetY}`] : []));
      const points = [...targets].map(c => c.split(',').map(Number));
      const xs = new Set(points.map(p => p[0])), ys = new Set(points.map(p => p[1]));
      if (!points.length || (xs.size !== 1 && ys.size !== 1)) { add('RETURN_APPROACH', family, 'Gate aperture must be a nonempty straight tile segment'); continue; }
      const dx = xs.size === 1 ? (points[0][0] < tmj.width / 2 ? -1 : 1) : 0;
      const dy = xs.size === 1 ? 0 : (points[0][1] < tmj.height / 2 ? -1 : 1);
      let anchor: string | undefined;
      for (const alias of aliases) {
        const matches = actual.filter(s => s.layer.name === alias);
        if (matches.length !== 1) continue; // The closed-set check reports missing/duplicate aliases.
        const cells = matches[0].cells;
        const shape = JSON.stringify([...cells].sort());
        const sx = new Set(cells.map(c => Number(c.split(',')[0]))), sy = new Set(cells.map(c => Number(c.split(',')[1])));
        if (cells.length !== 4 || new Set(cells).size !== 4 || sx.size !== 2 || sy.size !== 2 || Math.max(...sx) - Math.min(...sx) !== 1 || Math.max(...sy) - Math.min(...sy) !== 1 || (anchor !== undefined && anchor !== shape)) {
          add('RETURN_FAMILY', alias, 'Every family alias must share the same four spawn tiles');
        }
        anchor ??= shape;
        for (const start of cells) {
          const [x, y] = start.split(',').map(Number);
          let reached = false;
          for (let n = 0; n <= tmj.width + tmj.height; n++) {
            const nx = x + dx * n, ny = y + dy * n, cell = `${nx},${ny}`;
            if (nx < 0 || ny < 0 || nx >= tmj.width || ny >= tmj.height || blocked.has(cell) || (exits.has(cell) && !targets.has(cell))) break;
            if (targets.has(cell)) { reached = true; break; }
          }
          if (!reached) add('RETURN_APPROACH', alias, `Spawn ${start} needs a clear straight approach to its own gate aperture`);
        }
      }
    }
  }
  return issues;
}

/** Native-property shape plus ID relationships used by generated maps. */
export function validateWam(input: unknown): ValidationIssue[] {
  const parsed=emittedWamSchema.safeParse(input);
  if(!parsed.success)return parsed.error.issues.map(i=>({code:'WAM_SCHEMA_INVALID',mapId:'unknown',location:i.path.join('.'),message:i.message}));
  const wam=parsed.data,issues:ValidationIssue[]=[],ids=new Set<string>();
  const add=(code:string,location:string,message:string)=>issues.push({code,mapId:wam.mapUrl,location,message});
  for(const [i,a] of wam.areas.entries()) {
    if(!a.id||ids.has(a.id))add('WAM_AREA_ID',`areas.${i}.id`,'Area IDs must be nonempty and unique');ids.add(a.id);
    for(const [j,p]of a.properties.entries())if(p.type==='listenerMegaphone'&&!wam.areas.some(stage=>stage.id===p.speakerZoneName&&stage.properties.some(prop=>prop.type==='speakerMegaphone')))add('WAM_LISTENER_REFERENCE',`areas.${i}.properties.${j}`,'Listener must reference an existing speaker area ID, not a broadcast display name');
  }
  return issues;
}
