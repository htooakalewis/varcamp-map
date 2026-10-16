"""Original VarCamp integer-grid coastal artwork; no reference image pixels are read.

Run from repository root. Shapes are authored here at native pixel size. The SVG is
the editable art master; exportCustomArt produces the PNG consumed by Tiled.
"""
from pathlib import Path
import json

parts=[]
sprites={}
def sprite(name,x,y,w,h,body,blocking=(),level='belowAvatar'):
    sprites['coast-'+name]={'sheet':'assets/tilesets/original/coastal.png','rect':dict(x=x,y=y,width=w,height=h),'blockingCells':list(blocking),'level':level,'sourceId':'original'}
    parts.append(f'<g id="coast-{name}" transform="translate({x*32} {y*32})">{body}</g>')
def rect(x,y,w,h,c,extra=''):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}" {extra}/>'
def path(d,c,stroke=None,width=2):return f'<path d="{d}" fill="{c}"'+(f' stroke="{stroke}" stroke-width="{width}" stroke-linejoin="round"' if stroke else '')+'/>'
def line(x1,y1,x2,y2,c,w=2):return path(f'M{x1} {y1}L{x2} {y2}','none',c,w)
def circle(x,y,r,c,stroke=None,w=2):return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"'+(f' stroke="{stroke}" stroke-width="{w}"' if stroke else '')+'/>'

# The overview is an original three-quarter sailing vessel, with hull volume,
# a raised stern, three canvas sails and two tall masts. No rectangular floor
# or label is being substituted for the silhouette.
s=path('M26 522L46 565L114 592L477 592L548 566L598 516L572 512L523 542L111 552Z','#0d808d')
s+=path('M30 426L64 410L148 414L202 453L464 453L522 418L583 452L615 487L592 533L551 560L486 579L136 579L78 565L40 537Z','#402b35','#241d2c',6)
s+=path('M42 446L75 432L148 435L200 471L464 471L523 441L600 486L575 519L535 540L483 552L132 553L82 541L48 522Z','#9a583c','#dda367',5)
for y in [477,492,508,525,542,560]:s+=path(f'M48 {y}L92 {y+9}L146 {y+14}L482 {y+14}L545 {y-2}L588 {y-27}','none','#533b34',3)
s+=path('M48 385L154 385L206 430L459 430L518 396L568 422L606 472L581 499L531 518L480 530L141 531L86 517L48 491Z','#ca8b50','#5a3b2e',6)
s+=path('M57 395L149 395L202 441L462 441L518 408L560 431L593 471L574 488L526 506L478 518L142 520L92 505L59 486Z','#dfa467','#f8cf8a',5)
# Longitudinal planks following the three-quarter deck, with staggered seams.
for x in range(70,580,16):
    y1=399 if x<151 else 445 if x<465 else 423
    y2=489 if x<110 else 514 if x<480 else 497
    s+=line(x,y1,x,y2,'#a9673f',2)
    for y in range(y1+20+(x%3)*7,y2,35):s+=line(x,y,x+14,y,'#bc8050',2)
# Raised stern castle, windows, thick rail and staircase.
s+=path('M54 374L146 374L178 401L178 463L144 483L59 472Z','#6b4031','#f0c184',5)
s+=path('M61 365L143 365L168 390L168 442L140 459L62 449Z','#dc9d5a','#ffe1a0',5)
for x in range(70,160,13):s+=line(x,377,x,445,'#ad6c40',2)
for y in range(442,490,8):s+=path(f'M170 {y}L206 {y+22}L206 {y+28}L170 {y+6}Z','#8e5637','#e9bc7d',1)
s+=path('M55 358L145 358L174 385','none','#ffe4ae',7)
for x,y in [(58,361),(88,359),(118,359),(146,363),(172,385)]:s+=rect(x-3,y,6,23,'#71432e')+circle(x,y,5,'#e6bd78')
for x in [77,111,145]:s+=rect(x,516,24,27,'#e0ae66')+rect(x+4,520,16,19,'#172e40')+line(x+12,520,x+12,539,'#b06e42',2)
for x,y in [(502,545),(544,526),(574,507)]:s+=circle(x,y,10,'#d8a15a','#54372e',3)+circle(x,y,5,'#132d3a')
# Main masts, crow's nest and spars, thick lashings.
for x,top,bottom in [(274,48,471),(454,89,462)]:
    s+=rect(x-6,top,13,bottom-top,'#6f402d')+rect(x-3,top,5,bottom-top,'#c28547')+rect(x+2,top,3,bottom-top,'#edb76b')
    for y in range(top+34,bottom,79):s+=rect(x-9,y,19,9,'#f4d6a1')+line(x-9,y+3,x+10,y+3,'#92714c',2)
    s+=path(f'M{x-29} 183L{x+30} 183L{x+23} 213L{x-22} 213Z','#8c5538','#e9b87a',4)
    s+=path(f'M{x-30} 183L{x-23} 173L{x+23} 173L{x+31} 183Z','#d5a065','#ffe0a3',3)
    for xx in range(x-17,x+24,10):s+=line(xx,187,xx,207,'#553a30',2)
