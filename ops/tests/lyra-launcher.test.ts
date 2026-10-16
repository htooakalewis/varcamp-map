import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { buildCreateArgs, config, verifyModule, isMapFrame, RuntimeHealth } from '../bots/config.mjs';
import { BotManager } from '../bots/manager.mjs';
import { denyMediaPermissions } from '../bots/browser-session.mjs';

const image = `sha256:${'a'.repeat(64)}`;
const id = '1'.repeat(64);
function container(overrides = {}) {
  return { Id: id, Name: '/varcamp-lyra-dev', Config: { Labels: {
    'io.varcamp.bot.owner': 'varcamp-lyra-development-v1',
    'io.varcamp.bot.module-sha256': '29b9a65b5880a922710ddf6b524e1ee0d772620687c7843c5b6928f633396c1f',
  } }, State: { Running: true, Status: 'running', Health: { Status: 'healthy' } }, ...overrides };
}
function engine(initial = null) {
  let current = initial;
  const events: string[] = [];
  const api = {
    async inspect(target) { events.push(`inspect:${target}`); return current && (target === current.Id || target === 'varcamp-lyra-dev') ? structuredClone(current) : null; },
    async create() { if (current) throw Error('name conflict'); current = container({ State: { Running: false, Status: 'created' } }); events.push('create'); return id; },
    async start(target) { events.push(`start:${target}`); current.State = { Running: true, Status: 'running', Health: { Status: 'healthy' } }; },
    async stop(target) { events.push(`stop:${target}`); if (current?.Id === target) current.State.Running = false; },
    async remove(target) { events.push(`remove:${target}`); if (current?.Id === target) current = null; },
    async logs() { return 'startup diagnostic'; },
  };
  return { api, events, get current() { return current; }, replace(value) { current = value; } };
}

