import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WORLD_CATALOG } from '../../src/world/catalog';
import { validateMap, validateWam } from './validate';

const directory = resolve(process.argv[2] ?? 'maps');
const files = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ENOENT') return [];
  throw error;
});
let count = 0;
let errors = 0;
for (const file of files.filter(file => file.endsWith('.tmj') || file.endsWith('.wam')).sort()) {
  count++;
  try {
    const input: unknown = JSON.parse(await readFile(resolve(directory, file), 'utf8'));
    const issues = file.endsWith('.wam') ? validateWam(input) : validateMap(input, WORLD_CATALOG);
    errors += issues.length;
    for (const issue of issues) console.error(`${file}: ${issue.code} at ${issue.location}: ${issue.message}`);
  } catch (error) {
    console.error(`${file}: READ_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    errors++;
  }
}
console.info(`Catalog: ${Object.keys(WORLD_CATALOG).length} maps. Validated ${count} current TMJ/WAM files; ${errors} issues.`);
if (count === 0) console.info('Foundation only: no maps constructed yet. This does not validate the complete world package.');
process.exitCode = errors === 0 ? 0 : 1;
