"""Actual closed private source loader. A digest by itself grants no effect."""
import hashlib,json,math,os,re,stat,time
from pathlib import Path
from types import MappingProxyType
from . import release_binding
from .deadline import alarm
PERSONAS=('lyra','nova','orion')
ROOM='https://varcamp.3-1-133-135.sslip.io/~/varcamp-demo/maps/overworld.wam'
class PlanError(ValueError):pass
class UnboundRelease(PlanError):pass
class InputClosureError(PlanError):
 def __init__(self,fd,original,close_error):
  self.uncertain_fd=fd;self.original=original;self.close_error=close_error;super().__init__('Uncertain private input close; original error retained')
INPUT_SECONDS=5
SOURCE_ROWS=(('/opt/lyra/runner.mjs','source'),('/opt/lyra/candidate-render-policy.mjs','source'),('/opt/lyra/config.mjs','source'),('/opt/lyra/evidence.mjs','source'),('/opt/lyra/healthcheck.mjs','source'),('/opt/lyra/browser-session.mjs','source'),('/opt/lyra/node_modules/playwright-core/package.json','sdk-package'),('/opt/lyra/node_modules/playwright-core/browsers.json','sdk-browsers'),('/opt/lyra/node_modules/playwright-core/lib/coreBundle.js','sdk-resolver'))
PUBLIC_PATTERNS={'controller':r'https://maps\.3-1-133-135\.sslip\.io/varcamp-demo/bots/lyra\.js\?v=[a-f0-9]{64}','app-frontend':r'https://varcamp\.3-1-133-135\.sslip\.io/assets/main-[A-Za-z0-9_-]+\.js','iframe-sdk':r'https://varcamp\.3-1-133-135\.sslip\.io/iframe_api\.js','main':r'https://maps\.3-1-133-135\.sslip\.io/varcamp-demo/assets/src-main-[A-Za-z0-9_-]+\.js','GameManager':r'https://varcamp\.3-1-133-135\.sslip\.io/assets/GameManager-[A-Za-z0-9_-]+\.js'}
def need(ok,reason):
 if not ok:raise PlanError(reason)
def digest(raw):return hashlib.sha256(raw).hexdigest()
def pin(value):return type(value)is str and re.fullmatch('[a-f0-9]{64}',value)is not None
def strict(raw):
 def pairs(rows):
  out={}
  for k,v in rows:
   need(k not in out,'Duplicate JSON field');out[k]=v
  return out
 def finite(v):
  f=float(v);need(math.isfinite(f),'Finite JSON number');return f
 def integer(v):need(len(v.lstrip('-'))<=128,'Bounded JSON integer');return int(v)
 return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda v:(_ for _ in()).throw(PlanError('Nonfinite JSON')),parse_float=finite,parse_int=integer)
def _file(path,limit,mode):
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);first=None;raw=bytearray()
 try:
  a=os.fstat(fd);need(stat.S_ISREG(a.st_mode)and a.st_nlink==1 and a.st_uid==os.getuid()and stat.S_IMODE(a.st_mode)==mode and 0<a.st_size<=limit,'Private bounded regular input required')
  while True:
   part=os.read(fd,min(16384,limit-len(raw)+1))
   if not part:break
   raw.extend(part);need(len(raw)<=limit,'Input overflow')
  b=os.fstat(fd);need((a.st_dev,a.st_ino,a.st_mode,a.st_nlink,a.st_uid,a.st_size,a.st_mtime_ns,a.st_ctime_ns)==(b.st_dev,b.st_ino,b.st_mode,b.st_nlink,b.st_uid,b.st_size,b.st_mtime_ns,b.st_ctime_ns)and len(raw)==a.st_size,'Input changed')
 except BaseException as error:first=error
 try:os.close(fd)
 except BaseException as error:raise InputClosureError(fd,first,error)from(first or error)
 if first is not None:raise first
 return bytes(raw)
class Plan:
 __slots__=('release','baseline','directory','manifest_sha','seccomp_path','seccomp','config_template','host_template')
 def __init__(self,*_):raise PlanError('Actual verified source loader only')
def load_plan(directory,manifest_sha):
 # This first refusal precedes directory opens, provider construction and imports.
 if release_binding.REVIEWED_PLAN_SHA256 is None or release_binding.REVIEWED_RELEASE is None:raise UnboundRelease('Actual final release/image source binding is absent')
 with alarm(time.monotonic()+INPUT_SECONDS):return _load_bound(directory,manifest_sha)
