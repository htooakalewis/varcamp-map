import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('runs all eleven Python editor catalog preservation and refusal checks', () => {
  const result = spawnSync('python3', ['ops/tests/test_editor_catalogs.py'], {
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.signal, result.stderr).toBeNull();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toMatch(/Ran 11 tests\b/);
  expect(result.stderr).toMatch(/\bOK\s*$/);
});
