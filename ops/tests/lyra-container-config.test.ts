import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildCreateArgs } from '../bots/config.mjs';
const read = name => readFileSync(new URL(`../bots/${name}`, import.meta.url), 'utf8');

it('pins one browser dependency separately and keeps the browser image build context minimal', () => {
  const pkg = JSON.parse(read('package.json')); const lock = JSON.parse(read('package-lock.json'));
  expect(pkg.dependencies).toEqual({ 'playwright-core': '1.64.1' });
  expect(Object.keys(lock.packages).sort()).toEqual(['', 'node_modules/playwright-core']);
  expect(lock.packages['node_modules/playwright-core'].integrity).toBe('sha512-BC4s8y6SEVA6Q1rSxZTto8hI1KUI3xXlHGZgvGqP4IqPdI/a6FX9H29IDNz7vKo9l21b6LfYosScPL6M3xxyDQ==');
  const instructions = read('Dockerfile').trim().split('\n').map(line => { const [kind, ...args] = line.split(' '); return { kind, args: args.join(' ') }; });
  expect(instructions.filter(i => i.kind === 'FROM').map(i => i.args)).toEqual(['mcr.microsoft.com/playwright@sha256:68456172e8d99f42cf391e835f5d566b3ab0a2c6a745decd9590c4d73c54d2fb']);
  expect(instructions.filter(i => i.kind === 'USER').map(i => i.args)).toEqual(['1000:1000']);
  expect(instructions.filter(i => ['EXPOSE', 'VOLUME', 'ADD', 'ENTRYPOINT'].includes(i.kind))).toEqual([]);
  expect(JSON.parse(instructions.find(i => i.kind === 'CMD').args)).toEqual(['node', 'runner.mjs']);
  const copies = instructions.filter(i => i.kind === 'COPY').flatMap(i => i.args.split(' ').slice(0, -1));
  expect(copies.sort()).toEqual(['browser-session.mjs', 'config.mjs', 'healthcheck.mjs', 'package-lock.json', 'package.json', 'runner.mjs']);
  const allowedContext = read('.dockerignore').trim().split('\n');
  expect(allowedContext[0]).toBe('*');
  expect(allowedContext.slice(1).map(s => s.slice(1)).sort()).toEqual(['Dockerfile', ...copies].sort());
  expect(readdirSync(new URL('../bots/', import.meta.url))).toContain('PLAYWRIGHT-LICENSE');
});

it('uses the byte-pinned official default-deny seccomp profile for Chromium namespaces without privilege escalation', () => {
  const profileBytes = read('seccomp.json'); const profile = JSON.parse(profileBytes);
  expect(createHash('sha256').update(profileBytes).digest('hex')).toBe('cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849');
  expect(profile.defaultAction).toBe('SCMP_ACT_ERRNO');
  expect(profile.archMap.some(a => a.architecture === 'SCMP_ARCH_AARCH64')).toBe(true);
  const namespaceRule = profile.syscalls.find(rule => rule.comment === 'Allow create user namespaces');
  expect(namespaceRule.action).toBe('SCMP_ACT_ALLOW');
  expect(namespaceRule.names).toEqual(['clone', 'setns', 'unshare']);
  const args = buildCreateArgs(`sha256:${'a'.repeat(64)}`, '/project/ops/bots/seccomp.json');
  expect(args.filter((_, index) => args[index - 1] === '--security-opt')).toEqual(['no-new-privileges:true', 'seccomp=/project/ops/bots/seccomp.json']);
  expect(args).not.toContain('unconfined'); expect(args).not.toContain('SYS_ADMIN');
});
