"""Validate actual atomic runner output using unchanged source evidence predicates."""
import math,time
from .service_plan import ROOM,strict
from .service_contract import need
from . import runtime_predicates as runtime
NAMES={'lyra':'Lyra[BOT]','nova':'Nova[BOT]','orion':'Orion[BOT]'}
def validate_health(plan,p,raw,started_wall_ms,renderer,now=None):
 now=time.time()*1000 if now is None else now
 h=strict(raw)
 need(type(h)is dict and h.get('healthy')is True and h.get('error')is None and h.get('failure')is None,'Runner must be currently healthy without a terminal fault')
 need(h.get('persona')==p and h.get('moduleSha256')==plan.release['controller']['sha256'],'Exact current persona/module')
 c=h.get('controller');need(type(c)is dict and type(c.get('identity'))is dict,'Actual controller identity')
 identity=c['identity'];need(set(identity)=={'roomId','name','playerId'}and identity['roomId']==ROOM and identity['name']==NAMES[p]and type(identity['playerId'])is int and identity['playerId']>0 and h.get('identity')==identity,'Exact shared player identity')
 need(type(c.get('evidence'))is dict and type(c['evidence'].get('steps'))is int and c['evidence']['steps']>=1,'Actual confirmed controller motion required')
 need(type(h.get('updatedAt'))in(int,float)and math.isfinite(h['updatedAt'])and h['updatedAt']>=started_wall_ms and 0<=now-h['updatedAt']<15000,'New invocation current readiness only')
 need(runtime.APP==plan.release['app']and runtime.EXECUTING_SOURCES==plan.release['executingSources'],'Bound current public runtime sources')
 renderer(h,runtime.makeExecutionPolicy('canvas'),now)
 runtime.verifyExecution(h.get('scripts'),runtime.makeExecutionPolicy('canvas'))
 need(now<runtime.health_source_expiry(h),'Original controller/renderer lease expired')
 return {'playerId':identity['playerId'],'name':identity['name'],'roomId':identity['roomId'],'steps':c['evidence']['steps'],'rendererSequence':h['rendererEvidence']['sequence'],'updatedAt':h['updatedAt']}
