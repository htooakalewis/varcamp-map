"""Assemble reviewed original poses into native WorkAdventure sprite sheets."""
from pathlib import Path
from PIL import Image,ImageChops
from fractions import Fraction
from io import BytesIO
import argparse,hashlib,json
ROOT=Path(__file__).resolve().parents[2]
def sha(raw):return hashlib.sha256(raw).hexdigest()
def render(recipe):
 out={};seen=set()
 if recipe['format']!={'sheet':[96,128],'frame':[32,32],'rows':['down','left','right','up'],'footBaseline':30,'maxSubjectSize':28}:raise ValueError('Unexpected native texture contract')
 for char in recipe['characters']:
  if char['id'] in seen:raise ValueError('Duplicate character ID')
  seen.add(char['id']);sheet=Image.new('RGBA',(96,128));scale=Fraction(*char['uniformScale'])
  if [f['targetFrame'] for f in char['frames']]!=list(range(12)):raise ValueError('Incomplete or reordered native frame targets')
  for f in char['frames']:
   source_path=ROOT/f['source'];source_raw=source_path.read_bytes();mask_raw=(ROOT/f['mask']).read_bytes()
   if sha(source_raw)!=f['sourceSha256'] or sha(mask_raw)!=f['maskSha256']:raise ValueError('Source or isolation mask body changed')
   source=Image.open(source_path).convert('RGBA');box=f['crop']
   if len(box)!=4 or any(type(x)!=int for x in box) or not(0<=box[0]<box[2]<=source.width and 0<=box[1]<box[3]<=source.height):raise ValueError('Invalid source crop')
   sprite=source.crop(box);mask=Image.open(BytesIO(mask_raw))
   if mask.mode!='L' or mask.size!=sprite.size or set(mask.getdata())!={0,255}:raise ValueError('Invalid source selection mask')
   sprite.putalpha(ImageChops.multiply(sprite.getchannel('A'),mask))
   ratio=scale*Fraction(*f.get('sourceUnitsScale',[1,1]));width=max(1,round(sprite.width*ratio));height=max(1,round(sprite.height*ratio))
   if width>28 or height>28:raise ValueError('Native subject exceeds reserved frame margin')
   sprite=sprite.resize((width,height),Image.Resampling.NEAREST);visible=sprite.getchannel('A').getbbox()
   if visible is None:raise ValueError('A subject vanished at native resolution')
   sprite=sprite.crop(visible);frame=f['targetFrame'];sheet.alpha_composite(sprite,(frame%3*32+(32-sprite.width)//2,frame//3*32+31-sprite.height))
  b=BytesIO();sheet.save(b,format='PNG');out[f'{char["sign"]}-{char["gender"]}.png']=b.getvalue()
 if len(out)!=24:raise ValueError('The package must contain all24 reviewed skins')
 return out

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args();recipe=json.loads((ROOT/'art/source/wokas/export-recipe.json').read_bytes());out=render(recipe);directory=ROOT/'public/wokas/varcamp-zodiac-v1'
 manifest={'version':1,'status':'SOURCE_PACKAGE_NOT_LIVE_SELECTION','format':recipe['format'],'assets':[{'file':name,'bytes':len(raw),'sha256':sha(raw)} for name,raw in out.items()]}
 template={'version':1,'category':'woka','assetBaseUrl':None,'collection':{'name':'VarCamp Zodiac 2026','textures':[{'id':c['id'],'name':f'{c["sign"].title()} · {c["gender"].title()}','file':f'{c["sign"]}-{c["gender"]}.png'} for c in recipe['characters']]}}
 for name,obj in [('manifest.json',manifest),('collection.template.json',template)]:out[name]=(json.dumps(obj,indent=2,ensure_ascii=False)+'\n').encode()
 if args.check:
  for name,raw in out.items():
   if (directory/name).read_bytes()!=raw:raise ValueError(f'Native output differs from exact source export: {name}')
  print('Verified24 exact native sheets, source masks, source hashes, package manifest and unbound collection.')
 else:
  directory.mkdir(parents=True,exist_ok=True)
  for name,raw in out.items():(directory/name).write_bytes(raw)
  print('Exported24 native skins and unbound whole-character collection; no live catalog changed.')
if __name__=='__main__':main()
