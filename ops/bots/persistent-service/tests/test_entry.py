"""Closed real entry/loader tests. Source literals are patched ONLY in tests."""
import contextlib,copy,hashlib,importlib.util,io,json,pathlib,sys,tempfile,time,unittest
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from service.service_plan import load_plan,PlanError
from service import release_binding
from helpers import plan,SOURCE_PATHS

def value():
 p=plan();r=copy.deepcopy(p.release);controller={'url':'https://htooayelwinict.github.io/varcamp-map/bots/lyra.js?v='+'2345'*16,'bytes':1,'sha256':'2345'*16}
 rows=[{'kind':'controller',**controller,'status':200},
 {'kind':'app-frontend','url':'https://varcamp.3-1-133-135.sslip.io/assets/main-TEST.js','bytes':12,'sha256':'1234'*16,'status':200},
 {'kind':'iframe-sdk','url':'https://varcamp.3-1-133-135.sslip.io/iframe_api.js','bytes':2,'sha256':'3456'*16,'status':200},
 {'kind':'main','url':'https://maps.3-1-133-135.sslip.io/varcamp-demo/assets/src-main-TEST.js','bytes':3,'sha256':'4567'*16,'status':200},
 {'kind':'GameManager','url':'https://varcamp.3-1-133-135.sslip.io/assets/GameManager-TEST.js','bytes':4,'sha256':'5678'*16,'status':200}]
 kinds=('source',)*6+('sdk-package','sdk-browsers','sdk-resolver')
 r.update(controller=controller,public=rows,app={**rows[1],'frame':'owned-main-page'},executingSources=[{'kind':x['kind'],'url':x['url'],'size':x['bytes'],'sha256':x['sha256'],'status':200,'capture':'captured'}for x in rows if x['kind']in('iframe-sdk','main','GameManager')],sources=[{'path':path,'bytes':len(path),'sha256':hashlib.sha256(path.encode()).hexdigest(),'kind':kind}for path,kind in zip(SOURCE_PATHS,kinds)],native={'url':'https://maps.3-1-133-135.sslip.io/varcamp-demo/maps/overworld.tmj','bytes':3720000,'sha256':'6789'*16,'geometrySha256':'789a'*16},imageConfigSha256='89ab'*16)
 sec=(ROOT/'tests/fixtures/seccomp.json').read_bytes()
 p.host_template['SecurityOpt']=['no-new-privileges:true','seccomp='+sec.decode()]
 return {'scope':'varcamp-persistent-guides-production-v1','release':r,'baseline':p.baseline,'seccomp':{'file':'seccomp.json','bytes':len(sec),'sha256':hashlib.sha256(sec).hexdigest()},'configTemplate':p.config_template,'hostTemplate':p.host_template}

