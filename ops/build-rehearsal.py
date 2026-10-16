"""Temporary Aries QA export only, never a nine-map world build."""
import copy,json,pathlib,shutil,zipfile
root=pathlib.Path(__file__).resolve().parent.parent
out=root/'ops/rehearsal';out.mkdir(exist_ok=True)
m=json.load(open(root/'docs/qa/samples/aries.tmj'));placements=json.load(open(root/'docs/qa/samples/aries-placements.json'))
catalog=json.load(open(root/'art/tile-catalog.json'));catalog=catalog.get('sprites',catalog)
for tileset in m['tilesets']:
 source=(root/'docs/qa/samples'/tileset['image']).resolve();dest=out/'assets'/source.name;dest.parent.mkdir(exist_ok=True);shutil.copy2(source,dest);tileset['image']='assets/'+source.name
# Keep the original drawing order and put avatars above floor/walls, below furnished props.
floorIndex=next(i for i,l in enumerate(m['layers']) if l['name']=='lectern')
m['layers'].insert(floorIndex,{'name':'floorLayer','type':'objectgroup','objects':[],'visible':True,'opacity':1,'x':0,'y':0})
first=max(t['firstgid']+t['tilecount'] for t in m['tilesets'])
t=copy.deepcopy(m['tilesets'][0]);t.update(firstgid=first,name='rehearsal-collision-mask',tiles=[{'id':0,'properties':[{'name':'collides','type':'bool','value':True}]}]);m['tilesets'].append(t)
data=[0]*(m['width']*m['height'])
for p in placements['placements']:
 for dx,dy in catalog[p['id']]['blockingCells']:
  x,y=p['x']+dx,p['y']+dy
  if 0<=x<m['width'] and 0<=y<m['height']:data[y*m['width']+x]=first
start=[0]*len(data);start[16*m['width']+11]=m['tilesets'][0]['firstgid'];assert data[16*m['width']+11]==0
for name,cells in [('start',start),('rehearsal-collisions',data)]:m['layers'].append({'name':name,'type':'tilelayer','width':m['width'],'height':m['height'],'data':cells,'visible':False,'opacity':1,'x':0,'y':0})
# WorkAdventure/Phaser resolves render layers by flattened name, not numeric Tiled ID.
counts={}
for l in m['layers']:counts[l['name']]=counts.get(l['name'],0)+1
for i,l in enumerate(m['layers']):
 l['id']=i+1
 if counts[l['name']]>1:l['name']=l['name']+'--placement-'+str(l['id'])
m['nextlayerid']=len(m['layers'])+1;m['properties']=[{'name':'mapName','type':'string','value':'CORE REHEARSAL — temporary Aries QA sample'}]
(out/'core-rehearsal.tmj').write_text(json.dumps(m))
(out/'core-rehearsal.wam').write_text(json.dumps({'version':'2.1.0','mapUrl':'core-rehearsal.tmj','entities':{},'areas':[],'entityCollections':[],'metadata':{'name':'CORE REHEARSAL — temporary Aries QA sample','description':'Temporary core/identity verification sample. No event release, broadcast or capacity acceptance.'}}))
shutil.copytree(root/'assets/tilesets',out/'licenses',dirs_exist_ok=True,ignore=shutil.ignore_patterns('*.png'));shutil.copy2(root/'art/sources.json',out/'asset-sources.json')
with zipfile.ZipFile(root/'ops/rehearsal.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in out.rglob('*'):
  if f.is_file():z.write(f,f.relative_to(out))
print('Temporary rehearsal ZIP built, no production world claim.')
