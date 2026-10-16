import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('retains the whole live tree, omits paired live WAMs, and limits replacement to reviewed metadata', () => {
  const result = execFileSync('python3', ['-c', `
import sys,json
sys.path.insert(0,'ops')
from release_upload import replacement_files
live={'maps/a.tmj':b'old','maps/a.wam':b'human','maps/preview/a.tmj':b'preview','maps/preview/a.wam':b'preview-human','assets/legacy.js':b'legacy','unpaired.wam':b'orphan'}
release={'maps/a.tmj':b'new','maps/a.wam':b'stale','assets/new.js':b'new'}
p=replacement_files(release,live)
print(json.dumps({k:v.decode() for k,v in p.items()}))
`], { encoding: 'utf8' });
  expect(JSON.parse(result)).toEqual({'maps/a.tmj':'new','maps/preview/a.tmj':'preview','assets/legacy.js':'legacy','assets/new.js':'new','unpaired.wam':'orphan'});
});

it('uses explicitly reviewed new metadata and refuses unexpected reviewed paths', () => {
  const result = execFileSync('python3', ['-c', `
import sys,json
sys.path.insert(0,'ops')
from release_upload import replacement_files
r={'maps/a.tmj':b'new','maps/a.wam':b'source'};b={'maps/a.tmj':b'old','maps/a.wam':b'human'}
p=replacement_files(r,b,{'maps/a.wam':b'human+reviewed'})
rejected=False
try: replacement_files(r,b,{'maps/nope.wam':b'wrong'})
except ValueError: rejected=True
print(json.dumps({'value':p['maps/a.wam'].decode(),'rejected':rejected}))
`], { encoding: 'utf8' });
  expect(JSON.parse(result)).toEqual({value:'human+reviewed',rejected:true});
});

it('accepts exactly the complete twelve-map catalog and rejects incomplete or extra map pairs', () => {
  const result = execFileSync('python3', ['-c', `
import sys,json
sys.path.insert(0,'ops')
from release_upload import validate_release_maps
ids=['overworld','campus-exploration','solar-hall','lunar-hall','fire-district','earth-district','air-district','water-district','orbit-maze','hidden-observatory','nebula-arcade','zodiac-festival-park']
r={f'maps/{i}.{e}':b'x' for i in ids for e in ('tmj','wam')}
validate_release_maps(r,ids)
incomplete=dict(r);incomplete.pop('maps/overworld.wam')
extra=dict(r);extra['maps/legacy.tmj']=b'x';extra['maps/legacy.wam']=b'x'
rejected=[]
for candidate in (incomplete,extra):
 try: validate_release_maps(candidate,ids);rejected.append(False)
 except ValueError: rejected.append(True)
print(json.dumps({'pairs':sum(p.endswith('.tmj') for p in r),'rejected':rejected}))
`], { encoding: 'utf8' });
  expect(JSON.parse(result)).toEqual({ pairs: 12, rejected: [true, true] });
});

it('prepares the complete 33-map release through the actual publisher entry point', () => {
  const result=execFileSync('python3',['-c',`
import sys,json,os,tempfile,pathlib
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path('ops').resolve()))
import release_upload
ids=['overworld','campus-exploration','solar-hall','lunar-hall','fire-district','earth-district','air-district','water-district','orbit-maze','hidden-observatory','nebula-arcade','zodiac-festival-park','shipyard-beach','comet-maze','orbit-playground','constellation-shore','fa-ship','star-garden','moon-cafe','moon-grotto','stargazer-terrace']+['speaker-'+s for s in ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces')]
class Storage:
 def __init__(self,*args): pass
 def download(self,target): return release_upload.zip_bytes({})
with tempfile.TemporaryDirectory() as directory:
 os.chdir(directory)
 pathlib.Path('dist/maps').mkdir(parents=True)
 for i in ids:
  for e in ('tmj','wam'): pathlib.Path('dist/maps/'+i+'.'+e).write_bytes(b'x')
 with patch.object(release_upload,'Storage',Storage),patch.object(sys,'argv',['release_upload','prepare','--plan','plan','--target','candidate']): release_upload.main()
 plan=json.loads(pathlib.Path('plan/plan.json').read_text())
 print(json.dumps({'mapPairs':sum(p.endswith('.tmj') for p in plan['package']),'files':len(plan['package'])}))
`],{encoding:'utf8'});
  expect(JSON.parse(result.trim().split('\n').at(-1)!)).toEqual({mapPairs:33,files:66});
});

it('aborts a changed baseline before upload and checks complete delayed readback', () => {
  const result = execFileSync('python3', ['-c', `
import sys,json
sys.path.insert(0,'ops')
from release_upload import apply_plan,inventory,zip_bytes
class Storage:
 def __init__(self, changed=False): self.sent=0; self.reads=0; self.changed=changed
 def download(self,target):
  self.reads+=1
  return zip_bytes({'a':b'human' if self.changed else (b'new' if self.sent else b'old')})
 def upload(self,target,files): self.sent+=1; return 200
bad=Storage(True); rejected=False
try: apply_plan(bad,'example',inventory({'a':b'old'}),{'a':b'new'},inventory({'a':b'new'}),lambda _:None)
except ValueError: rejected=True
good=Storage(); success=True
try: apply_plan(good,'example',inventory({'a':b'old'}),{'a':b'new'},inventory({'a':b'new'}),lambda _:None)
except ValueError: success=False
print(json.dumps({'rejected':rejected,'badSent':bad.sent,'success':success,'goodSent':good.sent,'reads':good.reads}))
`], { encoding: 'utf8' });
  expect(JSON.parse(result)).toEqual({rejected:true,badSent:0,success:true,goodSent:1,reads:4});
});

it('retired rehearsal entry point refuses before loading credentials or sending a partial ZIP', () => {
  let output = '';
  try { execFileSync('python3',['ops/upload-rehearsal.py'],{encoding:'utf8',stdio:'pipe'}); }
  catch (error) { output = String((error as {stderr?:string}).stderr); }
  expect(output).toContain('Rehearsal upload retired');
  expect(output).not.toContain('Traceback');
});

type TransportReceipt = {
  location: string | null;
  code: number;
  method: string;
  rejected: boolean;
  status: number;
  body?: string;
  requests: { url: string; method: string; dummyAuthorizationPresent: boolean; hostHeaderPresent: boolean }[];
};
const transport = JSON.parse(execFileSync('python3', ['ops/tests/release_transport_harness.py'], { encoding: 'utf8' })) as {
  redirects: TransportReceipt[];
  ordinary: TransportReceipt[];
};

it.each(transport.redirects)('rejects $method $code to $location before any follow-on request', receipt => {
  expect(receipt.rejected).toBe(true);
  expect(receipt.status).toBe(receipt.code);
  expect(receipt.requests).toEqual([{
    url: `https://trusted.example/${receipt.method === 'GET' ? 'download' : 'upload'}`,
    method: receipt.method,
    dummyAuthorizationPresent: true,
    hostHeaderPresent: true,
  }]);
});

it.each(transport.ordinary)('accepts ordinary $method response through the actual selected opener', receipt => {
  expect(receipt.rejected).toBe(false);
  expect(receipt.status).toBe(200);
  expect(receipt.body).toBe('ordinary response');
  expect(receipt.requests).toHaveLength(1);
  expect(receipt.requests[0].dummyAuthorizationPresent).toBe(true);
  expect(receipt.requests[0].hostHeaderPresent).toBe(true);
});
