#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { config, assertOwned } from './config.mjs';
import { BotManager } from './manager.mjs';
const exec = promisify(execFile);
const docker = async args => (await exec('docker', args, { timeout: 25000, maxBuffer: 2 * 1024 * 1024 })).stdout.trim();
const engine = {
  async inspect(target) {
    try { return JSON.parse(await docker(['container', 'inspect', target]))[0]; }
    catch (error) { if (/No such (container|object):/.test(error.stderr ?? '')) return null; throw error; }
  },
  create: args => docker(args), start: id => docker(['start', id]),
  stop: id => docker(['stop', '--time', '15', id]), remove: id => docker(['rm', id]),
  async logs(id) {
    const result = await exec('docker', ['logs', '--tail', '80', id], { timeout: 25000, maxBuffer: 1024 * 1024 });
    return `${result.stdout}\n${result.stderr}`.trim();
  },
};
async function main() {
  const [command, image, ...extra] = process.argv.slice(2);
  if (extra.length || (command !== 'start' && image)) throw Error('Unexpected arguments');
  const manager = new BotManager(engine);
  if (command === 'start') return manager.start(image, fileURLToPath(new URL('./seccomp.json', import.meta.url)));
  if (command === 'stop') return manager.stop();
  if (command === 'status') { const status = await manager.status(); if (!status.healthy) process.exitCode = 1; return status; }
  if (command === 'logs') {
    const container = await engine.inspect(config.name);
    if (!container) throw Error('Owned browser is absent');
    assertOwned(container); return { id: container.Id, logs: await engine.logs(container.Id) };
  }
  if (command === 'snapshot') {
    const ids = (await docker(['ps', '-aq', '--no-trunc'])).split('\n').filter(Boolean);
    const containers = await Promise.all(ids.map(async id => {
      const item = await engine.inspect(id);
      if (!item) throw Error('Container changed while taking snapshot; retry');
      return { id: item.Id, name: item.Name.slice(1), state: item.State.Status, health: item.State.Health?.Status ?? 'none' };
    }));
    return { capturedAt: new Date().toISOString(), botName: config.name, containers };
  }
  throw Error('Usage: node ops/bots/cli.mjs start sha256:<built-image-id> | stop | status | logs | snapshot');
}
try { console.log(JSON.stringify(await main(), null, 2)); }
catch (error) { console.error(error.message); process.exitCode = 1; }
