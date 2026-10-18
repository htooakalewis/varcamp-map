"""Pure original renderer/executing-source/lease predicates; no finite owner import."""
import hashlib,json,math,time
from types import MappingProxyType
from .service_plan import ROOM
from . import release_binding
Failure=ValueError
APP=None if release_binding.REVIEWED_RELEASE is None else release_binding.REVIEWED_RELEASE['app']
EXECUTING_SOURCES=None if release_binding.REVIEWED_RELEASE is None else release_binding.REVIEWED_RELEASE['executingSources']

def check(value,message):
 if not value:raise Failure(message)

def makeExecutionPolicy(mode):
 check(type(mode)is str and mode in ('default','canvas'),'Fixed navigation mode required')
 url=ROOM+('?phaserMode=canvas'if mode=='canvas'else'')
 return MappingProxyType({'schemaVersion':1,'frameRole':'owned-main-page','navigationMode':mode,'navigationUrlSha256':hashlib.sha256(url.encode()).hexdigest(),'binding':'response-frame-and-url'})

def verifyExecution(scripts,policy):
 check(isinstance(policy,MappingProxyType),'Immutable host execution policy required')
 check(type(policy.get('schemaVersion'))is int and all(type(policy.get(k))is str for k in ('frameRole','navigationMode','navigationUrlSha256','binding'))and dict(policy)==dict(makeExecutionPolicy(policy.get('navigationMode'))),'Fixed host execution policy mismatch')
 check(isinstance(scripts,list)and len(scripts)<=8,'Captured response inventory shape')
 check(sum(1 for row in scripts if isinstance(row,dict)and row.get('kind')=='GameManager'and row.get('capture')=='captured')==1,'Exactly one captured GameManager context required')
 for expected in EXECUTING_SOURCES:
  matches=[row for row in scripts if isinstance(row,dict)and row.get('kind')==expected['kind']and all(row.get(k)==v for k,v in expected.items())and row.get('origin')=='captured-response-body']
  check(bool(matches),'Executing response contract missing/mismatch: '+expected['kind'])
  if expected['kind']in('main','iframe-sdk'):check(any(row.get('frame')=='about:srcdoc'for row in matches),'Executing response frame mismatch: '+expected['kind'])
 for row in scripts:
  check(isinstance(row,dict),'Captured response row shape')
  if row.get('capture')=='captured'and row.get('kind')in('main','iframe-sdk','GameManager'):
   expected=next(e for e in EXECUTING_SOURCES if e['kind']==row['kind'])
   check(all(row.get(k)==v for k,v in expected.items()),'Contradictory captured response identity')
   if row['kind']=='GameManager':
    check(all(type(row.get(k))is type(v)for k,v in expected.items()),'GameManager response typed pins mismatch')
    ctx=row.get('executionContext')
    check(isinstance(ctx,dict)and set(ctx)==set(policy)and type(ctx.get('schemaVersion'))is int and ctx.get('schemaVersion')==1 and all(type(ctx.get(k))is str for k in ('frameRole','navigationMode','navigationUrlSha256','binding'))and ctx==dict(policy),'GameManager executionContext missing/type/shape/binding mismatch')
 return True

