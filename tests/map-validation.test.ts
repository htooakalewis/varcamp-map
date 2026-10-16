import { describe, expect, it } from 'vitest';
import { WORLD_CATALOG } from '../src/world/catalog';
import { validateMap } from '../tools/maps/validate';

const props = (name: string, value: unknown, type = 'bool') => [{ name, type, value }];
function validMap() {
  const data = Array<number>(40 * 36).fill(0);
  data[41] = 1;
  return {
    type: 'map', version: '1.10', tiledversion: '1.12.2', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
    width: 40, height: 36, tilewidth: 32, tileheight: 32, nextlayerid: 4, nextobjectid: 1,
    properties: props('worldMapId', 'hidden-observatory', 'string'),
    tilesets: [{ firstgid: 1, name: 'fixture', tilewidth: 32, tileheight: 32, tilecount: 2, columns: 2, image: '../tilesets/fixture.png', imagewidth: 64, imageheight: 32, tiles: [{ id: 1, properties: props('collides', true) }] }],
    layers: [
      { id: 1, type: 'objectgroup', name: 'floorLayer', objects: [] },
      { id: 2, type: 'tilelayer', name: 'observatory-entry', width: 40, height: 36, data: [...data], properties: [...props('startLayer', true), ...props('start', true)] },
      { id: 3, type: 'tilelayer', name: 'walls', width: 40, height: 36, data: Array<number>(40 * 36).fill(0) },
    ],
  };
}
const codes = (map: unknown) => validateMap(map, WORLD_CATALOG).map(issue => issue.code);

describe('map validation', () => {
  it('accepts a finite embedded map with a walkable named default arrival', () => {
    expect(validateMap(validMap(), WORLD_CATALOG)).toEqual([]);
  });
  it('rejects a missing floorLayer object group', () => {
    const map = validMap(); map.layers.splice(0, 1);
    expect(codes(map)).toContain('FLOOR_LAYER_MISSING');
  });
  it('rejects external TSX references', () => {
    const map = validMap(); Object.assign(map.tilesets[0], { source: 'fixture.tsx' });
    expect(codes(map)).toContain('EXTERNAL_TILESET');
  });
  it('rejects duplicate embedded tileset names before WorkAdventure binds the wrong firstgid',()=>{
    const map=validMap();map.tilesets.push({...structuredClone(map.tilesets[0]),firstgid:3});
    expect(validateMap(map,WORLD_CATALOG)).toEqual(expect.arrayContaining([expect.objectContaining({code:'TILESET_NAME_DUPLICATE',location:'tilesets.1.name'})]));
  });
  it('allows one atlas image to support multiple uniquely named tilesets',()=>{
    const map=validMap();map.tilesets.push({...structuredClone(map.tilesets[0]),firstgid:3,name:'fixture-animation-alias'});
    expect(codes(map)).toEqual([]);
  });
  it('rejects a GID outside the embedded tileset ranges', () => {
    const map = validMap(); map.layers[2].data![0] = 3;
    expect(codes(map)).toContain('INVALID_GID');
  });
  it('accepts legal flipped GIDs by masking the Tiled transform flags', () => {
    const map = validMap(); map.layers[2].data![0] = 2147483649;
    expect(codes(map)).toEqual([]);
  });
  it('rejects truncated tile data', () => {
    const map = validMap(); map.layers[2].data!.pop();
    expect(codes(map)).toContain('TILE_DATA_LENGTH');
  });
  it('rejects an arrival on any collision layer', () => {
    const map = validMap(); map.layers[2].data![41] = 2;
    expect(codes(map)).toContain('SPAWN_BLOCKED');
  });
  it('rejects arrival tiles overlapping exit triggers', () => {
    const map = validMap(); map.layers[2].data![41] = 1; map.layers[2].properties = props('exitUrl', 'overworld.wam#from-observatory', 'string');
    expect(codes(map)).toContain('SPAWN_EXIT_OVERLAP');
  });
  it('requires boolean collision properties', () => {
    const map = validMap(); map.tilesets[0].tiles[0].properties = props('collides', 'true', 'string');
    expect(codes(map)).toContain('COLLISION_PROPERTY');
  });
  it('requires a default spawn and each catalog entry', () => {
    const map = validMap(); map.layers[1].properties = []; map.layers[1].name = 'decoration';
    expect(codes(map)).toContain('DEFAULT_SPAWN_MISSING');
    expect(codes(map)).toContain('ENTRY_MISSING');
  });
  it('rejects an unknown world map identity', () => {
    const map = validMap(); map.properties[0].value = 'other-map';
    expect(codes(map)).toContain('UNKNOWN_MAP');
  });
  it('reports structural errors without throwing for malformed input', () => {
    const issues = validateMap({ type: 'map', layers: 'broken' }, WORLD_CATALOG);
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SCHEMA_INVALID', mapId: 'unknown', location: expect.any(String), message: expect.any(String) })]));
  });
  it('enforces orthogonal 32px finite maps with catalog dimensions', () => {
    const map = validMap(); map.orientation = 'isometric'; map.tilewidth = 16; map.width = 39;
    expect(codes(map)).toContain('MAP_FORMAT');
    expect(codes(map)).toContain('MAP_DIMENSIONS');
  });
});

