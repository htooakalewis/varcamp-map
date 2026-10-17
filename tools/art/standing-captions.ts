import{readFileSync,writeFileSync,readdirSync,existsSync}from'node:fs';
import{createHash}from'node:crypto';
import{isDeepStrictEqual}from'node:util';
import{resolve}from'node:path';
import{pathToFileURL}from'node:url';
import sharp from'sharp';
import type{MapLayout,LayoutSign}from'../maps/types';
export const CAPTION_IMAGE='assets/tilesets/original/standing-captions.png';
const META='art/source/standing-captions.json',SVG='art/source/standing-captions.svg',FONT='art/source/hub-nameplates.json';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const arrows:Record<string,string[]>={'↑':['00100','01110','11111','00100','00100','00100','00100'],'↓':['00100','00100','00100','00100','11111','01110','00100'],'←':['00100','01000','10000','11111','10000','01000','00100'],'→':['00100','00010','00001','11111','00001','00010','00100']};
export interface CaptionSpec{map:string;face:string;sign:LayoutSign;}
export interface CaptionRow extends CaptionSpec{atlasX:number;atlasY:number;}
export function captionSpecs(layout:MapLayout):CaptionSpec[]{
 const result:CaptionSpec[]=[];for(const link of layout.standingSigns??[])if(link.text!==undefined){
  const rows=layout.signs?.filter(s=>s.name===link.text)??[];if(link.faceKind!==undefined||rows.length!==1)throw Error('Standing caption requires one linked placement/text');
  result.push({map:layout.id,face:link.face,sign:structuredClone(rows[0])});
 }return result;
}
export function renderCaptionMaster(specs:CaptionSpec[]):{svg:string;rows:CaptionRow[];width:number;height:number}{
 const glyphs={...JSON.parse(readFileSync(FONT,'utf8')).glyphs,...arrows}as Record<string,string[]>;const rows:CaptionRow[]=[];const ids=new Set<string>();let x=0,y=0,art='';
 for(const spec of specs){const s=spec.sign,key=spec.map+'/'+s.name;if(ids.has(key))throw Error('Duplicate standing caption');ids.add(key);
  const w=s.width*32,h=s.height*32,pad=s.padding??0,color=s.color??'#f1d9a0';
  if(![s.x,s.y,s.width,s.height,pad].every(Number.isInteger)||s.width<1||s.height!==1||w>512||pad<0||pad*2>=h||!/^#[\da-f]{6}$/i.test(color)||!['left','center'].includes(s.align??'left'))throw Error(`${key}: invalid standing caption bounds/style/padding`);
  if(!Number.isFinite(s.fontSize??18)||(s.fontSize??18)<=0)throw Error(`${key}: invalid standing caption font size`);
  const scale=Math.max(1,Math.floor((s.fontSize??18)/7));if(scale>3)throw Error(`${key}: unsupported standing caption size`);
  const chars=[...s.text];if(!chars.length||chars.some(c=>!glyphs[c]))throw Error(`${key}: unsupported or empty standing caption glyph`);
  const widths=chars.map(c=>c===' '?2*scale:5*scale),ink=widths.reduce((a,b)=>a+b,0)+chars.length-1,high=7*scale;
  if(ink>w-pad*2||high>h-pad*2)throw Error(`${key}: standing caption does not fit padding`);
  if(x+s.width>16){x=0;y++;}if(y>=6)throw Error('Standing caption atlas exceeds512x192');const row={...structuredClone(spec),atlasX:x,atlasY:y};rows.push(row);
  let px=x*32+(s.align==='center'?Math.floor((w-ink)/2):pad);const py=y*32+Math.floor((h-high)/2);
  for(const[c,char]of chars.entries()){
   if(char!==' ')for(const[gy,bits]of glyphs[char].entries())for(let gx=0;gx<5;gx++)if(bits[gx]==='1')art+=`<rect x="${px+gx*scale}" y="${py+gy*scale}" width="${scale}" height="${scale}" fill="${color}"/>`;
   px+=widths[c]+1;
  }x+=s.width;
 }
 const height=(y+1)*32;return{svg:`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="${height}" shape-rendering="crispEdges">${art}</svg>\n`,rows,width:512,height};
}
export function readStandingCaptions(layout:MapLayout):{rows:CaptionRow[];width:number;height:number;image:string;pngSha256:string}|undefined{
 const expected=captionSpecs(layout);if(!expected.length)return;
 const meta=JSON.parse(readFileSync(META,'utf8'));if(meta.schemaVersion!==1||meta.glyphsSha256!==sha(readFileSync(FONT))||meta.producerSha256!==sha(readFileSync('tools/art/standing-captions.ts')))throw Error('Stale standing caption font/producer');
 const rendered=renderCaptionMaster(meta.specs),png=readFileSync(CAPTION_IMAGE);
 if(meta.svgSha256!==sha(rendered.svg)||readFileSync(SVG,'utf8')!==rendered.svg||meta.pngSha256!==sha(png)||png.readUInt32BE(16)!==rendered.width||png.readUInt32BE(20)!==rendered.height)throw Error('Stale standing caption artwork');
 const selected=rendered.rows.filter(r=>r.map===layout.id);if(!isDeepStrictEqual(selected.map(({atlasX:_x,atlasY:_y,...spec})=>spec),expected))throw Error('Stale standing caption semantic source');
 return{rows:selected,width:rendered.width,height:rendered.height,image:CAPTION_IMAGE,pngSha256:meta.pngSha256};
}
export async function checkStandingCaptionArt():Promise<void>{
 if(!existsSync(META)&&(!existsSync('world/layouts')||!readdirSync('world/layouts').filter(f=>f.endsWith('.json')).some(f=>captionSpecs(JSON.parse(readFileSync('world/layouts/'+f,'utf8'))).length)))return;
 const specs=JSON.parse(readFileSync(META,'utf8')).specs as CaptionSpec[];const rendered=renderCaptionMaster(specs),expected=await sharp(Buffer.from(rendered.svg)).ensureAlpha().raw().toBuffer(),actual=await sharp(CAPTION_IMAGE).ensureAlpha().raw().toBuffer();if(!expected.equals(actual))throw Error('Standing caption PNG differs from original glyph artwork');
 for(const file of readdirSync('world/layouts').filter(f=>f.endsWith('.json')))readStandingCaptions(JSON.parse(readFileSync('world/layouts/'+file,'utf8')));
}
export async function writeStandingCaptions():Promise<void>{
 const specs=readdirSync('world/layouts').filter(f=>f.endsWith('.json')).sort().flatMap(f=>captionSpecs(JSON.parse(readFileSync('world/layouts/'+f,'utf8'))));const rendered=renderCaptionMaster(specs),png=await sharp(Buffer.from(rendered.svg)).png().toBuffer();
 writeFileSync(SVG,rendered.svg);writeFileSync(CAPTION_IMAGE,png);writeFileSync(META,JSON.stringify({schemaVersion:1,specs,glyphsSha256:sha(readFileSync(FONT)),producerSha256:sha(readFileSync('tools/art/standing-captions.ts')),svgSha256:sha(rendered.svg),pngSha256:sha(png)},null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)void writeStandingCaptions().catch(error=>{console.error(error);process.exitCode=1;});
