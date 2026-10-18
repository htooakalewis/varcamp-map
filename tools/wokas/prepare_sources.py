"""Isolate original generated poses without painting or inventing missing art.

Subject components use alpha>128. Detached components of at least3source pixels
within32pixels of the subject box are kept. The two-pixel source fringe retains
original RGBA samples, except opaque pixels belonging to a different subject.
Each crop and binary source-selection mask is retained for exact review.
"""
from pathlib import Path
from PIL import Image,ImageFilter,ImageChops
import hashlib,json
from fractions import Fraction
ROOT=Path(__file__).resolve().parents[2]
SIGNS=('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def connected(im):
 w,h=im.size;raw=im.getchannel('A').point(lambda p:255 if p>128 else 0).tobytes();parent=[];spans=[];prev=[]
 def find(i):
  while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
  return i
 def union(a,b):
  a,b=find(a),find(b)
  if a!=b:parent[b]=a
 for y in range(h):
  now=[];start=None
  for x in range(w+1):
   v=x<w and raw[y*w+x]
   if v and start is None:start=x
   if not v and start is not None:
    i=len(parent);parent.append(i);now.append((start,x,i));spans.append((start,y,x,i));start=None
  j=0
  for s,e,i in now:
   while j<len(prev) and prev[j][1]<s:j+=1
   k=j
   while k<len(prev) and prev[k][0]<=e:union(i,prev[k][2]);k+=1
  prev=now
 groups={}
 for x,y,xx,i in spans:groups.setdefault(find(i),[]).append((x,y,xx))
 out=[]
 for lines in groups.values():
  out.append({'lines':lines,'pixels':sum(xx-x for x,y,xx in lines),'bbox':[min(x for x,y,xx in lines),min(y for x,y,xx in lines),max(xx for x,y,xx in lines),max(y for x,y,xx in lines)+1]})
 return out

def isolate(im,sign,centers=None,keep_rows=None,columns=3):
 parts=connected(im);all_major=[p for p in parts if p['pixels']>500]
 centers=centers or [160,390,620,860,1120,1370,1620,1870]
 keep_rows=set(range(len(centers))) if keep_rows is None else set(keep_rows)
 major=[]
 for p in all_major:
  b=p['bbox'];row=min(range(len(centers)),key=lambda r:abs((b[1]+b[3])/2-centers[r]))
  if row in keep_rows:major.append(p)
 grouped={}
 for p in major:
  b=p['bbox'];row=min(range(len(centers)),key=lambda r:abs((b[1]+b[3])/2-centers[r]));grouped.setdefault(row,[]).append(p)
 if set(grouped)!=keep_rows or any(len(v)!=columns for v in grouped.values()):raise ValueError(f'{sign}: unexpected or joined source subjects; explicit original repair required')
 keys=[r*columns+c for r in sorted(keep_rows) for c in range(columns)]
 order=[p for r in sorted(keep_rows) for p in sorted(grouped[r],key=lambda p:p['bbox'][0])]
 selected=[[] for _ in order]
 for p in parts:
  if p['pixels']<3:continue
  if any(p is q for q in all_major):
   matches=[i for i,q in enumerate(order) if p is q]
   if matches:selected[matches[0]].append(p)
   continue
  b=p['bbox']
  def distance(q):
   a=q['bbox'];dx=max(a[0]-b[2],b[0]-a[2],0);dy=max(a[1]-b[3],b[1]-a[3],0);return dx*dx+dy*dy,abs((b[0]+b[2])-(a[0]+a[2]))+abs((b[1]+b[3])-(a[1]+a[3]))
  i=min(range(len(order)),key=lambda i:distance(order[i]));d=distance(order[i])[0]
  if d<=32*32:selected[i].append(p)
 results={}
 for i,groups in enumerate(selected):
  mask=Image.new('L',im.size);pix=mask.load()
  for p in groups:
   for x,y,xx in p['lines']:
    for j in range(x,xx):pix[j,y]=255
  mask=mask.filter(ImageFilter.MaxFilter(5));pix=mask.load()
  for p in all_major:
   if p is not order[i]:
    for x,y,xx in p['lines']:
     for k in range(x,xx):pix[k,y]=0
  alpha=ImageChops.multiply(im.getchannel('A'),mask);box=alpha.getbbox()
  if box is None:raise ValueError('Empty source subject')
  results[keys[i]]=(box,mask.crop(box),len(groups)-1)
 return results

def main():
 masters=json.loads((ROOT/'art/source/wokas/masters.json').read_bytes());recipe={'version':1,'format':{'sheet':[96,128],'frame':[32,32],'rows':['down','left','right','up'],'footBaseline':30,'maxSubjectSize':28},'characters':[]}
 direction_repairs=json.loads((ROOT/'art/source/wokas/direction-repairs.json').read_bytes())['repairs']
 if [(r['sign'],r['gender'],r['targetFrame'],r['direction']) for r in direction_repairs]!=[('leo','male',5,'left'),('capricorn','male',5,'left')]:raise ValueError('Unexpected reviewed direction-repair roster')
 direction_repairs={r['sign']:r for r in direction_repairs}
 for asset in masters['assets']:
  sign=asset['sign'];raw=(ROOT/asset['source']).read_bytes()
  if sha(raw)!=asset['sha256']:raise ValueError('Original master body changed')
  im=Image.open(ROOT/asset['source']).convert('RGBA')
  replacement_units={}
  if sign=='leo':
   frames=isolate(im,sign,[110,330,550,770,996,1220,1440,1660],[0,1,2,3,6,7])
   repair_path='art/source/wokas/leo-female-down-left-repair.png';repair_raw=(ROOT/repair_path).read_bytes();repair=Image.open(ROOT/repair_path).convert('RGBA')
   fixed=isolate(repair,'leo-female-down-left-repair',[300,750])
   replacements={12+i:(fixed[i],repair_path,sha(repair_raw),i) for i in range(6)}
   repair_height=max(fixed[i][0][3]-fixed[i][0][1] for i in range(6))
   replacement_units.update({12+i:Fraction(224,repair_height) for i in range(6)})
  else:frames=isolate(im,sign);replacements={}
  if sign in direction_repairs:
   declaration=direction_repairs[sign];repair_path=declaration['source'];repair_raw=(ROOT/repair_path).read_bytes()
   if len(repair_raw)!=declaration['bytes'] or sha(repair_raw)!=declaration['sha256']:raise ValueError('Reviewed direction-repair master body changed')
   repair=Image.open(ROOT/repair_path).convert('RGBA')
   if list(repair.size)!=declaration['sourceSize']:raise ValueError('Reviewed direction-repair master dimensions changed')
   fixed_pose=isolate(repair,sign+'-male-left-third',[repair.height//2],columns=1)[0]
   source_index=asset['maleFrameSourceOrder'][declaration['targetFrame']]
   original_box=frames[source_index][0]
   if original_box[3]-original_box[1]!=declaration['originalSourceHeight']:raise ValueError('Original direction-repair scale anchor changed')
   replacements[source_index]=(fixed_pose,repair_path,sha(repair_raw),0)
   replacement_units[source_index]=Fraction(declaration['originalSourceHeight'],fixed_pose[0][3]-fixed_pose[0][1])
  for gender in ('male','female'):
   order=asset[gender+'FrameSourceOrder'];subject=[replacements[i][0] if i in replacements else frames[i] for i in order]
   denom=max(Fraction(max(b[2]-b[0],b[3]-b[1]))*replacement_units.get(i,1) for i,(b,_,_) in zip(order,subject))
   row={'id':f'varcamp-zodiac-v1-{sign}-{gender}','sign':sign,'gender':gender,'uniformScale':[(Fraction(28,1)/denom).numerator,(Fraction(28,1)/denom).denominator],'frames':[]}
   for target,source_index in enumerate(order):
    if source_index in replacements:
     (box,mask,detached),source,source_sha,repair_index=replacements[source_index]
    else:(box,mask,detached),source,source_sha,repair_index=frames[source_index],asset['source'],asset['sha256'],None
    path=f'art/source/wokas/masks/{sign}-{gender}-{target:02d}.png';(ROOT/path).parent.mkdir(parents=True,exist_ok=True);mask.save(ROOT/path)
    unit_scale=replacement_units.get(source_index,Fraction(1,1))
    row['frames'].append({'targetFrame':target,'sourceFrame':source_index,'source':source,'sourceSha256':source_sha,'replacementSourceFrame':repair_index,'crop':list(box),'mask':path,'maskSha256':sha((ROOT/path).read_bytes()),'retainedDetachedComponents':detached,'sourceUnitsScale':[unit_scale.numerator,unit_scale.denominator]})
   recipe['characters'].append(row)
 (ROOT/'art/source/wokas/export-recipe.json').write_text(json.dumps(recipe,indent=2)+'\n')
 print(f'Prepared exact source receipts for {len(recipe["characters"])} characters.')
if __name__=='__main__':main()
