import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

const python = (script: string) => JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }));

it('replaces only the mapUrl version token, preserving length and every other byte', () => {
  const result = python(`
import sys,json,hashlib
sys.path.insert(0,'ops')
from migrate_wam_tokens import rewrite_token
from release_upload import wam_reference
old='0'*64; new=hashlib.sha256(b'final native map').hexdigest()
data=('{\\n  "version": "1.0.0",\\n  "mapUrl": "a.tmj?v='+old+'",\\n  "entities": [{"id": "editor-owned", "note": "<VERSION> literal must survive"}],\\n  "areas": [], "metadata": {"custom": true, "text": "v='+'f'*64+'"}\\n}\\n').encode()
out=rewrite_token('maps/a.wam',data,new)
start=data.index(old.encode())
print(json.dumps({'sameLength':len(out)==len(data),'prefixSame':out[:start]==data[:start],'suffixSame':out[start+64:]==data[start+64:],
 'pin':wam_reference('maps/a.wam',out)[0],'expected':new,'oldGone':old.encode() not in out,'decoyKept':('"text": "v='+'f'*64).encode() in out,
 'placeholderKept':b'<VERSION> literal must survive' in out,'parsed':json.loads(out)['mapUrl']=='a.tmj?v='+new,'inputUntouched':old.encode() in data}))
`);
  expect(result).toEqual({ sameLength: true, prefixSame: true, suffixSame: true, pin: result.expected, expected: result.expected, oldGone: true, decoyKept: true, placeholderKept: true, parsed: true, inputUntouched: true });
});

it('rejects WAMs without a single literal root mapUrl token and invalid replacement pins', () => {
  const result = python(`
import sys,json
sys.path.insert(0,'ops')
from migrate_wam_tokens import rewrite_token
new='a'*64
def rejected(path,data,pin=new):
  try: rewrite_token(path,data,pin); return False
  except ValueError: return True
cases={
 'noMapUrl': rejected('maps/a.wam', b'{"entities": []}'),
 'noToken': rejected('maps/a.wam', b'{"mapUrl": "a.tmj"}'),
 'twoTokensInOneUrl': rejected('maps/a.wam', ('{"mapUrl": "a.tmj?v='+'1'*64+'?v='+'2'*64+'"}').encode()),
 'twoMapUrlKeys': rejected('maps/a.wam', ('{"mapUrl": "a.tmj?v='+'1'*64+'", "mapUrl": "a.tmj?v='+'2'*64+'"}').encode()),
 'wrongBasename': rejected('maps/a.wam', ('{"mapUrl": "b.tmj?v='+'1'*64+'"}').encode()),
 'nonHexToken': rejected('maps/a.wam', ('{"mapUrl": "a.tmj?v='+'G'*64+'"}').encode()),
 'malformedJson': rejected('maps/a.wam', b'{"mapUrl": "a.tmj?v='+b'1'*64),
 'badNewPin': rejected('maps/a.wam', ('{"mapUrl": "a.tmj?v='+'1'*64+'"}').encode(), 'ABC'),
 'nestedOnlyIgnored': rejected('maps/a.wam', ('{"mapUrl": "a.tmj?v='+'1'*64+'", "nested": {"mapUrl": "a.tmj?v='+'2'*64+'"}}').encode()),
}
print(json.dumps(cases))
`);
  expect(result).toEqual({ noMapUrl: true, noToken: true, twoTokensInOneUrl: true, twoMapUrlKeys: true, wrongBasename: true, nonHexToken: true, malformedJson: true, badNewPin: true, nestedOnlyIgnored: false });
});

it('plans migrations only for paired live WAMs whose pin differs from the final TMJ', () => {
  const result = python(`
import sys,json,hashlib,tempfile,pathlib
sys.path.insert(0,'ops')
from migrate_wam_tokens import migrate
from release_upload import wam_reference
def wam(name,pin): return ('{"mapUrl": "'+name+'.tmj?v='+pin+'", "entities": ["human"]}').encode()
final=hashlib.sha256(b'final').hexdigest()
with tempfile.TemporaryDirectory() as d:
  (pathlib.Path(d)/'maps').mkdir()
  for name in ('a','b'): (pathlib.Path(d)/'maps'/(name+'.tmj')).write_bytes(b'final')
  live={'maps/a.wam':wam('a','0'*64),'maps/b.wam':wam('b',final),'maps/c.wam':wam('c','0'*64),'maps/a.tmj':b'old','assets/x.js':b'x'}
  reviewed,summary=migrate(live,d)
print(json.dumps({'summary':summary,'reviewed':sorted(reviewed),'migratedPin':wam_reference('maps/a.wam',reviewed['maps/a.wam'])[0]==final,'entitiesKept':json.loads(reviewed['maps/a.wam'])['entities']}))
`);
  expect(result).toEqual({ summary: { migrated: ['maps/a.wam'], unchanged: ['maps/b.wam'], missing: ['maps/c.wam'] }, reviewed: ['maps/a.wam'], migratedPin: true, entitiesKept: ['human'] });
});
