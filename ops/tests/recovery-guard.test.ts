import {execFileSync} from 'node:child_process';
import {describe, expect, it} from 'vitest';

// Real local validators and filesystem mutations; every fixture is synthetic.
describe('private generation and isolated recovery guards', () => {
  for (const group of ['positive', 'custody', 'manifest', 'target', 'cleanup', 'inert']) {
    it(`enforces ${group} before any target write`, () => {
      const result = JSON.parse(execFileSync('python3', [
        'ops/tests/recovery-guard-fixture.py', group,
      ], {encoding: 'utf8'}));
      expect(result).toMatchObject({available: true, passed: true});
      expect(result.cases).toBeGreaterThan(0);
    });
  }
});