# Rigging before canvas, diagonals visibly converge on mast heads and deck cleats.
for x,y,bx,by in [(274,60,204,439),(274,60,345,476),(454,97,388,465),(454,97,550,473),(274,233,129,410),(454,244,589,468)]:s+=line(x,y,bx,by,'#e7cc92',2)
for x,y,w,h,col in [(274,93,133,135,'#fff0ca'),(274,251,160,158,'#f1ddb0'),(454,223,115,179,'#f7e7ba')]:
    left=x-w//2;right=x+w//2
    s+=line(left-13,y-5,right+13,y-5,'#67452f',7)
    s+=path(f'M{left} {y}Q{x} {y+15} {right} {y}L{right+17} {y+h-22}Q{x+8} {y+h+25} {left-12} {y+h-10}Q{left+16} {y+h//2} {left} {y}Z',col,'#c6a36b',3)
    for xx in [left+26,x+10,right-22]:s+=path(f'M{xx} {y+11}Q{xx+18} {y+h//2} {xx+4} {y+h-9}','none','#dfc48d',2)
    s+=path(f'M{left-5} {y+h-12}Q{x+6} {y+h+15} {right+13} {y+h-22}','none','#ffecc6',5)
    # Navy zodiac compass medallion, not a copied pirate skull.
    cx=x+6;cy=y+h//2+12
    s+=circle(cx,cy,22,'#233a54','#cfa75f',3)+path(f'M{cx} {cy-17}L{cx+5} {cy-4}L{cx+17} {cy}L{cx+5} {cy+5}L{cx} {cy+17}L{cx-5} {cy+5}L{cx-17} {cy}L{cx-5} {cy-4}Z','#f4d18a')
# Bow spirit, bowsprit flag, pennants and mooring line.
s+=path('M566 435L628 406L632 414L581 451Z','#7d4a31','#ebc38c',3)
for x,y,col in [(274,49,'#253b59'),(454,89,'#c45c55')]:s+=path(f'M{x+7} {y+3}L{x+65} {y+12}L{x+40} {y+27}L{x+7} {y+23}Z',col,'#e1bc7a',2)
s+=circle(295,65,5,'#f2d68f')+line(45,494,8,508,'#e2c79b',4)+circle(8,508,7,'#8c5633','#f5d49c',3)
sprite('sailing-ship',0,0,20,20,s)

# A wind-filled square sail for the walkable deck; no collision is attached to
# overhead rigging/canvas. Players retain a central clear promenade.
s=line(18,30,207,30,'#70412b',8)+line(110,7,110,207,'#8a5635',9)
s+=path('M28 36Q112 48 196 36L208 177Q115 213 17 181Q40 104 28 36Z','#f4e4bc','#be9e69',3)
for x in [58,104,151,180]:s+=path(f'M{x} 43Q{x+14} 111 {x+5} 185','none','#d8bc84',2)
s+=circle(112,115,24,'#243c58','#d0ac68',3)+path('M112 95L118 109L132 115L118 121L112 136L106 121L92 115L106 109Z','#f2d38b')
s+=line(20,184,110,7,'#e9ce94',2)+line(205,178,110,7,'#e9ce94',2)
sprite('square-sail',20,0,7,7,s)
s=rect(25,5,14,214,'#6b422e')+rect(28,5,6,214,'#c58d51')
for y in range(20,220,31):s+=rect(20,y,24,9,'#e4c489')+line(20,y+4,44,y+4,'#a18153',2)
s+=path('M8 72L56 72L50 99L14 99Z','#885335','#e3b87a',3)+path('M8 72L16 64L49 64L56 72Z','#d4a06b','#ffdc9a',2)
sprite('mast',27,0,2,7,s)

