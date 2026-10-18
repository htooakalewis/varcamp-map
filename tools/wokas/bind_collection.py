"""Bind a reviewed whole-character collection to an actual HTTPS asset root.

This creates a new catalog value/file. It neither contacts nor modifies a server.
The operator must first establish which live Woka service supplies that catalog.
"""
from pathlib import Path
from urllib.parse import urlsplit
import argparse,copy,hashlib,json,re,struct,ipaddress
ROOT=Path(__file__).resolve().parents[2]

def append_collection(existing,asset_base_url):
 if not isinstance(existing,dict):raise ValueError('Catalog must be an object')
 if not isinstance(asset_base_url,str):raise ValueError('An actual HTTPS asset base URL is required')
 try:u=urlsplit(asset_base_url);port=u.port
 except ValueError:raise ValueError('Invalid HTTPS asset host or port') from None
 if any(c.isspace() or ord(c)<32 for c in asset_base_url) or port is not None and not 1<=port<=65535:raise ValueError('Invalid HTTPS asset host or port')
 hostname=u.hostname or ''
 try:ipaddress.ip_address(hostname)
 except ValueError:
  try:labels=hostname.rstrip('.').encode('idna').decode('ascii').split('.')
  except UnicodeError:raise ValueError('Invalid HTTPS asset host') from None
  if not labels or any(not re.fullmatch(r'[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?',part) for part in labels):raise ValueError('Invalid HTTPS asset host')
 if u.scheme!='https' or not u.hostname or u.username or u.password or u.query or u.fragment or not asset_base_url.endswith('/') or '%' in u.path or '\\' in asset_base_url or any(p in ('.','..') for p in u.path.split('/')):raise ValueError('Asset root must be an absolute HTTPS directory URL without credentials, query, fragment or traversal')
 template=json.loads((ROOT/'public/wokas/varcamp-zodiac-v1/collection.template.json').read_bytes())
 if template['assetBaseUrl'] is not None or template['category']!='woka':raise ValueError('Expected unbound whole-character template')
 directory=ROOT/'public/wokas/varcamp-zodiac-v1'
 manifest=json.loads((directory/'manifest.json').read_bytes())
 expected={f'{s}-{g}.png' for s in ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces') for g in ('male','female')}
 rows=manifest['assets']
 if len(rows)!=24 or {r['file'] for r in rows}!=expected:raise ValueError('Incomplete native texture package')
 for row in rows:
  raw=(directory/row['file']).read_bytes()
  if len(raw)!=row['bytes'] or hashlib.sha256(raw).hexdigest()!=row['sha256']:raise ValueError('Native texture body changed')
  if raw[:8]!=b'\x89PNG\r\n\x1a\n' or raw[12:16]!=b'IHDR' or struct.unpack('>II',raw[16:24])!=(96,128) or raw[24:26]!=bytes([8,6]):raise ValueError('Invalid native RGBA texture')
 collection=copy.deepcopy(template['collection']); ids=set()
 if len(collection['textures'])!=24 or {t['file'] for t in collection['textures']}!=expected:raise ValueError('Incomplete whole-character collection')
 if any(t['id']!='varcamp-zodiac-v1-'+t['file'][:-4] for t in collection['textures']):raise ValueError('Unexpected collection ID')
 for layer in existing.values():
  if not isinstance(layer,dict) or not isinstance(layer.get('collections'),list):raise ValueError('Malformed existing collection layer')
  for current in layer['collections']:
   for t in current['textures']:
    if t['id'] in ids:raise ValueError('Existing catalog has duplicate texture IDs')
    ids.add(t['id'])
 for t in collection['textures']:
  if t['id'] in ids:raise ValueError('New ID collides with the existing catalog')
  ids.add(t['id']);filename=t.pop('file')
  if filename!=Path(filename).name or not filename.endswith('.png'):raise ValueError('Invalid asset filename')
  t['url']=asset_base_url+filename
 out=copy.deepcopy(existing);out.setdefault('woka',{'collections':[]})['collections'].append(collection)
 return out

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--catalog',type=Path,required=True);p.add_argument('--asset-base-url',required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
 value=append_collection(json.loads(args.catalog.read_bytes()),args.asset_base_url)
 with args.output.open('x') as f:f.write(json.dumps(value,indent=2,ensure_ascii=False)+'\n')
 print(f'Wrote a new bound catalog to {args.output}; no live service was changed.')
if __name__=='__main__':main()
