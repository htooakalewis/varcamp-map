// RETIRED historical launcher: retained for regression provenance only.
// Use the unbound persistent-service source template; this is not a deployment entry.
import { failureRecord } from './evidence.mjs';
import { selectProfile, assertOwned, buildCreateArgs } from './config.mjs';
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

/** Engine injection keeps host management independent of browser dependencies. */
export class BotManager {
  constructor(engine, { now = Date.now, sleep = pause, startupTimeout = 150000, persona = 'lyra' } = {}) {
    Object.defineProperty(this, 'profile', { value: selectProfile(persona), enumerable: true }); this.engine = engine; this.now = now; this.sleep = sleep; this.startupTimeout = startupTimeout;
  }
  async status() {
    const container = await this.engine.inspect(this.profile.name);
    if (!container) return { state: 'absent', healthy: false };
    assertOwned(container, this.profile);
    return { id: container.Id, state: container.State.Status,
      healthy: container.State.Running === true && container.State.Health?.Status === 'healthy',
      health: container.State.Health?.Status ?? 'unknown', exitCode: container.State.ExitCode };
  }
  async start(image, seccomp) {
    const args = buildCreateArgs(image, seccomp, this.profile);
    const existing = await this.engine.inspect(this.profile.name);
    if (existing) {
      assertOwned(existing, this.profile);
      if (!existing.State.Running) throw Error('Owned container already exists but is not running; inspect logs, then stop before starting');
      return this.waitReady(existing.Id);
    }
    // Docker reserves the exact name atomically. A losing concurrent creator fails without cleanup.
    const id = await this.engine.create(args);
    if (!/^[0-9a-f]{64}$/.test(id)) throw Error('Docker returned an invalid container ID');
    try {
      const created = await this.engine.inspect(id);
      if (!created) throw Error('Created container disappeared');
      assertOwned(created, this.profile);
      if (created.Id !== id) throw Error('Immutable container ID mismatch');
      await this.engine.start(id);
      return await this.waitReady(id);
    } catch (error) {
      let diagnostic, cleanup;
      try { diagnostic = failureRecord(await this.engine.logs(id)); } catch (failure) { diagnostic = failureRecord(failure); }
      try { await this.removeOwned(id); } catch (failure) { cleanup = failureRecord(failure); }
      const failure = Error(`${this.profile.persona} startup failed: ${failureRecord(error).error?.message ?? 'startup rejected'}\n${JSON.stringify(diagnostic)}${cleanup ? '\nCleanup: ' + JSON.stringify(cleanup) : ''}`, { cause: error });
      Object.assign(failure, { containerId: id, diagnostic, cleanup: cleanup ?? null });
      throw failure;
    }
  }
  async waitReady(id) {
    const deadline = this.now() + this.startupTimeout;
    while (this.now() < deadline) {
      const container = await this.engine.inspect(id);
      if (!container) throw Error('Owned browser disappeared during startup');
      assertOwned(container, this.profile);
      if (container.Id !== id) throw Error('Immutable container ID mismatch');
      if (!container.State.Running || container.State.Health?.Status === 'unhealthy') throw Error(`Browser ${container.State.Status}/${container.State.Health?.Status ?? 'unknown'}`);
      if (container.State.Health?.Status === 'healthy') return { id, state: 'running', healthy: true };
      await this.sleep(1000);
    }
    throw Error('Browser readiness timed out');
  }
  async removeOwned(id) {
    const current = await this.engine.inspect(id);
    if (!current) return;
    assertOwned(current, this.profile);
    if (current.Id !== id) throw Error('Immutable container ID mismatch');
    if (current.State.Running) await this.engine.stop(id);
    await this.engine.remove(id);
  }
  async logs() {
    const current = await this.engine.inspect(this.profile.name);
    if (!current) throw Error('Owned browser is absent');
    assertOwned(current, this.profile);
    return { id: current.Id, logs: await this.engine.logs(current.Id) };
  }
  async stop() {
    const current = await this.engine.inspect(this.profile.name);
    if (!current) return { state: 'absent', healthy: false };
    assertOwned(current, this.profile);
    await this.removeOwned(current.Id);
    return { state: 'stopped', healthy: false, id: current.Id };
  }
}
