"""TEST ONLY synthetic lifecycle DTOs and real local fixed-reader files. No observations or deployment authority."""
import copy,json,os,pathlib,shutil,subprocess,sys,tempfile,time,unittest
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path[:0]=[str(ROOT),str(ROOT/'tests')]
from service.service_contract import ContractError,verify_container
from service.service_operator import ServiceOperator,ServiceFailure
from service.service_journal import Journal
from service.service_engine import DockerEngine,DockerError
from service import service_engine
from helpers import plan as test_plan,container,FakeEngine
class LifecycleTests(unittest.TestCase):
 def setUp(self):
  self.plan=test_plan();self.created=container(self.plan,'lyra');self.running=copy.deepcopy(self.created);self.running['HostConfig']['OomKillDisable']=None;self.running['State'].update(Running=True,Status='running',StartedAt='2026-01-01T00:00:00.000000001Z');self.running['AppArmorProfile']='docker-default'
 def stopped(self):
  item=copy.deepcopy(self.running);item['State'].update(Running=False,Status='exited');return item
 def test_every_full_field_remains_exact_in_created_running_and_exited(self):
  for phase,item in [('synthetic-created',self.created),('synthetic-running',self.running),('synthetic-exited',self.stopped())]:
   verify_container(self.plan,'lyra',item['Id'],item)
   self.assertEqual(sum(len(item[k])for k in ('Config','HostConfig')),83)
   for section in ('Config','HostConfig'):
    for key in item[section]:
     bad=copy.deepcopy(item);bad[section][key]={'TEST_INVALID':item[section][key]}
     with self.subTest(phase=phase,section=section,key=key),self.assertRaises(ContractError):verify_container(self.plan,'lyra',item['Id'],bad)
    bad=copy.deepcopy(item);bad[section]['TEST_UNKNOWN']=True
    with self.assertRaises(ContractError):verify_container(self.plan,'lyra',item['Id'],bad)
 def test_contradictory_phases_and_wrong_oom_phase_never_become_tolerance(self):
  mutations=[(self.created,lambda x:x['HostConfig'].update(OomKillDisable=None)),(self.running,lambda x:x['HostConfig'].update(OomKillDisable=False)),(self.stopped(),lambda x:x['HostConfig'].update(OomKillDisable=False)),(self.created,lambda x:x['State'].update(StartedAt=self.running['State']['StartedAt'])),(self.running,lambda x:x['State'].update(StartedAt='0001-01-01T00:00:00Z')),(self.running,lambda x:x['State'].update(StartedAt='garbage')),(self.running,lambda x:x['State'].update(Status='paused')),(self.running,lambda x:x['State'].update(Running=False))]
  for n,(item,mutate)in enumerate(mutations):
   bad=copy.deepcopy(item);mutate(bad)
   with self.subTest(mutation=n),self.assertRaises(ContractError):verify_container(self.plan,'lyra',item['Id'],bad)
  for paused in (True,None,'false'):
   bad=copy.deepcopy(self.running);bad['State']['Paused']=paused
   with self.subTest(paused=paused),self.assertRaises(ContractError):verify_container(self.plan,'lyra',bad['Id'],bad)
  bad=copy.deepcopy(self.running);del bad['State']['Paused']
  with self.assertRaises(ContractError):verify_container(self.plan,'lyra',bad['Id'],bad)
  badplan=copy.copy(self.plan);badplan.host_template=copy.deepcopy(self.plan.host_template);badplan.host_template['OomKillDisable']=None
  with self.assertRaises(ContractError):verify_container(badplan,'lyra',self.running['Id'],self.running)
 def test_external_created_to_exited_cannot_gain_attestation_or_cleanup_ownership(self):
  p=test_plan()
  class ExternalInvocationPeer(FakeEngine):
   def create(peer,args,end):
    identity=super().create(args,end);peer.objects[identity]['State'].update(Running=False,Status='exited',StartedAt='2026-10-18T19:00:00Z');peer.objects[identity]['HostConfig']['OomKillDisable']=None;return identity
  with tempfile.TemporaryDirectory()as tmp:
   directory=pathlib.Path(tmp);directory.chmod(0o700);journal=Journal(directory,p);peer=ExternalInvocationPeer(p);owner=ServiceOperator(p,journal,peer)
   try:
    with self.assertRaises(ServiceFailure):owner.start('lyra')
    self.assertEqual(owner._attested,set());self.assertEqual(len(peer.objects),1)
    self.assertFalse({'start','stop','remove','archive','health'}&{op for op,_ in peer.calls})
   finally:journal.close()
 def test_changed_stopped_invocation_refuses_before_source_read_or_new_start(self):
  p=test_plan()
  with tempfile.TemporaryDirectory()as tmp:
   directory=pathlib.Path(tmp);directory.chmod(0o700);journal=Journal(directory,p);peer=FakeEngine(p);owner=ServiceOperator(p,journal,peer)
   try:
    first=owner.start('lyra');owner.stop('lyra');peer.objects[first['id']]['State']['StartedAt']='2026-10-18T20:00:00Z';before=len(peer.calls)
    with self.assertRaises(ServiceFailure):owner.start('lyra')
    self.assertEqual(owner._attested,set());self.assertIn(first['id'],peer.objects)
    self.assertFalse({'create','start','stop','remove','archive','health'}&{op for op,_ in peer.calls[before:]})
   finally:journal.close()
 def test_created_health_is_unavailable_without_exec_archive_or_synthetic_body(self):
  p=test_plan()
  with tempfile.TemporaryDirectory()as tmp:
   directory=pathlib.Path(tmp);directory.chmod(0o700);journal=Journal(directory,p);peer=FakeEngine(p);identity=peer.create(['create','--env','VARCAMP_BOT_PERSONA=lyra'],time.monotonic()+2);journal.member('lyra').update(id=identity,state='created');owner=ServiceOperator(p,journal,peer);before=len(peer.calls)
   try:
    with self.assertRaisesRegex(ServiceFailure,'Runtime health unavailable'):owner._health_raw('lyra',identity,time.monotonic()+2)
    self.assertFalse({'archive','health'}&{op for op,_ in peer.calls[before:]});self.assertEqual(owner.actual_evidence,{})
   finally:journal.close()
 def test_supported_stop_timeout_keeps_grace_and_exact_ack_without_warning_stripping(self):
  identity=self.running['Id'];warning=b'TEST warning on stdout\n';seen=[];end=time.monotonic()+12
  def native_cli(args,until,limit):
   seen.append((args,until,limit));return subprocess.CompletedProcess(args,0,(warning if '--time'in args else b'')+(identity+'\n').encode(),b'')
  with patch('service.service_engine.bounded',side_effect=native_cli):DockerEngine().stop(identity,end)
  self.assertEqual(seen[0],(['/usr/bin/docker','stop','--timeout','10',identity],end,4096))
  result=subprocess.CompletedProcess([],0,warning+(identity+'\n').encode(),b'')
  with patch('service.service_engine.bounded',return_value=result):
   with self.assertRaises(DockerError)as caught:DockerEngine().stop(identity,end)
  self.assertEqual(caught.exception.stdout,result.stdout);self.assertEqual(caught.exception.returncode,0)
 def test_runtime_transport_uses_only_fixed_node_on_full_id_under_original_caps(self):
  method=getattr(DockerEngine,'health',None);self.assertTrue(callable(method),'Runtime mounted publication needs a dedicated fixed transport')
  raw=b'{"TEST_ONLY":"runtime publication"}';identity=self.running['Id'];end=time.monotonic()+20;seen=[]
  def capture(args,until,limit):seen.append((args,until,limit));return subprocess.CompletedProcess(args,0,raw,b'')
  with patch('service.service_engine.bounded',side_effect=capture):self.assertEqual(DockerEngine().health(identity,end),raw)
  args,until,limit=seen[0];self.assertEqual(args[:5],['/usr/bin/docker','exec',identity,'/usr/bin/node','-e']);self.assertEqual(len(args),6);self.assertEqual(args[5],service_engine.HEALTH_READER_JS);self.assertLessEqual(until,time.monotonic()+4);self.assertEqual(limit,2*1024**2)
  for identity in ('partial','/foreign','a'*63):
   with patch('service.service_engine.bounded')as boundary:
    with self.assertRaises(ContractError):DockerEngine().health(identity,end)
    boundary.assert_not_called()
  for result in (subprocess.CompletedProcess([],1,b'partial',b'original reader error'),subprocess.CompletedProcess([],0,raw,b'unexpected stderr'),subprocess.CompletedProcess([],0,b'',b''),subprocess.CompletedProcess([],0,b'x'*(1024**2+1),b'')):
   with patch('service.service_engine.bounded',return_value=result):
    with self.assertRaises(DockerError)as caught:DockerEngine().health(self.running['Id'],end)
    self.assertEqual((caught.exception.stdout,caught.exception.stderr,caught.exception.returncode),(result.stdout,result.stderr,result.returncode))

