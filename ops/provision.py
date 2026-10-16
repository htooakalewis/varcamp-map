"""Create private initial inputs once. Never print values or overwrite existing secrets."""
import json, os, pathlib, secrets, sys
ops=pathlib.Path(__file__).resolve().parent
private=ops/'private'
if private.exists(): raise SystemExit('Private provisioning already exists; refusing to rotate secrets implicitly')
inputs=json.load(open(sys.argv[1]))
private.mkdir(mode=0o700)
os.umask(0o077)
env=dict(line.split('=',1) for line in (ops/'.env.example').read_text().splitlines() if line and not line.startswith('#'))
for k in ['SECRET_KEY','MAP_STORAGE_API_TOKEN','ROOM_API_SECRET_KEY','OPENID_CLIENT_SECRET','POSTGRES_PASSWORD','BOOTSTRAP_ADMIN_PASSWORD','UPLOAD_PASSWORD']: env[k]=secrets.token_hex(32)
env['ORGANISER_EMAIL']=inputs['organiserEmail'];env['ACME_EMAIL']=inputs['acmeEmail']
(private/'environment').write_text(''.join(k+'='+v+'\n' for k,v in env.items()))
password=secrets.token_urlsafe(28)
(private/'organiser-credentials.json').write_text(json.dumps({'username':'organiser','email':inputs['organiserEmail'],'password':password}))
realm=json.load(open(ops/'keycloak/realm.template.json'));client=realm['clients'][0]
client.update(secret=env['OPENID_CLIENT_SECRET'],rootUrl='https://'+env['PLAY_HOST'],baseUrl='https://'+env['PLAY_HOST'],redirectUris=['https://'+env['PLAY_HOST']+'/openid-callback'],webOrigins=['https://'+env['PLAY_HOST']])
client['attributes']['post.logout.redirect.uris']='https://'+env['PLAY_HOST']+'/logout-callback'
realm['users']=[{'username':'organiser','enabled':True,'email':inputs['organiserEmail'],'emailVerified':True,'firstName':'VarCamp','lastName':'Organiser','attributes':{'wa_tags':['organizer']},'credentials':[{'type':'password','value':password,'temporary':False}],'clientRoles':{'realm-management':['realm-admin']}}]
(private/'realm.json').write_text(json.dumps(realm))
t=json.load(open(ops/'traefik/traefik.yml'));t['certificatesResolvers']['letsencrypt']['acme']['email']=inputs['acmeEmail'];(private/'traefik.yml').write_text(json.dumps(t))
print('Private inputs created with mode0600; no values emitted.')
