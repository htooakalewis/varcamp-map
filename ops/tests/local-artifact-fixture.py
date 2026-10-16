"""Real checker and safe-file acquisition against synthetic temporary artifacts."""
import copy
import hashlib
import json
import pathlib
import sys
import tempfile
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import preflight_checks as checks
H = lambda c: c * 64
ID = 'sha256:' + H('3')
BASE = 'thecodingmachine/workadventure-play@sha256:e063ea840b75a26cb740c642ad79fb27c5facfff53fe4e5ba40eb3f50d3f72c0'
SOURCE = '96d43a841766b22418c061744e7ed2aafd9870d3'
TAG = 'varcamp/workadventure-play:oidc-cookie-synthetic'
PATHS = {'src/pusher/services/OpenIDClient.ts': 'eb7cc1c6085b5a89449ecffb276df4c8e1298a22520e6ca77b6b6380ea3869ea', 'src/pusher/controllers/AuthenticateController.ts': '174ef7cf372536a6989e7de8d5f483894a640716093e273cc98d2479ff878062', 'src/pusher/services/TransientOidcCookieOptions.ts': None}
def digest(b): return hashlib.sha256(b).hexdigest()
def setup(root):
 (root/'artifacts').mkdir()
 archive=b'synthetic image archive bytes'; (root/'artifacts/image.tar').write_bytes(archive)
 receipt={'schema':'local-artifact-v1','image':TAG,'imageId':ID,'platform':'linux/arm64','archive':{'file':'artifacts/image.tar','sha256':digest(archive)},'baselineSourceCommit':SOURCE,'baseImage':BASE,'baseImageId':BASE.split('@')[1],'patchSha256':H('4'),'patchBytes':512,'sourceFiles':{p:{'originalSha256':o,'patchedSha256':H('5'),'installedSha256':H('5'),'uid':1000,'gid':1000,'mode':'0644'} for p,o in PATHS.items()},'build':{'dockerfileSha256':H('6'),'contextSha256':H('7'),'contextFiles':{'Dockerfile':H('6'),'cookie.patch':H('4'),'source-files.json':H('9'),**{p:H('5') for p in PATHS}},'toolchain':{'node':'v24.21.0','tsx':'4.22.3','express':'5.2.1','cookie':'0.7.2','openid-client':'5.7.1','typescript':'5.9.3'}},'exportImport':{'beforeImageId':ID,'afterImageId':ID,'archiveSha256':digest(archive)},'composeFixture':{'image':TAG,'configImage':TAG,'imageId':ID,'pullPolicy':'never'}}
 data=(json.dumps(receipt)+'\n').encode();(root/'artifacts/receipt.json').write_bytes(data)
 lock={'image':TAG,'platform':'linux/arm64','identityMode':'local-artifact-v1','imageId':ID,'archive':receipt['archive'],'provenance':{'receiptFile':'artifacts/receipt.json','receiptSha256':digest(data),'baselineSourceCommit':SOURCE,'baseImage':BASE,'patchSha256':H('4')}}
 service={'play':{'image':TAG,'platform':'linux/arm64','pull_policy':'never'}}
 record={'Id':ID,'Os':'linux','Architecture':'arm64','RepoDigests':[]}
 images={TAG:copy.deepcopy(record),ID:copy.deepcopy(record)}
 containers=[{'Image':ID,'Config':{'Image':TAG,'Labels':{'com.docker.compose.project':'varcamp','com.docker.compose.service':'play'}},'State':{'Running':True,'Health':{'Status':'healthy'}}}]
 return lock,receipt,service,images,containers
class LocalArtifactTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=pathlib.Path(self.tmp.name);self.lock,self.receipt,self.services,self.images,self.containers=setup(self.root)
 def api(self,name):
  self.assertTrue(hasattr(checks,name),f'{name}: explicit local artifact contract is not implemented')
  return getattr(checks,name)
 def run_inventory(self):
  locks=self.api('validate_image_locks')([self.lock]);self.api('validate_service_image_locks')(self.services,locks)
  evidence=self.api('acquire_local_evidence')(self.root,self.lock)
  try:checks.check_running_services(self.services,self.containers,self.images,image_locks=locks,local_evidence={TAG:evidence})
  except TypeError:self.fail('checker does not yet support explicit local Play identity')
 def rewrite_receipt(self):
  b=(json.dumps(self.receipt)+'\n').encode();(self.root/'artifacts/receipt.json').write_bytes(b);self.lock['provenance']['receiptSha256']=digest(b)
 def test_exact_local_play_without_fake_repo_digest(self): self.run_inventory()
 def test_missing_local_evidence(self):
  locks=self.api('validate_image_locks')([self.lock])
  with self.assertRaises(ValueError):checks.check_running_services(self.services,self.containers,self.images,image_locks=locks,local_evidence={})
 def test_identity_and_inventory_denials(self):
  for case in ['mutable-tag','stale-container','wrong-reference','wrong-actual-id','expected-amd64','actual-amd64','unhealthy','missing','duplicate','wrong-service']:
   with self.subTest(case=case):
    self.setUp()
    if case=='mutable-tag':self.images[TAG]['Id']='sha256:'+H('8');self.containers[0]['Image']=self.images[TAG]['Id'];self.images[self.images[TAG]['Id']]={**self.images[TAG]}
    elif case=='stale-container':self.containers[0]['Image']='sha256:'+H('8');self.images[self.containers[0]['Image']]={**self.images[ID],'Id':self.containers[0]['Image']}
    elif case=='wrong-reference':self.containers[0]['Config']['Image']='other:tag'
    elif case=='wrong-actual-id':self.images[ID]['Id']='sha256:'+H('8')
    elif case=='expected-amd64':self.images[TAG]['Architecture']='amd64'
    elif case=='actual-amd64':self.images[ID]['Architecture']='amd64'
    elif case=='unhealthy':self.containers[0]['State']['Health']['Status']='unhealthy'
    elif case=='missing':self.containers=[]
    elif case=='duplicate':self.containers.append(copy.deepcopy(self.containers[0]))
    elif case=='wrong-service':self.containers[0]['Config']['Labels']['com.docker.compose.service']='back'
    with self.assertRaises((ValueError,KeyError)):self.run_inventory()
 def test_bad_lock_and_service_modes(self):
  for case in ['missing-mode','unknown-mode','bad-id','bad-hash','duplicate-ref','stock-id','zero-patch','empty-patch','other-service','missing-pull','always-pull']:
   with self.subTest(case=case):
    self.setUp()
    entries=[self.lock]
    if case=='missing-mode':del self.lock['identityMode']
    elif case=='unknown-mode':self.lock['identityMode']='skipDigest'
    elif case=='bad-id':self.lock['imageId']='sha256:bad'
    elif case=='bad-hash':self.lock['archive']['sha256']='BAD'
    elif case=='duplicate-ref':entries.append(copy.deepcopy(self.lock))
    elif case=='stock-id':self.lock['imageId']=BASE.split('@')[1]
    elif case=='zero-patch':self.lock['provenance']['patchSha256']=H('0')
    elif case=='empty-patch':self.lock['provenance']['patchSha256']=''
    elif case=='other-service':self.services={'back':self.services['play']}
    elif case=='missing-pull':del self.services['play']['pull_policy']
    elif case=='always-pull':self.services['play']['pull_policy']='always'
    with self.assertRaises(ValueError):
     locks=self.api('validate_image_locks')(entries);self.api('validate_service_image_locks')(self.services,locks)
 def test_required_real_file_bytes_and_safe_paths(self):
  for case in ['missing-archive','missing-receipt','tampered-archive','tampered-receipt','traversal','absolute','file-symlink','directory-symlink','nonregular','verified-flag-only']:
   with self.subTest(case=case):
    self.setUp()
    if case=='missing-archive':(self.root/'artifacts/image.tar').unlink()
    elif case=='missing-receipt':(self.root/'artifacts/receipt.json').unlink()
    elif case=='tampered-archive':(self.root/'artifacts/image.tar').write_bytes(b'changed')
    elif case=='tampered-receipt':(self.root/'artifacts/receipt.json').write_bytes(b'{}')
    elif case=='traversal':self.lock['archive']['file']='artifacts/../image.tar'
    elif case=='absolute':self.lock['archive']['file']='/tmp/image.tar'
    elif case=='file-symlink':(self.root/'artifacts/image.tar').unlink();(self.root/'artifacts/image.tar').symlink_to(self.root/'artifacts/receipt.json')
    elif case=='directory-symlink':(self.root/'artifacts').rename(self.root/'elsewhere');(self.root/'artifacts').symlink_to(self.root/'elsewhere',target_is_directory=True)
    elif case=='nonregular':(self.root/'artifacts/image.tar').unlink();(self.root/'artifacts/image.tar').mkdir()
    elif case=='verified-flag-only':(self.root/'artifacts/image.tar').unlink();self.lock['verified']=True
    with self.assertRaises((ValueError,OSError)):self.api('acquire_local_evidence')(self.root,self.lock)
 def test_provenance_mismatch_even_with_rehashed_receipt(self):
  for case in ['id','platform','archive','source','base','patch','empty-patch','missing-source','installed-source','original-source','ownership','dockerfile','context','toolchain','import','compose']:
   with self.subTest(case=case):
    self.setUp()
    if case=='id':self.receipt['imageId']='sha256:'+H('8')
    elif case=='platform':self.receipt['platform']='linux/amd64'
    elif case=='archive':self.receipt['archive']['sha256']=H('8')
    elif case=='source':self.receipt['baselineSourceCommit']='8'*40
    elif case=='base':self.receipt['baseImage']='stock@sha256:'+H('8')
    elif case=='patch':self.receipt['patchSha256']=H('8')
    elif case=='empty-patch':self.receipt['patchBytes']=0
    elif case=='missing-source':self.receipt['sourceFiles']={}
    elif case=='installed-source':next(iter(self.receipt['sourceFiles'].values()))['installedSha256']=H('8')
    elif case=='original-source':next(iter(self.receipt['sourceFiles'].values()))['originalSha256']=H('8')
    elif case=='ownership':next(iter(self.receipt['sourceFiles'].values()))['uid']=0
    elif case=='dockerfile':self.receipt['build']['dockerfileSha256']=''
    elif case=='context':self.receipt['build']['contextFiles']={}
    elif case=='toolchain':self.receipt['build']['toolchain']['tsx']='0'
    elif case=='import':self.receipt['exportImport']['afterImageId']='sha256:'+H('8')
    elif case=='compose':self.receipt['composeFixture']['configImage']='other:tag'
    self.rewrite_receipt()
    with self.assertRaises(ValueError):self.run_inventory()
 def test_stock_repo_digest_checks_remain_strict(self):
  ref='example/stock@sha256:'+H('1');imageid='sha256:'+H('2');services={'back':{'image':ref}}
  record={'Id':imageid,'Os':'linux','Architecture':'arm64','RepoDigests':[ref]};images={ref:copy.deepcopy(record),imageid:copy.deepcopy(record)};containers=copy.deepcopy(self.containers);containers[0]['Image']=imageid;containers[0]['Config']['Image']=ref;containers[0]['Config']['Labels']['com.docker.compose.service']='back'
  checks.check_running_services(services,containers,images)
  for key in [ref,imageid]:
   with self.subTest(key=key):
    bad=copy.deepcopy(images);bad[key]['RepoDigests']=[]
    with self.assertRaises(ValueError):checks.check_running_services(services,containers,bad)
if __name__=='__main__':unittest.main()