# Sky aircraft has a real towing line and an empty 192×64 banner frame. Logos
# are separate public sponsor PNGs, intentionally replaceable by the team.
s=path('M12 30L216 30L216 101L10 101L23 65Z','#1e3a52','#dec486',3)
s+=line(216,62,267,55,'#ebdbb5',2)+path('M262 49L311 45L340 53L369 48L376 55L349 64L311 62L268 60Z','#ecce7e','#38475c',3)
s+=path('M307 51L289 12L303 9L332 51Z','#e05e50','#344761',3)+path('M315 61L299 111L314 112L340 61Z','#ca4c49','#344761',3)
s+=path('M350 51L344 30L354 29L367 51Z','#e9c77a','#344761',2)+rect(324,44,12,12,'#6ed4dd')+line(377,34,377,80,'#e0e9df',4)+circle(377,56,5,'#46516b')
sprite('sponsor-plane',20,7,12,4,s,level='aboveAvatar')
s=path('M50 25L88 5L280 5L327 31L352 73L349 125L329 164L283 207L256 237L124 237L98 206L58 169L33 122L33 77Z','#cd684e','#253b52',4)
s+=path('M110 14L98 76L99 144L134 224L171 233L154 139L155 68L163 9Z','#f2cd80')
s+=path('M215 9L228 70L230 145L207 234L251 230L286 147L286 76L271 13Z','#ecc783')
s+=path('M37 80L346 80L349 145L324 183L61 183L38 141Z','#1e3a52','#f5d88c',4)
s+=rect(86,91,214,77,'#172e46')
for x in [125,257]:s+=line(x,237,151 if x==125 else 231,285,'#e5c38d',3)
s+=path('M145 280L239 280L230 314L154 314Z','#97603e','#f0c58b',4)
for x in range(157,235,13):s+=line(x,286,x-2,309,'#bd8550',3)
sprite('sponsor-balloon',20,11,12,10,s,level='aboveAvatar')

# Terrain has varied hand-positioned grains and gentle water facets, not a dark
# repeated office floor. All water retains its collision independently.
s=rect(0,0,32,32,'#efd293')
for x,y,w in [(3,5,3),(19,2,2),(11,18,4),(26,26,3),(3,27,2),(24,11,3),(15,29,2)]:s+=rect(x,y,w,1,'#d8b579')+rect(x+1,y+2,1,1,'#f9e8b9')
sprite('sand',0,21,1,1,s)
s=rect(0,0,32,32,'#298fac')+path('M2 8L9 6L15 8M21 24L27 22L32 23','none','#58bdc8',1)+rect(18,14,4,1,'#61c4ca')
sprite('sea',1,21,1,1,s,[(0,0)])
s=rect(0,0,32,32,'#51c5be')+path('M2 10L9 8L17 10M20 26L27 24L32 25','none','#91dfd1',1)
sprite('shallows',2,21,1,1,s,[(0,0)])
for i,d in enumerate(['south','north','east','west']):
    base=rect(0,0,32,32,'#d3b17d')+path('M0 22L8 25L17 21L24 25L32 22L32 32L0 32Z','#51c5be')+path('M0 21L8 24L17 20L24 24L32 21','none','#fff4d4',4)+rect(2,18,5,1,'#ead2a5')
    rot={'south':0,'north':180,'east':270,'west':90}[d]
    sprite('foam-'+d,3+i,21,1,1,f'<g transform="rotate({rot} 16 16)">{base}</g>')
s=rect(0,0,32,32,'#a66942')
for y in [0,8,16,24]:s+=rect(0,y,32,1,'#f0ba78')+rect(0,y+6,32,2,'#835135')
for x,y in [(7,2),(23,10),(6,18),(24,26)]:s+=rect(x,y,2,2,'#65442e')
sprite('dock-plank',7,21,1,1,s)
s=rect(0,0,32,32,'#a96c45')+line(3,0,3,32,'#d99d62')+line(16,0,16,32,'#714a32')+line(29,0,29,32,'#d99d62')+line(4,16,15,16,'#6f4933')+line(17,27,28,27,'#6f4933')
sprite('deck-plank',8,21,1,1,s)

