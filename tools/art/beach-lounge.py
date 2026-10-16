"""Native integer-grid SVG beach objects. No resampling, raster source or fonts."""
from pathlib import Path
import math,json
import sys, subprocess, hashlib
root=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve(); parts=[]
def px(x,y,c,w=1,h=1):parts.append(f'<rect x="{int(x)}" y="{int(y)}" width="{int(w)}" height="{int(h)}" fill="{c}"/>')
def ellipse(cx,cy,rx,ry,c):
 for y in range(int(cy-ry),int(cy+ry)+1):
  d=(y-cy)/ry
  if abs(d)<=1:
   span=int(rx*math.sqrt(1-d*d));px(cx-span,y,c,span*2+1)
def line(x,y,xx,yy,c,r=1):
 n=max(abs(xx-x),abs(yy-y),1)
 for i in range(int(n)+1):px(round(x+(xx-x)*i/n)-r//2,round(y+(yy-y)*i/n)-r//2,c,r,r)
def palm(ox,oy):
 ellipse(ox+48,oy+119,36,6,'#bfac72')
 # Curved trunk, individually lit old leaf scars.
 for y in range(49,119):
  x=ox+42+int(11*((y-49)/70)**1.6)
  px(x-5,oy+y,'#65482d',11);px(x-3,oy+y,'#9a6b3d',7);px(x-2,oy+y,'#c89a55',3)
  if y%7 in (0,1):px(x-4,oy+y,'#68492c',9)
 # Long feathery fronds, drawn far-to-near. Jagged leaflets are actual pixels.
 for j,(ex,ey,bend) in enumerate([(6,72,18),(10,38,-13),(23,14,-9),(49,6,-8),(77,14,-8),(91,42,-12),(86,76,15),(56,90,8),(23,88,8)]):
  points=[]
  for i in range(33):
   t=i/32; x=47+(ex-47)*t; y=48+(ey-48)*t-bend*math.sin(math.pi*t);points.append((x,y))
  for i,(x,y) in enumerate(points):
   t=i/32;wid=1+int(7*math.sin(math.pi*t)**.7);col=['#204e3c','#205e43','#287747'][j%3]
   dx=ex-47;dy=ey-48;length=math.hypot(dx,dy);nx=-dy/length;ny=dx/length
   for side in [-1,1]:
    reach=wid*(1 if i%3 else .65)
    line(round(ox+x),round(oy+y),round(ox+x+nx*reach*side),round(oy+y+ny*reach*side),col,2)
    if i%2==0:line(round(ox+x),round(oy+y),round(ox+x+nx*(reach-1)*side-(ex-47)/length*2),round(oy+y+ny*(reach-1)*side-(ey-48)/length*2),'#438d50' if side<0 else '#326e43',1)
  for i in range(0,31):line(round(ox+points[i][0]),round(oy+points[i][1]),round(ox+points[i+1][0]),round(oy+points[i+1][1]),'#82a854',1)
 ellipse(ox+47,oy+49,6,5,'#766133');ellipse(ox+44,oy+48,3,3,'#a48a41')
def umbrella(ox,oy,colors):
 ellipse(ox+51,oy+111,36,6,'#c2ad76');px(ox+47,oy+65,'#7b5a3b',4,44);px(ox+48,oy+65,'#c69d60',2,43)
 # Shallow foreshortening, eight tailored alternating panels and a scalloped edge.
 for y in range(8,79):
  for x in range(3,93):
   dx=(x-47)/44;dy=(y-43)/34;r=math.hypot(dx,dy);a=math.atan2(dy,dx);edge=1-.035*(1+math.cos(a*8))
   if r<=edge:
    sector=int((a+math.pi)/(math.pi/4))%8
    c=colors[sector%2]
    if r>.94:c='#83694b'
    elif r>.87:c=colors[2+sector%2]
    elif abs(((a+math.pi)/(math.pi/4))%1-.02)<.025:c='#f1dfb4'
    px(ox+x,oy+y,c)
 ellipse(ox+47,oy+43,5,4,'#f5e5bf');px(ox+46,oy+39,'#fff0d1',3,2)
def chair(ox,oy):
 ellipse(ox+33,oy+87,25,5,'#bda571')
 # Exposed legs and angled wooden frame make a chaise, rather than a bin silhouette.
 for x in [10,49]:px(ox+x,oy+31,'#64472e',4,55);px(ox+x+1,oy+32,'#c39358',2,52)
 px(ox+8,oy+84,'#6c4c30',10,3);px(ox+47,oy+84,'#6c4c30',10,3)
 for y in range(9,72):
  inset=3 if y<31 else 0;left=16+inset;right=47-inset
  px(ox+left-3,oy+y,'#815733',3);px(ox+right+1,oy+y,'#b78951',3)
  for x in range(left,right+1):
   c='#e8dfbf' if (x-left)//5%2==0 else '#387e81'
   if y in [9,10,30,31,37,38,70,71]:c='#b8bca0' if (x-left)//5%2==0 else '#28646b'
   px(ox+x,oy+y,c)
 # Visible hinge, armrests and separate foot rail.
 px(ox+9,oy+38,'#d2aa6b',8,4);px(ox+48,oy+38,'#d2aa6b',8,4);px(ox+14,oy+74,'#cda66c',37,3)
 px(ox+13,oy+30,'#e0bd7b',3,3);px(ox+48,oy+30,'#e0bd7b',3,3)
def towel(ox,oy):
 px(ox+4,oy+7,'#c1ab78',55,48);px(ox+2,oy+4,'#ead9aa',55,48)
 for y in range(7,50):
  for x in range(5,54):
   if y%10<3:px(ox+x,oy+y,'#c27463')
   elif x%5==0 and y%2==0:px(ox+x,oy+y,'#f6e8c5')
 for x in range(4,57,4):px(ox+x,oy+1,'#f0dfb8',1,4);px(ox+x,oy+52,'#f0dfb8',1,4)
def shrub(ox,oy):
 ellipse(ox+32,oy+55,28,5,'#b9a06b')
 for i,(x,y) in enumerate([(17,34),(37,29),(48,41),(27,44),(12,46)]):
  ellipse(ox+x,oy+y,12,12,'#2b6343');ellipse(ox+x-1,oy+y-3,10,10,'#4f8b4e')
  for z in range(15):
   xx=(z*7+i*3)%17-8;yy=(z*11+i)%17-8
   if xx*xx+yy*yy<70:px(ox+x+xx,oy+y+yy,'#75a35b',2)
palm(0,0);umbrella(96,0,['#d47b63','#f3dfad','#ae624f','#dbc38f']);umbrella(192,0,['#438b8c','#eee3be','#326b71','#d6cba6']);chair(288,0);towel(352,0);shrub(416,0)
# Gentle native sand variants, no uniform wallpaper dots.
for v in range(16):
 ox=(v%8)*32;oy=128+(v//8)*32;px(ox,oy,'#e5c787',32,32)
 for k in range(18):
  x=(k*19+v*7)%32;y=(k*11+v*13)%32;px(ox+x,oy+y,'#dabc7d' if k%3 else '#eed7a1',1+(k%4==0))
# Sea veil: existing licensed LPC ripples remain visible beneath the tint.
px(256,128,'#247f91',32,32)
# Fine coastal grasses and pebbles.
for j in range(7):
 x=300+j*3;line(x,155,x-5+j%4,139+j%5,'#6c8c57',1);line(x,155,x+3,143+j%4,'#8ba565',1)
for x,y in [(332,151),(340,147),(346,154)]:ellipse(x,y,3,2,'#a59473');px(x-1,y-1,'#d3c29a',3)
svg='<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256" shape-rendering="crispEdges">'+''.join(parts)+'</svg>'
(root/'art/source/beach-lounge.svg').write_text(svg)
# Catalog additions are separate and mergeable.
sheet='assets/tilesets/original/beach-lounge.png'
def s(x,y,w,h,block=[],level='aboveAvatar'):return dict(sheet=sheet,rect=dict(x=x,y=y,width=w,height=h),blockingCells=block,level=level,sourceId='original')
c={'beach-palm':s(0,0,3,4,[[1,3]]),'beach-parasol-coral':s(3,0,3,4,[[1,3]]),'beach-parasol-teal':s(6,0,3,4,[[1,3]]),'beach-recliner':s(9,0,2,3,[[0,1],[1,1],[0,2],[1,2]],'belowAvatar'),'beach-woven-towel':s(11,0,2,2,[],'belowAvatar'),'beach-shrub':s(13,0,2,2,[[0,1],[1,1]])}
for v in range(16):c[f'beach-sand-{v}']=s(v%8,4+v//8,1,1,[],'belowAvatar')
c['beach-sea-veil']=s(8,4,1,1,[],'belowAvatar');c['beach-grass']=s(9,4,1,1,[],'belowAvatar');c['beach-pebbles']=s(10,4,1,1,[],'belowAvatar')
(root/'art/beach-lounge-sprites.json').write_text(json.dumps(c,indent=2)+'\n')
cat=json.loads((root/'art/tile-catalog.json').read_text());cat.update(c);(root/'art/tile-catalog.json').write_text(json.dumps(cat,indent=2)+'\n')
print('native SVG and 25 beach catalog sprites authored')
# Pixel timber cabana and open thatched beach bar, matching the native vessel palette.
parts=[]
def building(ox,oy,w,bar=False):
 ellipse(ox+w//2,oy+147,w//2-4,8,'#bfa572')
 if not bar:
  px(ox+13,oy+58,'#715037',w-26,88)
  for y in range(61,143):
   px(ox+16,oy+y,'#b17a48' if y%9 else '#805b39',w-32)
   if y%9 in (2,3):px(ox+18,oy+y,'#c2925b',w-38)
  for x in [26,w-58]:
   px(ox+x-4,oy+76,'#543f2e',42,40);px(ox+x,oy+79,'#699b95',34,32)
   px(ox+x+4,oy+81,'#b8ccad',8,28);px(ox+x+16,oy+79,'#e1bb78',3,32);px(ox+x-5,oy+113,'#d5a56a',44,4)
  px(ox+w//2-17,oy+104,'#513d2d',34,42);px(ox+w//2-14,oy+107,'#7e5b39',28,38)
  for x in range(w//2-10,w//2+10,7):px(ox+x,oy+109,'#9b7144',2,34)
  px(ox+w//2+8,oy+126,'#d8b06d',3,3)
  for y in range(19,63):
   left=abs(19-y)//2;px(ox+31-left,oy+y,'#254d4b',w-62+2*left)
   if y%7 in (1,2):px(ox+32-left,oy+y,'#4d8380',w-64+2*left)
   if y%7==0:
    for x in range(38-left,w-34+left,14):px(ox+x+(7 if y%14 else 0),oy+y,'#2f6664',1,6)
  px(ox+8,oy+63,'#5e4830',w-16,5);px(ox+12,oy+62,'#dbb879',w-24,2)
 else:
  px(ox+18,oy+52,'#4c5d46',w-36,68)
  for x in [15,w-22]:px(ox+x,oy+43,'#775234',7,103);px(ox+x+1,oy+44,'#c79655',3,100)
  for y in range(16,65):
   inset=(64-y)//2;px(ox+8+inset,oy+y,'#977242',w-16-inset*2)
   for x in range(10+inset,w-10-inset,5):
    px(ox+x,oy+y,'#d3b16c' if (x+y//5)%3 else '#b28b4f',2,1)
  px(ox+7,oy+64,'#6c5030',w-14,5);px(ox+8,oy+62,'#e3c17b',w-16,2)
  # Shadowed shelf with small glassware and a hanging woven lamp.
  px(ox+26,oy+98,'#92673b',w-52,4)
  for j,x in enumerate([35,49,72,108,125,145]):
   px(ox+x,oy+83,'#52897d' if j%2 else '#96af7d',5,14);px(ox+x+1,oy+79,'#c4c8a0',2,5);px(ox+x+1,oy+86,'#c2cfa6',1,7)
  px(ox+w//2-1,oy+69,'#735736',2,14);px(ox+w//2-7,oy+83,'#bd9556',14,9);px(ox+w//2-4,oy+85,'#e2c37f',8,5)
  px(ox+12,oy+114,'#674a30',w-24,32)
  for x in range(15,w-16,9):px(ox+x,oy+117,'#b98a51',7,28);px(ox+x+1,oy+119,'#d0a262',2,24)
  px(ox+9,oy+110,'#67482c',w-18,7);px(ox+10,oy+109,'#dbb473',w-20,3);px(ox+11,oy+146,'#a37a45',w-22,3)
building(0,224,160);building(160,224,192,True)
old=(root/'art/source/beach-lounge.svg').read_text();old=old.replace('height="256" shape','height="512" shape').replace('</svg>',''.join(parts)+'</svg>');(root/'art/source/beach-lounge.svg').write_text(old)
c['beach-cabana']=s(0,7,5,5,[[x,y] for x in range(5) for y in range(3,5)])
c['beach-tiki-bar']=s(5,7,6,5,[[x,y] for x in range(6) for y in range(3,5)])
(root/'art/beach-lounge-sprites.json').write_text(json.dumps(c,indent=2)+'\n');cat.update(c);(root/'art/tile-catalog.json').write_text(json.dumps(cat,indent=2)+'\n')
# A low slatted timber table with two cool drinks, scaled for a shade pocket.
parts=[]
ox,oy=352,224
ellipse(ox+32,oy+55,27,5,'#bea572');px(ox+18,oy+32,'#684a2e',5,24);px(ox+43,oy+32,'#684a2e',5,24)
ellipse(ox+32,oy+28,28,20,'#6f4f32');ellipse(ox+32,oy+25,27,18,'#b68a51')
for y in range(10,43):
 span=int(26*math.sqrt(max(0,1-((y-25)/18)**2)))
 if y%6==0:px(ox+32-span,oy+y,'#8a643b',span*2+1)
 if y%6==1:px(ox+33-span,oy+y,'#d1a76b',max(1,span*2-2))
for x in [22,40]:
 ellipse(ox+x,oy+26,5,2,'#8f6b43');px(ox+x-3,oy+15,'#d3e1be',7,9);px(ox+x-2,oy+16,'#d79b67',5,6);px(ox+x-1,oy+12,'#f6e5b7',1,8)
old=(root/'art/source/beach-lounge.svg').read_text().replace('</svg>',''.join(parts)+'</svg>');old=old.replace('fill="#247f91"','fill="#247f91" fill-opacity="0.74"');(root/'art/source/beach-lounge.svg').write_text(old)
c['beach-low-table']=s(11,7,2,2,[[0,1],[1,1]],'belowAvatar');cat.update(c)
(root/'art/beach-lounge-sprites.json').write_text(json.dumps(c,indent=2)+'\n');(root/'art/tile-catalog.json').write_text(json.dumps(cat,indent=2)+'\n')

# Native surf master is derived from the authoritative layout animation descriptors.
parts=[]
def wave(ox,oy,mask,phase):
 if mask>=16:
  for u in range(5,28):
   v=14+int(3*math.sin((u+phase*3)*math.pi/30))+[0,1,2,1][phase]
   x,y=(u,v) if mask==16 else (v,u)
   px(ox+x,oy+y,'#83bcba')
   if 10<u<23:px(ox+x,oy+y+1,'#70afb1')
  return
 for side in range(4):
  if not (mask>>side)&1:continue
  for u in range(32):
   depth=4+int(2*math.sin((u+phase*4)*math.pi/22))+[0,1,2,1][phase]
   for v in range(depth):
    x,y=[(u,v),(31-v,u),(u,31-v),(v,u)][side]
    px(ox+x,oy+y,'#9ec7b7' if v<depth-2 else '#f3e7c4')
   # Broken trailing sparkle, never a solid white zigzag.
   if (u+phase*3)%13<6:
    x,y=[(u,depth+2),(29-depth,u),(u,29-depth),(depth+2,u)][side];px(ox+x,oy+y,'#eadab3')
for mask in range(18):
 for phase in range(4):
  tile=mask*4+phase;wave((tile%32)*32,(tile//32)*32,mask,phase)

layout=json.loads((root/'world/layouts/shipyard-beach.json').read_text())
for overlay in layout['animatedOverlays']:
 if not overlay['name'].startswith('beach-surf'):continue
 for animation in overlay['animations']:
  cursor=animation['id'];mask=animation['frames'][0]['tileid']//4
  wave((cursor%32)*32,(cursor//32)*32,mask,0)
(root/'art/source/beach-surf.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="672" shape-rendering="crispEdges">'+''.join(parts)+'</svg>')
subprocess.run(['node','--input-type=module','-e', 'import sharp from "sharp";for(const name of ["beach-lounge","beach-surf"])await sharp(`art/source/${name}.svg`).png().toFile(`assets/tilesets/original/${name}.png`);'],cwd=root,check=True)
sources=json.loads((root/'art/sources.json').read_text())
for name in ['beach-lounge','beach-surf']:
 path=f'assets/tilesets/original/{name}.png';entry={'path':path,'sha256':hashlib.sha256((root/path).read_bytes()).hexdigest()}
 sources['original']['files']=[x for x in sources['original']['files'] if x['path']!=path]+[entry]
note=' Beach refinement: beach-lounge.svg/png and beach-surf.svg/png add integer-grid native pixel palms, striped parasols/recliners, slatted tables, woven towels, timber cabana/bar and gentle 2080ms four-frame surf. A separate translucent original tile calms the existing licensed LPC water; imported source sheets are unchanged.'
if note not in sources['original']['changes']:sources['original']['changes']+=note
(root/'art/sources.json').write_text(json.dumps(sources,indent=2)+'\n')
print('Beach native SVG/PNG masters, sprite catalog and source hashes refreshed.')
