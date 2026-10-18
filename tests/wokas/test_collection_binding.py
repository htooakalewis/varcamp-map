from pathlib import Path
import importlib.util,unittest,copy,tempfile,shutil
ROOT=Path(__file__).resolve().parents[2]
class BindingContract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  p=ROOT/'tools/wokas/bind_collection.py'
  if p.exists():
   s=importlib.util.spec_from_file_location('binding',p);cls.m=importlib.util.module_from_spec(s);s.loader.exec_module(cls.m)
  else:cls.m=None
 def test_binding_preserves_existing_collections_and_resolves_all_new_ids(self):
  self.assertIsNotNone(self.m,'Missing whole-character collection binder')
  old={'woka':{'collections':[{'name':'Original','textures':[{'id':'default','name':'Default','url':'https://example.test/original.png'}]}]},'body':{'collections':[],'required':True}}
  saved=copy.deepcopy(old);out=self.m.append_collection(old,'https://venue.example.test/wokas/varcamp-zodiac-v1/')
  self.assertEqual(old,saved);self.assertEqual(out['body'],saved['body']);self.assertEqual(out['woka']['collections'][0],saved['woka']['collections'][0])
  textures=out['woka']['collections'][1]['textures'];self.assertEqual(len(textures),24)
  self.assertEqual(textures[0],{'id':'varcamp-zodiac-v1-aries-male','name':'Aries · Male','url':'https://venue.example.test/wokas/varcamp-zodiac-v1/aries-male.png'})
  self.assertEqual(textures[-1]['id'],'varcamp-zodiac-v1-pisces-female')
 def test_invalid_hosting_urls_and_existing_id_collisions_refuse(self):
  self.assertIsNotNone(self.m,'Missing whole-character collection binder')
  for base in [None,'','http://example.test/','https://example.test/?x=1','https://example.test/#x','https://user:pass@example.test/','https://example.test/a/../b/','https://example.test/%2e%2e/','https://bad host/','https://example.test:bad/','https://example.test:0/']:
   with self.subTest(base=base),self.assertRaises(ValueError):self.m.append_collection({},base)
  old={'woka':{'collections':[{'name':'Existing','textures':[{'id':'varcamp-zodiac-v1-gemini-male','name':'Other','url':'https://example.test/a.png'}]}]}}
  with self.assertRaises(ValueError):self.m.append_collection(old,'https://venue.example.test/wokas/')
 def test_binding_refuses_stale_texture_body(self):
  self.assertIsNotNone(self.m)
  with tempfile.TemporaryDirectory() as folder:
   temporary=Path(folder);target=temporary/'public/wokas/varcamp-zodiac-v1';target.parent.mkdir(parents=True)
   shutil.copytree(ROOT/'public/wokas/varcamp-zodiac-v1',target)
   (target/'aries-male.png').write_bytes(b'stale image body')
   previous=self.m.ROOT
   try:
    self.m.ROOT=temporary
    with self.assertRaisesRegex(ValueError,'Native texture body changed'):self.m.append_collection({},'https://venue.example.test/wokas/')
   finally:self.m.ROOT=previous
if __name__=='__main__':unittest.main(verbosity=2)