def _load_bound(directory,manifest_sha):
 need(type(manifest_sha)is str and manifest_sha==release_binding.REVIEWED_PLAN_SHA256 and re.fullmatch('[0-9a-f]{64}',manifest_sha),'Exact source-reviewed plan digest')
 directory=Path(directory);need(directory.is_absolute()and directory.resolve()==directory,'Canonical input directory')
 ds=directory.lstat();need(stat.S_ISDIR(ds.st_mode)and ds.st_uid==os.getuid()and stat.S_IMODE(ds.st_mode)==0o700,'Private owner directory')
 raw=_file(directory/'plan.json',65536,0o600);need(digest(raw)==manifest_sha,'Plan bytes mismatch');value=strict(raw)
 need(type(value)is dict and set(value)=={'scope','release','baseline','seccomp','configTemplate','hostTemplate'},'Closed plan shape')
 need(value['scope']=='varcamp-persistent-guides-production-v1'and value['release']==release_binding.REVIEWED_RELEASE,'Actual reviewed release mismatch')
 release=value['release'];need(type(release)is dict and set(release)=={'room','image','imageConfigSha256','imageEnv','imageLabels','controller','public','app','executingSources','sources','native'}and release['room']==ROOM,'Closed fixed guide release')
 need(type(release['image'])is str and re.fullmatch('sha256:[a-f0-9]{64}',release['image']),'Immutable final image')
 need(type(release['controller'])is dict and set(release['controller'])=={'url','bytes','sha256'},'Controller pin')
 need(release['controller']['url']=='https://maps.3-1-133-135.sslip.io/varcamp-demo/bots/lyra.js?v='+release['controller']['sha256'],'Fixed current controller URL')
 need(pin(release['imageConfigSha256']),'Actual image full Config pin')
 need(type(release['public'])is list and len(release['public'])==5 and all(type(x)is dict and set(x)=={'kind','url','bytes','sha256','status'}for x in release['public'])and {x['kind']for x in release['public']}==set(PUBLIC_PATTERNS),'Actual five closed public bodies')
 for row in release['public']:
  need(type(row['url'])is str and re.fullmatch(PUBLIC_PATTERNS[row['kind']],row['url'])and type(row['status'])is int and row['status']==200,'Fixed current source URL/status')
 public={x['kind']:x for x in release['public']}
 need(release['controller']=={k:public['controller'][k]for k in('url','bytes','sha256')},'Same actual controller body')
 need(release['app']=={**public['app-frontend'],'frame':'owned-main-page'},'Same actual core App attestation')
 executed=release['executingSources']
 need(type(executed)is list and len(executed)==3 and all(type(x)is dict and set(x)=={'kind','url','size','sha256','status','capture'}for x in executed)and {x['kind']for x in executed}=={'iframe-sdk','main','GameManager'},'Closed actual delivered source roster')
 for row in executed:
  expected=public[row['kind']];need(row=={'kind':expected['kind'],'url':expected['url'],'size':expected['bytes'],'sha256':expected['sha256'],'status':200,'capture':'captured'},'Expected delivered response must match actual public bytes')
 need(type(release['sources'])is list and len(release['sources'])==9 and all(type(x)is dict and set(x)=={'path','bytes','sha256','kind'}for x in release['sources'])and [(x['path'],x['kind'])for x in release['sources']]==list(SOURCE_ROWS),'Exact ordered nine image source members')
 for row in release['sources']:need(type(row['bytes'])is int and 0<row['bytes']<=(8*1024**2 if row['kind']=='sdk-resolver'else 1024**2)and pin(row['sha256']),'Bounded actual image source')
 need(type(release.get('native'))is dict and set(release['native'])=={'url','bytes','sha256','geometrySha256'},'Actual current native source pin')
 need(type(release['native']['url'])is str and re.fullmatch(r'https://maps\.3-1-133-135\.sslip\.io/varcamp-demo/maps/overworld\.tmj(?:\?v=[A-Za-z0-9_-]{1,128})?',release['native']['url'])and pin(release['native']['geometrySha256']),'Fixed current native URL and geometry')
 for row in [release['controller'],*release['public'],release['native']]:
  need(type(row.get('bytes'))is int and 0<row['bytes']<=8*1024**2 and type(row.get('sha256'))is str and re.fullmatch('[a-f0-9]{64}',row['sha256']),'Original bounded public body')

 baseline=value['baseline'];need(type(baseline)is list and len(baseline)==77 and len({x['id']for x in baseline})==77,'Actual fresh protected77 baseline')
 for row in baseline:
  need(type(row)is dict and set(row)=={'id','name','image','state','health','configSha256','hostConfigSha256','mountsSha256'}and pin(row['id'])and type(row['name'])is str and re.fullmatch('/[A-Za-z0-9][A-Za-z0-9_.-]{0,255}',row['name'])and type(row['image'])is str and re.fullmatch('sha256:[a-f0-9]{64}',row['image'])and row['state']in('created','exited','running','paused','dead','restarting','removing')and row['health']in('none','starting','healthy','unhealthy')and all(pin(row[k])for k in('configSha256','hostConfigSha256','mountsSha256')),'Closed protected host row')
 sec=value['seccomp'];need(type(sec)is dict and set(sec)=={'file','bytes','sha256'}and sec['file']=='seccomp.json','Fixed security source')
 secraw=_file(directory/sec['file'],65536,0o600);need(len(secraw)==sec['bytes']and digest(secraw)==sec['sha256']=='f922c7c9bfc1ece0b72b244e56dc85756ded002c837fb46054cfd8b275c74b6b','Original derived seccomp source')
 plan=object.__new__(Plan);plan.release=release;plan.baseline=baseline;plan.directory=directory;plan.manifest_sha=manifest_sha;plan.seccomp_path=directory/'seccomp.json';plan.seccomp=strict(secraw);plan.config_template=value['configTemplate'];plan.host_template=value['hostTemplate']
 from .service_contract import validate_templates
 validate_templates(plan);return plan
def verify_plan_inputs(plan):
 """Re-read the real private inputs; a loaded DTO is not a drift exemption."""
 current=load_plan(plan.directory,plan.manifest_sha)
 need(current.release==plan.release and current.baseline==plan.baseline and current.config_template==plan.config_template and current.host_template==plan.host_template and current.seccomp==plan.seccomp,'Retained plan changed after admission')
