"""Original absolute main-thread deadlines; no deadline refresh or retry."""
import math,signal,threading,time
from contextlib import contextmanager
@contextmanager
def alarm(end):
 if threading.current_thread()is not threading.main_thread()or type(end)not in(int,float)or not math.isfinite(end):raise ValueError('Actual foreground original deadline required')
 began=time.monotonic();handler=signal.getsignal(signal.SIGALRM);previous=signal.getitimer(signal.ITIMER_REAL);prior_end=began+previous[0]if previous[0]>0 else None;actual=min(end,prior_end)if prior_end is not None else end
 if actual<=began:raise TimeoutError('Original deadline elapsed')
 def expired(*_):raise TimeoutError('Original absolute deadline')
 signal.signal(signal.SIGALRM,expired);signal.setitimer(signal.ITIMER_REAL,actual-began)
 try:yield
 finally:
  signal.setitimer(signal.ITIMER_REAL,0);signal.signal(signal.SIGALRM,handler)
  if prior_end is not None:signal.setitimer(signal.ITIMER_REAL,max(.000001,prior_end-time.monotonic()),previous[1])
