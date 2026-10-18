"""Bounded real service ownership transaction; detached browser lifetime belongs to Docker."""
import datetime,hashlib,json,re,time
from .service_plan import PERSONAS
from .service_contract import persona,name,verify_container,create_args
from .service_health import validate_health
from .runtime_predicates import RendererAdmission,health_source_expiry
from .failure_record import local_certain
class ServiceFailure(RuntimeError):pass
SOURCE_PATHS=('/opt/lyra/runner.mjs','/opt/lyra/candidate-render-policy.mjs','/opt/lyra/config.mjs','/opt/lyra/evidence.mjs','/opt/lyra/healthcheck.mjs','/opt/lyra/browser-session.mjs','/opt/lyra/node_modules/playwright-core/package.json')
class ServiceOperator:
 def __init__(self,plan,journal,engine):self.plan=plan;self.journal=journal;self.engine=engine;self.closed=False;self.first_error=None;self.secondary_errors=[];self.actual_evidence={};self._attested=set();self._created_here=set();self._cleanup_entered=set()
 def _persona(self,p):
  try:persona(p)
  except Exception as error:raise ServiceFailure('Fixed single persona only')from error
  if self.closed:raise ServiceFailure('Closed local operator')
 def _owned(self):return {m['id']for m in self.journal.state['members'].values()if m['id']is not None and m['state']!='removed'}
 def _certain(self,end):
  if time.monotonic()>=end:raise TimeoutError('Original service observation end')
  if self.journal.poisoned or self.journal.closed or self.journal.state['pending']is not None or not local_certain(self.first_error,self.secondary_errors,self.journal):raise ServiceFailure('Unresolved local/durable service state')
 def _inventory(self,end):
  # Complete ownership/history/source verification is independent of health.
  self._certain(end);items={}
  for p,member in self.journal.state['members'].items():
   identity=member['id'];slot=member['state']
   if identity is None:
    if slot!='absent':raise ServiceFailure('Unresolved service slot blocks new effects')
    continue
   if slot=='removed':raise ServiceFailure('Retired slot requires a separately reviewed release')
   if slot=='unknown':raise ServiceFailure('Unresolved actual service state blocks new effects')
   item=self._inspect(p,identity,end);self._sources(identity,end);self._certain(end);items[p]=item
  if self.engine.baseline({item['Id']for item in items.values()},end)!=sorted(self.plan.baseline,key=lambda r:r['id']):raise ServiceFailure('Protected host roster/state/health changed')
  self._certain(end);return items
 def _ownership(self,end):
  self._certain(end);self.engine.ownership(self.plan,end);return self._inventory(end)
 def _preflight(self,end):
  self._certain(end);self.engine.preflight(self.plan,end);items=self._inventory(end)
  players=set();source_expiries=[]
  # START alone admits current public/native bodies and every running peer's
  # exact native/runtime/renderer lease and recorded shared identity.
  for p,item in items.items():
   member=self.journal.member(p);state=item['State'];slot=member['state']
   if slot in('created','stopped'):continue
   if member['startedAt']is None or state.get('StartedAt')!=member['startedAt']:raise ServiceFailure('Actual recorded invocation changed')
   if slot not in('ready','starting')or state['Running']is not True or state.get('Status')!='running'or state.get('Health',{}).get('Status')!='healthy':raise ServiceFailure('Recorded running service is no longer healthy')
   raw=self._health_raw(p,item['Id'],end);receipt=validate_health(self.plan,p,raw,member['startWallMs'],RendererAdmission());source_expiries.append(health_source_expiry(json.loads(raw)))
   if member['playerId']is None or receipt['playerId']!=member['playerId']:raise ServiceFailure('Actual recorded shared player changed')
   if receipt['playerId']in players:raise ServiceFailure('Distinct actual guide player identities required')
   players.add(receipt['playerId'])
  # Recheck the isolation bracket after health IO, without renewing receipts.
  if self.engine.baseline({item['Id']for item in items.values()},end)!=sorted(self.plan.baseline,key=lambda r:r['id']):raise ServiceFailure('Protected host roster/state/health changed')
  self._certain(end)
  if any(time.time()*1000>=expiry for expiry in source_expiries):raise ServiceFailure('Original actual health lease expired during preflight')
 def _inspect(self,p,identity,end):
  item=verify_container(self.plan,p,identity,self.engine.inspect(identity,end));member=self.journal.member(p);state=item['State'];slot=member['state']
  # Pair physical phase with the source-acknowledged history BEFORE any source
  # read/attestation. A later slot rejection must not create cleanup ownership.
  if member['id']!=identity:raise ServiceFailure('Exact recorded member ID required')
  if slot=='created':
   if state['Status']!='created':raise ServiceFailure('Recorded created member was invoked externally')
  elif slot in('starting','ready','stopped'):
   if state['Status']=='created':raise ServiceFailure('Recorded invoked member reverted to created')
   if member['startedAt']is not None and state['StartedAt']!=member['startedAt']:raise ServiceFailure('Actual recorded invocation changed')
   if slot in('ready','stopped')and member['startedAt']is None:raise ServiceFailure('Recorded invocation identity required')
   if slot=='stopped'and state['Status']!='exited':raise ServiceFailure('Recorded stopped member changed state')
  else:raise ServiceFailure('Unresolved service slot cannot select a lifecycle phase')
  return item
 def _health_raw(self,p,identity,end):
  observed=self._inspect(p,identity,end)
  if observed['State']['Running']is not True:raise ServiceFailure('Runtime health unavailable for exact stopped container')
  return self._runtime_publication(p,identity,end)
 def _runtime_publication(self,p,identity,end):
  raw=self.engine.health(identity,end);self.actual_evidence[p+'-health.json']=raw;return raw
 def _sources(self,identity,end):
  expected={r['path']:r for r in self.plan.release['sources']}
  for path in SOURCE_PATHS:
   row=expected[path];raw=self.engine.archive(identity,path,end)
   if len(raw)!=row['bytes']or hashlib.sha256(raw).hexdigest()!=row['sha256']:raise ServiceFailure('Actual stopped container source changed: '+path)
 def _mutate(self,p,op,end,call):
  # The source mutation interval and actual pending identity exist BEFORE effect.
  self.journal.begin(p,op,end)
  try:
   value=call()
   if time.monotonic()>=end:raise TimeoutError('Original mutation settled late')
   return value
  except BaseException as error:
   self.first_error=self.first_error or error;raise
 def _error(self,p,operation,error,end):
  self.first_error=self.first_error or error
  # One original terminal interval owns failure journaling and cleanup. It does
  # not extend the failed operation or make a late mutation receipt conclusive.
  terminal_end=time.monotonic()+15
  pending=self.journal.state['pending']
  own_pending=pending is not None and pending['persona']==p
  self.journal.fail(p,pending['operation']if own_pending else operation,error,min(terminal_end,time.monotonic()+.25),unknown=own_pending)
  # A known receipt and an earlier successful full physical/source inspection
  # authorize only this failed attempt's exact object. Unknown attempts and
  # failed local/durable settlement remain held; neither can be retried.
  self._cleanup_failed_attempt(p,terminal_end)
  raise ServiceFailure(p+' '+operation+' failed: '+str(self.first_error)[:1024])from self.first_error
 def _cleanup_failed_attempt(self,p,end):
  member=self.journal.member(p);identity=member['id']
  if p in self._cleanup_entered or identity not in self._attested or self.journal.poisoned or self.journal.state['pending']is not None or member['state']in('unknown','removed','absent')or not local_certain(self.first_error,self.secondary_errors,self.journal):return
  self._cleanup_entered.add(p)
  try:
   observed=self._inspect(p,identity,end)
   # Capture the real structured terminal/pageerror and logs BEFORE stopping
   # tmpfs or removing the object. These are private evidence, never admission.
   try:self._health_raw(p,identity,end)
   except BaseException as diagnostic:self.secondary_errors.append(diagnostic)
   if not local_certain(self.first_error,self.secondary_errors,self.journal):return
   try:
    for stream,raw in self.engine.logs(identity,end).items():self.actual_evidence[p+'-logs.'+stream+'.bin']=raw
   except BaseException as diagnostic:self.secondary_errors.append(diagnostic)
   if not local_certain(self.first_error,self.secondary_errors,self.journal):return
   if observed['State']['Running']:
    action_end=min(end,time.monotonic()+12);self.journal.begin_cleanup(p,'stop',action_end)
    try:self.engine.stop(identity,action_end)
    except BaseException as error:
     self.journal.fail(p,'stop',error,action_end,unknown=True);raise
    if time.monotonic()>=action_end:raise TimeoutError('Original cleanup STOP settled late')
    self.journal.acknowledge(p,'stop',action_end,id=identity);observed=self._inspect(p,identity,end);member.update(state='stopped')
   if observed['State']['Running']or observed['State'].get('Status')not in('created','exited'):raise ServiceFailure('Conclusive stopped owned object required before removal')
   if identity in self._created_here:
    action_end=min(end,time.monotonic()+2);self.journal.begin_cleanup(p,'remove',action_end)
    try:self.engine.remove(identity,action_end)
    except BaseException as error:
     self.journal.fail(p,'remove',error,action_end,unknown=True);raise
    if time.monotonic()>=action_end:raise TimeoutError('Original cleanup REMOVE settled late')
    self.journal.acknowledge(p,'remove',action_end,id=identity)
    if not self.engine.absent(identity,name(p),end):raise ServiceFailure('Removal receipt lacks actual ID/name absence')
    member.update(state='removed');self.journal.event(p,'remove','absent',end,id=identity)
   else:self.journal.event(p,'stop','stopped-after-failure',end,id=identity)
  except BaseException as secondary:
   self.secondary_errors.append(secondary)
   self.journal.fail(p,'cleanup',secondary,min(end,time.monotonic()+.25),unknown=self.journal.state['pending']is not None)
 def start(self,p):
  self._persona(p);self._attested.clear();self._created_here.clear();self._cleanup_entered.clear();began=time.monotonic();end=began+150;member=self.journal.member(p)
  try:
   if self.journal.state['firstFailure']is not None or self.journal.state['pending']is not None:raise ServiceFailure('Held prior failure; no new effect/retry')
   if member['state']not in('absent','stopped'):raise ServiceFailure('Only fresh absent slot or explicitly stopped recorded ID can start')
   self._preflight(end)
   if member['state']=='absent':
    if self.engine.names(name(p),end):raise ServiceFailure('Existing exact name must not be adopted')
    action_end=min(end,time.monotonic()+25)
    identity=self._mutate(p,'create',action_end,lambda:self.engine.create(create_args(self.plan,p),action_end))
    member.update(id=identity,state='created');self._created_here.add(identity);self.journal.acknowledge(p,'create',action_end,id=identity)
   identity=member['id'];observed=self._inspect(p,identity,end)
   if observed['State']['Running']:raise ServiceFailure('Expected acknowledged stopped object')
   self._sources(identity,end);self._inspect(p,identity,end);self._attested.add(identity);self._preflight(end)
   # The invocation lower wall bound is captured once before START and never refreshed.
   start_wall=time.time()*1000;action_end=min(end,time.monotonic()+5)
   self._mutate(p,'start',action_end,lambda:self.engine.start(identity,action_end))
   member.update(state='starting',startWallMs=start_wall,playerId=None,startedAt=None);self.journal.acknowledge(p,'start',action_end,id=identity)
   renderer=RendererAdmission()
   while time.monotonic()<end:
    observed=self._inspect(p,identity,end);state=observed['State']
    if state['Running']is not True or state.get('Status')!='running':raise ServiceFailure('Guide stopped during readiness')
    health=state.get('Health',{}).get('Status')
    if health=='unhealthy':raise ServiceFailure('Native Docker health is unhealthy')
    if health=='healthy':
     raw=self._health_raw(p,identity,end)
     receipt=validate_health(self.plan,p,raw,start_wall,renderer)
     started_at=state.get('StartedAt')
     if type(started_at)is not str or re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z',started_at)is None or started_at.startswith('0001-'):raise ServiceFailure('Actual started invocation identity required')
     member.update(startedAt=started_at,playerId=receipt['playerId'])
     self._preflight(end);member.update(state='ready',playerId=receipt['playerId']);self.journal.event(p,'start','ready',end,id=identity,playerId=receipt['playerId'],rendererSequence=receipt['rendererSequence'])
     return {'persona':p,'id':identity,'state':'ready',**receipt,'externalServiceRemainsRunning':True,'localOperatorLifetimeIsSeparate':True}
    if health!='starting':raise ServiceFailure('Unknown Docker health state')
    time.sleep(min(1,max(0,end-time.monotonic())))
   raise TimeoutError('Original startup150s elapsed')
  except BaseException as error:self._error(p,'start',error,end)
 def status(self,p):
  self._persona(p);end=time.monotonic()+25;member=self.journal.member(p)
  if member['id']is None:raise ServiceFailure('No actual recorded ID; status cannot adopt')
  opening=self._ownership(end);services={};receipts={};expiries={};self.observation_errors={}
  for guide,slot in self.journal.state['members'].items():
   item=opening.get(guide);state=None if item is None else item['State']
   native='none'if state is None else state.get('Health',{}).get('Status','none')
   native=native if native in('none','starting','healthy','unhealthy')else'unknown'
   row={'persona':guide,'id':slot['id'],'journalState':slot['state'],'state':'absent'if state is None else('stopped'if state['Status']=='exited'else state['Status']),'healthy':False,'nativeHealth':native,'reason':'absent'if item is None else('exited'if state['Status']=='exited'else'not-started')};services[guide]=row
   if state is None or state['Running']is not True:continue
   # Ownership/history failures must escape before degraded-health handling.
   current=self._inspect(guide,item['Id'],end)
   if current['State']['Running']is not True:
    row.update(state='stopped',healthy=False,reason='physical-state-changed');continue
   stage='runtime-read-failed'
   try:
    raw=self._runtime_publication(guide,item['Id'],end);stage='runtime-validation-failed'
    receipt=validate_health(self.plan,guide,raw,slot['startWallMs'],RendererAdmission())
    if slot['playerId']is None or receipt['playerId']!=slot['playerId']:raise ServiceFailure('Actual recorded shared player changed')
    receipts[guide]=receipt;expiries[guide]=health_source_expiry(json.loads(raw));row.update(healthy=native=='healthy',reason='healthy'if native=='healthy'else'native-not-healthy')
   except Exception as error:
    # Preserve actual exception objects as well as bounded report metadata.
    # Local-client/descriptor uncertainty is never converted to degraded health.
    self.observation_errors[guide]=error;self.secondary_errors.append(error)
    self._certain(end);row.update(reason=stage,error={'type':type(error).__name__,'message':str(error)[:1024]})
   self._certain(end)
  final=self._ownership(end);players={}
  for guide,row in services.items():
   item=final.get(guide);before=opening.get(guide)
   if item is None:continue
   state=item['State'];native=state.get('Health',{}).get('Status','none');native=native if native in('none','starting','healthy','unhealthy')else'unknown'
   row.update(state='stopped'if state['Status']=='exited'else state['Status'],nativeHealth=native)
   if (state['Status'],state['Running'],state['StartedAt'])!=(before['State']['Status'],before['State']['Running'],before['State']['StartedAt']):row.update(healthy=False,reason='physical-state-changed')
   elif native!=before['State'].get('Health',{}).get('Status','none'):row.update(healthy=False,reason='native-health-changed')
   elif guide in expiries and time.time()*1000>=expiries[guide]:row.update(healthy=False,reason='lease-expired')
   if row['healthy']:
    player=receipts[guide]['playerId']
    if player in players:
     row.update(healthy=False,reason='duplicate-player');services[players[player]].update(healthy=False,reason='duplicate-player')
    else:players[player]=guide
  for guide,row in services.items():
   if row['healthy']:row.update(receipts[guide])
  self._certain(end);return {**services[p],'services':services}
 def stop(self,p):
  self._persona(p);self._attested.clear();self._created_here.clear();self._cleanup_entered.clear();end=time.monotonic()+15;member=self.journal.member(p)
  try:
   if self.journal.state['firstFailure']is not None or self.journal.state['pending']is not None or member['state']!='ready'or member['id']is None:raise ServiceFailure('Only acknowledged known ready service without held failure can stop')
   item=self._ownership(end)[p]
   if item['State']['Running']:
    action_end=min(end,time.monotonic()+12)
    self._mutate(p,'stop',action_end,lambda:self.engine.stop(member['id'],action_end))
    self.journal.acknowledge(p,'stop',action_end,id=member['id']);observed=self._inspect(p,member['id'],end)
    if observed['State']['Running']or observed['State'].get('Status')!='exited':raise ServiceFailure('Actual stopped inspection required')
    stage='stopped'
   else:
    if item['State']['Status']!='exited':raise ServiceFailure('Conclusive exact owned exited invocation required')
    stage='observed-exited'
   member.update(state='stopped');self.journal.event(p,'stop',stage,end,id=member['id']);self._ownership(end)
   return {'persona':p,'id':member['id'],'state':'stopped','settlement':stage}
  except BaseException as error:self._error(p,'stop',error,end)
 def close(self):
  # Successful service ownership does not mean those external objects are absent.
  self.closed=True;self.journal.close()
