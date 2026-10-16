import { hasLiveControllerLease } from './evidence.mjs';
import { readFileSync } from 'node:fs';
import { selectProfile } from './config.mjs';
try {
  const config = selectProfile(process.env.VARCAMP_BOT_PERSONA ?? 'lyra');
  const health = JSON.parse(readFileSync(process.argv[2] ?? '/tmp/lyra-health.json', 'utf8'));
  const lifecycleValid = hasLiveControllerLease(health.controller);
  const age = Date.now() - health.updatedAt;
  if (!lifecycleValid || health.persona !== config.persona || health.healthy !== true || health.error !== null || health.moduleSha256 !== config.moduleSha256 ||
      !Number.isFinite(age) || age < 0 || age >= 15000) process.exitCode = 1;
} catch { process.exitCode = 1; }
