"""Closed production1CPU contract. No provider or lifecycle side effects."""
import copy,datetime,json,re
from .service_plan import PERSONAS,PlanError
class ContractError(PlanError):pass
def need(ok,why):
 if not ok:raise ContractError(why)
def same(a,b):return json.dumps(a,sort_keys=True,separators=(',',':'),allow_nan=False)==json.dumps(b,sort_keys=True,separators=(',',':'),allow_nan=False)
def persona(value):need(type(value)is str and value in PERSONAS,'Fixed service persona');return value
def name(p):return 'varcamp-'+persona(p)+'-service-v1'
def labels(plan,p):return {'io.varcamp.bot.owner':'varcamp-'+persona(p)+'-development-v1','io.varcamp.bot.module-sha256':plan.release['controller']['sha256'],'io.varcamp.bot.persona':p,'io.varcamp.service.owner':'persistent-three-guide-v1','io.varcamp.service.release':plan.manifest_sha}
def security(options):
 need(type(options)is list and len(options)==2 and len(set(options))==2,'Exactly two security options')
 sec=[o[8:]for o in options if type(o)is str and o.startswith('seccomp=')]
 need(len(sec)==1 and 'no-new-privileges:true'in options,'Exact seccomp/nnp options')
 try:value=json.loads(sec[0])
 except Exception as e:raise ContractError('Invalid seccomp option')from e
 return {'no-new-privileges':True,'seccomp':value}
def validate_templates(plan):
 c,h=plan.config_template,plan.host_template
 need(type(c)is dict and type(h)is dict,'Complete actual Config/HostConfig templates required')
 need(c.get('Hostname')=='$ID12'and c.get('Image')=='$IMAGE'and c.get('Labels')=='$LABELS'and c.get('Env')=='$ENV','Only four declared Config placeholders')
 need(c.get('User')=='1000:1000'and c.get('Cmd')==['node','runner.mjs','--renderer-mode=canvas']and c.get('Entrypoint')in(None,[]),'Exact runner command/user')
 for k,v in {'AttachStdin':False,'AttachStdout':True,'AttachStderr':True,'OpenStdin':False,'StdinOnce':False,'Tty':False}.items():need(c.get(k)is v,'Actual Docker CLI production stdio default: '+k)
 need(c.get('Healthcheck')=={'Test':['CMD','node','healthcheck.mjs'],'Interval':5_000_000_000,'Timeout':3_000_000_000,'StartPeriod':120_000_000_000,'Retries':3}and type(c.get('StopTimeout'))is int and c['StopTimeout']==15 and not c.get('ExposedPorts'),'Exact healthcheck/stop/no exposed ports')
 required={'NanoCpus':1_000_000_000,'Memory':2*1024**3,'MemorySwap':2*1024**3,'PidsLimit':512,'ShmSize':512*1024**2,'ReadonlyRootfs':True,'Privileged':False,'CapDrop':['ALL'],'Init':True,'NetworkMode':'bridge','IpcMode':'private','PidMode':'','UTSMode':'','Tmpfs':{'/tmp':'rw,nosuid,nodev,size=512m,uid=1000,gid=1000,mode=1777'},'LogConfig':{'Type':'json-file','Config':{'max-size':'5m','max-file':'2'}}}
 for k,v in required.items():need(k in h and same(h[k],v),'Fixed production field: '+k)
 need(h.get('OomKillDisable')is False,'Exact created engine OOM policy')
 need(h.get('RestartPolicy')in({'Name':'no'},{'Name':'no','MaximumRetryCount':0}),'No automatic restart')
 for k in ('CapAdd','Binds','VolumesFrom','PortBindings','Devices','DeviceRequests','DeviceCgroupRules','GroupAdd','Sysctls','Ulimits','Links'):
  need(not h.get(k),'Forbidden host facility: '+k)
 for k in ('PidMode','UTSMode','UsernsMode','CgroupParent','CpusetCpus','CpusetMems'):
  need(h.get(k,'')=='','Forbidden host namespace/placement: '+k)
 need(h.get('Runtime','runc')in('','runc')and h.get('CgroupnsMode','private')=='private'and not h.get('PublishAllPorts')and not h.get('AutoRemove'),'Fixed runtime/namespace/no published ports/no auto-remove')
 need(same(security(h['SecurityOpt']),{'no-new-privileges':True,'seccomp':plan.seccomp}),'Original source security policy')
 env=plan.release['imageEnv'];base=plan.release['imageLabels']
 need(type(env)is list and all(type(v)is str and '\x00'not in v and not v.startswith('VARCAMP_BOT_PERSONA=')for v in env),'Actual fixed image Env')
 need(type(base)is dict and all(type(k)is str and type(v)is str and not k.startswith(('io.varcamp.bot.','io.varcamp.service.'))for k,v in base.items()),'Actual original image labels')
