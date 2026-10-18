import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{createHash}from'node:crypto';import sharp from'sharp';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
/** Fixed original art authoring. No network or licensed raster input is mixed into CC0 sheets. */
export async function writeBeachShipArt(){
 const palette={shadow:'#205e70',body:'#438b8c',lit:'#70afb1',lip:'#9ec7b7',foam:'#f3e7c4',spray:'#eadab3'},strength=[.10,.42,.82,1,1,.8,.44,.14],fronts=[18,23,30,38,43,39,30,21];let original='';
 const pixels:{x:number;y:number;c:string;alpha:number}[]=[];
 const pixel=(x:number,y:number,c:string,alpha:number)=>`<rect x="${x}" y="${y}" width="2" height="2" fill="${c}" opacity="${alpha.toFixed(3)}"/>`;
 const px=(x:number,y:number,c:string,alpha:number)=>{x=Math.round(x/2)*2;y=Math.round(y/2)*2;pixels.push({x,y,c,alpha});return pixel(x,y,c,alpha);};
 for(let k=0;k<8;k++){const edge=(x:number)=>fronts[k]+5*Math.sin(x*Math.PI/192+k*.55)+3*Math.sin(x*Math.PI/53+k*.7);for(let x=0;x<384;x+=2){const taper=Math.min(1,x/18,(383-x)/18);for(let y=0;y<64;y+=2){const d=edge(x)-y;if(d>27||d< -12||d< -5&&((Math.floor(x/2)*17+Math.floor(y/2)*37+k*11)%101)<(-d-4)*11)continue;const c=d>18?palette.shadow:d>9?palette.body:d>3?palette.lit:d> -4?palette.foam:palette.lip;original+=px(x,k*64+y,c,strength[k]*taper*(d>18?.7:1));}}
  if(k>0&&k<7)for(const[center,radius]of[[47,13],[139,17],[231,11],[331,15]]){for(let a=-2.6;a<2.1;a+=.16){const x=center+Math.cos(a)*radius,y=edge(center)-11+Math.sin(a)*10;if(y>=1&&y<62)original+=px(x,k*64+y,palette.foam,strength[k]);}for(let i=0;i<5;i++){const x=center-9+i*6,y=edge(center)+7+(i%3)*2;if(y<62)original+=px(x,k*64+y,palette.spray,strength[k]*.65);}}
 }
 const master=`<svg xmlns="http://www.w3.org/2000/svg" width="384" height="512" viewBox="0 0 384 512" shape-rendering="crispEdges">${original}</svg>`;writeFileSync('art/source/rolling-breaker-master.svg',master);
 const carriers=Array.from({length:48},(_,i)=>Math.floor(i/4)*16+12+i%4);let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" shape-rendering="crispEdges"><defs><g id="original-breaker">${original}</g></defs><use href="#original-breaker"/>`;
 // Copy only the selected tile's actual two-pixel rectangles. Referencing the
 // entire eight-frame master in48 clipped viewports expands the renderer49fold.
 for(let i=0;i<48;i++){const sx=i%24%12*32,sy=Math.floor(i%24/12)*32+(i>=24?256:0),dx=carriers[i]%16*32,dy=Math.floor(carriers[i]/16)*32;
  for(const p of pixels)if(p.x>=sx&&p.x<sx+32&&p.y>=sy&&p.y<sy+32)svg+=pixel(dx+p.x-sx,dy+p.y-sy,p.c,p.alpha);
 }
 svg+='</svg>';writeFileSync('art/source/rolling-breaker.svg',svg);const png=await sharp(Buffer.from(svg)).png().toBuffer();writeFileSync('assets/tilesets/original/rolling-breaker.png',png);
 const overlays=[8,29].map((x,phase)=>({name:`rolling-breaker-${phase?'east':'west'}`,image:'assets/tilesets/original/rolling-breaker.png',sourceId:'original',level:'belowAvatar' as const,x,y:1,width:12,height:2,carrierTileIds:carriers.slice(phase*24,phase*24+24),animations:Array.from({length:24},(_,i)=>({id:carriers[phase*24+i],frames:Array.from({length:8},(_,f)=>{const k=(f+phase*4)%8;return{tileid:k*32+Math.floor(i/12)*16+i%12,duration:200};})}))}));
 for(const overlay of overlays){Object.assign(overlay,{provenance:{metadataPath:`art/source/${overlay.name}.json`,atlasSha256:sha(png),inputs:[{path:'art/source/rolling-breaker-master.svg',sha256:sha(master)},{path:'art/source/rolling-breaker.svg',sha256:sha(svg)},{path:'tools/art/beach-ship.ts',sha256:sha(readFileSync('tools/art/beach-ship.ts'))}]}});writeFileSync(`art/source/${overlay.name}.json`,JSON.stringify({schemaVersion:1,overlay},null,2)+'\n');}
 writeFileSync('art/source/rolling-breaker.json',JSON.stringify({schemaVersion:1,license:'CC0-1.0',source:'Original VarCamp full-width pixel geometry; no imported pixels',masterSha256:sha(master),producerSha256:sha(readFileSync('tools/art/beach-ship.ts')),svgSha256:sha(svg),atlasSha256:sha(png),overlays},null,2)+'\n');
 const glyphs=JSON.parse(readFileSync('art/source/hub-nameplates.json','utf8')).glyphs as Record<string,string[]>;let art='';const rect=(x:number,y:number,w:number,h:number,c:string)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
 // Native wooden plank, raised timber wall, bunks, furniture, lamps and stairs.
 art+=rect(0,0,32,32,'#795332');for(let y=0;y<32;y+=8)art+=rect(0,y,32,1,'#493828')+rect(1,y+1,30,1,'#a67846');for(const[x,y]of[[5,4],[22,12],[9,20],[26,28]])art+=rect(x,y,1,1,'#d1a76a');
 art+=rect(32,0,32,64,'#3b3028')+rect(34,4,28,52,'#795332')+rect(35,6,26,2,'#c2985f')+rect(34,52,28,8,'#513b29');
 art+=rect(64,0,64,96,'#493729')+rect(67,5,58,83,'#bc965f')+rect(70,11,52,18,'#e8d7b0')+rect(70,32,52,48,'#294355')+rect(74,36,44,4,'#d7ae65');for(const x of[67,121])art+=rect(x,85,4,10,'#312e28');
 art+=rect(128,0,96,64,'#392e26')+rect(130,4,92,48,'#a77740')+rect(134,8,84,38,'#c29b65')+rect(132,52,8,10,'#513927')+rect(212,52,8,10,'#513927');for(let x=144;x<211;x+=20)art+=rect(x,18,10,10,'#dfcda2')+rect(x+2,20,6,6,'#e9dfbe');
 art+=rect(224,0,96,64,'#47392f')+rect(226,7,92,47,'#916545')+rect(230,10,86,8,'#c4aa78')+rect(235,24,24,23,'#282e31')+rect(266,24,24,23,'#374955')+rect(292,22,20,27,'#c29a5e');
 art+=rect(320,0,64,96,'#3e3027')+rect(324,6,56,80,'#996e42');for(let y=15;y<80;y+=25)art+=rect(326,y,52,3,'#4c3729')+rect(330,y-10,12,10,'#c49652')+rect(349,y-10,21,10,'#556454');
 art+=rect(384,0,32,64,'#6c542f')+rect(390,14,20,31,'#293b40')+rect(394,20,12,18,'#f4d384')+rect(398,10,4,7,'#c6ad63');
 art+=rect(416,0,64,96,'#342b24')+rect(420,5,56,85,'#926a41');for(let y=12;y<90;y+=13)art+=rect(420,y,56,5,'#d1a96a')+rect(420,y+5,56,3,'#59412c');
 // Floor chart table, compass and rope accents; all original pixels.
 art+=rect(128,64,96,64,'#42382b')+rect(131,69,90,45,'#b88a50')+rect(141,76,68,28,'#dec88d');for(let x=148;x<205;x+=13)art+=rect(x,82,4,10,'#63877a');art+=rect(131,114,7,12,'#53402b')+rect(214,114,7,12,'#53402b');
 art+=rect(224,64,32,32,'#463b2a')+rect(228,68,24,24,'#c7a46a')+rect(238,71,4,18,'#30516a')+rect(231,78,18,4,'#30516a');
 const arrows:Record<string,string[]>={'←':['00100','01000','10000','11111','10000','01000','00100'],'↓':['00100','00100','00100','00100','11111','01110','00100']};Object.assign(glyphs,arrows);
 for(const [label,start,width]of [['← LOWER DECK',0,160],['HELM',160,128]] as const){let xx=start+8;art+=rect(start,128,width,32,'#4b3929');for(const c of label){if(c===' '){xx+=8;continue;}for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(glyphs[c][y][x]==='1')art+=rect(xx+x*2,137+y*2,2,2,'#f1d9a0');xx+=12;}}
 // Compass rug, mess bench and rope coil occupy otherwise unused atlas cells.
 art+=rect(256,64,64,64,'#293e4c')+rect(258,66,60,60,'#a9804b')+rect(261,69,54,54,'#324f5b');for(let d=0;d<20;d+=2)art+=rect(286-d/2,76+d,4+d,2,'#c39c59')+rect(276+d/2,98+d,24-d,2,'#c39c59');
 art+=rect(320,100,64,22,'#3c3027')+rect(322,102,60,12,'#ac7d46')+rect(324,114,6,12,'#66452d')+rect(374,114,6,12,'#66452d');for(let x=328;x<377;x+=8)art+=rect(x,105,4,1,'#d2ad6d');
 for(let a=0;a<Math.PI*6;a+=.12){const radius=2+a*.5;art+=rect(400+Math.round(Math.cos(a)*radius),112+Math.round(Math.sin(a)*radius*.6),2,2,'#b39460');}
 art+=rect(388,70,24,20,'#c89c57')+rect(392,66,16,28,'#c89c57')+rect(392,72,16,16,'#244652')+rect(396,70,8,20,'#244652')+rect(394,74,12,2,'#78a3a6');
 const titles=['MESS GALLEY','CAPTAIN CHARTS','CREW BUNKS','CARGO HOLD'];for(let i=0;i<titles.length;i++){const x=(i%2)*256,y=160+Math.floor(i/2)*32;art+=rect(x,y,256,32,'#4b3929')+rect(x+2,y+2,252,1,'#a37d48');let pos=x+10;for(const c of titles[i]){if(c===' '){pos+=8;continue;}const bits=glyphs[c];if(!bits)throw Error('Unsupported room glyph '+c);for(let yy=0;yy<7;yy++)for(let xx=0;xx<5;xx++)if(bits[yy][xx]==='1')art+=rect(pos+xx*2,y+9+yy*2,2,2,'#f1d9a0');pos+=12;}}
 const interior=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="224" viewBox="0 0 512 224" shape-rendering="crispEdges">${art}</svg>`;writeFileSync('art/source/ship-interior.svg',interior);const insidePng=await sharp(Buffer.from(interior)).png().toBuffer();writeFileSync('assets/tilesets/original/ship-interior.png',insidePng);writeFileSync('art/source/ship-interior.json',JSON.stringify({schemaVersion:1,svgSha256:sha(interior),atlasSha256:sha(insidePng),producerSha256:sha(readFileSync('tools/art/beach-ship.ts')),glyphsSha256:sha(readFileSync('art/source/hub-nameplates.json')),floorLabels:[{sprite:'ship-lower-deck-label',text:'← LOWER DECK',rect:{x:0,y:4,width:5,height:1},size:14},{sprite:'ship-helm-label',text:'HELM',rect:{x:5,y:4,width:4,height:1},size:14}]},null,2)+'\n');mkdirSync('assets/audio',{recursive:true});
}