describe('dedicated Lyra container boundary', () => {
  it('builds only one bounded, sandboxed, detached browser with no service mounts or published ports', () => {
    const args = buildCreateArgs(image, '/repo/ops/bots/seccomp.json');
    for (const pair of [['--name','varcamp-lyra-dev'], ['--cpus','1'], ['--memory','2g'], ['--pids-limit','512'], ['--shm-size','512m'], ['--user','1000:1000'], ['--cap-drop','ALL'], ['--network','bridge'], ['--restart','no']]) {
      expect(args[args.indexOf(pair[0]) + 1]).toBe(pair[1]);
    }
    expect(args).toContain('--read-only'); expect(args).toContain('--init');
    expect(args).toContain('no-new-privileges:true');
    expect(args).toContain('seccomp=/repo/ops/bots/seccomp.json');
    expect(args).toContain('/tmp:rw,nosuid,nodev,size=512m,uid=1000,gid=1000,mode=1777');
    expect(args.at(-1)).toBe(image);
    for (const forbidden of ['--privileged','--publish','-p','--volume','-v','--cap-add','--pid','--ipc','--env-file']) expect(args).not.toContain(forbidden);
    expect(() => buildCreateArgs('arbitrary:latest', '/repo/seccomp.json')).toThrow(/image ID/);
  });
  it('refuses unrelated same-name containers on start and stop without mutations', async () => {
    const fake = engine(container({ Config: { Labels: {} } }));
    const manager = new BotManager(fake.api);
    await expect(manager.start(image, '/repo/seccomp.json')).rejects.toThrow(/ownership/);
    await expect(manager.stop()).rejects.toThrow(/ownership/);
    expect(fake.events.every(event => event.startsWith('inspect:'))).toBe(true);
    expect(fake.current.State.Running).toBe(true);
  });
  it('reserves a single name across simultaneous starts and reports healthy only after readiness', async () => {
    const fake = engine();
    const results = await Promise.allSettled([new BotManager(fake.api).start(image, '/repo/seccomp.json'), new BotManager(fake.api).start(image, '/repo/seccomp.json')]);
    expect(results.some(result => result.status === 'fulfilled')).toBe(true);
    expect(fake.events.filter(event => event === 'create')).toHaveLength(1);
    expect(fake.current.State.Health.Status).toBe('healthy');
  });
  it('stops and removes by the inspected immutable ID, never a same-name replacement', async () => {
    const fake = engine(container());
    const inspect = fake.api.inspect;
    let count = 0;
    fake.api.inspect = async target => { const found = await inspect(target); if (++count === 1) fake.replace(container({ Id: '2'.repeat(64), Config: { Labels: {} } })); return found; };
    await new BotManager(fake.api).stop();
    expect(fake.current.Id).toBe('2'.repeat(64)); expect(fake.current.State.Running).toBe(true);
    expect(fake.events).not.toContain('stop:varcamp-lyra-dev');
  });
  it('cleans its failed startup without treating stopped diagnostics as healthy', async () => {
    const fake = engine();
    fake.api.start = async () => { fake.replace(container({ State: { Running: false, Status: 'exited', ExitCode: 1 } })); };
    await expect(new BotManager(fake.api).start(image, '/repo/seccomp.json')).rejects.toThrow(/startup diagnostic/);
    expect(fake.current).toBeNull();
  });
  it('bounds startup readiness and cleans only its timed-out browser', async () => {
    const fake = engine(); let now = 0;
    fake.api.start = async () => { fake.replace(container({ State: { Running: true, Status: 'running', Health: { Status: 'starting' } } })); };
    await expect(new BotManager(fake.api, { now: () => now, sleep: async ms => { now += ms; }, startupTimeout: 2000 }).start(image, '/repo/seccomp.json')).rejects.toThrow(/readiness timed out/);
    expect(now).toBe(2000); expect(fake.current).toBeNull();
    expect(fake.events).toContain(`stop:${id}`); expect(fake.events).toContain(`remove:${id}`);
  });
  it('does not clean up a created container whose ownership cannot be reverified', async () => {
    const fake = engine();
    fake.api.start = async () => { fake.replace(container({ Config: { Labels: {} } })); throw Error('start failed'); };
    await expect(new BotManager(fake.api).start(image, '/repo/seccomp.json')).rejects.toThrow(/ownership/);
    expect(fake.current.State.Running).toBe(true);
    expect(fake.events.some(event => event.startsWith('stop:') || event.startsWith('remove:'))).toBe(false);
  });
  it('leaves a pre-existing owned exited container for explicit stop and inspection', async () => {
    const fake = engine(container({ State: { Running: false, Status: 'exited' } }));
    await expect(new BotManager(fake.api).start(image, '/repo/seccomp.json')).rejects.toThrow(/stop/);
    expect(fake.events).toEqual(['inspect:varcamp-lyra-dev']);
  });
  it('surfaces Docker stop failures and never removes that still-running container', async () => {
    const fake = engine(container()); fake.api.stop = async () => { throw Error('daemon refused stop'); };
    await expect(new BotManager(fake.api).stop()).rejects.toThrow(/daemon refused/);
    expect(fake.current.State.Running).toBe(true); expect(fake.events.some(event => event.startsWith('remove:'))).toBe(false);
  });
  it('never reports an unhealthy or unowned container healthy', async () => {
    expect(await new BotManager(engine().api).status()).toEqual({ state: 'absent', healthy: false });
    expect((await new BotManager(engine(container({ State: { Running: true, Status: 'running', Health: { Status: 'unhealthy' } } })).api).status()).healthy).toBe(false);
    await expect(new BotManager(engine(container({ Config: { Labels: {} } })).api).status()).rejects.toThrow(/ownership/);
  });
});

