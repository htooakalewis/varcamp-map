import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

type ValidationError = { type: string; message: string; details: string };
type Fetcher = { fileExists(path: string): Promise<boolean> };
const fixture = (name: string, sha: string): string => {
  const bytes = readFileSync(new URL(`../fixtures/workadventure-96d43a84/${name}.ts.txt`, import.meta.url));
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`Changed pinned ${name} fixture`);
  return bytes.toString();
};
const compile = (source: string) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const fetcher = fixture('ZipFileFetcher', '939e18fc63a8fba29217bbc2718aaf98bec3f290926668559cf91c82936d7339');
const ZipFileFetcher = new Function('path', `${compile(fetcher.replace(/^import .*\n/gm, '').replace('export class', 'class'))}; return ZipFileFetcher;`)(path) as new (map: string, files: string[]) => Fetcher;
const validator = fixture('MapValidator', '721b8a47ebd5010e9822320e3f2e3ba1f35ed22fe9089e173d4c503544285753');
const start = validator.indexOf('    private async validateTileset(');
const end = validator.indexOf('\n    /**', start);
if (start < 0 || end < 0) throw new Error('Missing pinned validator method boundary');
// Only supply its class field/constructor; the actual pinned method body is untouched.
const Probe = new Function(`${compile(`class Probe { constructor(private fileFetcher: unknown) {} ${validator.slice(start, end)} }`)}; return Probe;`)() as new (fetcher: Fetcher) => { validateTileset(map: unknown): Promise<ValidationError[]> };

export async function pinnedTilesetValidation(maps: Record<string, unknown>, files: string[]) {
  let rejectedReferences = 0, mapsRejected = 0;
  for (const [name, map] of Object.entries(maps)) {
    const errors = (await new Probe(new ZipFileFetcher(name, files)).validateTileset(map)).filter(error => error.type === 'error');
    rejectedReferences += errors.length;
    if (errors.length) mapsRejected++;
  }
  return { rejectedReferences, mapsRejected };
}
