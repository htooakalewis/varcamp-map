"""Failing-first actual operator path, synthetic sibling failure; no providers."""
import copy,hashlib,json,pathlib,subprocess,sys,tempfile,time,unittest
from unittest.mock import patch
SOURCE=pathlib.Path(__file__).resolve().parents[1]
sys.path[:0]=[str(SOURCE),str(SOURCE/'tests')]
from helpers import plan,FakeEngine
from service.service_journal import Journal
from service.service_operator import ServiceOperator,ServiceFailure
class AdmissionSeparationTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.directory=pathlib.Path(self.tmp.name);self.directory.chmod(0o700);self.plan=plan();self.peer=FakeEngine(self.plan);self.journal=Journal(self.directory,self.plan);self.owner=ServiceOperator(self.plan,self.journal,self.peer);self.results={p:self.owner.start(p) for p in ('lyra','nova','orion')}
  identity=self.results['orion']['id'];self.peer.objects[identity]['State'].update(Running=False,Status='exited',Health={'Status':'unhealthy'});self.before=len(self.peer.calls)
 def tearDown(self):self.journal.close();self.tmp.cleanup()
 def test_healthy_status_is_observable_when_a_verified_sibling_exited(self):
  result=self.owner.status('lyra');self.assertTrue(result['healthy']);self.assertEqual(result['state'],'running')
 def test_known_healthy_stop_is_not_health_admission_for_other_siblings(self):
  result=self.owner.stop('lyra');self.assertEqual(result['state'],'stopped');self.assertFalse(self.peer.objects[self.results['lyra']['id']]['State']['Running']);self.assertTrue(self.peer.objects[self.results['nova']['id']]['State']['Running'])
 def test_known_already_exited_invocation_settles_without_stop_retry_or_fake_ack(self):
  result=self.owner.stop('orion');self.assertEqual(result['state'],'stopped');self.assertEqual(self.journal.member('orion')['state'],'stopped');self.assertNotIn('stop',[op for op,_ in self.peer.calls[self.before:]]);self.assertIsNone(self.journal.state['pending'])
  events=self.journal.state['events'];self.assertEqual(events[-1]['stage'],'observed-exited');self.assertNotEqual(events[-1]['stage'],'acknowledged')
 def test_status_reports_each_actual_peer_and_does_not_mutate_journal(self):
  before=copy.deepcopy(self.journal.state);result=self.owner.status('lyra');rows=result['services']
  self.assertTrue(rows['lyra']['healthy']);self.assertTrue(rows['nova']['healthy']);self.assertFalse(rows['orion']['healthy']);self.assertEqual(rows['orion']['state'],'stopped');self.assertEqual(rows['orion']['reason'],'exited');self.assertEqual(self.journal.state,before)
  self.assertNotIn(('health',self.results['orion']['id']),self.peer.calls[self.before:]);self.assertFalse({'create','start','stop','remove'}&{op for op,_ in self.peer.calls[self.before:]})
 def test_native_unhealthy_running_peer_cannot_mask_a_healthy_sibling(self):
  orion=self.peer.objects[self.results['orion']['id']];orion['State'].update(Running=True,Status='running',Health={'Status':'unhealthy'})
  result=self.owner.status('lyra');self.assertTrue(result['healthy']);self.assertFalse(result['services']['orion']['healthy']);self.assertEqual(result['services']['orion']['reason'],'native-not-healthy')
 def test_runtime_terminal_exception_is_reported_only_on_its_peer_and_retained(self):
  original=self.peer.health;identity=self.results['nova']['id'];error=RuntimeError('TEST original sibling health reader error')
  def health(target,end):
   if target==identity:self.peer.calls.append(('health',target));raise error
   return original(target,end)
  self.peer.health=health;result=self.owner.status('lyra')
  self.assertTrue(result['healthy']);self.assertFalse(result['services']['nova']['healthy']);self.assertEqual(result['services']['nova']['reason'],'runtime-read-failed');self.assertEqual(result['services']['nova']['error']['message'],str(error));self.assertIs(self.owner.observation_errors['nova'],error)
 def test_start_still_requires_every_recorded_running_peer_healthy(self):
  self.owner.stop('nova');before=len(self.peer.calls)
  with self.assertRaises(ServiceFailure):self.owner.start('nova')
  self.assertFalse({'create','start','stop','remove'}&{op for op,_ in self.peer.calls[before:]});self.assertEqual(self.journal.member('nova')['state'],'stopped')
 def test_public_delivery_drift_does_not_authorize_start_or_prevent_known_stop(self):
  self.peer.fail='public';result=self.owner.stop('lyra');self.assertEqual(result['state'],'stopped');before=len(self.peer.calls)
  with self.assertRaises(ServiceFailure):self.owner.start('lyra')
  self.assertFalse({'create','start','stop','remove'}&{op for op,_ in self.peer.calls[before:]})
 def test_complete_security_drift_blocks_known_stop_before_mutation(self):
  self.peer.objects[self.results['nova']['id']]['HostConfig']['Privileged']=True
  with self.assertRaises(ServiceFailure):self.owner.stop('lyra')
  self.assertNotIn('stop',[op for op,_ in self.peer.calls[self.before:]])
 def test_recorded_invocation_drift_blocks_stop_even_of_another_peer(self):
  self.peer.objects[self.results['orion']['id']]['State']['StartedAt']='2026-01-01T00:00:00.123456789Z'
  with self.assertRaises(ServiceFailure):self.owner.stop('lyra')
  self.assertNotIn('stop',[op for op,_ in self.peer.calls[self.before:]])
 def test_source7_drift_blocks_stop_of_exact_owned_running_target(self):
  original=self.peer.archive;identity=self.results['nova']['id']
  def archive(target,path,end):return b'TEST source drift'if target==identity else original(target,path,end)
  self.peer.archive=archive
  with self.assertRaises(ServiceFailure):self.owner.stop('lyra')
  self.assertNotIn('stop',[op for op,_ in self.peer.calls[self.before:]])
 def test_protected77_drift_blocks_known_stop(self):
  self.peer.fail='host'
  with self.assertRaises(ServiceFailure):self.owner.stop('lyra')
  self.assertNotIn('stop',[op for op,_ in self.peer.calls[self.before:]])
 def test_pending_attempt_refuses_status_before_any_new_io(self):
  self.journal.state['pending']={'persona':'orion','operation':'stop'}
  with self.assertRaises(ServiceFailure):self.owner.status('lyra')
  self.assertEqual(len(self.peer.calls),self.before)
 def test_first_failure_is_not_cleared_to_allow_stop_or_fake_exited_settlement(self):
  first={'persona':'orion','operation':'start','type':'RuntimeError','message':'TEST earlier held failure'};self.journal.state['firstFailure']=copy.deepcopy(first)
  with self.assertRaises(ServiceFailure):self.owner.stop('orion')
  self.assertEqual(self.journal.state['firstFailure'],first);self.assertEqual(self.journal.member('orion')['state'],'ready');self.assertEqual(len(self.peer.calls),self.before)
 def test_unsettled_status_reader_stops_before_sibling_or_final_provider_io(self):
  identity=self.results['lyra']['id'];error=RuntimeError('TEST unsettled runtime health client');error.client_settled=False
  def health(target,end):self.peer.calls.append(('health',target));raise error
  self.peer.health=health
  with self.assertRaises(ServiceFailure):self.owner.status('lyra')
  self.assertEqual(self.peer.calls[-1],('health',identity));self.assertIs(self.owner.observation_errors['lyra'],error)
 def test_uncertain_descriptor_status_reader_is_never_degraded_health(self):
  identity=self.results['lyra']['id'];error=RuntimeError('TEST uncertain runtime health FD');error.uncertain_fd=12345
  def health(target,end):self.peer.calls.append(('health',target));raise error
  self.peer.health=health
  with self.assertRaises(ServiceFailure):self.owner.status('lyra')
  self.assertEqual(self.peer.calls[-1],('health',identity));self.assertIs(self.owner.observation_errors['lyra'],error)
 def test_exit_during_status_reports_final_physical_state_and_invalidates_health(self):
  original=self.peer.health;identity=self.results['lyra']['id']
  def health(target,end):
   raw=original(target,end)
   if target==identity:self.peer.objects[target]['State'].update(Running=False,Status='exited')
   return raw
  self.peer.health=health;result=self.owner.status('lyra');self.assertFalse(result['healthy']);self.assertEqual(result['state'],'stopped');self.assertEqual(result['reason'],'physical-state-changed');self.assertNotIn('playerId',result)
 def test_restart_during_status_cannot_return_an_old_healthy_receipt(self):
  original=self.peer.health;identity=self.results['lyra']['id']
  def health(target,end):
   raw=original(target,end)
   if target==identity:self.peer.objects[target]['State']['StartedAt']='2026-01-01T00:00:00.123456789Z'
   return raw
  self.peer.health=health
  with self.assertRaisesRegex(ServiceFailure,'invocation changed'):self.owner.status('lyra')
 def test_final_lease_expiry_cannot_be_renewed_by_the_ownership_bracket(self):
  original=self.peer.health;baseline=self.peer.baseline;seen=False
  def health(target,end):
   nonlocal seen
   value=json.loads(original(target,end));at=time.time()*1000-9900;value['controller']['evidence'].update(at=at,leaseDeadline=at+10000);seen=True;return json.dumps(value).encode()
  def slow(owned,end):
   if seen:time.sleep(.12)
   return baseline(owned,end)
  self.peer.health=health;self.peer.baseline=slow;result=self.owner.status('lyra');self.assertFalse(result['healthy']);self.assertEqual(result['reason'],'lease-expired')
 def test_full_contract_failure_before_runtime_read_halts_without_sibling_io(self):
  from service.service_contract import ContractError
  original=self.peer.inspect;identity=self.results['lyra']['id'];seen=0;fault=[]
  def inspect(target,end):
   nonlocal seen
   if target==identity:
    seen+=1
    if seen==2:self.peer.objects[target]['Config']['User']='0';fault.append(len(self.peer.calls))
   return original(target,end)
  self.peer.inspect=inspect
  with self.assertRaises(ContractError):self.owner.status('lyra')
  self.assertEqual(self.peer.calls[fault[0]:],[('inspect',identity)],'Failed full ownership cannot be treated as ordinary health failure')
