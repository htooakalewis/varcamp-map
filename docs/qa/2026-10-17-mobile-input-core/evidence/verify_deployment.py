import hashlib,json,pathlib,subprocess,urllib.request
def docker(*args):
    return json.loads(subprocess.check_output(['docker',*args],timeout=20))
root=pathlib.Path('/srv/varcamp')
before=(root/'compose.before-mobile-1a25.json').read_bytes()
after=(root/'compose.yml').read_bytes()
a=json.loads(before); b=json.loads(after)
image='sha256:1a25fe6ae0639fab9e2f365109893c40aca3e79cc4759d9c09c98655aaa3dddb'
assert b['services']['play']['image']==image
b['services']['play']['image']=a['services']['play']['image']
assert a==b
ids=subprocess.check_output(['docker','ps','-aq','--no-trunc','--filter','label=com.docker.compose.project=varcamp'],timeout=15).decode().split()
rows=docker('inspect',*ids)
by={x['Config']['Labels']['com.docker.compose.service']:x for x in rows}
assert len(by)==9
def safe(x):
    return dict(Id=x['Id'],Image=x['Image'],Status=x['State']['Status'],StartedAt=x['State']['StartedAt'],Health=x['State'].get('Health',{}).get('Status'),ComposeProject=x['Config']['Labels'].get('com.docker.compose.project'),ComposeService=x['Config']['Labels'].get('com.docker.compose.service'))
old=json.loads(pathlib.Path('/tmp/varcamp-mobile-core-20261017/runtime-readback-source/mobile-runtime-stopped-verifier-candidate/varcamp-owned-census.json').read_bytes())['rows']
assert all(safe(by[x['ComposeService']])==x for x in old if x['ComposeService']!='play')
p=by['play']; assert p['Image']==image and p['State']['Status']=='running' and p['State']['Health']['Status']=='healthy'
config=docker('compose','--env-file',str(root/'private/environment'),'-f',str(root/'compose.yml'),'config','--format','json')
env=dict(v.split('=',1) for v in p['Config']['Env'])
assert all(env.get(k)==str(v) for k,v in config['services']['play']['environment'].items())
urls=['https://varcamp.3-1-133-135.sslip.io/~/varcamp-demo/maps/overworld.wam','https://varcamp.3-1-133-135.sslip.io/assets/GameManager-CBZPpoD6.js']
http=[]
for url in urls:
    with urllib.request.urlopen(url,timeout=20) as r:
        data=r.read(20*1024*1024); assert r.status==200
        http.append(dict(url=url,status=r.status,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
print(json.dumps(dict(scope='CURRENT_DEPLOYMENT_SMOKE_NOT_DEVICE_ACCEPTANCE',composeOnlyPlayImageChanged=True,beforeSha256=hashlib.sha256(before).hexdigest(),afterSha256=hashlib.sha256(after).hexdigest(),play=safe(p),otherEightUnchanged=True,resolvedEnvironmentMatches=True,http=http),sort_keys=True))
