import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';

const temporary: string[] = [];
afterEach(() => temporary.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
function directory() { const path = mkdtempSync(join(process.cwd(), '.varcamp-test-')); temporary.push(path); return path; }
function validate(path: string) { return spawnSync(process.execPath, ['--import', 'tsx', 'tools/maps/validate-cli.ts', path], { encoding: 'utf8' }); }
it('fails CLI validation on malformed current TMJ files', () => {
  const path = directory(); writeFileSync(join(path, 'bad.tmj'), '{"type":"map"}');
  const result = validate(path);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('SCHEMA_INVALID');
});
it('identifies a foundation-only run without claiming complete world validation', () => {
  const result = validate(directory());
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('Validated 0 current TMJ/WAM files');
  expect(result.stdout).toContain('Foundation only');
});
it('reports unreadable JSON as a CLI issue', () => {
  const path = directory(); writeFileSync(join(path, 'bad.tmj'), '{broken');
  const result = validate(path);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('READ_ERROR');
});
it('fails loudly when a future tool has not been implemented', () => {
  const result = spawnSync(process.execPath, ['tools/run-tool.mjs', 'tools/not-implemented.ts'], { encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Tool not implemented yet');
});
it('passes arguments and failure exit status through to an implemented tool', () => {
  const path = join(directory(), 'exit.ts'); writeFileSync(path, 'console.log(process.argv[2]); process.exitCode = 7;');
  const result = spawnSync(process.execPath, ['tools/run-tool.mjs', path, 'sentinel'], { encoding: 'utf8' });
  expect(result.status).toBe(7);
  expect(result.stdout).toContain('sentinel');
});

it('fails the project command when an audience references a broadcast name instead of its stage ID', () => {
  const path=directory();
  const area=(id:string,properties:unknown[])=>({id,name:id,visible:true,x:0,y:0,width:32,height:32,properties});
  writeFileSync(join(path,'invalid.wam'),JSON.stringify({version:'2.1.0',mapUrl:'solar-hall.tmj',entities:{},entityCollections:[],areas:[area('solar-stage',[{id:'speaker',type:'speakerMegaphone',name:'varcamp-solar-main',chatEnabled:false,seeAttendees:false}]),area('audience',[{id:'listen',type:'listenerMegaphone',speakerZoneName:'varcamp-solar-main',chatEnabled:false,allowTalking:false,raiseHandEnabled:true}])]}));
  const result=validate(path);expect(result.status).toBe(1);expect(result.stderr).toContain('WAM_LISTENER_REFERENCE');
});
