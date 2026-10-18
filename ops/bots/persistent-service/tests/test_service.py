"""Offline tests on the actual production operator; providers are TEST boundaries only."""
import copy, hashlib, importlib, json, pathlib, stat, sys, tempfile, time, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from service.service_contract import ContractError, verify_container, create_args
from service.service_operator import ServiceOperator, ServiceFailure
from service.service_journal import Journal, JournalError
from service.service_plan import load_plan, UnboundRelease

class ContractTests(unittest.TestCase):
 def test_wrong_image_and_privilege_refuse_despite_exact_name_labels(self):
  from helpers import plan,container
  p=plan();good=container(p,'lyra');verify_container(p,'lyra',good['Id'],good)
  wrong=copy.deepcopy(good);wrong['Image']='sha256:'+'dead'*16
  with self.assertRaises(ContractError):verify_container(p,'lyra',good['Id'],wrong)
  wrong=copy.deepcopy(good);wrong['HostConfig']['Privileged']=True
  with self.assertRaises(ContractError):verify_container(p,'lyra',good['Id'],wrong)
 def test_every_full_config_key_and_security_field_is_compared(self):
  from helpers import plan,container
  p=plan();good=container(p,'lyra')
  mutations=[lambda c:c.update(Image='sha256:'+'abcd'*16),lambda c:c['HostConfig'].update(Privileged=True),lambda c:c['Config'].update(User='0'),lambda c:c['HostConfig'].update(Binds=['/:/host']),lambda c:c['HostConfig'].update(NewUnknownField=True),lambda c:c['Config'].update(NewUnknownField=True),lambda c:c['Config']['Env'].append('VARCAMP_BOT_PERSONA=nova'),lambda c:c['Config']['Labels'].update({'io.varcamp.service.persona':'nova'}),lambda c:c.update(Mounts=[{'Source':'/host'}])]
  for mutation in mutations:
   c=copy.deepcopy(good);mutation(c)
   with self.subTest(mutation=mutation),self.assertRaises(ContractError):verify_container(p,'lyra',good['Id'],c)
 def test_all_three_actual_create_argv_preserve_source_isolation(self):
  from helpers import plan
  p=plan()
  for persona in ('lyra','nova','orion'):
   args=create_args(p,persona)
   self.assertEqual(args[0],'create');self.assertIn('1000:1000',args);self.assertIn('ALL',args);self.assertIn('no-new-privileges:true',args);self.assertIn('--read-only',args);self.assertIn(p.release['image'],args);self.assertEqual(args[-3:],['node','runner.mjs','--renderer-mode=canvas'])
  for persona in ('qa','','LYRA',None):
   with self.assertRaises(ContractError):create_args(p,persona)

