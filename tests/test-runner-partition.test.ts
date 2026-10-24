import { expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testName = /\.(?:test|spec)\.(?:c|m)?[jt]sx?$/;
function testFiles(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? testFiles(path) : testName.test(entry.name) ? [path.replaceAll('\\', '/')] : [];
  });
}

it('partitions every test in the owned roots between actual Vitest discovery and native Node', () => {
  const all = [...testFiles('tests'), ...testFiles('ops/tests')].sort();
  const native = all.filter(path => /^ops\/tests\/[^/]+\.test\.mjs$/.test(path));
  const expectedVitest = all.filter(path => !native.includes(path));
  const listed = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'list', '--filesOnly', '--json'], {
    cwd: root, encoding: 'utf8', timeout: 30000,
  });
  expect(listed.status, listed.stderr).toBe(0);
  const files: { file: string }[] = JSON.parse(listed.stdout);
  const actual = files.map(({ file }) => relative(root, resolve(root, file)).replaceAll('\\', '/')).sort();
  expect(actual).toEqual(expectedVitest);
  expect(native.length).toBeGreaterThan(0);
  for (const path of native) expect(readFileSync(join(root, path), 'utf8')).toMatch(/from\s*['"]node:test['"]/);
});

it('runs native Node suites explicitly before Vitest in the devbox deploy script while preserving npm test argument forwarding', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  expect(pkg.scripts.test).toBe('vitest run');
  expect(pkg.scripts['test:node']).toBe('node --test ops/tests/*.test.mjs');
  expect(pkg.scripts['deploy:demo']).toBe('bash ops/deploy-demo.sh');
  const deploy = readFileSync(join(root, 'ops/deploy-demo.sh'), 'utf8');
  const native = deploy.indexOf('npm run test:node');
  const vitest = deploy.indexOf('npm test -- --maxWorkers=1 --testTimeout=30000');
  expect(native).toBeGreaterThan(-1);
  expect(vitest).toBeGreaterThan(native);
});