class RendererAdmission:

    def __init__(self):
        self.previous = None
        self.previous_canonical = None

    def __call__(self, health, policy, now):
        check(dict(policy) == dict(makeExecutionPolicy('canvas')), 'Canvas-only candidate policy required')
        value = health.get('rendererEvidence') if isinstance(health, dict) else None
        check(isinstance(value, dict) and set(value) == {'schemaVersion', 'requestedMode', 'appAttestation', 'sequence', 'observation'}, 'Exact renderer receipt required')
        check(type(value['schemaVersion']) is int and value['schemaVersion'] == 1 and (value['requestedMode'] == 'canvas'), 'Renderer schema/mode mismatch')
        app = value['appAttestation']
        check(isinstance(app, dict) and set(app) == set(APP) and all((type(app[k]) is type(x) and app[k] == x for (k, x) in APP.items())), 'Actual App body attestation mismatch')
        check(type(value['sequence']) is int and 1 <= value['sequence'] <= 9007199254740991, 'Renderer sequence invalid')
        o = value['observation']
        fields = {'startWallMs', 'endWallMs', 'startMonoMs', 'endMonoMs', 'backend', 'canvasWidth', 'canvasHeight', 'clientWidth', 'clientHeight', 'viewportWidth', 'viewportHeight', 'dpr', 'sameCanvas', 'nativeInitialized'}
        check(isinstance(o, dict) and set(o) == fields, 'Exact renderer observation required')
        for k in ('startWallMs', 'endWallMs', 'startMonoMs', 'endMonoMs'):
            check(type(o[k]) in (int, float) and math.isfinite(o[k]) and (0 <= o[k] <= 9007199254740991), 'Renderer real clock bounds')
        check(type(now) in (int, float) and math.isfinite(now) and (0 <= now <= 9007199254740991), 'Host real clock invalid')
        check(0 <= o['endMonoMs'] - o['startMonoMs'] <= 1000 and 0 <= o['endWallMs'] - o['startWallMs'] <= 1000, 'Renderer acquisition deadline/order')
        check(0 <= now - o['endWallMs'] < 15000, 'Renderer receipt stale/future')
        check(o['backend'] == 'canvas2d' and o['sameCanvas'] is True and (o['nativeInitialized'] is True), 'Initialized retained Canvas required')
        for k in ('canvasWidth', 'canvasHeight'):
            check(type(o[k]) is int and 0 < o[k] <= 32768, 'Renderer backing dimensions invalid')
        for k in ('clientWidth', 'clientHeight'):
            check(type(o[k]) in (int, float) and math.isfinite(o[k]) and (0 < o[k] <= 32768), 'Renderer client dimensions invalid')
        check(type(o['viewportWidth']) is int and o['viewportWidth'] == 1440 and (type(o['viewportHeight']) is int) and (o['viewportHeight'] == 1000) and (type(o['dpr']) in (int, float)) and (o['dpr'] == 1), 'Fixed viewport/DPR required')
        canonical = json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)
        if self.previous is not None:
            check(value['sequence'] >= self.previous['sequence'], 'Renderer sequence regressed')
            if value['sequence'] == self.previous['sequence']:
                check(canonical == self.previous_canonical, 'Renderer same-sequence receipt conflict')
            else:
                check(o['startMonoMs'] >= self.previous['observation']['endMonoMs'] and o['endWallMs'] >= self.previous['observation']['endWallMs'], 'Renderer observation clock regressed')
        self.previous = json.loads(canonical)
        self.previous_canonical = canonical
        return True

require=check

def health_source_expiry(health):
    """Original producer lease shape and existing health/renderer expiry, never renewed."""
    import math
    def finite(v):return type(v)in(int,float)and math.isfinite(v)and v>=0
    require(type(health)is dict and type(health.get('controller'))is dict,'Present controller source required')
    controller=health['controller'];e=controller.get('evidence');require(type(e)is dict and finite(e.get('at'))and finite(e.get('leaseDeadline'))and e['leaseDeadline']>=e['at'],'Original controller lease fields')
    for field in('operation','phase'):
        if field in e:require(type(e[field])is str and __import__('re').fullmatch('[a-z-]{1,40}',e[field]),'Original controller operation/phase')
    outcome=controller.get('outcome');valid=False
    if outcome=='pending':valid=e.get('operation')in('map','position','move')and e.get('phase')in('startup','pre-step')and type(e.get('sequence'))is int and e['sequence']>0 and finite(e.get('startedAt'))and e['startedAt']<=e['at']and e.get('operationBudgetMs')==10000 and e.get('deadline')==e['startedAt']+10000 and e['leaseDeadline']==e['deadline']
    elif outcome=='allowed-idle':
        budgets={'step-rest':100,'rest':2000,'conversation':20000};reason=e.get('reason');valid=type(reason)is str and reason in budgets and e.get('idleBudgetMs')==budgets[reason]and finite(e.get('idleStartedAt'))and e['idleStartedAt']<=e['at']and e.get('deadline')==e['idleStartedAt']+e['idleBudgetMs']and e['leaseDeadline']==e['deadline']+10000
    elif outcome=='progress':valid=e.get('operationBudgetMs')==10000 and e['leaseDeadline']==e['at']+10000
    require(valid,'Original controller lease shape')
    renderer=health.get('rendererEvidence');require(type(renderer)is dict and type(renderer.get('observation'))is dict,'Original renderer source required');end=renderer['observation'].get('endWallMs');updated=health.get('updatedAt');require(finite(end)and finite(updated),'Original health/renderer source clocks')
    return min(e['leaseDeadline'],updated+15000,end+15000)
