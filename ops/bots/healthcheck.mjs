import { readFileSync } from 'node:fs';
import { config } from './config.mjs';
try {
  const health = JSON.parse(readFileSync(process.argv[2] ?? '/tmp/lyra-health.json', 'utf8'));
  const age = Date.now() - health.updatedAt;
  if (health.healthy !== true || health.error !== null || health.moduleSha256 !== config.moduleSha256 ||
      !Number.isFinite(age) || age < 0 || age >= 15000) process.exitCode = 1;
} catch { process.exitCode = 1; }