class ImmutableOwnershipEngineTests(unittest.TestCase):
 def test_ownership_checks_actual_image_config_and_plan_without_public_transport(self):
  from service.service_engine import DockerEngine
  p=plan();config={'TEST_ONLY':'complete synthetic image Config'};p.release['imageConfigSha256']=hashlib.sha256(json.dumps(config,sort_keys=True,separators=(',',':')).encode()).hexdigest();item={'Id':p.release['image'],'Config':config,'Architecture':'arm64','Os':'linux'};seen=[];end=time.monotonic()+15
  def boundary(args,until,limit):seen.append((args,until,limit));return subprocess.CompletedProcess(args,0,json.dumps([item]).encode(),b'')
  with patch('service.service_engine.verify_plan_inputs')as inputs,patch('service.service_engine.urllib.request.build_opener',side_effect=AssertionError('No public transport for immutable ownership')),patch('service.service_engine.bounded',side_effect=boundary):DockerEngine().ownership(p,end)
  inputs.assert_called_once_with(p);self.assertEqual(seen[0][0],['/usr/bin/docker','image','inspect',p.release['image']]);self.assertLessEqual(seen[0][1],time.monotonic()+4);self.assertEqual(seen[0][2],262144)
  for mutate in (lambda v:v.update(Id='sha256:'+'dead'*16),lambda v:v['Config'].update(TEST_ONLY='changed'),lambda v:v.update(Architecture='amd64')):
   bad=copy.deepcopy(item);mutate(bad)
   with patch('service.service_engine.verify_plan_inputs'),patch('service.service_engine.bounded',return_value=subprocess.CompletedProcess([],0,json.dumps([bad]).encode(),b'')):
    with self.assertRaises(Exception):DockerEngine().ownership(p,end)
if __name__=='__main__':unittest.main(verbosity=2)