# Furniture and wildlife. Palm canopy is overhead; only the trunk cell blocks.
s='<ellipse cx="51" cy="119" rx="34" ry="7" fill="#5a6145" opacity="0.22"/>'+path('M43 66L43 82L46 100L48 116L54 116L52 96L51 80L55 70Z','#795334')+line(44,83,51,81,'#c0945c',3)+line(46,95,52,94,'#c0945c',3)+line(48,108,54,106,'#c0945c',3)
s+=path('M44 58L8 40L2 49L31 67L10 71L9 81L45 72L24 94L34 95L51 74L69 99L79 97L62 69L91 78L95 68L68 59L95 48L89 38L59 51L74 24L64 22L51 46L40 24L30 28Z','#23764f','#164d42',3)
s+=path('M14 48L49 61L84 47M25 84L50 63L76 84M43 36L52 62L67 36','none','#54a463',4)
for x,y in [(18,50),(27,54),(37,58),(66,54),(76,50),(37,45),(43,52),(60,47),(33,77),(40,71),(63,76),(68,82)]:s+=rect(x,y,6,2,'#78ad63')+rect(x+2,y+3,5,2,'#1c6145')
s+=circle(46,67,5,'#ad7746')+circle(55,66,5,'#bb8650')
sprite('palm',0,22,3,4,s,[(1,3)],'aboveAvatar')
s='<ellipse cx="47" cy="112" rx="31" ry="9" fill="#6f6b47" opacity="0.23"/>'+path('M42 30L47 108L50 108L49 30Z','#9f7748')+path('M5 34L12 18L29 6L53 6L76 20L90 36L74 51L51 59L25 53Z','#e97862','#f8dc9f',3)
s+=path('M29 6L43 33L25 53L5 34L12 18Z','#f3d189')+path('M53 6L45 34L51 59L74 51L90 36L76 20Z','#f5d997')+line(45,8,45,36,'#b77056',2)+circle(45,34,6,'#ffe9ae')
sprite('parasol',3,22,3,4,s,[(1,3)])
s='<ellipse cx="31" cy="89" rx="29" ry="6" fill="#706343" opacity="0.22"/>'+path('M9 6L47 6L55 53L43 83L8 83L2 51Z','#f6e1b4','#77553c',3)+path('M11 10L43 10L47 43L7 43Z','#e56f58')+path('M8 47L48 47L40 75L8 75Z','#f1bc73')+line(10,85,6,94,'#624933',3)+line(42,83,50,92,'#624933',3)
sprite('deck-chair',6,22,2,3,s,[(0,2),(1,2)])
s=rect(5,4,51,54,'#df7058')+rect(8,8,45,46,'#f5c57e')+rect(9,17,43,6,'#e7785d')+rect(9,38,43,6,'#e7785d')+path('M7 58L7 63M15 58L15 63M24 58L24 63M34 58L34 63M45 58L45 63M54 58L54 63','none','#f3deae',2)
sprite('towel',8,22,2,2,s)

# Bamboo beach bar with shutters, striped awning, bottles and a thatched roof.
s=rect(14,49,164,94,'#906039')+rect(20,56,152,67,'#3f5449')
for x in [19,172]:s+=rect(x,50,7,98,'#dcae67')+line(x,61,x+7,61,'#886440')+line(x,100,x+7,100,'#886440')
s+=path('M6 49L24 13L168 13L187 49Z','#b78243','#5c4930',3)
for x in range(14,182,9):s+=line(x,45,max(25,min(166,x)),19,'#eac078',3)
s+=rect(7,48,180,13,'#f1d49a')
for x in range(8,186,28):s+=rect(x,48,14,13,'#d96d55')
s+=rect(15,112,163,27,'#cf9251')+rect(10,108,174,8,'#f4cc88')
for x in range(20,180,17):s+=line(x,119,x,138,'#9f643a')
for x,c in [(41,'#64c3ba'),(66,'#db9160'),(127,'#86bd71'),(151,'#e5c273')]:s+=rect(x,84,7,22,c)+rect(x+2,78,3,7,'#e5cba2')
s+=rect(84,89,24,18,'#ede0b5')+path('M84 89L96 80L108 89Z','#d1764c')
sprite('beach-bar',10,22,6,5,s,[(x,4) for x in range(6)])

