import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const checker = resolve('publication/verify-source.mjs');
const revisionPath = 'publication/revisions/2026-10-16-shared-guides.json';
const baselineHash = '4b654bd1437066b13498661f3ca14774daf1066d072036beffaf06f0c014250e';
const replacement = 'reviewed replacement\n';
const replacementHash = createHash('sha256').update(replacement).digest('hex');
const originalPaths = Object.keys(JSON.parse(readFileSync('publication/source-manifest.json', 'utf8')).sourceInventory);
const reviewed = () => ({ path: 'src/main.ts', fromSha256: baselineHash, toSha256: replacementHash, reason: 'Authorized fixture replacement' });

describe('publication exact reviewed replacements', () => {
  let root: string;
  let manifest: { maps: number; wams: number; sourceFilesByteExact: number; sourceInventory: Record<string, string>; extensionInventory: Record<string, string> };
  function write(path: string, content: string) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  function pinRevisions(value: unknown = { schemaVersion: 1, revisions: [] }) {
    const bytes = JSON.stringify(value);
    write(revisionPath, bytes);
    manifest.extensionInventory[revisionPath] = createHash('sha256').update(bytes).digest('hex');
  }
  function verify() {
    write('publication/source-manifest.json', JSON.stringify(manifest));
    const result = spawnSync(process.execPath, [checker, root], { encoding: 'utf8' });
    return { status: result.status, output: result.stdout + result.stderr };
  }
  function rejects(message: string) {
    const result = verify();
    expect(result.status).not.toBe(0);
    expect(result.output).toContain(message);
  }
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'varcamp-revisions-'));
    manifest = {
      maps: 33, wams: 33, sourceFilesByteExact: 303,
      sourceInventory: Object.fromEntries(originalPaths.map(path => [path, baselineHash])),
      extensionInventory: { 'src/bots/reviewed.ts': baselineHash },
    };
    for (const path of originalPaths) write(path, 'baseline\n');
    write('src/bots/reviewed.ts', 'baseline\n');
    pinRevisions();
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('accepts an empty pinned revision list with all original bytes unchanged', () => {
    expect(verify().status).toBe(0);
  });

  it('rejects changed baseline bytes without a reviewed record', () => {
    write('src/main.ts', replacement);
    rejects('Frozen source changed: src/main.ts');
  });

  it('accepts only the exact reviewed old-to-new replacement and reports it truthfully', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    write('src/main.ts', replacement);
    const result = verify();
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('302 unchanged source hashes and 1 exact reviewed replacement');
    expect(result.output).not.toContain('No source files were rewritten');
    expect(manifest.sourceInventory['src/main.ts']).toBe(baselineHash);
  });

  it('rejects an unrelated edit beside an exact reviewed replacement', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    write('src/main.ts', replacement);
    write('src/quests/model.ts', replacement);
    rejects('Frozen source changed: src/quests/model.ts');
  });

  it('requires the fixed revision file to be pinned in extensions', () => {
    delete manifest.extensionInventory[revisionPath];
    rejects('Reviewed revision file must be pinned in extensionInventory');
  });

  it('rejects a missing revision file', () => {
    rmSync(join(root, revisionPath));
    rejects(`Missing extension source: ${revisionPath}`);
  });

  it('rejects revision file bytes that disagree with their extension hash', () => {
    write(revisionPath, JSON.stringify({ schemaVersion: 1, revisions: [reviewed()] }));
    rejects(`Extension source changed: ${revisionPath}`);
  });

  it('rejects a missing reviewed source', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    rmSync(join(root, 'src/main.ts'));
    rejects('Missing frozen source: src/main.ts');
  });

  it('checks the old digest against the original receipt even when replacement bytes match', () => {
    pinRevisions({ schemaVersion: 1, revisions: [{ ...reviewed(), fromSha256: replacementHash }] });
    write('src/main.ts', replacement);
    rejects('Reviewed revision baseline mismatch: src/main.ts');
  });

  it('rejects replacement bytes that disagree with the approved new digest', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    write('src/main.ts', 'unapproved\n');
    rejects('Reviewed source changed: src/main.ts');
  });

  it('rejects an approved replacement when the old bytes remain', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    rejects('Reviewed source changed: src/main.ts');
  });

  it('rejects duplicate revisions for the same source', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed(), reviewed()] });
    rejects('Duplicate reviewed revision: src/main.ts');
  });

  it.each(['src/unknown.ts', 'src/*.ts', '../src/main.ts', '/src/main.ts'])(
    'rejects a revision outside the exact original receipt: %s', path => {
      pinRevisions({ schemaVersion: 1, revisions: [{ ...reviewed(), path }] });
      rejects('Reviewed revision path is not an exact original source');
    },
  );

  it('rejects extension overlap with a revised original source', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    manifest.extensionInventory['src/main.ts'] = replacementHash;
    write('src/main.ts', replacement);
    rejects('Extension overlaps frozen source: src/main.ts');
  });

  it('rejects a revision of an extension file', () => {
    pinRevisions({ schemaVersion: 1, revisions: [{ ...reviewed(), path: 'src/bots/reviewed.ts' }] });
    rejects('Reviewed revision path is not an exact original source');
  });

  it('still rejects changed extensions beside an exact reviewed replacement', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    write('src/main.ts', replacement);
    write('src/bots/reviewed.ts', replacement);
    rejects('Extension source changed: src/bots/reviewed.ts');
  });

  it('still rejects unlisted additions beside an exact reviewed replacement', () => {
    pinRevisions({ schemaVersion: 1, revisions: [reviewed()] });
    write('src/main.ts', replacement);
    write('src/unlisted.ts', replacement);
    rejects('Source inventory has missing or additional files');
  });

  it.each([
    null,
    [],
    { schemaVersion: 2, revisions: [] },
    { schemaVersion: 1, revisions: [], wildcard: true },
    { schemaVersion: 1, revisions: {} },
    { schemaVersion: 1 },
    { schemaVersion: 1, revisions: [null] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), unknown: true }] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), reason: '' }] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), reason: '  ' }] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), reason: 4 }] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), path: 4 }] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), fromSha256: 'wrong' }] },
    { schemaVersion: 1, revisions: [{ ...reviewed(), toSha256: replacementHash.toUpperCase() }] },
    { schemaVersion: 1, revisions: [{ path: 'src/main.ts', fromSha256: baselineHash, toSha256: replacementHash }] },
  ])('rejects malformed or widened revision schema %#', value => {
    pinRevisions(value);
    rejects('Invalid reviewed revision schema');
  });
});
