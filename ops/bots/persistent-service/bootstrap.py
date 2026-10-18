"""Source-verified isolated production entry; this file is externally pinned by Root."""
import hashlib,json,os,pathlib,platform,signal,stat,sys,time
SOURCE_MANIFEST_SHA256='6db733e64a4b255ddb08e06cf7cb3e7561773a21163692723e1209febae331c8'
FILES={'__init__.py','deadline.py','failure_record.py','owned_client.py','release_binding.py','runtime_predicates.py','service_cli.py','service_contract.py','service_engine.py','service_health.py','service_journal.py','service_operator.py','service_plan.py'}
INTERPRETER={'executable':'/usr/bin/python3','resolvedExecutable':'/usr/bin/python3.12','executableSha256':'c86f21d0da9290ece2d7d49a3f7ed52aed59cb029abdf0ea25c79634f6cbe960','version':'3.12.3 (main, Aug 31 2026, 10:18:26) [GCC 13.3.0]','versionInfo':[3,12,3,'final',0],'isolated':1,'noSite':1,'dontWriteBytecode':1,'pycachePrefix':None,'platform':'linux','machine':'aarch64','uid':0,'euid':0}

def fail(message):raise ValueError(message)
def read(path,maximum):
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd)
  if not stat.S_ISREG(a.st_mode)or a.st_uid!=os.getuid()or a.st_nlink!=1 or stat.S_IMODE(a.st_mode)!=0o600 or not 0<a.st_size<=maximum:fail('Private bounded source required')
  data=b''
  while True:
   chunk=os.read(fd,min(16384,maximum-len(data)+1))
   if not chunk:break
   data+=chunk
   if len(data)>maximum:fail('Source byte overflow')
  b=os.fstat(fd)
  if(a.st_dev,a.st_ino,a.st_size,a.st_mode,a.st_uid,a.st_nlink,a.st_mtime_ns,a.st_ctime_ns)!=(b.st_dev,b.st_ino,b.st_size,b.st_mode,b.st_uid,b.st_nlink,b.st_mtime_ns,b.st_ctime_ns)or len(data)!=a.st_size:fail('Source changed')
  return data
 finally:os.close(fd)

def check_interpreter_profile(value):
 if json.dumps(value,sort_keys=True,separators=(',',':'))!=json.dumps(INTERPRETER,sort_keys=True,separators=(',',':')):fail('Qualified actual Linux interpreter profile required')
def actual_interpreter():
 if sys.platform!='linux'or sys.version_info[:3]!=(3,12,3)or os.getuid()!=0 or os.geteuid()!=0:fail('Qualified actual Linux interpreter required; local tests do not grant production authority')
 executable=pathlib.Path(sys.executable);resolved=executable.resolve()
 if str(executable)!=INTERPRETER['executable']or str(resolved)!=INTERPRETER['resolvedExecutable']:fail('Exact actual Linux interpreter path required')
 fd=os.open(resolved,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  before=os.fstat(fd)
  if not stat.S_ISREG(before.st_mode)or before.st_uid!=0 or before.st_mode&0o022 or before.st_size<=0:fail('Actual interpreter source required')
  hashed=hashlib.sha256();size=0
  while True:
   chunk=os.read(fd,65536)
   if not chunk:break
   hashed.update(chunk);size+=len(chunk)
  after=os.fstat(fd)
  if(before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns,before.st_ctime_ns)!=(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns)or size!=before.st_size:fail('Actual interpreter changed')
 finally:os.close(fd)
 return {'executable':str(executable),'resolvedExecutable':str(resolved),'executableSha256':hashed.hexdigest(),'version':sys.version,'versionInfo':list(sys.version_info),'isolated':sys.flags.isolated,'noSite':sys.flags.no_site,'dontWriteBytecode':sys.flags.dont_write_bytecode,'pycachePrefix':sys.pycache_prefix,'platform':sys.platform,'machine':platform.machine(),'uid':os.getuid(),'euid':os.geteuid()}
def verify_source_tree(root):
 for directory in(root,root/'service'):
  s=directory.lstat()
  if directory.resolve()!=directory or not stat.S_ISDIR(s.st_mode)or s.st_uid!=os.getuid()or stat.S_IMODE(s.st_mode)!=0o700:fail('Private canonical source directory required')
 if {p.name for p in root.iterdir()}-{'service','tests','bootstrap.py','source-manifest.json','README.md'}or {p.name for p in(root/'service').iterdir()}!=FILES:fail('Closed source roster required')
 raw=read(root/'source-manifest.json',65536)
 if hashlib.sha256(raw).hexdigest()!=SOURCE_MANIFEST_SHA256:fail('Source manifest mismatch')
 def pairs(items):
  result={}
  for key,value in items:
   if key in result:fail('Duplicate source field')
   result[key]=value
  return result
 value=json.loads(raw,object_pairs_hook=pairs)
 if type(value)is not dict or set(value)!={'scope','files'}or value['scope']!='varcamp-guide-service-source-v1'or type(value['files'])is not dict or set(value['files'])!={'service/'+name for name in FILES}:fail('Closed manifest schema required')
 for name,row in value['files'].items():
  if type(row)is not dict or set(row)!={'bytes','sha256','mode'}or row['mode']!=0o600:fail('Closed source record')
  data=read(root/name,65536)
  if len(data)!=row['bytes']or hashlib.sha256(data).hexdigest()!=row['sha256']:fail('Actual source mismatch: '+name)
 return root
def verified_entry():
 check_interpreter_profile(actual_interpreter());root=verify_source_tree(pathlib.Path(__file__).parent)
 if any(name=='service'or name.startswith('service.')for name in sys.modules):fail('No preloaded service source')
 sys.path.insert(0,str(root))
 from service.service_cli import main
 return main

if __name__=='__main__':
 signal.signal(signal.SIGALRM,lambda *_:(_ for _ in()).throw(TimeoutError('Original five-second source input end')));signal.setitimer(signal.ITIMER_REAL,5)
 try:entry=verified_entry()
 except BaseException as error:
  print('Source verification refused: '+type(error).__name__+': '+str(error)[:1024],file=sys.stderr);raise SystemExit(2)
 finally:signal.setitimer(signal.ITIMER_REAL,0)
 raise SystemExit(entry())
