import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const manifest = JSON.parse(readFileSync(resolve(root, 'publication/source-manifest.json'), 'utf8'));
const inventory = manifest.sourceInventory;
const extensions = manifest.extensionInventory ?? {};
assert.equal(Object.keys(inventory).length, 303);
for (const path of Object.keys(extensions)) {
  assert.ok(!Object.hasOwn(inventory, path), `Extension overlaps frozen source: ${path}`);
  assert.ok(existsSync(resolve(root, path)), `Missing extension source: ${path}`);
}
for (const [path, expected] of Object.entries(inventory)) {
  const hash = createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
  assert.equal(hash, expected, `Frozen source changed: ${path}`);
}
for (const [path, expected] of Object.entries(extensions)) {
  const hash = createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
  assert.equal(hash, expected, `Extension source changed: ${path}`);
}
const folders = ['app', 'art', 'assets', 'maps', 'src', 'tools', 'tests', 'world'];
const files = folders.flatMap(folder => readdirSync(resolve(root, folder), { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => relative(root, resolve(entry.parentPath, entry.name))).sort()).sort();
const reviewedFiles = [...Object.keys(inventory), ...Object.keys(extensions)]
  .filter(path => folders.some(folder => path.startsWith(`${folder}/`))).sort();
assert.deepEqual(files, reviewedFiles, 'Source inventory has missing or additional files');
const maps = readdirSync(resolve(root, 'maps'));
const ids = extension => maps.filter(path => path.endsWith(extension)).map(path => path.slice(0, -extension.length)).sort();
assert.equal(ids('.tmj').length, 33);
assert.deepEqual(ids('.tmj'), ids('.wam'), 'Native TMJ and WAM map IDs differ');
assert.equal(manifest.maps, 33);
assert.equal(manifest.wams, 33);
assert.equal(manifest.sourceFilesByteExact, 303);
console.log(`Verified all 303 frozen source hashes, ${Object.keys(extensions).length} reviewed extension hashes and 33 native TMJ/WAM map pairs. No source files were rewritten.`);
