"""The reviewed source defect must be repaired without replacing good poses."""
from pathlib import Path
from PIL import Image
import hashlib,json,unittest
ROOT=Path(__file__).resolve().parents[2]

class ReviewedLeftStrideRepair(unittest.TestCase):
 def test_only_two_reviewed_left_strides_are_explicit_original_replacements(self):
  contract=json.loads((ROOT/'art/source/wokas/direction-repairs.json').read_bytes())
  self.assertEqual([(r['sign'],r['gender'],r['targetFrame'],r['direction']) for r in contract['repairs']], [('leo','male',5,'left'),('capricorn','male',5,'left')])
  recipe=json.loads((ROOT/'art/source/wokas/export-recipe.json').read_bytes())
  for repair in contract['repairs']:
   raw=(ROOT/repair['source']).read_bytes();self.assertEqual(hashlib.sha256(raw).hexdigest(),repair['sha256']);self.assertEqual(len(raw),repair['bytes'])
   character=next(c for c in recipe['characters'] if c['sign']==repair['sign'] and c['gender']==repair['gender'])
   frame=character['frames'][repair['targetFrame']]
   self.assertEqual(frame['source'],repair['source']);self.assertEqual(frame['sourceSha256'],repair['sha256']);self.assertEqual(frame['replacementSourceFrame'],0)
   self.assertEqual(character['uniformScale'],repair['originalUniformScale'],'Unrelated poses must keep their original scale')
   self.assertNotIn('mirror',frame);self.assertNotIn('flip',frame)

 def test_all_other_two_hundred_eighty_six_native_frames_are_byte_exact(self):
  baseline=json.loads((ROOT/'art/source/wokas/direction-repair-baseline.json').read_bytes())
  targets={tuple(t) for t in baseline['repairTargets']};changed=[]
  for row in baseline['textures']:
   im=Image.open(ROOT/'public/wokas/varcamp-zodiac-v1'/row['file']).convert('RGBA')
   for i,expected in enumerate(row['frames']):
    actual=hashlib.sha256(im.crop((i%3*32,i//3*32,i%3*32+32,i//3*32+32)).tobytes()).hexdigest()
    if actual!=expected:changed.append((row['file'],i))
  self.assertEqual(set(changed),targets,'Exactly the two wrong-facing native frames must change')
  self.assertEqual(len(changed),2)

if __name__=='__main__':unittest.main(verbosity=2)