class OperatorTests(unittest.TestCase):
 def setUp(self):
  from helpers import plan,FakeEngine
  self.tmp=tempfile.TemporaryDirectory();self.directory=pathlib.Path(self.tmp.name);self.directory.chmod(0o700);self.plan=plan();self.engine=FakeEngine(self.plan);self.journal=Journal(self.directory,self.plan);self.owner=ServiceOperator(self.plan,self.journal,self.engine)
 def tearDown(self):self.journal.close();self.tmp.cleanup()
 def test_success_closes_local_owner_without_stopping_detached_guide(self):
  result=self.owner.start('lyra');self.assertEqual(result['state'],'ready');self.assertEqual(self.engine.objects[result['id']]['State']['Running'],True)
  self.owner.close();self.assertNotIn('stop',[op for op,_ in self.engine.calls]);self.assertEqual(self.journal.member('lyra')['id'],result['id'])
 def test_explicit_slots_not_blind_all_profile_start(self):
  self.owner.start('lyra');self.assertEqual(len(self.engine.objects),1)
  with self.assertRaises(ServiceFailure):self.owner.start('all')
 def test_rejected_repeat_start_never_cleans_a_successfully_handed_off_service(self):
  first=self.owner.start('lyra');before=len(self.engine.calls)
  with self.assertRaises(ServiceFailure):self.owner.start('lyra')
  self.assertIn(first['id'],self.engine.objects,'An earlier successful handoff is never this failed attempt')
  self.assertTrue(self.engine.objects[first['id']]['State']['Running'])
  self.assertNotIn('stop',[op for op,_ in self.engine.calls[before:]])
 def test_existing_name_never_adopted_even_with_matching_labels(self):
  from helpers import container
  self.engine.objects['1234'*16]=container(self.plan,'lyra',identity='1234'*16)
  with self.assertRaises(ServiceFailure):self.owner.start('lyra')
  self.assertNotIn('start',[op for op,_ in self.engine.calls]);self.assertNotIn('stop',[op for op,_ in self.engine.calls])
 def test_unknown_create_is_held_and_not_retried_or_name_adopted(self):
  self.engine.fail='create-lost-ack'
  with self.assertRaises(ServiceFailure):self.owner.start('lyra')
  self.assertEqual(self.journal.member('lyra')['state'],'unknown')
  self.engine.fail=None
  with self.assertRaises(ServiceFailure):self.owner.start('lyra')
  self.assertEqual([op for op,_ in self.engine.calls].count('create'),1);self.assertNotIn('stop',[op for op,_ in self.engine.calls])
 def test_unknown_start_retains_first_error_and_exact_known_id(self):
  self.engine.fail='start-lost-ack'
  with self.assertRaises(ServiceFailure):self.owner.start('lyra')
  first=copy.deepcopy(self.journal.state['firstFailure']);self.assertEqual(self.journal.member('lyra')['state'],'unknown');self.assertRegex(self.journal.member('lyra')['id'],'^[a-f0-9]{64}$')
  with self.assertRaises(ServiceFailure):self.owner.start('nova')
  self.assertEqual(first,self.journal.state['firstFailure']);self.assertEqual([op for op,_ in self.engine.calls].count('start'),1)
  self.assertEqual(self.journal.member('nova')['state'],'absent','A refused sibling had no actual pending mutation')
 def test_journal_failure_precedes_any_mutation(self):
  self.journal.poisoned=True
  with self.assertRaises(ServiceFailure):self.owner.start('lyra')
  self.assertNotIn('create',[op for op,_ in self.engine.calls])
 def test_protected_host_or_public_drift_precedes_create(self):
  for field in ('host','public'):
   self.engine.fail=field
   with self.assertRaises(ServiceFailure):self.owner.start('lyra')
  self.assertNotIn('create',[op for op,_ in self.engine.calls])
 def test_wrong_created_security_prevents_start(self):
  self.engine.fail='created-security'
  with self.assertRaises(ServiceFailure):self.owner.start('lyra')
  self.assertNotIn('start',[op for op,_ in self.engine.calls])
 def test_controlled_stop_start_revalidates_exact_id_and_new_health_epoch(self):
  first=self.owner.start('lyra');self.owner.stop('lyra');second=self.owner.start('lyra')
  self.assertEqual(first['id'],second['id']);self.assertNotEqual(first['playerId'],second['playerId']);self.assertEqual([op for op,_ in self.engine.calls].count('create'),1)
 def test_stale_health_after_restart_cannot_publish_ready(self):
  self.owner.start('lyra');self.owner.stop('lyra');self.engine.fail='stale-health'
  with self.assertRaises(ServiceFailure):self.owner.start('lyra')
  self.assertNotEqual(self.journal.member('lyra')['state'],'ready')
 def test_status_never_adopts_an_unrecorded_object(self):
  with self.assertRaises(ServiceFailure):self.owner.status('lyra')
 def test_three_distinct_journal_ids_and_sibling_preservation(self):
  a=[self.owner.start(p) for p in ('lyra','nova','orion')];self.assertEqual(len({x['id'] for x in a}),3)
  siblings=copy.deepcopy({x['id']:self.engine.objects[x['id']] for x in a[1:]});self.owner.stop('lyra')
  for identity,body in siblings.items():self.assertEqual(body,self.engine.objects[identity])
 def test_missing_recorded_sibling_blocks_another_persona_before_create(self):
  first=self.owner.start('lyra');del self.engine.objects[first['id']];before=len(self.engine.calls)
  with self.assertRaises(ServiceFailure):self.owner.start('nova')
  self.assertNotIn('create',[op for op,_ in self.engine.calls[before:]])
 def test_full_config_drift_of_recorded_sibling_blocks_another_persona(self):
  first=self.owner.start('lyra');self.engine.objects[first['id']]['Config']['User']='0';before=len(self.engine.calls)
  with self.assertRaises(ServiceFailure):self.owner.start('nova')
  self.assertNotIn('create',[op for op,_ in self.engine.calls[before:]])
 def test_changed_invocation_of_recorded_sibling_blocks_another_persona(self):
  first=self.owner.start('lyra');self.engine.objects[first['id']]['State']['StartedAt']='2026-10-18T20:00:00.123456789Z';before=len(self.engine.calls)
  with self.assertRaises(ServiceFailure):self.owner.start('nova')
  self.assertNotIn('create',[op for op,_ in self.engine.calls[before:]])
 def test_changed_shared_player_of_recorded_sibling_blocks_another_persona(self):
  first=self.owner.start('lyra');original=self.engine.health
  def changed(identity,end):
   raw=original(identity,end)
   if identity==first['id']:
    h=json.loads(raw);h['controller']['identity']['playerId']+=99;h['identity']=h['controller']['identity'];return json.dumps(h).encode()
   return raw
  self.engine.health=changed;before=len(self.engine.calls)
  with self.assertRaises(ServiceFailure):self.owner.start('nova')
  self.assertNotIn('create',[op for op,_ in self.engine.calls[before:]])
 def test_readiness_failure_cleans_only_current_attested_new_id(self):
  first=self.owner.start('lyra');old=copy.deepcopy(self.engine.objects[first['id']]);self.engine.fail='readiness-error'
  with self.assertRaises(ServiceFailure):self.owner.start('nova')
  identity=self.journal.member('nova')['id']
  self.assertNotIn(identity,self.engine.objects)
  self.assertEqual(self.engine.objects[first['id']],old)
  self.assertIn(('stop',identity),self.engine.calls);self.assertIn(('remove',identity),self.engine.calls)
  self.assertEqual(self.journal.member('nova')['state'],'removed')
 def test_cleanup_error_preserves_original_readiness_failure_and_holds_unknown(self):
  self.engine.fail='readiness-and-stop-error'
  with self.assertRaises(ServiceFailure)as caught:self.owner.start('lyra')
  self.assertIn('TEST original readiness',str(caught.exception))
  self.assertEqual(self.owner.first_error.args,('TEST original readiness',))
  self.assertEqual(self.journal.member('lyra')['state'],'unknown')
  self.assertNotIn('remove',[op for op,_ in self.engine.calls])
  self.assertEqual([str(e)for e in self.owner.secondary_errors],['TEST original readiness','TEST cleanup STOP lost ACK'])
 def test_actual_terminal_health_and_logs_survive_known_canary_cleanup(self):
  self.engine.fail='terminal-health'
  with self.assertRaises(ServiceFailure):self.owner.start('lyra')
  identity=self.journal.member('lyra')['id'];self.assertNotIn(identity,self.engine.objects)
  self.assertTrue(hasattr(self.owner,'actual_evidence'),'Native failure evidence must survive ephemeral tmpfs/container removal')
  body=json.loads(self.owner.actual_evidence['lyra-health.json']);self.assertEqual(body['failure']['error']['message'],'hasPreviousMessage TEST original native cause')
  self.assertIn(b'TEST original native cause',self.owner.actual_evidence['lyra-logs.stdout.bin']);self.assertEqual(self.owner.actual_evidence['lyra-logs.stderr.bin'],b'TEST native error stream')
 def test_two_personas_cannot_acknowledge_the_same_shared_player_id(self):
  first=self.owner.start('lyra');original=self.engine.health
  def duplicate(identity,end):
   raw=original(identity,end)
   if identity!=first['id']:
    h=json.loads(raw);h['controller']['identity']['playerId']=first['playerId'];h['identity']=h['controller']['identity'];return json.dumps(h).encode()
   return raw
  self.engine.health=duplicate
  with self.assertRaises(ServiceFailure):self.owner.start('nova')
  self.assertEqual(self.journal.member('lyra')['state'],'ready');self.assertNotEqual(self.journal.member('nova')['state'],'ready')
 def test_health_lease_expiring_during_host_bracket_cannot_publish_ready(self):
  original=self.engine.health;baseline=self.engine.baseline
  def expiring(identity,end):
   raw=original(identity,end)
   h=json.loads(raw);at=time.time()*1000-9990;h['controller']['evidence'].update(at=at,leaseDeadline=at+10000);return json.dumps(h).encode()
  def slow(owned,end):
   if any(o['State']['Running']for o in self.engine.objects.values()):time.sleep(.025)
   return baseline(owned,end)
  self.engine.health=expiring;self.engine.baseline=slow
  with self.assertRaises(ServiceFailure):self.owner.start('lyra')
  self.assertNotEqual(self.journal.member('lyra')['state'],'ready')

class SourceEntryTests(unittest.TestCase):
 def test_unbound_source_refuses_before_filesystem_provider_work(self):
  with self.assertRaises(UnboundRelease):load_plan('/does-not-exist','a'*64)

if __name__=='__main__':unittest.main()