def create_args(plan,p):
 persona(p);validate_templates(plan)
 return ['create','--name',name(p),'--init','--user','1000:1000','--cpus','1','--memory','2g','--memory-swap','2g','--pids-limit','512','--shm-size','512m','--read-only','--tmpfs','/tmp:rw,nosuid,nodev,size=512m,uid=1000,gid=1000,mode=1777','--cap-drop','ALL','--security-opt','no-new-privileges:true','--security-opt','seccomp='+str(plan.seccomp_path),'--network','bridge','--restart','no','--stop-timeout','15','--log-driver','json-file','--log-opt','max-size=5m','--log-opt','max-file=2',*[x for k,v in labels(plan,p).items()for x in('--label',k+'='+v)],'--env','VARCAMP_BOT_PERSONA='+p,plan.release['image'],'node','runner.mjs','--renderer-mode=canvas']
def container_phase(item):
 """Pinned engine physical history, not a caller flag or ownership authority."""
 state=item.get('State');need(type(state)is dict and type(state.get('Running'))is bool and state.get('Paused')is False and state.get('OOMKilled')is False and state.get('Dead')is False and state.get('Restarting')is False,'Conclusive running/stopped state')
 status=state.get('Status');started=state.get('StartedAt')
 if status=='created':
  need(state['Running']is False and started=='0001-01-01T00:00:00Z','Exact never-started created phase');return 'created'
 need(status in('running','exited')and state['Running']is(status=='running')and type(started)is str and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z',started)is not None and not started.startswith('0001-'),'Exact invoked physical phase')
 try:datetime.datetime.fromisoformat(started[:-1]+'+00:00')
 except ValueError as error:raise ContractError('Valid actual invocation timestamp')from error
 return 'invoked'
def verify_container(plan,p,identity,item):
 persona(p);validate_templates(plan)
 need(type(identity)is str and re.fullmatch('[a-f0-9]{64}',identity),'Actual full container ID')
 need(type(item)is dict and item.get('Id')==identity and item.get('Name')=='/'+name(p)and item.get('Image')==plan.release['image'],'Exact ID/name/image; no adoption')
 expected=copy.deepcopy(plan.config_template);expected.update(Hostname=identity[:12],Image=plan.release['image'],Labels={**plan.release['imageLabels'],**labels(plan,p)},Env=['VARCAMP_BOT_PERSONA='+p,*plan.release['imageEnv']])
 need(same(item.get('Config'),expected),'Complete Config changed')
 phase=container_phase(item)
 actual=copy.deepcopy(item.get('HostConfig'));host=copy.deepcopy(plan.host_template)
 # Engine8af9fe3 CREATE adapts unsupported OOM nil back to false; START
 # revalidates it to nil without CREATE adaptation. STOP retains that value.
 if phase=='invoked':host['OomKillDisable']=None
 need(type(actual)is dict,'Complete HostConfig required');actual['SecurityOpt']=security(actual.get('SecurityOpt'));host['SecurityOpt']=security(host['SecurityOpt'])
 need(same(actual,host),'Complete HostConfig changed')
 need(item.get('Mounts')==[] and type(item.get('RestartCount'))is int and item['RestartCount']==0,'No external mount/restart')
 state=item['State']
 need(item.get('AppArmorProfile')in(('docker-default',)if state['Running']else('','docker-default')),'Original AppArmor profile')
 return item
