import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
const inventory = (fixture: string) => JSON.parse(execFileSync('python3', ['ops/tests/preflight-fixture.py', fixture], { encoding: 'utf8' }));
describe('core preflight inventory checks', () => {
  it('rejects an occupied loopback TCP7880 signalling reservation', () => expect(inventory('occupied-loopback').accepted).toBe(false));
  it('rejects a stale running image even when the locked image is cached', () => expect(inventory('stale-image').accepted).toBe(false));
  it('rejects an actual image ID mismatch even when the reference claims the locked image', () => expect(inventory('wrong-image-id').accepted).toBe(false));
  it('rejects an unexpected service replacing an expected service with the same healthy count', () => expect(inventory('wrong-service').accepted).toBe(false));
  it('rejects duplicate service labels replacing a missing expected service', () => expect(inventory('duplicate-service').accepted).toBe(false));
  it('rejects a missing service', () => expect(inventory('missing-service').accepted).toBe(false));
  it('rejects an unlocked running reference despite the correct image ID', () => expect(inventory('unlocked-reference').accepted).toBe(false));
  it('checks actual running architecture, independently of the cached image', () => expect(inventory('wrong-architecture').accepted).toBe(false));
  it('accepts the exact healthy service inventory and unrelated loopback TCP40131', () => expect(inventory('valid').accepted).toBe(true));
  it('keeps the TCP7880 reservation protocol-specific', () => expect(inventory('udp-7880').accepted).toBe(true));
});


describe('explicit local Play artifact identity', () => {
  it('checks real safe artifact bytes and every scoped identity/provenance denial', () => {
    expect(() => execFileSync('python3', ['ops/tests/local-artifact-fixture.py'], { encoding: 'utf8' })).not.toThrow();
  });
});
