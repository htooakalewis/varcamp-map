import os,pathlib,sys,tempfile,time,unittest
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from service.service_journal import Journal,JournalError
from helpers import plan
class JournalTests(unittest.TestCase):
 def test_failed_close_retains_actual_fd_and_never_retries_it(self):
  with tempfile.TemporaryDirectory()as tmp:
   p=pathlib.Path(tmp);p.chmod(0o700);j=Journal(p,plan());fd=j.lock;actual=os.close
   def close(value):
    if value==fd:raise OSError('TEST uncertain close')
    actual(value)
   with patch('service.service_journal.os.close',side_effect=close):
    with self.assertRaises(OSError):j.close()
    self.assertEqual(j.lock,fd,'Uncertain actual holder must remain retained')
    j.close() # no second syscall for an uncertain close
   actual(fd) # TEST stub never closed it; this is not a production settlement
 def test_state_failure_never_retries_mutation_or_publishes_ack(self):
  with tempfile.TemporaryDirectory()as tmp:
   p=pathlib.Path(tmp);p.chmod(0o700);j=Journal(p,plan())
   try:
    with patch('service.service_journal.os.fsync',side_effect=OSError('TEST original fsync')):
     with self.assertRaises(OSError):j.begin('lyra','create',time.monotonic()+1)
    self.assertTrue(j.poisoned)
    with self.assertRaises(JournalError):j.begin('lyra','create',time.monotonic()+1)
   finally:j.close()
 def test_loaded_state_is_closed_and_private_not_arbitrary_authority(self):
  import json
  with tempfile.TemporaryDirectory()as tmp:
   p=pathlib.Path(tmp);p.chmod(0o700);j=Journal(p,plan());j.close();state=p/'service-state.json';v=json.loads(state.read_text());v['members']['lyra']['id']='foreign';state.write_text(json.dumps(v));state.chmod(0o600)
   with self.assertRaises(JournalError):Journal(p,plan())
if __name__=='__main__':unittest.main()