// Omitting a Tiled property's value must not be accepted as a valid JSON property.
it('rejects properties without a JSON value', () => {
  const map = validMap();
  delete (map.properties[0] as { value?: unknown }).value;
  expect(codes(map)).toContain('SCHEMA_INVALID');
});

// Tile objects must resolve through the same embedded ranges as tile layers.
it.each([999, 2147484647, 2147483648, 0])('rejects invalid tile object GID %i', objectGid => {
  const map = validMap();
  Object.assign(map.layers[0], { objects: [{ id: 1, name: 'tile-object', x: 64, y: 64, width: 32, height: 32, gid: objectGid }] });
  expect(validateMap(map, WORLD_CATALOG)).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'INVALID_GID', mapId: 'hidden-observatory', location: 'layers.0.objects.0.gid' }),
  ]));
});
it.each([1, 2147483649, 1073741825, 536870913, 4026531841])('accepts embedded tile object GID %i with masked transform flags', objectGid => {
  const map = validMap();
  Object.assign(map.layers[0], { objects: [{ id: 1, name: 'tile-object', x: 64, y: 64, width: 32, height: 32, gid: objectGid }] });
  expect(codes(map)).toEqual([]);
});
it.each([
  { offsetx: 1280, offsety: 0 },
  { offsetx: -64, offsety: 0 },
  { offsetx: 0, offsety: 1152 },
  { offsetx: 0, offsety: -64 },
  { x: 64, y: 0 },
])('rejects an arrival shifted outside map bounds by %o', position => {
  const map = validMap(); Object.assign(map.layers[1], position);
  expect(codes(map)).toContain('SPAWN_BOUNDS');
});
it.each([{ offsetx: 16 }, { offsety: 1 }])('rejects fractional-tile arrival positioning by %o', position => {
  const map = validMap(); Object.assign(map.layers[1], position);
  expect(codes(map)).toContain('SPAWN_POSITION');
});
it('checks arrival bounds inherited from a containing group', () => {
  const map = validMap();
  const grouped = { ...map, layers: [map.layers[0], { id: 4, name: 'shifted', type: 'group', offsetx: 1280, layers: [map.layers[1]] }, map.layers[2]] };
  expect(codes(grouped)).toContain('SPAWN_BOUNDS');
});
it('accepts tile-aligned arrival translations at the map boundary', () => {
  const map = validMap(); Object.assign(map.layers[1], { offsetx: 1216, offsety: 1088 });
  // The fixture arrival starts at (1,1), ending at the legal last cell (39,35).
  expect(codes(map)).toEqual([]);
});
