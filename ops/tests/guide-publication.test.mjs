import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, copyFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as runner from '../bots/runner.mjs';

test('every retired CLI spelling refuses before any provider lookup or mutation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'guide-retired-cli-'));
  const marker = join(directory, 'provider-called');
  try {
    writeFileSync(join(directory, 'docker'), `#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.GUIDE_PROVIDER_MARKER, 'called'); console.log('[]');\n`, { mode: 0o700 });
    for (const args of [[], ['status'], ['start', 'sha256:' + 'a'.repeat(64)], ['stop'], ['logs'], ['lyra', 'status'], ['nova', 'start'], ['orion', 'stop'], ['all', 'status']]) {
      const result = spawnSync(process.execPath, [new URL('../bots/cli.mjs', import.meta.url).pathname, ...args], { encoding: 'utf8', env: { ...process.env, PATH: directory, GUIDE_PROVIDER_MARKER: marker } });
      assert.equal(result.status, 2, JSON.stringify(args));
      assert.match(result.stderr, /retired.*persistent-service/i);
      assert.equal(result.stdout, '');
      assert.equal(existsSync(marker), false, 'retired entry must not import or invoke a provider');
    }
    const text = readFileSync(new URL('../bots/cli.mjs', import.meta.url), 'utf8');
    assert.doesNotMatch(text, /(?:import\s|require\()/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('the actual copied image closure includes the renderer-aware runner and policy', async () => {
  const dockerfile = readFileSync(new URL('../bots/Dockerfile', import.meta.url), 'utf8');
  const copies = dockerfile.trim().split('\n').filter(line => line.startsWith('COPY ')).flatMap(line => line.split(' ').slice(1, -1));
  assert.ok(copies.includes('candidate-render-policy.mjs'));
  const directory = mkdtempSync(join(tmpdir(), 'guide-image-closure-'));
  try {
    for (const file of copies) {
      const input = new URL('../bots/' + file, import.meta.url);
      assert.equal(statSync(input).mode & 0o004, 0o004, `COPY defaults to root ownership; image USER1000 must read ${file}`);
      copyFileSync(input, join(directory, file));
    }
    const copied = await import(pathToFileURL(join(directory, 'runner.mjs')));
    assert.equal(typeof copied.initializeCandidate, 'function');
    const policy = await import(pathToFileURL(join(directory, 'candidate-render-policy.mjs')));
    assert.equal(policy.parseCandidateMode(['--renderer-mode=canvas']), 'canvas');
    for (const args of [[], ['--renderer-mode=webgl'], ['--renderer-mode=canvas', '--extra']]) assert.throws(() => policy.parseCandidateMode(args));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('renderer proof is required before healthy readiness', async () => {
  const state = runner.createRunnerLifecycle();
  const now = Date.now();
  state.observe({ identity: { playerId: 7001 }, outcome: 'progress', evidence: { steps: 1, at: now, operationBudgetMs: 10000, leaseDeadline: now + 10000 } });
  await assert.rejects(state.ready({ playerId: 7001 }), /renderer/);
});

test('public service release data is explicitly unbound', () => {
  const binding = readFileSync(new URL('../bots/persistent-service/service/release_binding.py', import.meta.url), 'utf8');
  assert.match(binding, /^REVIEWED_PLAN_SHA256 = None$/m);
  assert.match(binding, /^REVIEWED_RELEASE = None$/m);
  assert.equal(binding.match(/^REVIEWED_/gm)?.length, 2);
});
