"""Intentional editor collection migration: preserve editor-owned bytes and scope."""
import unittest,json,sys,pathlib,tempfile
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from editor_catalogs import register_collections, make_package, source_policy
REQUIRED=[{'url':'https://venue.example/collections/FurnitureCollection.json','type':'file'},{'url':'https://venue.example/collections/OfficeCollection.json','type':'file'}]
class CatalogMigration(unittest.TestCase):
 def test_preserves_every_noncollection_byte_and_existing_user_collection(self):
  raw=b'{ "entities":{"saved":{"name":"user"}}, "entityCollections" : [ {"url":"https://custom.example/a.json","type":"file","vendor":{"keep":1}} \n], "vendor":"\\u1019" }\n'
  new,added=register_collections(raw,REQUIRED)
  insert=b','+json.dumps(REQUIRED,separators=(',',':')).encode()[1:-1]
  self.assertEqual(new,raw.replace(b'\n]',b'\n'+insert+b']'))
  self.assertEqual(added,[x['url']for x in REQUIRED]);self.assertEqual(json.loads(new)['entities'],json.loads(raw)['entities'])
 def test_nested_property_never_becomes_root_target(self):
  raw=b'{"vendor":{"entityCollections":[1]},"entityCollections":[],"areas":[{"id":"saved"}]}'
  new,_=register_collections(raw,REQUIRED);self.assertEqual(json.loads(new)['vendor'],{'entityCollections':[1]});self.assertEqual(json.loads(new)['areas'],[{'id':'saved'}])
 def test_idempotent_does_not_reserialize(self):
  raw=b'{ "entityCollections" : '+json.dumps(REQUIRED).encode()+b', "x": 1 }\n'
  self.assertEqual(register_collections(raw,REQUIRED),(raw,[]))
 def test_existing_required_url_order_and_unknown_fields_are_retained(self):
  existing=[{**REQUIRED[1],'vendor':'keep'}];raw=json.dumps({'entityCollections':existing}).encode();new,added=register_collections(raw,REQUIRED)
  self.assertEqual(json.loads(new)['entityCollections'],existing+[REQUIRED[0]]);self.assertEqual(added,[REQUIRED[0]['url']])
 def test_conflicting_existing_type_refuses(self):
  with self.assertRaises(ValueError):register_collections(json.dumps({'entityCollections':[{'url':REQUIRED[0]['url'],'type':'other'}]}).encode(),REQUIRED)
 def test_invalid_root_and_duplicate_keys_refuse(self):
  for raw in [b'[]',b'{}',b'{"entityCollections":{}}',b'{"entityCollections":[],"entityCollections":[]}',b'{"entityCollections":[],"x":NaN}',b'{"entityCollections":[3]}']:
   with self.subTest(raw=raw),self.assertRaises(ValueError):register_collections(raw,REQUIRED)
 def test_invalid_required_catalog_policy_refuses(self):
  for required in [[],[REQUIRED[0],REQUIRED[0]],[{'url':'http://bad.example/a','type':'file'}],[{'url':'https://venue.example/a','type':'other'}],[{'url':'https://u:p@venue.example/a','type':'file'}]]:
   with self.subTest(required=required),self.assertRaises(ValueError):register_collections(b'{"entityCollections":[]}',required)
 def test_only_explicit_wams_change_and_all_other_files_survive(self):
  raw=b'{"entityCollections":[],"entities":{"saved":{}}}';baseline={'maps/a.wam':raw,'maps/a.tmj':b'unchanged','old.png':b'png','maps/unrelated.wam':b'other'}
  package,changes=make_package(baseline,REQUIRED,['maps/a.wam']);self.assertEqual(set(package),set(baseline));self.assertEqual(changes[0]['path'],'maps/a.wam')
  for path in set(baseline)-{'maps/a.wam'}:self.assertEqual(package[path],baseline[path])
 def test_missing_or_unpaired_path_refuses_before_output(self):
  for base,paths in [({},['maps/a.wam']),({'maps/a.wam':b'{"entityCollections":[]}'},['maps/a.wam']),({'x':b'{}'},['../x'])]:
   with self.subTest(paths=paths),self.assertRaises(ValueError):make_package(base,REQUIRED,paths)
class CurrentSourcePolicy(unittest.TestCase):
 def fixture(self, root, kind):
  ids=['overworld','campus-exploration','solar-hall','lunar-hall','fire-district','earth-district','air-district','water-district','orbit-maze','hidden-observatory','nebula-arcade','zodiac-festival-park','shipyard-beach','comet-maze','orbit-playground','constellation-shore','fa-ship','star-garden','moon-cafe','moon-grotto','stargazer-terrace']+['speaker-'+x for x in ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces')]
  original={f'maps/{i}.{ext}':'0'*64 for i in ids for ext in ('wam','tmj')}
  extension={f'maps/fa-ship-interior.{ext}':'1'*64 for ext in ('wam','tmj')}
  if kind=='missing':extension.pop('maps/fa-ship-interior.wam')
  if kind=='unpaired':extension.pop('maps/fa-ship-interior.tmj')
  if kind=='extra':extension.update({'maps/foreign.wam':'2'*64,'maps/foreign.tmj':'2'*64})
  if kind=='replaced':
   extension.pop('maps/fa-ship-interior.wam');extension.pop('maps/fa-ship-interior.tmj');extension.update({'maps/foreign.wam':'2'*64,'maps/foreign.tmj':'2'*64})
  (root/'world').mkdir();(root/'publication').mkdir()
  (root/'world/editor-collections.json').write_text(json.dumps(REQUIRED))
  (root/'publication/source-manifest.json').write_text(json.dumps({'sourceInventory':original,'extensionInventory':extension}))
 def test_complete_current34_source_closure(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);self.fixture(root,'complete');catalogs,_,paths=source_policy(root)
   self.assertEqual(catalogs,REQUIRED);self.assertEqual(len(paths),34);self.assertIn('maps/fa-ship-interior.wam',paths)
 def test_missing_extra_replaced_or_unpaired_current_map_refuses(self):
  for kind in ('missing','extra','replaced','unpaired'):
   with self.subTest(kind=kind),tempfile.TemporaryDirectory() as d:
    root=pathlib.Path(d);self.fixture(root,kind)
    with self.assertRaisesRegex(ValueError,'34|paired'):source_policy(root)
if __name__=='__main__':unittest.main(verbosity=2)
