"""Single owner for this operator's local child stdio. No Docker policy."""
import os,selectors,signal,subprocess,time
from dataclasses import dataclass
@dataclass(frozen=True)
class Settlement:
 settled:bool
 first_error:BaseException|None=None
@dataclass(frozen=True)
class Failure:
 reason:str
 stdout:bytes
 stderr:bytes
 received:int
 client_settled:bool
class CaptureFailure(RuntimeError):
 def __init__(self,failure):super().__init__(failure.reason);self.failure=failure
 @property
 def client_settled(self):return self.failure.client_settled
 @property
 def stdout(self):return self.failure.stdout
 @property
 def stderr(self):return self.failure.stderr

def close_all_once(streams):
 first=None
 for stream in streams:
  try:stream.close()
  except BaseException as error:
   if first is None:first=error
 return Settlement(first is None,first)
def settle_client(child,end,already_waited=False,prior_error=None):
 """Exactly one settlement attempt; caller must never retry uncertain closes."""
 settled=already_waited;first=prior_error
 try:
  if not already_waited:
   try:os.killpg(child.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   remaining=end-time.monotonic()
   if remaining<=0:raise TimeoutError('client reap deadline')
   child.wait(timeout=remaining);settled=True
 except BaseException as error:
  settled=False
  if first is None:first=error
 finally:
  closed=close_all_once((child.stdout,child.stderr))
  if not closed.settled:
   settled=False
   if first is None:first=RuntimeError('client stream close: '+type(closed.first_error).__name__)
 return Settlement(settled,first)
def bounded(args,end,limit):
 began=time.monotonic()
 if end<=began:raise CaptureFailure(Failure('deadline before launch',b'',b'',0,True))
 child=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,stdin=subprocess.DEVNULL,start_new_session=True);buffers=[bytearray(),bytearray()];received=0;waited=False;first=None;work_end=end-min(.5,(end-began)/4)
 try:
  with selectors.DefaultSelector()as selected:
   for i,stream in enumerate((child.stdout,child.stderr)):os.set_blocking(stream.fileno(),False);selected.register(stream,selectors.EVENT_READ,i)
   while selected.get_map():
    if time.monotonic()>=work_end:raise TimeoutError('client deadline')
    for key,_ in selected.select(min(.1,max(0,work_end-time.monotonic()))):
     chunk=os.read(key.fd,min(65536,max(1,limit-received+1)))
     if not chunk:selected.unregister(key.fileobj);continue
     buffers[key.data].extend(chunk[:max(0,limit-received)]);received+=len(chunk)
     if received>limit:raise RuntimeError('streaming control output cap')
  remaining=work_end-time.monotonic()
  if remaining<=0:raise TimeoutError('client exit deadline')
  child.wait(timeout=remaining);waited=True
  if time.monotonic()>=end:raise TimeoutError('late client settlement')
 except BaseException as error:first=error
 settlement=settle_client(child,end,waited,first)
 if settlement.first_error is not None:
  raise CaptureFailure(Failure(type(settlement.first_error).__name__+': '+str(settlement.first_error)[:256],bytes(buffers[0]),bytes(buffers[1]),received,settlement.settled))from settlement.first_error
 return subprocess.CompletedProcess(args,child.returncode,bytes(buffers[0]),bytes(buffers[1]))
