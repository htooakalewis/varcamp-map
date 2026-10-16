import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const manifest = JSON.parse(readFileSync(resolve(root, 'publication/source-manifest.json'), 'utf8'));
const inventory = manifest.sourceInventory;
assert.equal(Object.keys(inventory).length, 303);
const folders = ['app', 'art', 'assets', 'maps', 'src', 'tools', 'tests', 'world'];
const files = folders.flatMap(folder => readdirSync(resolve(root, folder), { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => relative(root, resolve(entry.parentPath, entry.name))).sort()).sort();
assert.deepEqual(files, Object.keys(inventory).sort(), 'Source inventory has missing or additional files');
for (const path of files) {
  const hash = createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
  assert.equal(hash, inventory[path], `Frozen source changed: ${path}`);
}
const maps = readdirSync(resolve(root, 'maps'));
const ids = extension => maps.filter(path => path.endsWith(extension)).map(path => path.slice(0, -extension.length)).sort();
assert.equal(ids('.tmj').length, 33);
assert.deepEqual(ids('.tmj'), ids('.wam'), 'Native TMJ and WAM map IDs differ');
assert.equal(manifest.maps, 33);
assert.equal(manifest.wams, 33);
assert.equal(manifest.sourceFilesByteExact, 303);
console.log('Verified all 303 frozen source hashes and 33 native TMJ/WAM map pairs. No source files were rewritten.');
