import { config } from '../bots/config.mjs';
import { expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

it('health command fails closed for absent, malformed, stale, stopped, and wrong-module state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lyra-health-')); const path = join(dir, 'health.json');
  const command = ['ops/bots/healthcheck.mjs', path];
  const valid = { healthy: true, updatedAt: Date.now(), moduleSha256: config.moduleSha256, persona: 'lyra', error: null, controller: { outcome:'progress', evidence:{at:Date.now(),operationBudgetMs:10000,leaseDeadline:Date.now()+10000} } };
  try {
    expect(spawnSync(process.execPath, command).status).toBe(1);
    for (const input of ['bad json', JSON.stringify({ ...valid, updatedAt: Date.now() - 20000 }), JSON.stringify({ ...valid, updatedAt: Date.now() + 20000 }), JSON.stringify({ ...valid, controller:undefined }), JSON.stringify({ ...valid, controller:{outcome:'pending',evidence:{deadline:Date.now()-1}} }), JSON.stringify({ ...valid, controller:{outcome:'allowed-idle',evidence:{deadline:Date.now()-1}} }), JSON.stringify({ ...valid, controller:{outcome:'terminal',evidence:{}} }), JSON.stringify({ ...valid, healthy: false }), JSON.stringify({ ...valid, error: 'Lyra stopped: failed move' }), JSON.stringify({ ...valid, moduleSha256: '0'.repeat(64) })]) {
      writeFileSync(path, input); expect(spawnSync(process.execPath, command).status).toBe(1);
    }
    const refreshedAt=Date.now(); writeFileSync(path, JSON.stringify({...valid,updatedAt:refreshedAt,controller:{outcome:'progress',evidence:{at:refreshedAt,operationBudgetMs:10000,leaseDeadline:refreshedAt+10000}}})); expect(() => execFileSync(process.execPath, command)).not.toThrow();
  } finally { rmSync(dir, { recursive: true }); }
});
it('uses a controller-issued lease across a completed 100ms rest before the next 3s host observation', () => {
  const dir=mkdtempSync(join(tmpdir(),'guide-phase-lease-')), path=join(dir,'health.json');
  const observedAt=Date.now()-1100, phaseEnd=observedAt+100;
  const health={healthy:true,updatedAt:observedAt,moduleSha256:config.moduleSha256,persona:'lyra',error:null,controller:{outcome:'allowed-idle',evidence:{at:observedAt,reason:'step-rest',idleStartedAt:observedAt,idleBudgetMs:100,deadline:phaseEnd,leaseDeadline:phaseEnd+10000}}};
  try {
    writeFileSync(path,JSON.stringify(health)); expect(spawnSync(process.execPath,['ops/bots/healthcheck.mjs',path]).status).toBe(0);
    for(const controller of [{outcome:'allowed-idle',evidence:{deadline:phaseEnd,leaseDeadline:Date.now()-1}},{outcome:'pending',evidence:{deadline:Date.now()-1,leaseDeadline:Date.now()+10000}}]) {
      writeFileSync(path,JSON.stringify({...health,updatedAt:Date.now(),controller}));expect(spawnSync(process.execPath,['ops/bots/healthcheck.mjs',path]).status).toBe(1);
    }
  }finally{rmSync(dir,{recursive:true});}
});
it('rejects malformed long pending and idle authority in an actual persisted health file',()=>{
 const dir=mkdtempSync(join(tmpdir(),'guide-invalid-lease-')),path=join(dir,'health.json');
 try {for(const shape of ['pending','rest','conversation','unknown']) {
  const at=Date.now();const evidence=shape==='pending'?{at,operation:'move',phase:'pre-step',sequence:1,startedAt:at,operationBudgetMs:10000,deadline:at+3600000,leaseDeadline:at+3600000}:{at,reason:shape,idleStartedAt:at,idleBudgetMs:shape==='rest'?2000:20000,deadline:at+3600000,leaseDeadline:at+3610000};
  writeFileSync(path,JSON.stringify({healthy:true,updatedAt:at,moduleSha256:config.moduleSha256,persona:'lyra',error:null,controller:{outcome:shape==='pending'?'pending':'allowed-idle',evidence}}));
  expect(spawnSync(process.execPath,['ops/bots/healthcheck.mjs',path]).status).toBe(1);
 }}finally{rmSync(dir,{recursive:true});}
});
