import copy,hashlib,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'ops'))
import release_upload as publisher
from release_upload import wam_dependencies, aries_presentation_wam_candidate, is_aries_presentation_wam_change
old=json.loads((root/'tests/fixtures/aries-presentation/before.wam').read_text())
old['mapUrl']='speaker-aries.tmj?v='+'a'*64
old['settings']={'owner-setting':True}
old['vendor']={'keep':{'nested':['true',True,1]}}
old['areas'][0]['owner-stage-note']={'keep':True}
old['entities']['owner-decoration']={'x':96,'y':96,'prefabRef':{'collectionName':'Office','id':'lamp'},'vendor':{'keep':[1,2,3]}}
old['metadata']['owner-note']={'text':'retain this','enabled':True}
old['areas'].append({'id':'owner-quiet','name':'Owner quiet corner','visible':True,'x':32,'y':896,'width':32,'height':32,'properties':[{'id':'owner-silent','type':'silent'}]})
before=copy.deepcopy(old);candidate=copy.deepcopy(old)
new=json.loads((root/'maps/speaker-aries.wam').read_text())
candidate['areas']=[dict(a,**new['areas'][0]) if a['id']=='meeting-aries' else a for a in candidate['areas']]
candidate['areas'].append(new['areas'][-1]);tmj=(root/'maps/speaker-aries.tmj').read_bytes();pin=hashlib.sha256(tmj).hexdigest();candidate['mapUrl']='speaker-aries.tmj?v='+pin
encode=lambda d:(json.dumps(d,indent=2,ensure_ascii=False)+'\n').encode()
baseline={'maps/speaker-aries.wam':encode(old),'maps/speaker-aries.tmj':b'old map'}
release={'maps/speaker-aries.wam':encode(new),'maps/speaker-aries.tmj':tmj}
def accept(d):return wam_dependencies(release,baseline,{'maps/speaker-aries.wam':encode(d)})
deps=accept(candidate)
assert deps['maps/speaker-aries.wam'].get('migration')=='aries-presentation-v1'
assert old==before,'validation mutated its input'
cases=['metadata','entity','extra-area','old-beacon','talking','reference','stage-size','missing-audience','unowned-setting','owner-bool-number','listener-bool-number']
for kind in cases:
 bad=copy.deepcopy(candidate)
 if kind=='metadata':bad['metadata']['owner-note']['enabled']=False
 if kind=='entity':bad['entities'].clear()
 if kind=='extra-area':bad['areas']=[a for a in bad['areas'] if a['id']!='owner-quiet']
 if kind=='old-beacon':next(a for a in bad['areas'] if a['id']=='beacon-aries')['x']+=32
 if kind=='talking':bad['areas'][-1]['properties'][0]['allowTalking']=True
 if kind=='reference':bad['areas'][-1]['properties'][0]['speakerZoneName']='varcamp-aries-talk'
 if kind=='stage-size':bad['areas'][0]['width']-=32
 if kind=='missing-audience':bad['areas'].pop()
 if kind=='unowned-setting':bad['settings']={'new-setting':True}
 if kind=='owner-bool-number':bad['metadata']['owner-note']['enabled']=1
 if kind=='listener-bool-number':bad['areas'][-1]['properties'][0]['allowTalking']=0
 try:accept(bad)
 except ValueError:pass
 else:raise AssertionError('Accepted unreviewed '+kind)
legacy=copy.deepcopy(old);legacy['mapUrl']=candidate['mapUrl'];token=accept(legacy)
assert 'migration' not in token['maps/speaker-aries.wam']
bad_old=copy.deepcopy(old);bad_old['areas'][0]['properties'][0]['livekitRoomConfig']['startWithAudioMuted']=1
bad_baseline={**baseline,'maps/speaker-aries.wam':encode(bad_old)}
try:wam_dependencies(release,bad_baseline,{'maps/speaker-aries.wam':encode(candidate)})
except ValueError:pass
else:raise AssertionError('Accepted a numeric old-owned boolean')
# report below
# print(json.dumps({'passedCases':['preserves-existing-owner-data','token-only-still-supported',*cases],'count':len(cases)+2}))

extra=[]
assert not is_aries_presentation_wam_change('maps/speaker-taurus.wam',encode(old),encode(candidate))
extra.append('wrong-path')
for kind in ['missing-meeting','duplicate-meeting','custom-owned-geometry','custom-owned-rights','audience-id-collision','audience-name-collision','listener-property-id-collision','stage-property-id-collision','broadcast-owner-collision']:
 bad=copy.deepcopy(old)
 if kind=='missing-meeting':bad['areas']=[a for a in bad['areas'] if a['id']!='meeting-aries']
 if kind=='duplicate-meeting':bad['areas'].append(copy.deepcopy(bad['areas'][0]))
 if kind=='custom-owned-geometry':bad['areas'][0]['x']+=32
 if kind=='custom-owned-rights':bad['areas'][0]['properties'].append({'id':'owner-rights','type':'areaDescription','description':'custom'})
 if kind=='audience-id-collision':bad['areas'].append({'id':'aries-audience','name':'different-owner-area'})
 if kind=='audience-name-collision':bad['areas'].append({'id':'owner-listen','name':'Aries listening area'})
 if kind=='listener-property-id-collision':bad['areas'][-1]['properties'][0]['id']='aries-listener'
 if kind=='stage-property-id-collision':bad['areas'][-1]['properties'][0]['id']='aries-stage-broadcast'
 if kind=='broadcast-owner-collision':bad['areas'][-1]['properties']=[{'id':'owner-speaker','type':'speakerMegaphone','name':'varcamp-aries-talk','chatEnabled':False,'seeAttendees':False}]
 assert aries_presentation_wam_candidate(bad) is None,kind
 try:wam_dependencies(release,{**baseline,'maps/speaker-aries.wam':encode(bad)},{'maps/speaker-aries.wam':encode(candidate)})
 except ValueError:pass
 else:raise AssertionError('Accepted old '+kind)
 extra.append(kind)
original_file=publisher.__file__
try:
 publisher.__file__='/nonexistent/copied-publisher/ops/release_upload.py'
 assert aries_presentation_wam_candidate(old) is None
 assert not is_aries_presentation_wam_change('maps/speaker-aries.wam',encode(old),encode(candidate))
finally:publisher.__file__=original_file
extra.append('missing-revision-files')
passed=['preserves-existing-owner-data','token-only-still-supported',*cases,'old-source-bool-number',*extra]
print(json.dumps({'passedCases':passed,'count':len(passed)}))
