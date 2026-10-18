"""Actual bounded local Docker client. Production has no provider selector."""
import hashlib,io,json,re,ssl,tarfile,time,urllib.request
from .owned_client import bounded
from .service_plan import strict,digest,verify_plan_inputs
from .service_contract import ContractError,need
DOCKER='/usr/bin/docker'
# Exact immutable-image /usr/bin/node; only builtin fs, no caller program/path.
# A pinned opened publication may legally be unlinked by the runner's atomic
# rename. Its bytes/mtime remain stable; current leases are checked afterward.
HEALTH_READER_JS=r"""const fs=require('node:fs');
const C=fs.constants,maximum=1048576;
let fd,first,secondary=[],data,total=0;
const describe=e=>String(e&&e.message||e).slice(0,2048);
try {
 fd=fs.openSync('/tmp/lyra-health.json',C.O_RDONLY|C.O_NOFOLLOW|C.O_NONBLOCK);
 const before=fs.fstatSync(fd,{bigint:true});
 const valid=s=>s.isFile()&&s.uid===BigInt(process.getuid())&&s.gid===BigInt(process.getgid())&&(s.mode&0o7777n)===0o600n&&s.nlink>=0n&&s.nlink<=1n&&s.size>0n&&s.size<=BigInt(maximum);
 if(!valid(before))throw Error('Invalid bounded owned runtime publication');
 data=Buffer.alloc(maximum+1);
 while(total<data.length){const n=fs.readSync(fd,data,total,data.length-total,null);if(n===0)break;total+=n;}
 const after=fs.fstatSync(fd,{bigint:true});
 if(!valid(after)||total!==Number(before.size)||['dev','ino','mode','uid','gid','size','mtimeNs'].some(k=>before[k]!==after[k]))throw Error('Incomplete or changed runtime publication');
} catch(error){first=error;}
if(fd!==undefined){const closing=fd;fd=undefined;try{fs.closeSync(closing);}catch(error){if(first)secondary.push(describe(error));else first=error;}}
if(first){process.stderr.write(JSON.stringify({first:describe(first),secondary}));process.exitCode=1;}
else process.stdout.write(data.subarray(0,total));
"""
class DockerError(RuntimeError):
 def __init__(self,operation,result=None):
  self.operation=operation;self.stdout=b''if result is None else result.stdout;self.stderr=b''if result is None else result.stderr;self.returncode=None if result is None else result.returncode;self.client_settled=result is not None
  super().__init__(operation if result is None else operation+': '+self.stderr.decode('utf8','replace')[:4096])
