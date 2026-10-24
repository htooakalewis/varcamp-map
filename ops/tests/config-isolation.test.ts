import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
function violations(c: any): string[] {
 const v: string[] = [];
 if(c.name !== 'varcamp') v.push('project');
 for(const [name,s] of Object.entries<any>(c.services ?? {})) {
  if(s.platform !== 'linux/arm64') v.push(`pin:${name}`);
  if(s.ports?.some((p:any)=> p.host_ip !== '127.0.0.1' || [5432,6379,50051,50053,9000].includes(p.target))) v.push(`public:${name}`);
  if(name !== 'traefik' && !Object.hasOwn(s.networks ?? {}, 'core')) v.push(`network:${name}`);
  if(s.labels?.['traefik.enable'] === 'true' && s.labels?.['traefik.docker.network'] !== 'varcamp_core') v.push(`route:${name}`);
 }
 const lock=JSON.parse(readFileSync('ops/images.lock.json','utf8'));
 const identity=JSON.parse(execFileSync('python3',['ops/tests/image-lock-validation.py'],{encoding:'utf8',input:JSON.stringify({services:c.services,entries:Object.values(lock.images)})}));
 if(!identity.accepted) v.push('image-identity');
 for(const n of Object.values<any>(c.networks ?? {})) if(n.external || !n.name?.startsWith('varcamp_')) v.push('network-owner');
 for(const n of Object.values<any>(c.volumes ?? {})) if(n.external || !n.name?.startsWith('varcamp_')) v.push('volume-owner');
 const e=c.services?.play?.environment ?? {};
 if(e.MAP_EDITOR_ALLOW_ALL_USERS !== 'false' || !e.MAP_EDITOR_ALLOWED_USERS || e.DISABLE_ANONYMOUS !== 'false' || e.OPENID_TAGS_CLAIM !== 'tags') v.push('identity');
 return v;
}
function providerViolations(c:any):string[] {
 const p=c.providers?.docker;
 return p?.exposedByDefault===false && p?.constraints==='Label(`com.docker.compose.project`, `varcamp`)' && p?.network==='varcamp_core' && p?.useBindPortIP===false ? [] : ['discovery'];
}
function rendered(env:Record<string,string>={}) {
 return JSON.parse(execFileSync('docker',['compose','--env-file','ops/.env.example','-f','ops/compose.yml','config','--format','json'],{encoding:'utf8',env:{...process.env,...env}}));
}
describe('production isolation',()=> {
 it('has a deployable configuration',()=>expect(existsSync('ops/compose.yml')).toBe(true));
 it('owns only private ARM64 pinned application resources',()=> {
  const c=rendered();expect(violations(c)).toEqual([]);
  const lock=JSON.parse(readFileSync('ops/images.lock.json','utf8'));
  for(const service of Object.values<any>(c.services)) expect(Object.values<any>(lock.images).map(x=>x.image)).toContain(service.image);
 });
 it('rejects public Postgres and broad Docker discovery',()=> {
  const c=rendered(); c.services.postgres.ports=[{host_ip:'0.0.0.0',published:'5432',target:5432}];
  expect(violations(c)).toContain('public:postgres');
  const staticConfig=JSON.parse(readFileSync('ops/traefik/traefik.yml','utf8'));
  expect(providerViolations(staticConfig)).toEqual([]);
  staticConfig.providers.docker.exposedByDefault=true;delete staticConfig.providers.docker.constraints;
  expect(providerViolations(staticConfig)).toContain('discovery');
 });
 it('keeps Basic upload distinct from callback and removes obsolete Bearer strategy',()=> {
  const e=rendered().services['map-storage'].environment;
  expect(e.ENABLE_BASIC_AUTHENTICATION).toBe('true'); expect(e.ENABLE_BEARER_AUTHENTICATION).toBe('false');
  expect(e.AUTHENTICATION_STRATEGY).toBeUndefined(); expect(e.AUTHENTICATION_TOKEN).toBeUndefined();
 });
});
it('refuses full readiness before media acceptance exists',()=> {
 expect(existsSync('ops/preflight.sh')).toBe(true);
 expect(()=>execFileSync('bash',['ops/preflight.sh','--phase','full'],{encoding:'utf8',stdio:['ignore','pipe','pipe']})).toThrow(/MEDIA NOT READY/);
});

it('supplies the required empty uploader URL when chat uploads are disabled',()=>expect(rendered().services.play.environment.UPLOADER_URL).toBe(''));

it('defaults map editor access to the organiser and accepts an explicit allowed-users list',()=> {
 expect(rendered().services.play.environment.MAP_EDITOR_ALLOWED_USERS).toBe('organiser@example.invalid');
 expect(rendered({MAP_EDITOR_ALLOWED_USERS:'a@x.invalid,b@x.invalid'}).services.play.environment.MAP_EDITOR_ALLOWED_USERS).toBe('a@x.invalid,b@x.invalid');
 expect(rendered({MAP_EDITOR_ALLOWED_USERS:''}).services.play.environment.MAP_EDITOR_ALLOWED_USERS).toBe('organiser@example.invalid');
});

it('keeps realm self registration off and publishes administrator tags in userinfo',()=> {
 const r=JSON.parse(readFileSync('ops/keycloak/realm.template.json','utf8'));
 expect(r.registrationAllowed).toBe(false);expect(r.clients[0].directAccessGrantsEnabled).toBe(false);
 const mapper=r.clients[0].protocolMappers[0];expect(mapper.config['userinfo.token.claim']).toBe('true');expect(mapper.config['multivalued']).toBe('true');expect(mapper.config['claim.name']).toBe('tags');
});
it('excludes bootstrap admin credentials from steady-state containers',()=> {
 const e=rendered().services.keycloak.environment;
 expect(e.KC_BOOTSTRAP_ADMIN_USERNAME).toBeUndefined();
 expect(e.KC_BOOTSTRAP_ADMIN_PASSWORD).toBeUndefined();
});


it('restricts the explicit local artifact to Play with pull_policy never',()=> {
 const c=rendered();
 c.services.play.pull_policy='always';
 expect(violations(c)).toContain('image-identity');
 const wrongService=rendered();
 wrongService.services.back.image=wrongService.services.play.image;
 wrongService.services.back.pull_policy='never';
 expect(violations(wrongService)).toContain('image-identity');
 const unlocked=rendered();
 unlocked.services.back.image='example/back:latest';
 expect(violations(unlocked)).toContain('image-identity');
});
