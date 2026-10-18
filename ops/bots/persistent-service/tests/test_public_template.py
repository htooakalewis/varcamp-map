"""Public unbound source closure. Test copies use private modes; checkout modes grant nothing."""
import ast, contextlib, hashlib, importlib.util, io, json, pathlib, shutil, subprocess, sys, tempfile, unittest
from unittest.mock import patch
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from service import release_binding
from service.service_plan import load_plan, UnboundRelease

class PublicTemplateTests(unittest.TestCase):
 def bootstrap(self):
  spec = importlib.util.spec_from_file_location('TEST_ONLY_PUBLIC_BOOTSTRAP', ROOT/'bootstrap.py')
  module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module
 def private_copy(self, directory):
  directory = pathlib.Path(directory).resolve(); directory.chmod(0o700)
  shutil.copytree(ROOT/'service', directory/'service'); (directory/'service').chmod(0o700)
  for name in ('bootstrap.py', 'source-manifest.json'): shutil.copy2(ROOT/name, directory/name)
  for file in directory.rglob('*'):
   if file.is_file(): file.chmod(0o600)
  return directory
 def test_binding_has_only_two_unbound_assignments(self):
  self.assertIsNone(release_binding.REVIEWED_PLAN_SHA256); self.assertIsNone(release_binding.REVIEWED_RELEASE)
  tree = ast.parse((ROOT/'service/release_binding.py').read_bytes())
  assignments = [node for node in tree.body if isinstance(node, ast.Assign)]
  self.assertEqual([node.targets[0].id for node in assignments], ['REVIEWED_PLAN_SHA256','REVIEWED_RELEASE'])
  self.assertTrue(all(isinstance(node.value,ast.Constant) and node.value.value is None for node in assignments))
 def test_unbound_loader_never_opens_plan_or_loads_provider(self):
  with patch('service.service_plan.os.open',side_effect=AssertionError('Plan IO before binding')), patch('builtins.__import__',wraps=__import__) as imports:
   with self.assertRaises(UnboundRelease): load_plan('/TEST_ONLY_DOES_NOT_EXIST','a'*64)
  self.assertNotIn('service.service_engine',[call.args[0] for call in imports.call_args_list])
 def test_real_cli_unbound_refuses_before_provider_and_reports_local_closure(self):
  from service.service_cli import main
  with patch('builtins.__import__',wraps=__import__) as imports, contextlib.redirect_stdout(io.StringIO()) as output:
   code=main(['start','lyra','/TEST_ONLY_DOES_NOT_EXIST','a'*64])
  result=json.loads(output.getvalue()); self.assertEqual(code,2); self.assertEqual(result['firstType'],'UnboundRelease')
  self.assertFalse(result['externalServicesMayRemain']); self.assertTrue(result['localClosureCertain'])
  self.assertNotIn('service.service_engine',[call.args[0] for call in imports.call_args_list])
 def test_private_mode_copy_passes_closed13_manifest_then_tampering_refuses(self):
  with tempfile.TemporaryDirectory() as tmp:
   directory=self.private_copy(tmp); module=self.bootstrap(); module.verify_source_tree(directory)
   rows=json.loads((directory/'source-manifest.json').read_bytes())['files']; self.assertEqual(len(rows),13)
   target=directory/'service/service_cli.py'; target.write_bytes(target.read_bytes()+b'\nraise RuntimeError("UNVERIFIED_IMPORT")\n')
   with self.assertRaisesRegex(ValueError,'Actual source mismatch'): module.verify_source_tree(directory)
 def test_checkout_modes_are_not_accepted_as_private_installation(self):
  with tempfile.TemporaryDirectory() as tmp:
   directory=self.private_copy(tmp); (directory/'service/service_cli.py').chmod(0o644)
   with self.assertRaisesRegex(ValueError,'Private bounded source'): self.bootstrap().verify_source_tree(directory)
 def test_interpreter_profile_remains_exact_and_local_profile_grants_no_authority(self):
  module=self.bootstrap(); expected=module.INTERPRETER; module.check_interpreter_profile(dict(expected))
  for key,bad in [('versionInfo',[3,12,14,'final',0]),('uid',1000),('executableSha256','a'*64),('isolated',0)]:
   with self.subTest(key=key), self.assertRaises(ValueError): module.check_interpreter_profile({**expected,key:bad})

if __name__=='__main__': unittest.main()
