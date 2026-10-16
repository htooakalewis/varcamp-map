import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

type Receipt = {
  helper: string;
  attackIndex: number;
  location: string;
  code: number;
  rejected: boolean;
  status?: number;
  completed: boolean;
  verifiedTlsDefaults: boolean;
  globalOpenerUntouched: boolean;
  requests: { url: string; method: string; authorizationPresent: boolean; passwordPresent: boolean }[];
};
const transport = JSON.parse(execFileSync('python3', ['ops/tests/identity_transport_harness.py'], {
  encoding: 'utf8',
})) as { redirects: Receipt[]; ordinary: Receipt[]; imports: { helper: string; safe: boolean }[] };

it.each(transport.redirects)('rejects $helper request $attackIndex status $code to $location before follow-on', receipt => {
  expect(receipt.rejected).toBe(true);
  expect(receipt.status).toBe(receipt.code);
  expect(receipt.completed).toBe(false);
  expect(receipt.requests).toHaveLength(receipt.attackIndex + 1);
  expect(receipt.requests.every(request => request.url.startsWith('https://trusted.example/'))).toBe(true);
  const last = receipt.requests.at(-1)!;
  expect(last.passwordPresent).toBe(receipt.attackIndex === 0);
  expect(last.authorizationPresent).toBe(receipt.attackIndex !== 0);
  expect(receipt.verifiedTlsDefaults).toBe(true);
  expect(receipt.globalOpenerUntouched).toBe(true);
});

it.each(transport.ordinary)('preserves the ordinary $helper flow with verified TLS defaults', receipt => {
  expect(receipt.rejected).toBe(false);
  expect(receipt.completed).toBe(true);
  expect(receipt.requests).toHaveLength(receipt.helper === 'configure-identity' ? 5 : 3);
  expect(receipt.requests[0].method).toBe('POST');
  expect(receipt.requests[0].passwordPresent).toBe(true);
  expect(receipt.requests.slice(1).every(request => request.authorizationPresent)).toBe(true);
  expect(receipt.verifiedTlsDefaults).toBe(true);
  expect(receipt.globalOpenerUntouched).toBe(true);
});

it.each(transport.imports)('imports $helper without private reads or admin requests', receipt => {
  expect(receipt.safe).toBe(true);
});
