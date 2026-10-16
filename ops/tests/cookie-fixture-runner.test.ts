import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

type Command = {
  stage: string;
  argv: string[];
  exit: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};
type Receipt = {
  exit: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  remaining: number | null;
  cleanupSucceeded: boolean;
  cleanup: Command[];
};
type Scenario = {
  scenario: string;
  exit: number | null;
  raised: string | null;
  receipts: Record<string, Receipt>;
  harnesses: string[];
  tripwireCalls: string[];
  calls: { step: string }[];
};
const scenarios = JSON.parse(execFileSync('python3', ['ops/tests/cookie_fixture_runner_harness.py'], {
  encoding: 'utf8',
})) as Scenario[];
const byName = (name: string) => scenarios.find(row => row.scenario === name)!;
const firstReceipt = (row: Scenario) => row.receipts['configured-https-run.json'];

it.each(['ordinary', 'forced-removal'])('retains successful command outcomes through all five modes: %s', name => {
  const row = byName(name);
  expect(row.exit).toBe(0);
  expect(row.raised).toBeNull();
  expect(Object.keys(row.receipts)).toHaveLength(5);
  expect(row.harnesses).toHaveLength(1);
  for (const receipt of Object.values(row.receipts)) {
    expect(receipt.exit).toBe(0);
    expect(receipt.remaining).toBe(0);
    expect(receipt.cleanupSucceeded).toBe(true);
    expect(receipt.cleanup.length).toBeGreaterThanOrEqual(2);
    expect(receipt.cleanup.every(command => command.exit === 0 && !command.timedOut)).toBe(true);
  }
  expect(firstReceipt(row).cleanup.map(command => command.stage)).toEqual(
    name === 'forced-removal' ? ['first-probe', 'remove', 'final-probe'] : ['first-probe', 'final-probe'],
  );
});

it.each(['first-probe-255', 'final-probe-255', 'removal-failure'])('fails closed and stops after a cleanup command failure: %s', name => {
  const row = byName(name);
  expect(row.exit).toBe(1);
  expect(row.raised).toBeNull();
  expect(Object.keys(row.receipts)).toEqual(['configured-https-run.json']);
  const receipt = firstReceipt(row);
  expect(receipt.exit).toBe(0);
  expect(receipt.remaining).toBeNull();
  expect(receipt.cleanupSucceeded).toBe(false);
  const command = receipt.cleanup.find(command => command.exit !== 0)!;
  expect(command.exit).toBe(name === 'removal-failure' ? 1 : 255);
  expect(command.stderr).toContain('dummy');
  expect(command.argv[0]).toBe('ssh');
});

it('fails on a successfully observed remaining fixture and never starts the next mode', () => {
  const row = byName('remaining-fixture');
  expect(row.exit).toBe(1);
  expect(Object.keys(row.receipts)).toEqual(['configured-https-run.json']);
  expect(firstReceipt(row).remaining).toBe(1);
  expect(firstReceipt(row).cleanupSucceeded).toBe(false);
});

it.each(['run-timeout', 'first-probe-timeout', 'final-probe-timeout', 'removal-timeout', 'run-and-cleanup-timeout'])('preserves run and cleanup evidence when a command times out: %s', name => {
  const row = byName(name);
  expect(row.exit).toBe(1);
  expect(row.raised).toBeNull();
  expect(Object.keys(row.receipts)).toEqual(['configured-https-run.json']);
  expect(row.harnesses).toHaveLength(1);
  const receipt = firstReceipt(row);
  const runTimedOut = name === 'run-timeout' || name === 'run-and-cleanup-timeout';
  expect(receipt.exit).toBe(runTimedOut ? null : 0);
  expect(receipt.timedOut).toBe(runTimedOut);
  if (runTimedOut) {
    expect(receipt.stdout).toBe('dummy partial stdout\n');
    expect(receipt.stderr).toBe('dummy partial stderr\n');
  }
  if (name === 'run-timeout') {
    expect(receipt.remaining).toBe(0);
    expect(receipt.cleanupSucceeded).toBe(true);
  } else {
    expect(receipt.remaining).toBeNull();
    expect(receipt.cleanupSucceeded).toBe(false);
    const timeout = receipt.cleanup.find(command => command.timedOut)!;
    expect(timeout.exit).toBeNull();
    expect(timeout.stdout).toBe('dummy partial stdout\n');
    expect(timeout.stderr).toBe('dummy partial stderr\n');
  }
});

it.each(['run-failure', 'primary-and-cleanup-failure'])('preserves the primary nonzero exit despite cleanup outcome: %s', name => {
  const row = byName(name);
  expect(row.exit).toBe(1);
  expect(row.raised).toBeNull();
  expect(Object.keys(row.receipts)).toEqual(['configured-https-run.json']);
  const receipt = firstReceipt(row);
  expect(receipt.exit).toBe(17);
  expect(receipt.stderr).toBe('dummy primary fixture failure\n');
  expect(receipt.cleanupSucceeded).toBe(name === 'run-failure');
});

it('retains launch failure and performs cleanup without starting another mode', () => {
  const row = byName('run-oserror');
  expect(row.exit).toBe(1);
  expect(row.raised).toBeNull();
  expect(Object.keys(row.receipts)).toEqual(['configured-https-run.json']);
  expect(firstReceipt(row).exit).toBeNull();
  expect(firstReceipt(row).remaining).toBe(0);
  expect(row.calls.map(call => call.step)).toEqual(['run', 'first-probe', 'final-probe']);
});

it('never reaches real subprocess or network facilities in any dummy regression', () => {
  expect(scenarios.every(row => row.tripwireCalls.length === 0)).toBe(true);
});