class DockerEngine:
 def _result(self,operation,args,end,limit=262144):
  # Caller supplies fixed internally constructed Docker argv only.
  result=bounded([DOCKER,*args],end,limit)
  if result.returncode!=0:raise DockerError(operation,result)
  return result
 def run(self,operation,args,end,limit=262144):return self._result(operation,args,end,limit).stdout
 def inspect(self,identity,end):
  need(bool(re.fullmatch('[a-f0-9]{64}',identity)),'Full ID only')
  rows=strict(self.run('inspect',['inspect',identity],min(end,time.monotonic()+4)))
  need(type(rows)is list and len(rows)==1,'One exact inspect response');return rows[0]
 def names(self,name,end):
  raw=self.run('names',['ps','-a','--no-trunc','--filter','name=^/'+name+'$','--format','{{.ID}}'],min(end,time.monotonic()+4),4096)
  ids=raw.decode('ascii').splitlines();need(all(re.fullmatch('[a-f0-9]{64}',v)for v in ids)and len(ids)==len(set(ids)),'Exact name census');return ids
 def baseline(self,owned,end):
  ids=self.run('host-list',['ps','-a','--no-trunc','--format','{{.ID}}'],min(end,time.monotonic()+4),16384).decode('ascii').splitlines()
  need(len(ids)<=128 and len(ids)==len(set(ids))and all(re.fullmatch('[a-f0-9]{64}',v)for v in ids),'Closed host ID roster')
  rows=[]
  for identity in sorted(set(ids)-set(owned)):
   item=self.inspect(identity,end);state=item['State']
   canonical=lambda value:hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf8')).hexdigest()
   rows.append({'id':item['Id'],'name':item['Name'],'image':item['Image'],'state':state['Status'],'health':state.get('Health',{}).get('Status','none'),'configSha256':canonical(item['Config']),'hostConfigSha256':canonical(item['HostConfig']),'mountsSha256':canonical(item['Mounts'])})
  after=self.run('host-list-after',['ps','-a','--no-trunc','--format','{{.ID}}'],min(end,time.monotonic()+4),16384).decode('ascii').splitlines()
  need(sorted(ids)==sorted(after),'Complete host ID roster changed during bracket')
  return rows
 def archive(self,identity,source,end,maximum=2*1024**2):
  raw=self.run('archive',['cp',identity+':'+source,'-'],min(end,time.monotonic()+4),maximum)
  with tarfile.open(fileobj=io.BytesIO(raw),mode='r:')as tar:
   members=tar.getmembers();need(len(members)==1 and members[0].isfile()and not members[0].issym()and not members[0].islnk()and members[0].name==source.rsplit('/',1)[-1]and 0<members[0].size<=1024**2,'One complete regular source archive')
   data=tar.extractfile(members[0]).read(members[0].size+1);need(len(data)==members[0].size,'Complete source data');return data
 def health(self,identity,end):
  need(type(identity)is str and re.fullmatch('[a-f0-9]{64}',identity)is not None,'Runtime health full ID only')
  result=self._result('runtime-health',['exec',identity,'/usr/bin/node','-e',HEALTH_READER_JS],min(end,time.monotonic()+4),2*1024**2)
  if result.stderr or not 0<len(result.stdout)<=1024**2:raise DockerError('Incomplete runtime health publication',result)
  return result.stdout
 def create(self,args,end):
  result=self._result('create',args,end,4096)
  if re.fullmatch(b'[a-f0-9]{64}\n',result.stdout)is None:raise DockerError('Incomplete actual CREATE ID',result)
  return result.stdout[:-1].decode('ascii')
 def start(self,identity,end):
  result=self._result('start',['start',identity],end,4096)
  if result.stdout!=(identity+'\n').encode():raise DockerError('Incomplete actual START acknowledgment',result)
 def stop(self,identity,end):
  result=self._result('stop',['stop','--timeout','10',identity],end,4096)
  if result.stdout!=(identity+'\n').encode():raise DockerError('Incomplete actual STOP acknowledgment',result)
 def remove(self,identity,end):
  result=self._result('remove',['rm',identity],min(end,time.monotonic()+2),4096)
  if result.stdout!=(identity+'\n').encode():raise DockerError('Incomplete actual REMOVE acknowledgment',result)
 def logs(self,identity,end):
  result=self._result('logs',['logs','--timestamps',identity],min(end,time.monotonic()+4),262144);return {'stdout':result.stdout,'stderr':result.stderr}
 def absent(self,identity,profile,end):
  raw=self.run('absence-id',['ps','-a','--no-trunc','--filter','id='+identity,'--format','{{.ID}}'],min(end,time.monotonic()+4),4096)
  return raw==b''and self.names(profile,end)==[]
 def preflight(self,plan,end):
  verify_plan_inputs(plan)
  # A no-proxy HTTPS reader; redirects and all nonexact sources refuse.
  opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=ssl.create_default_context()),_NoRedirect())
  for row in plan.release['public']:
   remaining=min(5,end-time.monotonic());need(remaining>0,'Original public preflight end')
   from .deadline import alarm
   with alarm(min(end,time.monotonic()+remaining)),opener.open(row['url'],timeout=remaining)as response:
    need(response.status==200 and response.geturl()==row['url'],'Exact public200 URL')
    body=response.read(min(row['bytes']+1,8*1024**2+1));need(len(body)==row['bytes']and digest(body)==row['sha256'],'Actual public source bytes changed')
  native=plan.release['native']
  from .deadline import alarm
  remaining=min(5,end-time.monotonic());need(remaining>0,'Original native source end')
  with alarm(min(end,time.monotonic()+remaining)),opener.open(native['url'],timeout=remaining)as response:
   need(response.status==200 and response.geturl()==native['url'],'Exact current native URL200')
   body=response.read(native['bytes']+1);need(len(body)==native['bytes']and digest(body)==native['sha256'],'Actual native body changed')
   need(native_geometry(strict(body))==native['geometrySha256'],'Actual native geometry changed')
  self._image(plan,end)
 def ownership(self,plan,end):
  # Existing immutable ownership does not depend on a still-live public body.
  verify_plan_inputs(plan);self._image(plan,end)
 def _image(self,plan,end):
  # Actual image identity, Config, architecture and final readback were separately reviewed.
  image=strict(self.run('image',['image','inspect',plan.release['image']],min(end,time.monotonic()+4)))
  need(type(image)is list and len(image)==1 and image[0].get('Id')==plan.release['image']and image[0].get('Architecture')=='arm64'and image[0].get('Os')=='linux','Actual final Linux ARM64 image')
  need(digest(json.dumps(image[0]['Config'],sort_keys=True,separators=(',',':')).encode())==plan.release['imageConfigSha256'],'Actual complete image Config')
class _NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*_):raise DockerError('Redirect forbidden')

def native_geometry(value):
 need(type(value)is dict and all(type(value.get(k))is int and value[k]==v for k,v in {'width':128,'height':128,'tilewidth':32,'tileheight':32}.items())and all(type(value.get(k))is list for k in('layers','tilesets','properties')),'Compatible current native geometry')
 def layers(rows):
  result=[]
  for layer in rows:
   current=dict(layer)
   if layer['type']=='group'and isinstance(layer.get('layers'),list):current['layers']=layers(layer['layers'])
   elif layer['type']=='objectgroup'and isinstance(layer.get('objects'),list):
    current['objects']=[]
    for obj in layer['objects']:
     o=dict(obj)
     if type(o.get('type'))is str and o['type']and o.get('class')==o['type']:o.pop('class')
     current['objects'].append(o)
   result.append(current)
  return result
 body={k:value[k]for k in('width','height','tilewidth','tileheight')};body.update(layers=layers(value['layers']),tilesets=[{k:v for k,v in t.items()if k!='image'}for t in value['tilesets']],properties=[p for p in value['properties']if p['name']!='script'])
 return digest(json.dumps(body,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf8'))
