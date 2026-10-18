import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';

type Crop={left:number;top:number;width:number;height:number};
type Pose={width:number;height:number;rgba:Buffer};
type Export={png:Buffer;width:number;height:number;source:string;crop:Crop};
const masters={props:'art/source/coast-life-props-master.png',small:'art/source/coast-life-small-props-master.png',gull:'art/source/coast-life-gull-master.png',marine:'art/source/coast-life-marine-master.png',plane:'art/source/coast-life-plane-master.png'};
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
// These rectangles follow the actual approved pixels, whose padding is not a
// regular grid. No original master is repainted or overwritten by extraction.
const crops:Record<string,{master:keyof typeof masters;crop:Crop}>={
 palm:{master:'props',crop:{left:636,top:0,width:322,height:355}},
 bar:{master:'props',crop:{left:0,top:345,width:365,height:300}},
 cabana:{master:'props',crop:{left:370,top:351,width:324,height:294}},
 chair:{master:'props',crop:{left:737,top:359,width:170,height:281}},
 recliner:{master:'props',crop:{left:995,top:361,width:220,height:279}},
 parasol:{master:'props',crop:{left:8,top:643,width:325,height:309}},
 pole:{master:'props',crop:{left:480,top:927,width:18,height:37}},
 boat:{master:'props',crop:{left:704,top:646,width:163,height:308}},
 rocks:{master:'props',crop:{left:4,top:968,width:322,height:270}},
 grass:{master:'props',crop:{left:356,top:959,width:275,height:278}},
 mooring:{master:'props',crop:{left:680,top:958,width:154,height:279}},
 towel:{master:'small',crop:{left:45,top:40,width:390,height:505}},
 table:{master:'small',crop:{left:465,top:150,width:375,height:368}},
 net:{master:'small',crop:{left:870,top:80,width:640,height:430}},
 sandcastle:{master:'small',crop:{left:25,top:570,width:510,height:420}},
 footprints:{master:'small',crop:{left:580,top:565,width:430,height:425}},
 shells:{master:'small',crop:{left:1060,top:610,width:440,height:350}},
};
const props:Record<string,{crop:string;size:[number,number];rotate?:number;parasol?:true;fill?:true}>={
 'beach-cabana':{crop:'cabana',size:[160,160]},'beach-tiki-bar':{crop:'bar',size:[192,160]},'solid-coast-beach-bar':{crop:'bar',size:[192,160]},
 'beach-palm':{crop:'palm',size:[96,128]},'coast-palm':{crop:'palm',size:[96,128]},
 'beach-parasol-coral':{crop:'parasol',size:[96,128],parasol:true},'beach-parasol-teal':{crop:'parasol',size:[96,128],parasol:true},'solid-coast-parasol':{crop:'parasol',size:[96,128],parasol:true},
 'solid-beach-recliner':{crop:'recliner',size:[64,96]},'solid-coast-deck-chair':{crop:'chair',size:[64,96]},
 'beach-woven-towel':{crop:'towel',size:[64,64]},'coast-towel':{crop:'towel',size:[64,64]},
 'beach-shrub':{crop:'grass',size:[64,64]},'solid-beach-low-table':{crop:'table',size:[64,64]},
 'coast-underwater-rock':{crop:'rocks',size:[64,64]},'solid-coast-sandcastle':{crop:'sandcastle',size:[64,64]},
 'solid-coast-volley-net':{crop:'net',size:[160,64],fill:true},'boat-wood':{crop:'boat',size:[64,32],rotate:90},
 'beach-grass':{crop:'grass',size:[32,32]},'beach-pebbles':{crop:'shells',size:[32,32]},'coast-footprints':{crop:'footprints',size:[32,32]},
 'coast-mooring-post':{crop:'mooring',size:[32,32]},'coast-pebble-cluster':{crop:'shells',size:[32,32]},'coast-shell':{crop:'shells',size:[32,32]},
};
async function trimAlpha(input:Buffer):Promise<Buffer>{
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});let left=info.width,top=info.height,right=-1,bottom=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 if(right<left)throw Error('Approved source crop is empty');
 return sharp(input).extract({left,top,width:right-left+1,height:bottom-top+1}).png().toBuffer();
}
async function crop(name:string):Promise<Buffer>{const source=crops[name];return trimAlpha(await sharp(readFileSync(masters[source.master])).extract(source.crop).png().toBuffer());}
async function fit(input:Buffer,width:number,height:number,options:{rotate?:number;fill?:boolean}={}):Promise<Buffer>{
 const sized=await sharp(input).rotate(options.rotate??0).resize(width,height,{fit:options.fill?'fill':'contain',position:'centre',background:{r:0,g:0,b:0,alpha:0},kernel:sharp.kernel.lanczos3}).png().toBuffer();
 return sized;
}
async function pose(input:Buffer,width:number,height:number):Promise<Pose>{return {width,height,rgba:await sharp(await fit(input,width,height)).ensureAlpha().raw().toBuffer()};}
/** Technical PNG crop/resize export only. Every painted pixel comes from an
 * approved generated master; alpha is retained, with no downloaded asset pixels. */
