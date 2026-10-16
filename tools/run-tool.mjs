import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [script, ...args] = process.argv.slice(2);
if (script && existsSync(resolve(script))) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', resolve(script), ...args], { stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
} else {
  console.error(`Tool not implemented yet: ${script ?? '(no script)'}. Complete the world construction/asset/QA task before running this command.`);
  process.exitCode = 1;
}