class RuntimeReaderTests(unittest.TestCase):
 def run_reader(self,path,prefix=''):
  program=getattr(service_engine,'HEALTH_READER_JS',None);self.assertIsInstance(program,str,'Fixed runtime reader is missing')
  self.assertEqual(program.count("'/tmp/lyra-health.json'"),1)
  # TEST ONLY: change only the fixed path literal to a private real fixture.
  # Production accepts no such path/program selector.
  program=program.replace("'/tmp/lyra-health.json'",json.dumps(str(path)))
  node=shutil.which('node');self.assertIsNotNone(node,'Offline reader tests require a local Node executable')
  return subprocess.run([node,'-e',prefix+program],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=5)
 def staged(self,directory,body=b'{"TEST_ONLY":"publication"}'):
  path=pathlib.Path(directory)/'health';path.write_bytes(body);os.chown(path,os.getuid(),os.getgid());path.chmod(0o600);return path
 def test_real_reader_emits_exact_bytes_only_after_descriptor_close(self):
  with tempfile.TemporaryDirectory()as tmp:
   path=self.staged(tmp);result=self.run_reader(path);self.assertEqual((result.returncode,result.stdout,result.stderr),(0,path.read_bytes(),b''))
 def test_atomic_replacement_can_unlink_published_fd_without_changing_its_snapshot(self):
  with tempfile.TemporaryDirectory()as tmp:
   path=self.staged(tmp,b'old published snapshot');nextfile=pathlib.Path(tmp)/'next';nextfile.write_bytes(b'new publication');os.chown(nextfile,os.getuid(),os.getgid());nextfile.chmod(0o600)
   prefix="const testFs=require('node:fs');const testOpen=testFs.openSync;testFs.openSync=function(...args){const fd=testOpen.apply(this,args);testFs.renameSync("+json.dumps(str(nextfile))+","+json.dumps(str(path))+");return fd;};"
   result=self.run_reader(path,prefix);self.assertEqual(result.returncode,0,result.stderr);self.assertEqual(result.stdout,b'old published snapshot');self.assertEqual(path.read_bytes(),b'new publication')
 def test_real_symlink_hardlink_fifo_empty_oversize_and_wrong_mode_refuse(self):
  with tempfile.TemporaryDirectory()as tmp:
   path=self.staged(tmp);link=pathlib.Path(tmp)/'link';link.symlink_to(path)
   self.assertNotEqual(self.run_reader(link).returncode,0)
   hard=pathlib.Path(tmp)/'hard';os.link(path,hard);self.assertNotEqual(self.run_reader(path).returncode,0);hard.unlink()
   fifo=pathlib.Path(tmp)/'fifo';os.mkfifo(fifo,0o600);self.assertNotEqual(self.run_reader(fifo).returncode,0)
   for body in (b'',b'x'*(1024**2+1)):
    path.write_bytes(body);result=self.run_reader(path);self.assertNotEqual(result.returncode,0);self.assertEqual(result.stdout,b'')
   path.write_bytes(b'complete');path.chmod(0o644);self.assertNotEqual(self.run_reader(path).returncode,0)
 def test_first_read_error_and_secondary_uncertain_close_survive_without_retry(self):
  with tempfile.TemporaryDirectory()as tmp:
   path=self.staged(tmp)
   prefix="const testFs=require('node:fs');let testCloses=0;testFs.readSync=function(){throw Error('TEST first read');};testFs.closeSync=function(){testCloses++;throw Error('TEST uncertain close '+testCloses);};"
   result=self.run_reader(path,prefix);self.assertNotEqual(result.returncode,0);self.assertEqual(result.stdout,b'');self.assertIn(b'TEST first read',result.stderr);self.assertIn(b'TEST uncertain close 1',result.stderr);self.assertNotIn(b'TEST uncertain close 2',result.stderr)
 def test_short_read_and_in_place_size_change_never_emit_positive_body(self):
  with tempfile.TemporaryDirectory()as tmp:
   path=self.staged(tmp)
   for prefix in ["const testFs=require('node:fs');testFs.readSync=function(){return 0;};","const testFs=require('node:fs');const testRead=testFs.readSync;let testOnce=false;testFs.readSync=function(...args){const n=testRead.apply(this,args);if(!testOnce){testOnce=true;testFs.appendFileSync("+json.dumps(str(path))+",'CHANGED');}return n;};"]:
    result=self.run_reader(path,prefix);self.assertNotEqual(result.returncode,0);self.assertEqual(result.stdout,b'')

if __name__=='__main__':unittest.main(verbosity=2)
