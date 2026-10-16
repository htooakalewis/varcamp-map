import { config } from '../bots/config.mjs';
import { expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

it('health command fails closed for absent, malformed, stale, stopped, and wrong-module state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lyra-health-')); const path = join(dir, 'health.json');
  const command = ['ops/bots/healthcheck.mjs', path];
  const valid = { healthy: true, updatedAt: Date.now(), moduleSha256: config.moduleSha256, persona: 'lyra', error: null };
  try {
    expect(spawnSync(process.execPath, command).status).toBe(1);
    for (const input of ['bad json', JSON.stringify({ ...valid, updatedAt: Date.now() - 20000 }), JSON.stringify({ ...valid, updatedAt: Date.now() + 20000 }), JSON.stringify({ ...valid, healthy: false }), JSON.stringify({ ...valid, error: 'Lyra stopped: failed move' }), JSON.stringify({ ...valid, moduleSha256: '0'.repeat(64) })]) {
      writeFileSync(path, input); expect(spawnSync(process.execPath, command).status).toBe(1);
    }
    writeFileSync(path, JSON.stringify(valid)); expect(() => execFileSync(process.execPath, command)).not.toThrow();
  } finally { rmSync(dir, { recursive: true }); }
});
