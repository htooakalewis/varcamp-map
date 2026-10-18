"""Protect the source lineage and prevent silent pose/substitution regressions."""
from pathlib import Path
import copy,hashlib,importlib.util,json,unittest
ROOT=Path(__file__).resolve().parents[2]
class SourceExport(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  spec=importlib.util.spec_from_file_location('export',ROOT/'tools/wokas/export.py');cls.m=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.m);cls.recipe=json.loads((ROOT/'art/source/wokas/export-recipe.json').read_bytes())
 def test_all_exact_original_masters_and_only_approved_frame_replacements(self):
  masters=json.loads((ROOT/'art/source/wokas/masters.json').read_bytes())
  self.assertEqual(len(masters['assets']),12)
  for source in masters['assets']:
   raw=(ROOT/source['source']).read_bytes();self.assertEqual(hashlib.sha256(raw).hexdigest(),source['sha256']);self.assertEqual(len(raw),source['bytes'])
  replacements=[]
  for c in self.recipe['characters']:
   order=[f['sourceFrame'] for f in c['frames']]
   if c['gender']=='female':self.assertEqual(order,list(range(12,24)))
   elif c['sign'] in ('cancer','leo','capricorn'):self.assertEqual(order,[0,1,2,3,4,8,6,7,5,9,10,11])
   else:self.assertEqual(order,list(range(12)))
   replacements +=[(c['id'],f['sourceFrame']) for f in c['frames'] if f['replacementSourceFrame'] is not None]
  self.assertEqual(replacements,[('varcamp-zodiac-v1-leo-male',8)]+[('varcamp-zodiac-v1-leo-female',i) for i in range(12,18)]+[('varcamp-zodiac-v1-capricorn-male',8)])
 def test_stale_source_crop_order_mask_and_duplicate_character_are_rejected(self):
  cases=[('sourceSha256','0'*64,'Source or isolation mask body changed'),('maskSha256','0'*64,'Source or isolation mask body changed'),('crop',[-1,0,10,10],'Invalid source crop'),('targetFrame',3,'Incomplete or reordered native frame targets')]
  for field,value,message in cases:
   with self.subTest(field=field):
    recipe=copy.deepcopy(self.recipe);recipe['characters'][0]['frames'][0][field]=value
    with self.assertRaisesRegex(ValueError,message):self.m.render(recipe)
  recipe=copy.deepcopy(self.recipe);recipe['characters'][1]['id']=recipe['characters'][0]['id']
  with self.assertRaisesRegex(ValueError,'Duplicate character ID'):self.m.render(recipe)
 def test_uniform_scale_cannot_escape_frame_or_clip_neighbor(self):
  recipe=copy.deepcopy(self.recipe);recipe['characters'][0]['uniformScale']=[1,1]
  with self.assertRaisesRegex(ValueError,'Native subject exceeds reserved frame margin'):self.m.render(recipe)
if __name__=='__main__':unittest.main(verbosity=2)
