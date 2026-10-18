"""Private bounded state/intent ledger; records never deserialize authority."""
import fcntl,json,math,os,re,secrets,stat,time
from pathlib import Path
from .service_plan import PERSONAS,strict,PlanError
from .deadline import alarm
class JournalError(PlanError):pass
class Journal:
 LIMIT=131072;MAX_EVENTS=320;ROW=2048
 def __init__(self,directory,plan):
  self.directory=Path(directory);self.path=self.directory/'service-state.json';self.lock=None;self.directory_fd=None;self.poisoned=False;self.closed=False;self.uncertain={};self.first_io_error=None
  try:
   s=self.directory.lstat()
   if not self.directory.is_absolute()or self.directory.resolve()!=self.directory or not stat.S_ISDIR(s.st_mode)or s.st_uid!=os.getuid()or stat.S_IMODE(s.st_mode)!=0o700:raise JournalError('Private canonical state directory required')
   self.directory_fd=os.open(self.directory,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
   held=os.fstat(self.directory_fd)
   if(held.st_dev,held.st_ino)!=(s.st_dev,s.st_ino):raise JournalError('Actual held state directory changed')
   self.lock=os.open('service.lock',os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600,dir_fd=self.directory_fd)
   a=os.fstat(self.lock)
   if not stat.S_ISREG(a.st_mode)or a.st_nlink!=1 or a.st_uid!=os.getuid()or stat.S_IMODE(a.st_mode)!=0o600:raise JournalError('Exact private lock')
   fcntl.flock(self.lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
   self.state={'scope':'varcamp-persistent-guides-state-v1','release':plan.manifest_sha,'generation':secrets.token_hex(16),'members':{p:{'id':None,'state':'absent','playerId':None,'startWallMs':None,'startedAt':None}for p in PERSONAS},'pending':None,'firstFailure':None,'events':[]}
   try:existing=os.stat('service-state.json',dir_fd=self.directory_fd,follow_symlinks=False)
   except FileNotFoundError:existing=None
   if existing is not None:
    from .service_plan import _file
    if not stat.S_ISREG(existing.st_mode):raise JournalError('Regular state file only')
    with alarm(time.monotonic()+5):loaded=strict(_file(self.path,self.LIMIT,0o600))
    self._validate(loaded,plan);self.state=loaded
   else:self.persist(time.monotonic()+5)
  except BaseException as original:
   self.first_io_error=original
   try:self.close()
   except BaseException:pass # original retained; close uncertainty stays on this object
   raise
 def _validate(self,state,plan):
  if type(state)is not dict or set(state)!=set(self.state)or state['scope']!=self.state['scope']or state['release']!=plan.manifest_sha or type(state['generation'])is not str or re.fullmatch('[a-f0-9]{32}',state['generation'])is None or type(state['members'])is not dict or set(state['members'])!=set(PERSONAS):raise JournalError('Closed state/release identity')
  for p,m in state['members'].items():
   if type(m)is not dict or set(m)!={'id','state','playerId','startWallMs','startedAt'}or m['state']not in('absent','created','starting','ready','stopped','unknown','removed'):raise JournalError('Closed member slot')
   if m['id']is not None and(type(m['id'])is not str or re.fullmatch('[a-f0-9]{64}',m['id'])is None):raise JournalError('Recorded immutable ID')
   if m['state']=='absent'and m['id']is not None or m['state']in('created','starting','ready','stopped','removed')and m['id']is None:raise JournalError('Member state/ID mismatch')
   if m['playerId']is not None and(type(m['playerId'])is not int or m['playerId']<=0):raise JournalError('Actual player identity')
   if m['startWallMs']is not None and(type(m['startWallMs'])not in(int,float)or not math.isfinite(m['startWallMs'])or m['startWallMs']<0):raise JournalError('Actual start clock')
   if m['startedAt']is not None and(type(m['startedAt'])is not str or re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z',m['startedAt'])is None):raise JournalError('Actual Docker invocation identity')
   if m['state']=='ready'and(m['startedAt']is None or m['playerId']is None or m['startWallMs']is None):raise JournalError('Ready slot requires actual invocation/player')
  if type(state['events'])is not list or len(state['events'])>self.MAX_EVENTS or any(type(r)is not dict or len(json.dumps(r).encode())>self.ROW for r in state['events']):raise JournalError('Bounded event inventory')
  pending=state['pending']
  if pending is not None and(type(pending)is not dict or set(pending)!={'persona','operation'}or pending['persona']not in PERSONAS or pending['operation']not in('create','start','stop','remove')):raise JournalError('Closed held pending attempt')
  first=state['firstFailure']
  if first is not None and(type(first)is not dict or set(first)!={'persona','operation','type','message'}or first['persona']not in PERSONAS or any(type(first[k])is not str for k in first)or len(first['message'])>1024):raise JournalError('Closed first failure')
 def member(self,p):
  if p not in PERSONAS:raise JournalError('Fixed slot')
  return self.state['members'][p]
 def _close_once(self,field):
  fd=getattr(self,field)
  if fd is None or field in self.uncertain:return
  self.uncertain[field]=fd # retain before the uncertain syscall; never retry
  try:os.close(fd)
  except BaseException as error:
   self.poisoned=True
   if self.first_io_error is None:self.first_io_error=error
   raise
  else:setattr(self,field,None);self.uncertain.pop(field)
 def persist(self,end):
  if self.poisoned or self.closed or self.uncertain or time.monotonic()>=end:raise JournalError('Original durable state bound')
  raw=(json.dumps(self.state,sort_keys=True,separators=(',',':'),allow_nan=False)+'\n').encode()
  if len(raw)>self.LIMIT:raise JournalError('Original bounded state envelope')
  temporary='state-'+secrets.token_hex(8)+'.next';self._writing=None
  try:
   with alarm(end):
    self._writing=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=self.directory_fd);offset=0
    while offset<len(raw):
     n=os.write(self._writing,raw[offset:])
     if n<=0:raise OSError('No journal progress')
     offset+=n
    os.fsync(self._writing);self._close_once('_writing')
    os.replace(temporary,'service-state.json',src_dir_fd=self.directory_fd,dst_dir_fd=self.directory_fd);os.fsync(self.directory_fd)
    if time.monotonic()>=end:raise TimeoutError('Late durable state settlement')
  except BaseException as error:
   self.poisoned=True
   if self.first_io_error is None:self.first_io_error=error
   raise
  finally:
   if self._writing is not None and '_writing'not in self.uncertain:
    try:self._close_once('_writing')
    except BaseException:
     if self.first_io_error is None:raise
 def event(self,p,operation,stage,end,**fields):
  if self.poisoned or self.closed:raise JournalError('Journal unavailable')
  row={'persona':p,'operation':operation,'stage':stage,**fields}
  if len(json.dumps(row,separators=(',',':')).encode())>self.ROW or len(self.state['events'])>=self.MAX_EVENTS:raise JournalError('Original journal row/count bound')
  self.state['events'].append(row);self.persist(end)
 def begin(self,p,op,end):
  if self.state['firstFailure']is not None or self.state['pending']is not None:raise JournalError('Held failure/attempt; no replay')
  self.state['pending']={'persona':p,'operation':op};self.event(p,op,'intent',end)
 def begin_cleanup(self,p,op,end):
  member=self.member(p)
  if self.state['firstFailure']is None or self.state['pending']is not None or member['id']is None or member['state']in('unknown','absent','removed')or op not in('stop','remove'):raise JournalError('Only conclusive owned cleanup after the original failure')
  self.state['pending']={'persona':p,'operation':op};self.event(p,op,'cleanup-intent',end,id=member['id'])
 def acknowledge(self,p,op,end,**fields):
  if self.state['pending']!={'persona':p,'operation':op}:raise JournalError('Exact source pending mutation')
  self.state['pending']=None;self.event(p,op,'acknowledged',end,**fields)
 def fail(self,p,operation,error,end,unknown=False):
  if self.state['firstFailure']is None:self.state['firstFailure']={'persona':p,'operation':operation,'type':type(error).__name__,'message':str(error)[:1024]}
  if unknown:self.member(p)['state']='unknown'
  try:self.event(p,operation,'failed',end,unknown=unknown)
  except BaseException:self.poisoned=True
 def close(self):
  if self.closed:return
  self.closed=True;first=None
  for field in('lock','directory_fd'):
   try:self._close_once(field)
   except BaseException as error:
    if first is None:first=error
  if first is not None:raise first
