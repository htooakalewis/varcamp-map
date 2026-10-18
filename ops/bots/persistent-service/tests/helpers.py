"""TEST ONLY: complete synthetic policy schema and peer state; never actual observations or release authority."""
import copy,hashlib,json,pathlib,time
from service.service_plan import Plan,ROOM
from service import runtime_predicates as runtime
SOURCE_PATHS=('/opt/lyra/runner.mjs','/opt/lyra/candidate-render-policy.mjs','/opt/lyra/config.mjs','/opt/lyra/evidence.mjs','/opt/lyra/healthcheck.mjs','/opt/lyra/browser-session.mjs','/opt/lyra/node_modules/playwright-core/package.json','/opt/lyra/node_modules/playwright-core/browsers.json','/opt/lyra/node_modules/playwright-core/lib/coreBundle.js')
def plan():
 value=json.loads(pathlib.Path(__file__).with_name('fixtures').joinpath('synthetic-policy-templates.json').read_bytes());assert value['scope']=='TEST_ONLY_SYNTHETIC_POLICY_SCHEMA'
 p=object.__new__(Plan);p.directory=pathlib.Path('/TEST_ONLY_NO_PROVIDER');p.manifest_sha='90ab'*16;p.seccomp_path=p.directory/'seccomp.json';p.seccomp={'TEST_ONLY':'no host security policy'}
 p.config_template=copy.deepcopy(value['configTemplate']);p.host_template=copy.deepcopy(value['hostTemplate'])
 app={'kind':'app-frontend','url':'https://varcamp.3-1-133-135.sslip.io/assets/main-TEST.js','bytes':12,'sha256':'1234'*16,'status':200,'frame':'owned-main-page'}
 executed=[{'kind':k,'url':'https://TEST_ONLY/'+k,'sha256':hashlib.sha256(k.encode()).hexdigest(),'size':len(k),'status':200,'capture':'captured'}for k in('iframe-sdk','main','GameManager')]
 p.release={'room':ROOM,'image':'sha256:'+'89ab'*16,'controller':{'url':'https://TEST_ONLY/controller','bytes':1,'sha256':'2345'*16},'sources':[{'path':path,'bytes':len(path.encode()),'sha256':hashlib.sha256(path.encode()).hexdigest()}for path in SOURCE_PATHS],'public':[{'kind':str(i)}for i in range(5)],'imageEnv':['PATH=/usr/bin'],'imageLabels':{},'app':app,'executingSources':executed}
 runtime.APP=app;runtime.EXECUTING_SOURCES=executed
 p.baseline=[{'id':f'{i+10000:064x}','name':'/TESTprotected'+str(i),'state':'running','health':'none','image':'sha256:'+'a0b1'*16,'configSha256':'a1b2'*16,'hostConfigSha256':'a2b3'*16,'mountsSha256':'a3b4'*16}for i in range(77)]
 return p
def container(p,persona,identity=None):
 from service.service_contract import labels,name
 identity=identity or hashlib.sha256(persona.encode()).hexdigest();c=copy.deepcopy(p.config_template);c.update(Hostname=identity[:12],Image=p.release['image'],Labels={**p.release['imageLabels'],**labels(p,persona)},Env=['VARCAMP_BOT_PERSONA='+persona,*p.release['imageEnv']])
 return {'Id':identity,'Name':'/'+name(persona),'Image':p.release['image'],'Config':c,'HostConfig':copy.deepcopy(p.host_template),'Mounts':[],'RestartCount':0,'AppArmorProfile':'','State':{'Running':False,'Paused':False,'Status':'created','StartedAt':'0001-01-01T00:00:00Z','OOMKilled':False,'Dead':False,'Restarting':False,'Health':{'Status':'starting'}}}
def healthy(p,persona,player,wall):
 now=time.time()*1000;policy=dict(runtime.makeExecutionPolicy('canvas'));scripts=[{**row,'origin':'captured-response-body','frame':'about:srcdoc'if row['kind']!='GameManager'else'owned-main-page',**({'executionContext':policy}if row['kind']=='GameManager'else{})}for row in p.release['executingSources']]
 identity={'roomId':ROOM,'name':{'lyra':'Lyra[BOT]','nova':'Nova[BOT]','orion':'Orion[BOT]'}[persona],'playerId':player}
 evidence={'at':now,'leaseDeadline':now+10000,'operationBudgetMs':10000,'steps':3}
 return {'healthy':True,'error':None,'failure':None,'persona':persona,'moduleSha256':p.release['controller']['sha256'],'identity':identity,'updatedAt':now,'controller':{'identity':identity,'evidence':evidence,'outcome':'progress'},'rendererEvidence':{'schemaVersion':1,'requestedMode':'canvas','appAttestation':p.release['app'],'sequence':1,'observation':{'startWallMs':now-1,'endWallMs':now,'startMonoMs':100,'endMonoMs':101,'backend':'canvas2d','canvasWidth':1440,'canvasHeight':1000,'clientWidth':1440,'clientHeight':1000,'viewportWidth':1440,'viewportHeight':1000,'dpr':1,'sameCanvas':True,'nativeInitialized':True}},'scripts':scripts}
