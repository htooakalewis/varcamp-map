import {execFileSync} from 'node:child_process';
import {expect,it} from 'vitest';
const run=(body:string)=>JSON.parse(execFileSync('python3',['-c',`
import sys,json,copy
sys.path.insert(0,'ops')
from redraw_wams import migrate_wams
def area(name,x=1):return {'id':name,'name':name,'visible':True,'x':x,'y':32,'width':64,'height':64,'properties':[{'id':'live-right','type':'silent','silent':True}]}
def wam(areas,**extras):return json.dumps(dict(version='1.0.0',mapUrl='scene.tmj',entities={},areas=areas,entityCollections=[],**extras)).encode()
${body}
`],{encoding:'utf8'}));
it('preserves fresh live properties, IDs and metadata while adopting reviewed area geometry',()=>{
 expect(run(`
live={'maps/campus-exploration.wam':wam([dict(area('garden-conversation'),id='campus-exploration-area-0')],metadata={'name':'Human title'},vendor={'custom':True}),'maps/overworld.wam':wam([area('welcome-directory')],metadata={'name':'Welcome'},settings={'recording':{'rights':['staff']}})}
release={'maps/campus-exploration.wam':wam([]),'maps/overworld.wam':wam([dict(area('welcome-directory',96),properties=[])]),'maps/star-garden.wam':wam([dict(area('garden-conversation',160),properties=[])])}
before=copy.deepcopy(live);out,report=migrate_wams(live,release)
g=json.loads(out['maps/star-garden.wam']);o=json.loads(out['maps/overworld.wam']);c=json.loads(out['maps/campus-exploration.wam'])
print(json.dumps({'garden':g['areas'][0],'settings':o.get('settings'),'welcomeX':o['areas'][0]['x'],'metadata':c.get('metadata'),'vendor':c.get('vendor'),'immutable':live==before,'moves':len(report)}))
`)).toEqual({garden:{id:'campus-exploration-area-0',name:'garden-conversation',visible:true,x:160,y:32,width:64,height:64,properties:[{id:'live-right',type:'silent',silent:true}]},settings:{recording:{rights:['staff']}},welcomeX:96,metadata:{name:'Human title'},vendor:{custom:true},immutable:true,moves:2});
});
it.each(['unknown-area','entity','missing-map','duplicate-name','duplicate-id'])('aborts unreviewed live state: %s',mode=>{
 expect(run(`
mode=${JSON.stringify(mode)}
live={'maps/overworld.wam':wam([area('welcome-directory')])};release={'maps/overworld.wam':wam([area('welcome-directory',96)])}
if mode=='unknown-area':live['maps/overworld.wam']=wam([area('human-area')])
if mode=='entity':
 d=json.loads(live['maps/overworld.wam']);d['entities']={'human':{'x':100,'y':100}};live['maps/overworld.wam']=json.dumps(d).encode()
if mode=='missing-map':release={}
if mode=='duplicate-name':release['maps/overworld.wam']=wam([area('welcome-directory'),dict(area('welcome-directory'),id='other')])
if mode=='duplicate-id':release['maps/overworld.wam']=wam([area('welcome-directory'),dict(area('another'),id='welcome-directory')])
rejected=False
try:migrate_wams(live,release)
except ValueError:rejected=True
print(json.dumps(rejected))
`)).toBe(true);
});
it('moves a zodiac discovery into its own room without moving unrelated district properties',()=>{
 expect(run(`
live={'maps/fire-district.wam':wam([area('beacon-aries'),area('sigil-fire')])};release={'maps/fire-district.wam':wam([dict(area('sigil-fire',160),properties=[])]),'maps/speaker-aries.wam':wam([dict(area('beacon-aries',320),properties=[])])}
out,report=migrate_wams(live,release)
print(json.dumps({'x':json.loads(out['maps/speaker-aries.wam'])['areas'][0]['x'],'properties':json.loads(out['maps/speaker-aries.wam'])['areas'][0]['properties'],'sigil':json.loads(out['maps/fire-district.wam'])['areas'][0]['x'],'moves':len(report)}))
`)).toEqual({x:320,properties:[{id:'live-right',type:'silent',silent:true}],sigil:160,moves:2});
});