s=rect(11,55,138,85,'#a86f43')+path('M2 55L28 13L131 13L159 55Z','#377f81','#253e43',4)
for y in [62,77,92,107,122]:s+=line(14,y,146,y,'#d4a26a',3)
s+=rect(67,74,29,66,'#233e45')+rect(22,75,30,32,'#8bc3c0')+rect(110,75,28,32,'#8bc3c0')+line(37,77,37,105,'#dcae76',3)+line(124,77,124,105,'#dcae76',3)+rect(6,50,151,8,'#f0c87e')
sprite('harbor-hut',16,22,5,5,s,[(x,4) for x in range(5)])
s=circle(16,16,13,'#8a5b3c','#d9ae72',3)+circle(16,16,6,'#c79559')+rect(13,0,6,9,'#e6cc9a')
sprite('mooring-post',21,22,1,1,s,[(0,0)])
sprite('rope-horizontal',22,22,1,1,path('M0 11Q16 24 32 11','none','#e8cca0',3))
sprite('rope-vertical',23,22,1,1,path('M11 0Q24 16 11 32','none','#e8cca0',3))
s=path('M5 9L26 9L29 22L27 51L23 58L8 58L3 49L2 22Z','#a67443','#654531',2)+path('M4 15L28 15L29 22L3 22ZM3 44L28 44L27 50L4 50Z','#496069')+path('M10 13L8 52M19 13L21 53','none','#d1a567',2)+path('M5 9L11 4L22 4L27 9Z','#dfb77c')
sprite('barrel',24,22,1,2,s,[(0,1)])
s=rect(4,8,55,50,'#a26d44')+rect(9,12,45,42,'#bf8953')+path('M7 11L56 55M56 11L7 55','none','#dfb27a',7)+path('M6 12L6 55L56 55L56 12Z','none','#634a33',3)
sprite('crate',25,22,2,2,s,[(0,1),(1,1)])
s=circle(32,31,21,'none','#a46b3d',7)+circle(32,31,6,'#dfb879','#644833',2)
for x,y in [(32,3),(52,11),(61,31),(51,51),(32,60),(12,51),(3,31),(12,11)]:s+=line(32,31,x,y,'#e2b774',4)+circle(x,y,3,'#a16c43')
sprite('wheel',27,22,2,2,s,[(0,1),(1,1)])
s=path('M13 10L49 10L55 21L46 63L17 63L9 23Z','#4c616b','#203e47',3)+rect(12,55,40,18,'#9f6942')+circle(15,76,10,'#64472f','#c7965f',3)+circle(49,76,10,'#64472f','#c7965f',3)+path('M18 8L44 8L46 20L16 20Z','#263c44')
sprite('cannon',29,22,2,3,s,[(0,2),(1,2)])
s=rect(4,4,88,88,'#543d32')+rect(9,9,78,78,'#d6a56b')+rect(15,15,66,66,'#2c454b')
for x in range(20,80,12):s+=line(x,16,x,80,'#667777',4)
for y in range(20,80,12):s+=line(16,y,80,y,'#667777',4)
sprite('hatch',32,22,3,3,s)
s=rect(8,4,5,120,'#9c6c3e')+path('M13 6L59 17L47 37L61 59L13 51Z','#263d58','#e3bd75',2)+path('M35 19L39 28L48 32L39 36L35 45L31 36L22 32L31 28Z','#f1d28e')
sprite('flag',35,22,2,4,s)
s=path('M4 14L10 8L21 8L31 17L41 8L54 8L60 14L48 12L32 25L17 12Z','#eaf2db','#557b89',2)+path('M27 20L34 20L32 25Z','#efb35f')
sprite('gull',37,22,2,1,s,level='aboveAvatar')
s=path('M7 13L16 8L24 14L29 9L29 23L23 20L16 23L7 17Z','#f4c76f','#e5f1c4',1)+circle(11,14,1,'#245b6c')
sprite('fish',39,22,1,1,s)
s=path('M7 21L7 14L12 8L21 8L27 14L27 22Z','#f5d9c3','#c98977',2)+path('M10 20L14 11M17 21L17 10M24 20L21 11','none','#dcac93',1)
sprite('shell',40,22,1,1,s)
s=path('M10 55L10 25L17 25L17 17L24 17L24 25L43 25L43 17L50 17L50 25L55 25L55 55Z','#dfb979','#f9dfa5',2)+rect(25,36,15,20,'#bd955e')+rect(17,10,3,19,'#8a7051')+path('M20 10L33 13L20 17Z','#d47558')
sprite('sandcastle',41,22,2,2,s)
s=path('M3 40L5 27L20 20L31 22L42 8L63 7L78 20L96 19L116 32L125 47L113 58L17 58Z','#eff0d9')+path('M14 48L112 48','none','#c6e1d5',4)
sprite('cloud',43,22,4,2,s,level='aboveAvatar')
sprite('bulwark',47,22,1,1,rect(0,0,32,32,'#70462f')+rect(0,0,32,5,'#f1c785')+rect(0,8,32,3,'#ab7142')+rect(4,16,24,3,'#8c5a36'),[(0,0)])
sprite('sign-board',48,22,1,1,rect(0,2,32,28,'#98663e')+rect(0,0,32,3,'#e4ba79')+rect(0,29,32,3,'#5c442f')+line(2,14,30,14,'#bd8a55',1)+rect(3,4,2,2,'#5e4a38')+rect(27,25,2,2,'#614b39'))
sprite('volley-net',49,22,5,2,path('M4 7L4 60M155 7L155 60','none','#b4824d',6)+rect(7,14,145,30,'none','stroke="#f3e8c8" stroke-width="2"')+''.join(line(x,15,x,43,'#eee0bd',1) for x in range(14,153,9))+''.join(line(8,y,151,y,'#eee0bd',1) for y in range(21,44,7)))
sprite('sign-post',54,22,1,1,'<ellipse cx="17" cy="29" rx="14" ry="3" fill="#665737" opacity="0.26"/>'+rect(12,0,8,29,'#704e33')+rect(13,0,3,28,'#b68a54')+line(12,13,20,13,'#4f3f2c',2))
sprite('wet-sand',55,22,1,1,rect(0,0,32,32,'#d3b17d')+path('M1 9L8 7L17 9M17 26L23 24L31 25','none','#e6c797',1)+rect(10,19,2,1,'#c39e6b'))
sprite('footprints',56,22,1,1,path('M6 5L10 4L12 9L10 14L6 14L4 10ZM20 18L24 17L26 22L24 27L20 27L18 23Z','#b59767'))
sprite('pebble-cluster',57,22,1,1,path('M3 21L6 15L12 15L15 22L12 25L5 25Z','#8b9386','#c9c7a7',1)+path('M19 13L22 8L28 10L30 15L27 19L21 18Z','#a9a78d','#e5d9b0',1)+rect(15,27,3,2,'#c0a879'))
sprite('underwater-rock',58,22,2,2,path('M9 46L5 29L16 17L31 12L48 21L59 40L50 51L24 56Z','#257b87')+path('M12 38L15 27L29 20L43 26L49 39L40 47L22 47Z','#3e9498')+path('M8 47Q31 60 56 45','none','#70c8c3',2)+rect(19,30,9,3,'#55aaa8')+rect(35,38,7,2,'#56aaa8'))
sprite('sign-pointer-left',60,22,1,1,path('M1 16L16 1L32 1L32 31L16 31Z','#98663e','#e4ba79',2)+line(9,16,31,16,'#bd8a55',1))
sprite('sign-pointer-right',61,22,1,1,path('M31 16L16 1L0 1L0 31L16 31Z','#98663e','#e4ba79',2)+line(1,16,23,16,'#bd8a55',1))

