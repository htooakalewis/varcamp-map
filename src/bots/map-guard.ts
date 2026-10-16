import { ROUTES } from './venue';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid native map geometry');
  return value as RecordValue;
};
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, sorted(child)]));
  return value;
}
/** WA duplicates native object type into class; only that identical alias is non-geometric. */
function nativeLayers(layers: unknown[]): unknown[] {
  return layers.map(value => {
    const layer = record(value);
    if (layer.type === 'group' && Array.isArray(layer.layers)) return { ...layer, layers: nativeLayers(layer.layers) };
    if (layer.type !== 'objectgroup' || !Array.isArray(layer.objects)) return layer;
    return { ...layer, objects: layer.objects.map(value => {
      const object = record(value);
      if (typeof object.type !== 'string' || object.type.length === 0 || object.class !== object.type) return object;
      return Object.fromEntries(Object.entries(object).filter(([key]) => key !== 'class'));
    }) };
  });
}
/** Pin native layer data/properties and all embedded tileset definitions, ignoring release URLs. */
export async function guardMap(value: unknown): Promise<void> {
  const map = record(value);
  if (map.width !== 128 || map.height !== 128 || map.tilewidth !== 32 || map.tileheight !== 32 || !Array.isArray(map.layers) || !Array.isArray(map.tilesets) || !Array.isArray(map.properties)) throw Error('Incompatible native map geometry');
  const geometry = {
    width: map.width, height: map.height, tilewidth: map.tilewidth, tileheight: map.tileheight,
    layers: nativeLayers(map.layers),
    tilesets: map.tilesets.map(tileset => Object.fromEntries(Object.entries(record(tileset)).filter(([key]) => key !== 'image'))),
    properties: map.properties.filter(property => record(property).name !== 'script'),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(sorted(geometry)));
  const digest = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== ROUTES.provenance.geometrySha256) throw Error('Native map signature mismatch; re-audit routes before movement');
}