def stage(directory,v):
 raw=(json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode();sha=hashlib.sha256(raw).hexdigest();(directory/'plan.json').write_bytes(raw);(directory/'plan.json').chmod(0o600)
 (directory/'seccomp.json').write_bytes((ROOT/'tests/fixtures/seccomp.json').read_bytes());(directory/'seccomp.json').chmod(0o600)
 return sha

class LoaderTests(unittest.TestCase):
 def load(self,v):
  with tempfile.TemporaryDirectory()as tmp:
   directory=pathlib.Path(tmp);directory.chmod(0o700);sha=stage(directory,v)
   with patch.object(release_binding,'REVIEWED_PLAN_SHA256',sha),patch.object(release_binding,'REVIEWED_RELEASE',v['release']):return load_plan(directory,sha)
 def test_real_loader_closed_positive_uses_actual_seccomp(self):
  v=value();loaded=self.load(v);self.assertEqual(loaded.release,v['release']);self.assertEqual(loaded.baseline,v['baseline'])
 def test_unknown_source_path_cannot_replace_one_of_nine_real_image_members(self):
  v=value();v['release']['sources'][0]['path']='/opt/lyra/foreign.mjs'
  with self.assertRaises(PlanError):self.load(v)
 def test_arbitrary_public_url_is_not_source_bound_by_a_kind_name(self):
  v=value();v['release']['public'][2]['url']='https://example.com/iframe_api.js'
  with self.assertRaises(PlanError):self.load(v)
 def test_mismatched_executing_source_bytes_cannot_be_expected_delivery(self):
  v=value();v['release']['executingSources'][0]['sha256']='aaaa'*16
  with self.assertRaises(PlanError):self.load(v)
 def test_unknown_release_fields_and_malformed_protected_row_refuse(self):
  for mutate in(lambda v:v['release'].update(fakeProof=True),lambda v:v['baseline'][0].update(configSha256='fake')):
   v=value();mutate(v)
   with self.subTest(mutate=mutate),self.assertRaises(PlanError):self.load(v)
 def test_delayed_plan_read_has_original_five_second_input_deadline(self):
  import os
  original=os.read;began=time.monotonic()
  def delayed(*args):time.sleep(5.2);return original(*args)
  with patch('service.service_plan.os.read',side_effect=delayed):
   with self.assertRaises(TimeoutError):self.load(value())
  self.assertLess(time.monotonic()-began,5.2)
 def test_real_cli_entry_exists_and_has_no_provider_import_before_unbound_refusal(self):
  self.assertIsNotNone(importlib.util.find_spec('service.service_cli'),'Actual consumed production entry is required')
  from service.service_cli import main
  with patch('builtins.__import__',wraps=__import__)as imports:
   code=main(['start','lyra','/does-not-exist','a'*64])
  self.assertEqual(code,2);self.assertNotIn('service.service_engine',[c.args[0]for c in imports.call_args_list])
 def test_actual_entry_consumes_loader_journal_operator_and_closes_detached_success(self):
  self._entry(False)
 def test_actual_entry_retains_native_error_bytes_before_scoped_cleanup(self):
  self._entry(True)
 def test_input_close_uncertainty_retains_original_error_and_actual_fd(self):
  import os
  from service.service_plan import _file
  with tempfile.TemporaryDirectory()as tmp:
   path=pathlib.Path(tmp)/'private';path.write_bytes(b'actual');path.chmod(0o600);original_close=os.close
   def close(fd):original_close(fd);raise OSError('TEST uncertain input close')
   with patch('service.service_plan.os.read',side_effect=OSError('TEST first input read')),patch('service.service_plan.os.close',side_effect=close):
    with self.assertRaises(Exception)as caught:_file(path,100,0o600)
   self.assertTrue(hasattr(caught.exception,'original'),'A close error cannot replace the original read error')
   self.assertEqual(str(caught.exception.original),'TEST first input read');self.assertIsInstance(caught.exception.uncertain_fd,int)
 def _entry(self,terminal):
  from service.service_cli import main
  from service import runtime_predicates as runtime
  from helpers import FakeEngine
  with tempfile.TemporaryDirectory()as tmp:
   directory=pathlib.Path(tmp);directory.chmod(0o700);v=value();sha=stage(directory,v)
   with patch.object(release_binding,'REVIEWED_PLAN_SHA256',sha),patch.object(release_binding,'REVIEWED_RELEASE',v['release']):
    loaded=load_plan(directory,sha);peer=FakeEngine(loaded);peer.fail='terminal-health'if terminal else None
    with patch('service.service_engine.DockerEngine',return_value=peer),patch.object(runtime,'APP',loaded.release['app']),patch.object(runtime,'EXECUTING_SOURCES',loaded.release['executingSources']),contextlib.redirect_stdout(io.StringIO())as output:code=main(['start','lyra',str(directory),sha])
   result=json.loads(output.getvalue());self.assertEqual(code,2 if terminal else 0)
   if terminal:
    evidence=list(directory.glob('failure-*/lyra-health.json'));self.assertEqual(len(evidence),1);self.assertIn('TEST original native cause',evidence[0].read_text());self.assertEqual(peer.objects,{})
   else:self.assertEqual(result['localIOClosed'],True);self.assertEqual(len(peer.objects),1);self.assertNotIn('stop',[op for op,_ in peer.calls])

if __name__=='__main__':unittest.main()
