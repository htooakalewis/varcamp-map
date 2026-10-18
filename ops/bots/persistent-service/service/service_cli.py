"""The only production entry. No old manager, finite owner or provider switch."""
import json,sys,time
from .service_plan import PERSONAS,load_plan
from .failure_record import local_certain

def main(argv=None):
 args=list(sys.argv[1:]if argv is None else argv)
 if len(args)!=4 or args[0]not in('start','status','stop')or args[1]not in PERSONAS:
  print(json.dumps({'status':'REFUSED','reason':'Expected start|status|stop, one fixed persona, private plan directory and plan SHA256'}));return 2
 action,p,directory,sha=args;journal=None;owner=None;first=None;result=None;secondaries=[]
 try:
  plan=load_plan(directory,sha) # unbound source refuses BEFORE provider imports
  from .service_journal import Journal
  from .service_engine import DockerEngine
  from .service_operator import ServiceOperator
  journal=Journal.__new__(Journal) # retain any partially initialized actual FDs
  Journal.__init__(journal,plan.directory,plan)
  owner=ServiceOperator(plan,journal,DockerEngine())
  result=getattr(owner,action)(p)
 except BaseException as error:first=error
 finally:
  if journal is not None:
   try:
    if owner is not None:owner.close()
    else:journal.close()
   except BaseException as error:
    if first is None:first=error
    else:secondaries.append(error)
 if first is not None:
  if journal is not None:
   try:
    from .failure_record import retain_failure
    retain_failure(journal,owner.first_error if owner is not None and owner.first_error is not None else first,([first]if owner is not None and owner.first_error is not first else[])+secondaries+(owner.secondary_errors if owner is not None else[]),time.monotonic()+5,owner.actual_evidence if owner is not None else{})
   except BaseException as error:secondaries.append(error)
  errors=secondaries+(owner.secondary_errors if owner is not None else[])
  print(json.dumps({'status':'FAILED','persona':p,'action':action,'firstType':type(first).__name__,'firstMessage':str(first)[:1024],'secondaryTypes':[type(x).__name__ for x in errors],'externalServicesMayRemain':journal is not None,'localClosureCertain':local_certain(first,errors,journal)}));return 2
 print(json.dumps({'status':'SOURCE_TRANSACTION_COMPLETE','persona':p,'action':action,'result':result,'localIOClosed':True,'liveAttendeeAcceptance':'NOT_RUN'}));return 0
