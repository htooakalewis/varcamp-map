import { createHash } from 'node:crypto';
import { profiles } from '../ops/bots/config.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

const visitorBotModules = new Set(['event-bridge.ts', 'personas.ts', 'venue.ts', 'lyra-routes.json'].map(file => resolve('src/bots', file)));
type VisitorChunk = { modules: Record<string, unknown>; imports: readonly string[]; dynamicImports: readonly string[] };
function visitorGraph(entry: string, chunks: ReadonlyMap<string, VisitorChunk>) {
  const seen = new Set<string>(), botModules = new Set<string>();
  const walk = (name: string) => {
    if (seen.has(name)) return;
    if (name === 'bots/lyra.js') throw Error('Visitor graph includes dedicated bot startup');
    seen.add(name);
    const chunk = chunks.get(name);
    if (!chunk) throw Error(`Missing emitted visitor dependency ${name}`);
    for (const path of Object.keys(chunk.modules)) if (path.includes('/src/bots/')) {
      if (!visitorBotModules.has(path)) throw Error(`Unapproved visitor bot-source dependency ${path}`);
      botModules.add(path);
    }
    for (const dependency of [...chunk.imports, ...chunk.dynamicImports]) walk(dependency);
  };
  walk(entry);
  return { seen, botModules };
}

describe('dedicated Lyra release module',()=>{
  it('emits an import-safe standalone controller while plaza and guide visitors load only the four approved pure communication modules',async()=>{
    const out=resolve('.qa/lyra-release');const result=await build({configFile:resolve('buildmap.vite.config.ts'),logLevel:'silent',build:{outDir:out}});
    const bot=resolve(out,'bots/lyra.js');expect(existsSync(bot),'release is missing bots/lyra.js').toBe(true);
    const script=`const m=await import(${JSON.stringify(pathToFileURL(bot).href)});if(typeof m.default?.run!=='function')throw Error('Missing official default.run');console.log('safe import without WA')`;
    expect(execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'})).toContain('safe import without WA');
    const bytes = readFileSync(bot);
    for (const profile of Object.values(profiles)) {
      expect(profile.moduleSha256, `${profile.persona} must pin the actual final module`).toBe(createHash('sha256').update(bytes).digest('hex'));
      expect(profile.moduleBytes).toBe(bytes.length);
    }
    const map=JSON.parse(readFileSync(resolve(out,'maps/overworld.tmj'),'utf8'));
    const runtime=map.properties.find((p:{name:string})=>p.name==='script').value;
    expect(runtime).toMatch(/^\.\.\/assets\/src-main-.+\.js$/);
    const outputs = Array.isArray(result) ? result.flatMap(r => r.output) : 'output' in result ? result.output : [];
    const chunks = new Map(outputs.filter(chunk => chunk.type === 'chunk').map(chunk => [chunk.fileName, chunk]));
    const guide = outputs.find(chunk => chunk.type === 'chunk' && chunk.isEntry && chunk.name === 'guides');
    expect(guide, 'missing actual attendee guide panel entry').toBeDefined();
    if (!guide || guide.type !== 'chunk') throw Error('Missing actual attendee guide panel entry');
    expect(outputs.some(asset => asset.fileName === 'src/guides/index.html')).toBe(true);
    const roots = [runtime.replace('../', ''), guide.fileName];
    const visitors = roots.map(root => visitorGraph(root, chunks));
    expect([...new Set(visitors.flatMap(graph => [...graph.botModules]))].sort()).toEqual([...visitorBotModules].sort());
    for (const graph of visitors) expect(graph.seen.has('bots/lyra.js')).toBe(false);
    // Retain strict startup isolation: each real graph rejects any additional
    // controller, native movement guard or unknown bot module, even in a child.
    for (const root of roots) for (const file of ['lyra.ts', 'controller.ts', 'map-guard.ts', 'unknown.ts']) {
      const mutation = new Map<string, VisitorChunk>(chunks), chunk = mutation.get(root)!;
      mutation.set(root, { ...chunk, modules: { ...chunk.modules, [resolve('src/bots', file)]: {} } });
      expect(() => visitorGraph(root, mutation)).toThrow(/Unapproved visitor bot-source/);
    }
    const dedicated = new Map<string, VisitorChunk>(chunks);
    dedicated.set(roots[0], { ...dedicated.get(roots[0])!, imports: ['bots/lyra.js'] });
    expect(() => visitorGraph(roots[0], dedicated)).toThrow(/dedicated bot startup/);
    const { guardMap } = await import('../src/bots/map-guard');
    await expect(guardMap(map)).resolves.toBeUndefined();
  },30000);
});
