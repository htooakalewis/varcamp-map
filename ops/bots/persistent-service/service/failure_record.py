"""Retain original private raw failures. Never print/export protected inspect data."""
import hashlib,json,os,stat
from .deadline import alarm

class FailureRecordError(RuntimeError):
 def __init__(self,message,fd=None,original=None):super().__init__(message);self.uncertain_fd=fd;self.original=original

def local_certain(first,secondary,journal):
 if journal is not None and journal.uncertain:return False
 seen=set();pending=[first,*secondary]
 for _ in range(24):
  if not pending:break
  error=pending.pop()
  if error is None or id(error)in seen:continue
  seen.add(id(error))
  if getattr(error,'uncertain_fd',None)is not None or getattr(error,'client_settled',True)is False:return False
  pending.append(error.__cause__)
 return not pending

def _write(directory,name,raw,end):
 fd=None;first=None
 try:
  with alarm(end):
   fd=os.open(directory/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
   offset=0
   while offset<len(raw):
    count=os.write(fd,raw[offset:])
    if count<=0:raise OSError('No forensic write progress')
    offset+=count
   os.fsync(fd)
 except BaseException as error:first=error
 if fd is not None:
  try:os.close(fd)
  except BaseException as close_error:raise FailureRecordError('Uncertain forensic close',fd,first or close_error)from(first or close_error)
 if first is not None:raise first
 return {'file':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}

def _errors(directory,errors,prefix,seen,end):
 rows=[]
 for error in errors:
  while error is not None and id(error)not in seen and len(rows)<8:
   seen.add(id(error));row={'type':type(error).__name__,'message':str(error)[:1024]}
   for field in('stdout','stderr'):
    raw=getattr(error,field,None)
    if type(raw)is bytes:row[field]=_write(directory,prefix+str(len(rows))+'-'+field+'.bin',raw,end)
   for field in('returncode','client_settled','uncertain_fd'):
    if hasattr(error,field):row[field]=getattr(error,field)
   if hasattr(error,'failure'):row['received']=error.failure.received;row['captureIsComplete']=False
   rows.append(row);error=error.__cause__
  if len(rows)==8:break
 return rows

def retain_failure(journal,first,secondary,end,actual_evidence=None):
 directory=journal.directory/('failure-'+journal.state['generation'])
 # One original evidence directory; later failed calls never overwrite it.
 try:os.mkdir(directory,0o700)
 except FileExistsError:return {'firstEvidencePreserved':True}
 s=directory.lstat()
 if not stat.S_ISDIR(s.st_mode)or s.st_uid!=os.getuid()or stat.S_IMODE(s.st_mode)!=0o700:raise FailureRecordError('Private evidence directory required')
 seen=set();rows=_errors(directory,[first],'',seen,end);secondary_rows=_errors(directory,secondary[:8],'secondary-',seen,end)
 evidence=[]
 for name,raw in(actual_evidence or{}).items():
  if name not in {p+suffix for p in('lyra','nova','orion')for suffix in('-health.json','-logs.stdout.bin','-logs.stderr.bin')}or type(raw)is not bytes or len(raw)>2*1024**2:raise FailureRecordError('Closed native forensic inventory')
  evidence.append(_write(directory,name,raw,end))
 record={'scope':'original-private-service-failure-v1','release':journal.state['release'],'generation':journal.state['generation'],'firstChain':rows,'secondary':secondary_rows,'actualNativeEvidence':evidence,'state':journal.state,'uncertainLocalFDs':dict(journal.uncertain)}
 return _write(directory,'record.json',(json.dumps(record,sort_keys=True,separators=(',',':'),allow_nan=False)+'\n').encode(),end)
