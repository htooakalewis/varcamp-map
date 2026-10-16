import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

describe('dedicated Lyra release module',()=>{
  it('emits a standalone import-safe default.run while visitors keep the existing runtime',async()=>{
    const out=resolve('.qa/lyra-release');const result=await build({configFile:resolve('buildmap.vite.config.ts'),logLevel:'silent',build:{outDir:out}});
    const bot=resolve(out,'bots/lyra.js');expect(existsSync(bot),'release is missing bots/lyra.js').toBe(true);
    const script=`const m=await import(${JSON.stringify(pathToFileURL(bot).href)});if(typeof m.default?.run!=='function')throw Error('Missing official default.run');console.log('safe import without WA')`;
    expect(execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'})).toContain('safe import without WA');
    const map=JSON.parse(readFileSync(resolve(out,'maps/overworld.tmj'),'utf8'));
    const runtime=map.properties.find((p:{name:string})=>p.name==='script').value;
    expect(runtime).toMatch(/^\.\.\/assets\/src-main-.+\.js$/);
    const outputs = Array.isArray(result) ? result.flatMap(r => r.output) : 'output' in result ? result.output : [];
    const chunks = new Map(outputs.filter(chunk => chunk.type === 'chunk').map(chunk => [chunk.fileName, chunk]));
    const seen = new Set<string>();
    const walk = (name: string) => {
      if (seen.has(name)) return;
      seen.add(name);
      const chunk = chunks.get(name);
      expect(chunk, `missing emitted visitor dependency ${name}`).toBeDefined();
      if (!chunk) return;
      expect(Object.keys(chunk.modules).some(path => path.includes('/src/bots/'))).toBe(false);
      for (const dependency of [...chunk.imports, ...chunk.dynamicImports]) walk(dependency);
    };
    walk(runtime.replace('../', ''));
    expect(seen.has('bots/lyra.js')).toBe(false);
    const { guardMap } = await import('../src/bots/map-guard');
    await expect(guardMap(map)).resolves.toBeUndefined();
  },30000);
});