export async function renderCoastLifeAssets(){
 const exported:Record<string,Export>={};
 for(const [old,spec]of Object.entries(props)){
  const [width,height]=spec.size;let png:Buffer;
  if(spec.parasol){const canopy=await fit(await crop('parasol'),92,92);const pole=await fit(await crop('pole'),8,36,{fill:true});png=await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:pole,left:44,top:88},{input:canopy,left:2,top:0}]).png().toBuffer();}
  else png=await fit(await crop(spec.crop),width,height,{rotate:spec.rotate,fill:spec.fill});
  const source=crops[spec.crop];exported['coast-life-'+old]={png,width,height,source:masters[source.master],crop:source.crop};
 }
 const groups:Record<string,Pose[]>={fish:[],gull:[],dolphin:[{width:96,height:96,rgba:Buffer.alloc(96*96*4)}],seal:[]};
 // The source marine cells are six equal columns, three equal rows. Fractional
 // grid boundaries are rounded independently so the 1774×887 master is covered.
 for(let i=0;i<6;i++){
  const cell=(row:number)=>({left:Math.round(i*1774/6),top:Math.round(row*887/3),width:Math.round((i+1)*1774/6)-Math.round(i*1774/6),height:Math.round((row+1)*887/3)-Math.round(row*887/3)});
  for(const [kind,row,size]of [['fish',0,32],['dolphin',1,96],['seal',2,64]]as const){const input=await trimAlpha(await sharp(readFileSync(masters.marine)).extract(cell(row)).png().toBuffer());groups[kind].push(await pose(input,size,size));}
 }
 for(let i=0;i<6;i++){const p=groups.fish[i];groups.fish.push({width:p.width,height:p.height,rgba:await sharp(p.rgba,{raw:{width:p.width,height:p.height,channels:4}}).flop().raw().toBuffer()});}
 // Gull IDs: 0..2 north, 3..5 east, 6..8 south, 9..11 west.
 const gullCrops:Crop[]=[
  {left:48,top:60,width:315,height:330},{left:0,top:435,width:427,height:246},{left:40,top:724,width:332,height:286},
  {left:463,top:49,width:233,height:320},{left:430,top:428,width:269,height:288},{left:436,top:747,width:255,height:275},
  {left:730,top:100,width:375,height:280},{left:695,top:435,width:446,height:250},{left:738,top:722,width:362,height:280},
  {left:1150,top:47,width:248,height:323},{left:1136,top:427,width:275,height:288},{left:1127,top:744,width:267,height:280},
 ];
 for(const rect of gullCrops){const input=await trimAlpha(await sharp(readFileSync(masters.gull)).extract(rect).png().toBuffer());groups.gull.push(await pose(input,32,32));}
 const plane=await fit(await trimAlpha(await sharp(readFileSync(masters.plane)).extract({left:0,top:0,width:724,height:724}).png().toBuffer()),192,96);
 const composites:{input:Buffer;left:number;top:number}[]=[],rects:Record<string,{x:number;y:number;width:number;height:number}>={};let x=0,y=0,rowHeight=0;
 for(const [name,p]of Object.entries(exported)){if(x+p.width>1024){x=0;y+=rowHeight;rowHeight=0;}composites.push({input:p.png,left:x,top:y});rects[name]={x:x/32,y:y/32,width:p.width/32,height:p.height/32};x+=p.width;rowHeight=Math.max(rowHeight,p.height);}
 const atlas=await sharp({create:{width:1024,height:y+rowHeight,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composites).png().toBuffer(),poseStrips:Record<string,Buffer>={};
 for(const [group,poses]of Object.entries(groups)){const width=poses[0].width,height=poses[0].height;poseStrips[group]=await sharp({create:{width:width*poses.length,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(await Promise.all(poses.map(async(p,i)=>({input:await sharp(p.rgba,{raw:{width:p.width,height:p.height,channels:4}}).png().toBuffer(),left:i*width,top:0})))).png().toBuffer();}
 const metadata={version:1,origin:'Original generated PNG masters in the user-approved art scope. Crop/alpha-preserving native-size technical exports.',generation:'art/source/coast-life-generation.json',masters:Object.values(masters).map(path=>({path,sha256:sha(readFileSync(path))})),atlas:{path:'assets/tilesets/original/coast-life-props.png',width:1024,height:y+rowHeight,sha256:sha(atlas),rects},props:Object.fromEntries(Object.entries(exported).map(([key,p])=>[key,{source:p.source,crop:p.crop,width:p.width,height:p.height,sha256:sha(p.png)}])),additionalParts:{parasolPole:crops.pole},poseCrops:{gull:gullCrops,marine:{columns:6,rows:3,width:1774,height:887,roundCellBoundaries:true,fishLeft:'horizontal mirror of the six right-facing approved PNG cells'}},poseGroups:Object.fromEntries(Object.entries(groups).map(([key,poses])=>[key,poses.map(p=>({width:p.width,height:p.height,rgbaSha256:sha(p.rgba)}))])),poseStrips:Object.entries(poseStrips).map(([name,png])=>({path:`art/source/coast-life-${name}-poses.png`,sha256:sha(png)})),plane:{source:masters.plane,crop:{left:0,top:0,width:724,height:724},width:192,height:96,sha256:sha(plane)}};
 return {props:exported,poses:groups,plane,atlas,poseStrips,metadata};
}
export async function writeCoastLifeAssets(){
 const result=await renderCoastLifeAssets();await mkdir('assets/tilesets/original',{recursive:true});
 const catalog=JSON.parse(readFileSync('art/tile-catalog.json','utf8'));
 for(const [name,rect]of Object.entries(result.metadata.atlas.rects)){const old=catalog[name.slice('coast-life-'.length)];catalog[name]={...structuredClone(old),sheet:'assets/tilesets/original/coast-life-props.png',rect,sourceId:'original'};}
 await writeFile('assets/tilesets/original/coast-life-props.png',result.atlas);
 for(const [group,png]of Object.entries(result.poseStrips))await writeFile(`art/source/coast-life-${group}-poses.png`,png);
 await writeFile('art/source/coastal-flight-plane.png',result.plane);
 await writeFile('art/source/coast-life-assets.json',JSON.stringify(result.metadata,null,2)+'\n');
 await writeFile('art/tile-catalog.json',JSON.stringify(catalog,null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await writeCoastLifeAssets();
