"""Exercise the actual release guard against genuine before-room WAMs."""
from pathlib import Path
import copy,hashlib,json,sys
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'ops'))
import release_upload as publisher
fixture=(root/'tests/fixtures/speaker-presentation/before-wams.json').read_bytes()
assert hashlib.sha256(fixture).hexdigest()=='472673071ae2ce517a25cc5a3cacb10a288e6277bb57f91cb33ccaa7af499b00'
rooms=json.loads(fixture)['rooms'];passed=[]
encode=lambda d:(json.dumps(d,indent=2,ensure_ascii=False)+'\n').encode()
for id,raw in rooms.items():
 sign=id[8:];path='maps/'+id+'.wam';old=json.loads(raw);old['mapUrl']=id+'.tmj?v='+'a'*64
 old['settings']={'owner-setting':True};old['metadata']['owner-note']={'enabled':True};old['vendor']={'keep':[1,True,'1']}
 old['entities']['owner-decoration']={'x':96,'y':96,'prefabRef':{'collectionName':'Office','id':'lamp'}}
 old['areas'][0]['owner-stage-note']={'retain':True}
 old['areas'].append({'id':'owner-quiet','name':'Owner quiet','visible':True,'x':32,'y':896,'width':32,'height':32,'properties':[{'id':'owner-silent','type':'silent'}]})
 before=copy.deepcopy(old);candidate=copy.deepcopy(old);new=json.loads((root/path).read_text())
 stage=next(a for a in new['areas'] if a['id']=='meeting-'+sign);aud=next(a for a in new['areas'] if a['id']==sign+'-audience')
 candidate['areas']=[dict(a,**stage) if a['id']=='meeting-'+sign else a for a in candidate['areas']];candidate['areas'].append(aud)
 tmj=(root/('maps/'+id+'.tmj')).read_bytes();candidate['mapUrl']=id+'.tmj?v='+hashlib.sha256(tmj).hexdigest()
 release={path:encode(new),'maps/'+id+'.tmj':tmj};baseline={path:encode(old),'maps/'+id+'.tmj':b'old'}
 def accept(d,base=None):return publisher.wam_dependencies(release,baseline if base is None else {**baseline,path:encode(base)},{path:encode(d)})
 result=accept(candidate);assert result[path]['migration']=='speaker-presentation-v1';assert old==before
 passed.append(id+':owner-data-retained')
 legacy=copy.deepcopy(old);legacy['mapUrl']=candidate['mapUrl'];assert 'migration' not in accept(legacy)[path];passed.append(id+':token-only')
 for kind in ['metadata','entity','extra-area','beacon','talking','reference','stage-size','missing-audience','new-settings','owner-bool-number','listener-bool-number','unknown-stage-field']:
  bad=copy.deepcopy(candidate)
  if kind=='metadata':bad['metadata']['owner-note']['enabled']=False
  if kind=='entity':bad['entities'].clear()
  if kind=='extra-area':bad['areas'].pop(-2)
  if kind=='beacon':next(a for a in bad['areas'] if a['id']=='beacon-'+sign)['x']+=32
  if kind=='talking':bad['areas'][-1]['properties'][0]['allowTalking']=True
  if kind=='reference':bad['areas'][-1]['properties'][0]['speakerZoneName']='varcamp-'+sign+'-talk'
  if kind=='stage-size':bad['areas'][0]['width']-=32
  if kind=='missing-audience':bad['areas'].pop()
  if kind=='new-settings':bad['settings']['new']=True
  if kind=='owner-bool-number':bad['metadata']['owner-note']['enabled']=1
  if kind=='listener-bool-number':bad['areas'][-1]['properties'][0]['allowTalking']=0
  if kind=='unknown-stage-field':bad['areas'][0].pop('owner-stage-note')
  try:accept(bad)
  except ValueError:pass
  else:raise AssertionError('Accepted '+id+'/'+kind)
  passed.append(id+':reject-'+kind)
 for kind in ['source-bool-number','missing-meeting','duplicate-meeting','custom-geometry','custom-rights','audience-id-collision','audience-name-collision','listener-property-collision','stage-property-collision','broadcast-owner-collision']:
  bad=copy.deepcopy(old)
  if kind=='source-bool-number':bad['areas'][0]['properties'][0]['livekitRoomConfig']['startWithAudioMuted']=1
  if kind=='missing-meeting':bad['areas'].pop(0)
  if kind=='duplicate-meeting':bad['areas'].append(copy.deepcopy(bad['areas'][0]))
  if kind=='custom-geometry':bad['areas'][0]['x']+=32
  if kind=='custom-rights':bad['areas'][0]['properties'].append({'id':'owner-rights','type':'silent'})
  if kind=='audience-id-collision':bad['areas'][-1]['id']=sign+'-audience'
  if kind=='audience-name-collision':bad['areas'][-1]['name']=sign.capitalize()+' listening area'
  if kind=='listener-property-collision':bad['areas'][-1]['properties'][0]['id']=sign+'-listener'
  if kind=='stage-property-collision':bad['areas'][-1]['properties'][0]['id']=sign+'-stage-broadcast'
  if kind=='broadcast-owner-collision':bad['areas'][-1]['properties']=[{'id':'owner-speaker','type':'speakerMegaphone','name':'varcamp-'+sign+'-talk'}]
  assert publisher.speaker_presentation_wam_candidate(path,bad) is None,kind
  try:accept(candidate,bad)
  except ValueError:pass
  else:raise AssertionError('Accepted old '+id+'/'+kind)
  passed.append(id+':reject-'+kind)
 for kind in ['duplicate-area-name','duplicate-area-id','duplicate-independent-property','duplicate-independent-owner']:
  bad=copy.deepcopy(old)
  extra=copy.deepcopy(bad['areas'][-1]);extra['id']='owner-second';extra['name']='Owner second';extra['properties'][0]['id']='owner-second-silent'
  if kind=='duplicate-area-name':extra['name']='meeting-'+sign
  if kind=='duplicate-area-id':extra['id']='beacon-'+sign
  if kind=='duplicate-independent-property':extra['properties'][0]['id']='owner-silent'
  if kind=='duplicate-independent-owner':
   bad['areas'][-1]['properties']=[{'id':'owner-broadcast','type':'speakerMegaphone','name':'owner-private'}]
   extra['properties']=[{'id':'owner-second-broadcast','type':'speakerMegaphone','name':'owner-private'}]
  bad['areas'].append(extra)
  assert publisher.speaker_presentation_wam_candidate(path,bad) is None,kind
  passed.append(id+':reject-'+kind)
 original_file=publisher.__file__
 try:
  publisher.__file__='/nonexistent/copied-publisher/ops/release_upload.py'
  try:accept(candidate)
  except ValueError:pass
  else:raise AssertionError('Accepted missing revision files')
 finally:publisher.__file__=original_file
 passed.append(id+':missing-revision')
print(json.dumps({'maps':list(rooms),'cases':len(passed)}))
