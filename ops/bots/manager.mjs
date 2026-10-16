import { config, assertOwned, buildCreateArgs } from './config.mjs';
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

/** Engine injection keeps host management independent of browser dependencies. */
export class BotManager {
  constructor(engine, { now = Date.now, sleep = pause, startupTimeout = 150000 } = {}) {
    this.engine = engine; this.now = now; this.sleep = sleep; this.startupTimeout = startupTimeout;
  }
  async status() {
    const container = await this.engine.inspect(config.name);
    if (!container) return { state: 'absent', healthy: false };
    assertOwned(container);
    return { id: container.Id, state: container.State.Status,
      healthy: container.State.Running === true && container.State.Health?.Status === 'healthy',
      health: container.State.Health?.Status ?? 'unknown', exitCode: container.State.ExitCode };
  }
  async start(image, seccomp) {
    const args = buildCreateArgs(image, seccomp);
    const existing = await this.engine.inspect(config.name);
    if (existing) {
      assertOwned(existing);
      if (!existing.State.Running) throw Error('Owned container already exists but is not running; inspect logs, then stop before starting');
      return this.waitReady(existing.Id);
    }
    // Docker reserves the exact name atomically. A losing concurrent creator fails without cleanup.
    const id = await this.engine.create(args);
    if (!/^[0-9a-f]{64}$/.test(id)) throw Error('Docker returned an invalid container ID');
    try {
      const created = await this.engine.inspect(id);
      if (!created) throw Error('Created container disappeared');
      assertOwned(created);
      await this.engine.start(id);
      return await this.waitReady(id);
    } catch (error) {
      let diagnostic = '';
      try { diagnostic = await this.engine.logs(id); } catch { /* Keep the primary error. */ }
      await this.removeOwned(id);
      throw Error(`Lyra startup failed: ${error.message}\n${diagnostic}`);
    }
  }
  async waitReady(id) {
    const deadline = this.now() + this.startupTimeout;
    while (this.now() < deadline) {
      const container = await this.engine.inspect(id);
      if (!container) throw Error('Owned browser disappeared during startup');
      assertOwned(container);
      if (!container.State.Running || container.State.Health?.Status === 'unhealthy') throw Error(`Browser ${container.State.Status}/${container.State.Health?.Status ?? 'unknown'}`);
      if (container.State.Health?.Status === 'healthy') return { id, state: 'running', healthy: true };
      await this.sleep(1000);
    }
    throw Error('Browser readiness timed out');
  }
  async removeOwned(id) {
    const current = await this.engine.inspect(id);
    if (!current) return;
    assertOwned(current);
    if (current.State.Running) await this.engine.stop(id);
    await this.engine.remove(id);
  }
  async stop() {
    const current = await this.engine.inspect(config.name);
    if (!current) return { state: 'absent', healthy: false };
    assertOwned(current);
    await this.removeOwned(current.Id);
    return { state: 'stopped', healthy: false, id: current.Id };
  }
}
