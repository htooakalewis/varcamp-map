"""Consumer-visible avatar package contracts; run before producing exports."""
from pathlib import Path
import hashlib,json,unittest
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
SIGNS=('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces')
class NativeWokaPackage(unittest.TestCase):
 def test_all_twenty_four_skins_are_selectable_native_textures(self):
  for sign in SIGNS:
   for gender in ('male','female'):
    with self.subTest(sign=sign,gender=gender):
     p=ROOT/f'public/wokas/varcamp-zodiac-v1/{sign}-{gender}.png'
     self.assertTrue(p.is_file(),f'Missing selectable avatar texture: {p.name}')
     im=Image.open(p)
     self.assertEqual(im.mode,'RGBA'); self.assertEqual(im.size,(96,128))
     frames=[]
     for row in range(4):
      poses=[]
      for col in range(3):
       frame=im.crop((col*32,row*32,(col+1)*32,(row+1)*32)); a=frame.getchannel('A'); box=a.getbbox()
       self.assertIsNotNone(box); self.assertGreaterEqual(box[0],1); self.assertGreaterEqual(box[1],1)
       self.assertLessEqual(box[2],31); self.assertEqual(box[3],31,'All frames have a fixed foot baseline')
       self.assertEqual(max(a.crop((0,0,32,1)).getdata()),0)
       poses.append(hashlib.sha256(frame.tobytes()).hexdigest()); frames.append(poses[-1])
      self.assertEqual(len(set(poses)),3,'Walking needs three painted poses, not duplicated idle frames')
     self.assertEqual(len(set(frames)),12,'All directional frames must remain distinct')
 def test_generated_high_resolution_masters_are_not_native_texture_files(self):
  sources=ROOT/'art/source/wokas'
  for sign in SIGNS:
   with Image.open(sources/f'{sign}-pair-master.png') as image:self.assertNotEqual(image.size,(96,128))
 def test_catalog_template_has_twenty_four_unique_whole_character_ids(self):
  p=ROOT/'public/wokas/varcamp-zodiac-v1/collection.template.json'
  self.assertTrue(p.is_file(),'Missing portable whole-character collection template')
  body=json.loads(p.read_bytes());self.assertEqual(body['category'],'woka');self.assertIsNone(body['assetBaseUrl'])
  textures=body['collection']['textures']; self.assertEqual(len(textures),24);self.assertEqual(len({t['id'] for t in textures}),24)
  self.assertEqual({t['file'] for t in textures},{f'{s}-{g}.png' for s in SIGNS for g in ('male','female')})
  for t in textures:self.assertNotIn('url',t,'Unbound URLs must not pretend to be live')
if __name__=='__main__':unittest.main(verbosity=2)