# Deck support structure is separate transparent native scenery. Each timber
# boom actually touches its centerline mast and the outboard canvas's yard;
# lighter lines tension the yard ends back to the mast head. Pixel endpoints
# below are shared with the existing sail/mast art, not decorative near misses.
s=line(203,161,480,161,'#573d2c',8)+line(203,157,480,157,'#ba8b51',6)+line(203,155,480,155,'#edc98b',2)
s+=line(480,20,18,158,'#ead1a0',3)+line(480,20,203,158,'#cdb27c',2)+circle(480,158,10,'#b68952','#f2d29a',2)
sprite('yard-fore',32,0,16,7,s)
s=line(2,222,274,449,'#573d2c',8)+line(2,218,274,445,'#bd8b50',6)+line(2,216,274,443,'#eac78c',2)
s+=line(2,20,274,446,'#ead1a0',3)+line(2,20,463,446,'#ceb17f',2)+circle(3,219,9,'#a87b49','#f1ce94',2)
sprite('yard-starboard',48,0,15,15,s)
s=line(480,220,203,290,'#573d2c',8)+line(480,216,203,286,'#bd8b50',6)+line(480,214,203,284,'#eac78c',2)
s+=line(480,20,18,286,'#ead1a0',3)+line(480,20,203,286,'#ceb17f',2)+circle(480,217,10,'#a87b49','#f1ce94',2)
sprite('yard-aft',32,8,16,10,s)

Path('art/source/coastal.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024" viewBox="0 0 2048 1024" shape-rendering="crispEdges">\n'+''.join(parts)+'\n</svg>\n')
Path('art/coastal-sprites.json').write_text(json.dumps(sprites,indent=2)+'\n')
print(f'Authored {len(sprites)} original coastal sprites')
