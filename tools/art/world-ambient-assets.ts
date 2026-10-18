import{readFileSync}from'node:fs';
import{writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import sharp from'sharp';
import type{NativeMotionPose}from'./native-motion';
const master='art/source/world-ambient-fx-master.png';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const recipes=[
 {name:'steam',bounds:[0,340],xs:[[60,235],[260,465],[505,670],[735,885]],size:[16,24],opacity:.55},
 {name:'ripples',bounds:[345,535],xs:[[20,230],[230,455],[450,700],[690,940]],size:[32,16],opacity:.7},
 {name:'device',bounds:[565,715],xs:[[65,225],[285,445],[495,675],[720,900]],size:[24,10],opacity:.6},
 {name:'lamp',bounds:[745,955],xs:[[60,205],[285,430],[505,665],[735,890]],size:[8,12],opacity:.55},
 {name:'leaves',bounds:[975,1175],xs:[[55,230],[285,450],[475,690],[745,900]],size:[8,12],opacity:.9},
 {name:'cascade',bounds:[1178,1448],xs:[[65,205],[285,430],[515,665],[735,890]],size:[12,24],opacity:.65},
 {name:'glint',bounds:[1450,1659],xs:[[55,220],[275,445],[495,675],[725,905]],size:[12,12],opacity:.45},
];
async function alphaTrim(input:Buffer):Promise<Buffer>{const{data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});let left=info.width,top=info.height,right=-1,bottom=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}if(right<left)throw Error('Empty original ambient crop');return sharp(input).extract({left,top,width:right-left+1,height:bottom-top+1}).png().toBuffer();}
/** Lossless straight-alpha stitch. Compositing RGBA over a blank canvas can
 * round low-alpha RGB channels and make native poses differ from editable PNGs. */
export async function packAmbientPoses(poses:NativeMotionPose[]):Promise<Buffer>{if(!poses.length)throw Error('Ambient pose strip requires frames');const{width:pw,height}=poses[0],width=pw*poses.length,raw=Buffer.alloc(width*height*4);for(const[i,p]of poses.entries()){if(p.width!==pw||p.height!==height)throw Error('Ambient pose dimensions must share a native canvas');for(let y=0;y<height;y++)p.rgba.copy(raw,(y*width+i*pw)*4,y*pw*4,(y+1)*pw*4);}return sharp(raw,{raw:{width,height,channels:4}}).png().toBuffer();}
export async function renderWorldAmbientAssets(){
 const groups:Record<string,NativeMotionPose[]>={},strips:Record<string,Buffer>={},source=readFileSync(master);
 for(const r of recipes){const[width,height]=r.size;groups[r.name]=[];for(const[left,right]of r.xs){const input=await alphaTrim(await sharp(source).extract({left,top:r.bounds[0],width:right-left,height:r.bounds[1]-r.bounds[0]}).png().toBuffer());const rgba=await sharp(input).resize(width,height,{fit:'contain',background:{r:0,g:0,b:0,alpha:0},kernel:sharp.kernel.lanczos3}).ensureAlpha().raw().toBuffer();for(let i=0;i<rgba.length;i+=4){rgba[i+3]=Math.round(rgba[i+3]*r.opacity);if(!rgba[i+3])rgba.fill(0,i,i+4);}groups[r.name].push({width,height,rgba});}}
 const marineSources=JSON.parse(readFileSync('art/source/world-ambient-generation.json','utf8')).marineInputs;
 for(const name of['fish','gull']){const path=`art/source/world-ambient-approved-${name}-strip.png`,input=readFileSync(path);if(!marineSources.some((p:any)=>p.path===path&&p.sha256===sha(input)))throw Error('Original approved ambient marine input changed');const{data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});const size=32;groups[name]=[];for(let x=0;x<info.width;x+=size){const rgba=Buffer.alloc(size*size*4);for(let y=0;y<size;y++)data.copy(rgba,y*size*4,(y*info.width+x)*4,(y*info.width+x+size)*4);groups[name].push({width:size,height:size,rgba});}}
 for(const[name,poses]of Object.entries(groups))strips[name]=await packAmbientPoses(poses);
 const planter=await sharp('art/source/world-ambient-planter-approved-atlas.png').extract({left:0,top:128,width:96,height:96}).png().toBuffer();
 const plants=planter;
 const metadata={version:1,master:{path:master,sha256:sha(source)},generation:'art/source/world-ambient-generation.json',marineSources,recipes,plants:{path:'assets/tilesets/original/world-ambient-plants.png',sha256:sha(plants),sources:[{path:'art/source/world-ambient-planter-approved-atlas.png',sha256:sha(readFileSync('art/source/world-ambient-planter-approved-atlas.png')),crop:{left:0,top:128,width:96,height:96},receipt:'Exact approved original interior planter; art/source/interior-reference-original.png c3f0d3716b93052c18238e2b0b65795eb1ba6de6bf95776643d821884963e73c; original crop55,446..392,838; native96canvas'}]},groups:Object.fromEntries(Object.entries(groups).map(([name,poses])=>[name,{path:`art/source/world-ambient-${name}-poses.png`,sha256:sha(strips[name]),width:poses[0].width,height:poses[0].height,frames:poses.length,rgbaHashes:poses.map(p=>sha(p.rgba)),maxPaintedPixels:Math.max(...poses.map(p=>{let n=0;for(let i=3;i<p.rgba.length;i+=4)if(p.rgba[i])n++;return n;}))}]))};
 return{groups,strips,plants,metadata};
}
export async function writeWorldAmbientAssets(){const r=await renderWorldAmbientAssets();for(const[name,png]of Object.entries(r.strips))await writeFile(`art/source/world-ambient-${name}-poses.png`,png);await writeFile(r.metadata.plants.path,r.plants);const c=JSON.parse(readFileSync('art/tile-catalog.json','utf8'));c['world-ambient-plant-palm']={...structuredClone(c['plant-palm']),sheet:r.metadata.plants.path,rect:{x:0,y:0,width:3,height:3},level:'belowAvatar',upperCells:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],sourceId:'original'};await writeFile('art/tile-catalog.json',JSON.stringify(c,null,2)+'\n');await writeFile('art/source/world-ambient-assets.json',JSON.stringify(r.metadata,null,2)+'\n');}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await writeWorldAmbientAssets();