class FakeEngine:
 def __init__(self,p):self.p=p;self.calls=[];self.objects={};self.fail=None;self.player=100;self.players={}
 def ownership(self,p,end):
  self.calls.append(('ownership',None))
  if self.fail=='image':raise RuntimeError('TEST immutable image drift')
 def preflight(self,p,end):
  self.calls.append(('preflight',None))
  if self.fail=='public':raise RuntimeError('TEST actual source drift')
 def baseline(self,owned,end):
  self.calls.append(('baseline',None));out=copy.deepcopy(self.p.baseline)
  if self.fail=='host':out[0]['state']='exited'
  return sorted(out,key=lambda r:r['id'])
 def names(self,name,end):self.calls.append(('names',name));return [k for k,v in self.objects.items()if v['Name']=='/'+name]
 def create(self,args,end):
  p=args[args.index('--env')+1].split('=')[1];obj=container(self.p,p);self.objects[obj['Id']]=obj;self.calls.append(('create',obj['Id']))
  if self.fail=='created-security':obj['HostConfig']['Privileged']=True
  if self.fail=='create-lost-ack':raise TimeoutError('TEST first actual lost CREATE ACK')
  return obj['Id']
 def inspect(self,id,end):self.calls.append(('inspect',id));return copy.deepcopy(self.objects[id])
 def archive(self,id,path,end):
  self.calls.append(('archive',id))
  if path=='/tmp/lyra-health.json':raise AssertionError('Runtime tmpfs must not use rootfs archive')
  return path.encode()
 def health(self,id,end):
  self.calls.append(('health',id))
  if self.fail in('readiness-error','readiness-and-stop-error')and next(v for v in self.objects[id]['Config']['Env']if v.startswith('VARCAMP_BOT_PERSONA='))in('VARCAMP_BOT_PERSONA=nova','VARCAMP_BOT_PERSONA=lyra'):
   # Do not sabotage an already-acknowledged sibling's preflight observation.
   if getattr(self,'failing_id',None)==id:raise RuntimeError('TEST original readiness')
  p=next(v for v in self.objects[id]['Config']['Env']if v.startswith('VARCAMP_BOT_PERSONA=')).split('=')[1];h=healthy(self.p,p,self.players[id],time.time()*1000)
  if self.fail=='terminal-health':h.update(healthy=False,error='hasPreviousMessage TEST original native cause',failure={'error':{'name':'TypeError','message':'hasPreviousMessage TEST original native cause'}})
  if self.fail=='stale-health':h['updatedAt']=1
  return json.dumps(h).encode()
 def start(self,id,end):
  self.calls.append(('start',id));self.objects[id]['HostConfig']['OomKillDisable']=None;self.player+=1;self.players[id]=self.player;self.objects[id]['State'].update(Running=True,Status='running',StartedAt='2026-10-18T01:00:00.'+str(self.player).zfill(9)+'Z',Health={'Status':'healthy'});self.objects[id]['AppArmorProfile']='docker-default'
  if self.fail=='start-lost-ack':raise TimeoutError('TEST original lost START ACK')
  if self.fail in('readiness-error','readiness-and-stop-error'):self.failing_id=id
 def stop(self,id,end):
  self.calls.append(('stop',id))
  if self.fail=='readiness-and-stop-error':raise TimeoutError('TEST cleanup STOP lost ACK')
  self.objects[id]['State'].update(Running=False,Status='exited');self.objects[id]['AppArmorProfile']='docker-default'
 def remove(self,id,end):self.calls.append(('remove',id));del self.objects[id]
 def absent(self,id,profile,end):return id not in self.objects and not self.names(profile,end)
 def logs(self,id,end):self.calls.append(('logs',id));return {'stdout':b'TEST original native cause','stderr':b'TEST native error stream'}
