import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import * as configs from '../bots/config.mjs';
import { BotManager } from '../bots/manager.mjs';
const image = `sha256:${'a'.repeat(64)}`;
function fleet() {
  const objects = new Map(), mutations: string[] = []; let sequence = 0;
  return { objects, mutations, engine: {
    async inspect(target) { return structuredClone([...objects.values()].find(c => c.Id === target || c.Name === `/${target}`) ?? null); },
    async create(args) { const name = args[args.indexOf('--name') + 1]; if ([...objects.values()].some(c => c.Name === `/${name}`)) throw Error('name conflict'); const labels = Object.fromEntries(args.flatMap((v, i) => v === '--label' ? [args[i + 1].split('=')] : [])); const id = String(++sequence).padStart(64, '0'); objects.set(id, { Id: id, Name: `/${name}`, Config: { Labels: labels }, State: { Running: false, Status: 'created' } }); mutations.push(`create:${name}`); return id; },
    async start(id) { mutations.push(`start:${id}`); objects.get(id).State = { Running: true, Status: 'running', Health: { Status: 'healthy' } }; },
    async stop(id) { mutations.push(`stop:${id}`); objects.get(id).State.Running = false; },
    async remove(id) { mutations.push(`remove:${id}`); objects.delete(id); }, async logs() { return 'diagnostic'; },
  } };
}
it('selects only fixed profiles and creates isolated sibling ownership with no automatic siblings', async () => {
  expect(typeof configs.selectProfile).toBe('function');
  const f = fleet(); const managers = ['lyra', 'nova', 'orion'].map(persona => new BotManager(f.engine, { persona }));
  const result = await Promise.all(managers.map(m => m.start(image, '/repo/seccomp.json')));
  expect([...f.objects.values()].map(c => c.Name).sort()).toEqual(['/varcamp-lyra-dev', '/varcamp-nova-dev', '/varcamp-orion-dev']);
  expect(result.every(r => r.healthy)).toBe(true);
  await managers[1].stop(); expect(f.objects.size).toBe(2);
  expect((await managers[0].status()).healthy).toBe(true); expect((await managers[2].status()).healthy).toBe(true);
  for (const c of f.objects.values()) expect(c.Config.Labels['io.varcamp.bot.persona']).toBe(c.Name.includes('lyra') ? 'lyra' : 'orion');
  expect(() => new BotManager(f.engine, { persona: 'all' })).toThrow(/persona/);
});
it('concurrent same-profile start reserves one name and failed startup cleanup leaves siblings intact', async () => {
  const f = fleet(); const nova = new BotManager(f.engine, { persona: 'nova' }); await nova.start(image, '/repo/seccomp.json');
  const outcomes = await Promise.allSettled([new BotManager(f.engine).start(image, '/repo/seccomp.json'), new BotManager(f.engine).start(image, '/repo/seccomp.json')]);
  expect(outcomes.some(x => x.status === 'fulfilled')).toBe(true);
  const original = f.engine.start; f.engine.start = async id => { if (f.objects.get(id).Name.includes('orion')) throw Error('rejected'); return original(id); };
  await expect(new BotManager(f.engine, { persona: 'orion' }).start(image, '/repo/seccomp.json')).rejects.toThrow(/rejected/);
  expect((await nova.status()).healthy).toBe(true); expect([...f.objects.values()].some(c => c.Name.includes('orion'))).toBe(false);
});
it.each(['legacy', 'missing', 'conflicting', 'foreign'])('refuses %s label shape on all operations without adoption or mutation', async shape => {
  const f = fleet(); const labels = { 'io.varcamp.bot.owner': 'varcamp-lyra-development-v1', 'io.varcamp.bot.module-sha256': '29b9a65b5880a922710ddf6b524e1ee0d772620687c7843c5b6928f633396c1f' };
  if (shape === 'conflicting') labels['io.varcamp.bot.persona'] = 'nova';
  if (shape === 'foreign') labels['io.varcamp.bot.owner'] = 'someone-else';
  if (shape === 'missing') labels['io.varcamp.bot.module-sha256'] = configs.config.moduleSha256;
  f.objects.set('1'.repeat(64), { Id: '1'.repeat(64), Name: '/varcamp-lyra-dev', Config: { Labels: labels }, State: { Running: false, Status: 'exited' } });
  const m = new BotManager(f.engine);
  for (const action of [() => m.status(), () => m.logs(), () => m.stop(), () => m.start(image, '/repo/seccomp.json')]) await expect(action()).rejects.toThrow(/ownership|legacy/i);
  expect(f.mutations).toEqual([]);
});
it('rejects caller-supplied profile settings and keeps each manager bound to its selected immutable profile', async () => {
  expect(() => configs.buildCreateArgs(image, '/repo/seccomp.json', { ...configs.config, name: 'foreign' })).toThrow(/fixed profile/);
  const manager = new BotManager(fleet().engine, { persona: 'nova' });
  expect(() => { manager.profile = configs.config; }).toThrow();
});
it('joins each fixed observed name/avatar and passes only that persona in the Docker environment', async () => {
  const { joinRoom } = await import('../bots/browser-session.mjs');
  for (const [persona, name, avatar] of [['lyra', 'Lyra[BOT]', '#woka-female4'], ['nova', 'Nova[BOT]', '#woka-male2'], ['orion', 'Orion[BOT]', '#woka-male1']]) {
    const actions: string[] = []; const click = key => ({ async click() { actions.push(key); } });
    const page = { async goto() {}, getByTestId: () => ({ async getAttribute() { return '10'; }, async fill(value) { actions.push(value); }, async inputValue() { return actions[0]; } }), getByRole: (_role, { name }) => click(name), locator: selector => click(selector), getByText: value => click(value) };
    const profile = configs.selectProfile(persona); await joinRoom(page, profile, {assertLive(){}});
    expect(actions).toEqual([name, 'Continue', avatar, 'Continue', 'Turn off your microphone', 'Turn off your camera', 'Save']);
    expect(configs.buildCreateArgs(image, '/repo/seccomp.json', profile)).toContain(`VARCAMP_BOT_PERSONA=${persona}`);
  }
});
it('the retired CLI refuses each fixed profile before Docker', () => {
  const directory = mkdtempSync(join(tmpdir(), 'guide-cli-')); const output = join(directory, 'target');
  try {
    writeFileSync(join(directory, 'docker'), `#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.CLI_TEST_TARGET, 'called'); console.log('[]');\n`, { mode: 0o700 });
    for (const args of [['status'], ['lyra', 'status'], ['nova', 'status'], ['orion', 'status'], ['all', 'status'], ['nova', 'restart'], ['orion', 'status', 'extra']]) {
      const result = spawnSync(process.execPath, ['ops/bots/cli.mjs', ...args], { encoding: 'utf8', env: { ...process.env, PATH: directory, CLI_TEST_TARGET: output } });
      expect(result.status).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toMatch(/retired.*persistent-service/i);
      expect(existsSync(output)).toBe(false);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
