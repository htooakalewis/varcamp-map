import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import type {TiledMap,TileLayer} from '../../tools/maps/types';
function pinned(name: string, sha: string) {
  const bytes = readFileSync(`tests/fixtures/workadventure-96d43a84/${name}.ts.txt`);
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw Error(`Changed pinned ${name}`);
  return bytes.toString();
}
const calculator = pinned('StartPositionCalculator', '78ba5907ff74458ee4bcbb8faf2a6c4daa5071b8c905ae85ff0c83cfed8ca7ad');
const methods = pinned('StartLayerMethods', '7d722386465a4538ee6e53841ef00a73a4773d72c68e9d2b38d9c4c745a8b390');
const compile = (code: string) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const createProbe = new Function('MathUtils', 'GameMapProperties', `${compile(`class Probe { ${methods} }`)};return Probe;`);
const createCompute = new Function('MathUtils', 'localUserStore', `${compile(calculator.replace(/^import .*\n/gm, '').replace('export function computeStartPosition', 'function computeStartPosition'))};return computeStartPosition;`);

// Execute the unchanged pinned selector and layer-selection methods. Only browser
// persistence and the wrapper's map boundary are supplied here; no player state or
// selected-layer result is mocked. Removing/moving the native start alias must fail.
export function startPosition(map: TiledMap, sample: number, name?: string): { x: number; y: number } {
  const MathUtils = {
    randomFromArray: <T>(items: T[]) => items[sample % items.length],
    randomPositionFromRect: () => { throw Error('Unexpected area-based spawn in hub fixture'); },
  };
  const Probe = createProbe(MathUtils, { START: 'start', START_LAYER: 'startLayer' });
  const wrapper = Object.assign(new Probe(), {
    dynamicAreas: new Map(), getAreas: () => new Map(), getAreaByName: () => undefined,
    getFlatLayers: () => map.layers,
    findLayer: (layerName: string) => map.layers.find(l => l.name === layerName),
    getTiledObjectProperty: (object: TileLayer, property: string) => object.properties?.find(p => p.name === property)?.value,
    hasStartTile: () => map.tilesets.some(t => t.tiles?.some(tile => tile.properties?.some(p => p.name === 'start'))),
  });
  const compute = createCompute(MathUtils, { getLocalUser: () => undefined });
  return compute(wrapper, map, undefined, name);
}