describe('module and frame integrity', () => {
  it('validates exact response bytes and URL before allowing module import', () => {
    const bytes = Buffer.from('reviewed bytes'); const digest = createHash('sha256').update(bytes).digest('hex');
    expect(verifyModule({ url: config.moduleUrl, status: 200, body: bytes }, digest)).toEqual(bytes);
    expect(() => verifyModule({ url: config.moduleUrl, status: 200, body: Buffer.from('changed') }, digest)).toThrow(/digest/);
    expect(() => verifyModule({ url: 'https://elsewhere.invalid/lyra.js', status: 200, body: bytes }, digest)).toThrow(/URL/);
    expect(() => verifyModule({ url: config.moduleUrl, status: 302, body: bytes }, digest)).toThrow(/HTTP/);
    expect(() => verifyModule({ url: config.moduleUrl, status: 200, body: bytes }, 'bad')).toThrow(/digest/);
  });
  it('requires srcdoc, the known map module origin/path, initialized WA and exact room', () => {
    const candidate = { location: 'about:srcdoc', initialized: true, roomId: config.roomUrl, scripts: ['https://varcamp.3-1-133-135.sslip.io/iframe_api.js', 'https://maps.3-1-133-135.sslip.io/varcamp-demo/assets/src-main-B6SMpqGv.js'] };
    expect(isMapFrame(candidate)).toBe(true);
    for (const patch of [{ location: config.roomUrl }, { initialized: false }, { roomId: 'other' }, { scripts: ['https://evil.invalid/varcamp-demo/assets/src-main-x.js'] }, { scripts: ['https://maps.3-1-133-135.sslip.io/src/journal/index.html'] }]) expect(isMapFrame({ ...candidate, ...patch })).toBe(false);
  });
  it('keeps fatal diagnostics sticky even if run resolves afterward', () => {
    const health = new RuntimeHealth(); health.fail('Lyra stopped: incompatible map');
    expect(() => health.ready({ playerId: 7 })).toThrow(/incompatible map/);
    expect(health.snapshot().healthy).toBe(false);
  });
  it('expires a stalled heartbeat and rejects non-ready state', () => {
    const health = new RuntimeHealth(); expect(health.snapshot(100).healthy).toBe(false);
    health.ready({ playerId: 7 }, 100); expect(health.snapshot(101).healthy).toBe(true);
    expect(health.snapshot(16_000).healthy).toBe(false);
    health.fail('page closed'); expect(health.snapshot(102).healthy).toBe(false);
  });
});


describe('isolated CDP media permissions', () => {
  // Browser.setPermission takes W3C PermissionDescriptor names, not PermissionType enum names.
  // This boundary matches the actual Chrome 155 / protocol 1.3 rejection captured in QA.
  function protocol(failName?: string) {
    const calls: { method: string; params: unknown }[] = [];
    const failure = Error('CDP permission command failed');
    return {
      calls, failure,
      async send(method: string, params?: { permission: { name: string } }) {
        if (method === 'Target.getTargetInfo') return { targetInfo: { browserContextId: 'isolated-lyra-context' } };
        if (method !== 'Browser.setPermission') throw Error(`Unexpected CDP method: ${method}`);
        calls.push({ method, params });
        if (!['microphone', 'camera'].includes(params?.permission.name ?? '')) throw Error(`Invalid PermissionDescriptor name: ${params?.permission.name}`);
        if (params?.permission.name === failName) throw failure;
        return {};
      },
    };
  }
  it('denies microphone and camera using W3C descriptors scoped to the intended origin and isolated context', async () => {
    const cdp = protocol();
    await denyMediaPermissions(cdp);
    expect(cdp.calls).toEqual([
      { method: 'Browser.setPermission', params: { permission: { name: 'microphone' }, setting: 'denied', origin: 'https://varcamp.3-1-133-135.sslip.io', browserContextId: 'isolated-lyra-context' } },
      { method: 'Browser.setPermission', params: { permission: { name: 'camera' }, setting: 'denied', origin: 'https://varcamp.3-1-133-135.sslip.io', browserContextId: 'isolated-lyra-context' } },
    ]);
  });
  it.each(['microphone', 'camera'])('propagates the %s denial failure without a fallback or later permission command', async name => {
    const cdp = protocol(name);
    await expect(denyMediaPermissions(cdp)).rejects.toBe(cdp.failure);
    expect(cdp.calls).toHaveLength(name === 'microphone' ? 1 : 2);
  });
  it('refuses a missing isolated context before changing permissions', async () => {
    const calls: string[] = [];
    const cdp = { async send(method: string) { calls.push(method); return { targetInfo: {} }; } };
    await expect(denyMediaPermissions(cdp)).rejects.toThrow('Missing isolated browser context ID');
    expect(calls).toEqual(['Target.getTargetInfo']);
  });
  it('propagates context lookup failure before changing permissions', async () => {
    const failure = Error('Target unavailable'); const calls: string[] = [];
    const cdp = { async send(method: string) { calls.push(method); throw failure; } };
    await expect(denyMediaPermissions(cdp)).rejects.toBe(failure);
    expect(calls).toEqual(['Target.getTargetInfo']);
  });
});
