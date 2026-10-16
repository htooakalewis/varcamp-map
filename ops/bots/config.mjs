import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';

const moduleSha256 = '29b9a65b5880a922710ddf6b524e1ee0d772620687c7843c5b6928f633396c1f';
export const config = Object.freeze({
  name: 'varcamp-lyra-dev', owner: 'varcamp-lyra-development-v1', botName: 'Lyra [BOT]',
  moduleSha256,
  moduleUrl: `https://htooayelwinict.github.io/varcamp-map/bots/lyra.js?v=${moduleSha256}`,
  roomUrl: 'https://varcamp.3-1-133-135.sslip.io/~/varcamp-demo/maps/overworld.wam',
});
export const labels = Object.freeze({
  'io.varcamp.bot.owner': config.owner,
  'io.varcamp.bot.module-sha256': config.moduleSha256,
});

export function buildCreateArgs(image, seccomp) {
  if (!/^sha256:[0-9a-f]{64}$/.test(image)) throw Error('Require an immutable local image ID (sha256:...)');
  if (!isAbsolute(seccomp) || /[\n\r]/.test(seccomp)) throw Error('Require an absolute seccomp profile path');
  return ['create', '--name', config.name, '--init', '--user', '1000:1000',
    '--cpus', '1', '--memory', '2g', '--memory-swap', '2g', '--pids-limit', '512', '--shm-size', '512m',
    '--read-only', '--tmpfs', '/tmp:rw,nosuid,nodev,size=512m,uid=1000,gid=1000,mode=1777',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--security-opt', `seccomp=${seccomp}`,
    '--network', 'bridge', '--restart', 'no', '--stop-timeout', '15',
    '--log-driver', 'json-file', '--log-opt', 'max-size=5m', '--log-opt', 'max-file=2',
    ...Object.entries(labels).flatMap(([key, value]) => ['--label', `${key}=${value}`]), image];
}

export function assertOwned(container) {
  if (container.Name !== `/${config.name}` || !/^[0-9a-f]{64}$/.test(container.Id) ||
      Object.entries(labels).some(([key, value]) => container.Config?.Labels?.[key] !== value)) {
    throw Error(`Refusing container with unverified ownership: ${config.name}`);
  }
  return container;
}

export function verifyModule({ url, status, body }, digest = config.moduleSha256) {
  if (url !== config.moduleUrl) throw Error('Unexpected module response URL');
  if (status !== 200) throw Error(`Module HTTP status ${status}; redirects are forbidden`);
  if (!/^[0-9a-f]{64}$/.test(digest) || createHash('sha256').update(body).digest('hex') !== digest) throw Error('Module digest mismatch');
  return body;
}

export function isMapFrame(candidate) {
  return candidate.location === 'about:srcdoc' && candidate.initialized === true &&
    candidate.roomId === config.roomUrl && Array.isArray(candidate.scripts) &&
    candidate.scripts.some(src => /^https:\/\/maps\.3-1-133-135\.sslip\.io\/varcamp-demo\/assets\/src-main-[A-Za-z0-9_-]+\.js$/.test(src));
}

export class RuntimeHealth {
  #error; #ready = false; #updatedAt = 0; #identity;
  fail(reason) { this.#error ??= String(reason); this.#ready = false; }
  ready(identity, now = Date.now()) {
    if (this.#error) throw Error(this.#error);
    this.#identity = identity; this.#ready = true; this.#updatedAt = now;
  }
  snapshot(now = Date.now()) {
    return { healthy: this.#ready && !this.#error && now >= this.#updatedAt && now - this.#updatedAt < 15000,
      updatedAt: this.#updatedAt, identity: this.#identity, error: this.#error ?? null, moduleSha256: config.moduleSha256 };
  }
}
