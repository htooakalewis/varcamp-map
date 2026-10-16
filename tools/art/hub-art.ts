import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
export interface HubArtMaster { glyphs:Record<string,string[]>;labels:{id:string;text:string}[];navigation:{id:string;lines:string[]}[]; }
/** Original integer-grid block letters. Pixel runs are native rectangles, never a font API. */
export function renderHubMasters(m:HubArtMaster):{labels:string;buildings:string} {
 const text=(value:string,y:number,width:number,scale:number,color:string)=>{
  const advance=6*scale,ink=value.length*advance-scale,left=Math.floor((width-ink)/2);
  if(left<(width<160?8:12))throw Error(`Pixel nameplate needs padding: ${value}`);
  let out='';for(const[i,char]of[...value].entries()){
   const glyph=m.glyphs[char];if(!glyph)throw Error(`Missing original glyph: ${char}`);
   for(const[row,line]of glyph.entries())for(let x=0;x<5;x++)if(line[x]==='1'){
    const start=x;while(x+1<5&&line[x+1]==='1')x++;
    out+=`<rect x="${left+i*advance+start*scale}" y="${y+row*scale}" width="${(x-start+1)*scale}" height="${scale}" fill="${color}"/>`;
   }
  }return out;
 };
 const panel=(y:number,w:number,h:number,ornaments=true)=>`<rect x="2" y="${y+2}" width="${w-4}" height="${h-4}" fill="#dbb66b"/><rect x="5" y="${y+5}" width="${w-10}" height="${h-10}" fill="#0c1d30"/>`+(ornaments?`<path d="M12 ${y+12}h12 M${w-24} ${y+12}h12 M12 ${y+h-12}h12 M${w-24} ${y+h-12}h12" stroke="#7aa7b5" stroke-width="2"/>`:'');
 let labels='<svg xmlns="http://www.w3.org/2000/svg" width="384" height="1632" shape-rendering="crispEdges">';
 for(const[i,label]of m.labels.entries()){
  const first=label.text.replace(' SPEAKER ROOM',''),y=i*64;
  labels+=panel(y,384,64)+text(first,y+9,384,3,'#ffe4a0')+text('SPEAKER ROOM',y+36,384,3,'#c9edf2');
 }
 let y=768;
 for(const nav of m.navigation){
  // Preserve existing atlas slots, room-label pixels, junction boards and gate plaques.
  const short=nav.lines.length===1,oldHeight=nav.id==='welcome'?96:nav.id==='brand'?64:short?32:64;
  const compact=['welcome','brand','directory','you-are-here'].includes(nav.id);
  const w=compact?(nav.id==='welcome'?160:nav.id==='brand'?192:128):nav.id.startsWith('gate-')?192:256,h=compact?32:oldHeight;
  labels+=panel(y,w,h,!compact);
  if(nav.id==='welcome')labels+=text(nav.lines[0],y+7,w,1,'#ffe4a0')+text(nav.lines[1],y+18,w,1,'#c9edf2');
  else if(compact)labels+=text(nav.lines[0],y+12,w,1,'#ffe4a0');
  else if(short)labels+=text(nav.lines[0],y+9,w,2,'#ffe4a0');
  else labels+=text(nav.lines[0],y+9,w,3,'#ffe4a0')+text(nav.lines[1],y+39,w,2,'#c9edf2');
  y+=oldHeight;
 }
 // Preserve old atlas boundary pixels used by the unchanged campus gate stamp.
 labels+='<rect x="191" y="1439" width="2" height="1" fill="#6d502c"/>';
 // Original compact arrows: one7px line =21 physical pixels at the observed default3×.
 const arms=[['north','N HALLS/MAZES',48,1440],['west','W PARK/ARCADE',0,1472],['east','E BEACH/SHIP',96,1472],['south','S GARDEN/CAFE',48,1504]] as const;
 for(const[direction,copy,x,ay]of arms){
  const path=direction==='north'?'M0 5H38L48 0l10 5h38v27H0z':direction==='south'?'M0 0h96v27H58l-10 5-10-5H0z':direction==='west'?'M0 16L10 0h86v32H10z':'M0 0h86l10 16-10 16H0z';
  labels+=`<g data-direction="${direction}" transform="translate(${x} ${ay})"><path d="${path}" fill="#dfbd75" stroke="#6d502c" stroke-width="1"/><path d="${path}" transform="translate(3 3) scale(.9375 .8125)" fill="#12293a"/>${text(copy,direction==='north'?14:direction==='south'?11:13,96,1,'#c9edf2')}</g>`;
 }
 labels+='</svg>\n';
 // Fixed camera: upright warm walls/windows, pitched roof depth, visible south front entrance.
 const windows=[64,256].map(x=>`<rect x="${x-4}" y="228" width="72" height="72" fill="#b79254"/><rect x="${x}" y="232" width="64" height="64" fill="#76b5c8"/><path d="M${x+8} 240h48v48h-48z" fill="#17394c"/><path d="M${x+32} 232v64 M${x} 264h64" stroke="#a6d5df" stroke-width="4"/><path d="M${x+8} 244l44 32" stroke="#5f9aa9" stroke-width="3"/>`).join('');
 const bricks=Array.from({length:7},(_,i)=>`<path d="M36 ${184+i*24}h312" stroke="#8c795f" stroke-width="2"/>`).join('');
 const roofSeams=Array.from({length:5},(_,i)=>{const y=42+i*19;return `<path d="M${192-i*30} ${y}l-132 72 M${192+i*30} ${y}l132 72" stroke="#607e98" stroke-width="3"/>`;}).join('');
 const house=`<rect x="24" y="96" width="344" height="268" fill="#020c18" opacity=".6"/><rect x="32" y="128" width="320" height="224" fill="#b7a181"/><path d="M32 128h16v224H32z" fill="#d4bf9b"/><path d="M336 128h16v224h-16z" fill="#867152"/>${bricks}<rect x="32" y="336" width="320" height="16" fill="#b39560"/><path d="M16 112L192 16l176 96v112H16z" fill="#071421"/><path d="M192 128L16 224h352z" fill="#c0aa84"/><path d="M16 112L192 16v112L16 224z" fill="#344f6d"/><path d="M192 16l176 96v112l-176-96z" fill="#233b58"/><path d="M16 224l176-96 176 96" fill="none" stroke="#d5ba7b" stroke-width="9"/><path d="M16 112L192 16l176 96" fill="none" stroke="#617e96" stroke-width="5"/><path d="M192 16v112" stroke="#d9c18b" stroke-width="5"/><g clip-path="url(#hub-roof-planes)">${roofSeams}<path d="M68 100l54-30v40l-54 30z" fill="#9edbe1" stroke="#d4c299" stroke-width="4"/><path d="M80 96v36 M96 87v36 M112 78v36" stroke="#365b70" stroke-width="3"/><path d="M236 68l66 36v24l-66-36z" fill="#122e4f" stroke="#719cb8" stroke-width="3"/><path d="M248 75v24 M264 83v24 M280 92v24" stroke="#4f839d" stroke-width="2"/></g>${windows}<rect x="152" y="276" width="80" height="76" fill="#c8a76b"/><rect x="160" y="284" width="64" height="68" fill="#08192c"/><rect x="168" y="292" width="48" height="60" fill="#234658"/><path d="M168 292v60 M216 292v60" stroke="#84dfeb" stroke-width="3"/><path d="M144 264h96l8 16H136z" fill="#516e83"/><path d="M136 280h112v6H136z" fill="#d3b678"/><path d="M160 352h64v32h-64z" fill="#8da9af"/><path d="M160 360h64 M160 372h64" stroke="#d4bf86" stroke-width="3"/>`;
 let buildings='<svg xmlns="http://www.w3.org/2000/svg" width="384" height="576" shape-rendering="crispEdges"><defs><clipPath id="hub-roof-planes"><path d="M16 112L192 16v112L16 224z M192 16l176 96v112l-176-96z"/></clipPath></defs>';
 buildings+=house;
 // Six-tile moon fountain: warm stone rim, tiered cyan basin, upright crescent sculpture.
 buildings+=`<g transform="translate(0 384)"><ellipse cx="96" cy="163" rx="90" ry="23" fill="#061523"/><path d="M8 118Q8 88 96 88t88 30v32q0 30-88 30T8 150z" fill="#907752"/><ellipse cx="96" cy="118" rx="88" ry="30" fill="#d5bc7a"/><ellipse cx="96" cy="116" rx="74" ry="23" fill="#193d59"/><ellipse cx="96" cy="114" rx="65" ry="18" fill="#3e98ae"/><path d="M30 115q66 18 132 0 M46 109q50-14 100 0" fill="none" stroke="#8adddf" stroke-width="3"/><path d="M74 106v-21h44v21" fill="#bda579"/><ellipse cx="96" cy="84" rx="31" ry="10" fill="#e0c790"/><path d="M109 15a39 39 0 1 0 12 61 35 35 0 0 1-12-61z" fill="#f7dfa3" stroke="#9b7849" stroke-width="3"/><path d="M100 20a34 34 0 0 0 8 53" fill="none" stroke="#fff0c9" stroke-width="3"/><path d="M53 91l-4 25 M139 91l4 25" stroke="#b2f2ee" stroke-width="3"/><circle cx="49" cy="119" r="4" fill="#b2f2ee"/><circle cx="143" cy="119" r="4" fill="#b2f2ee"/></g>`;
 buildings+='</svg>\n';return{labels,buildings};
}
export function writeHubMasters():void {
 const masters=renderHubMasters(JSON.parse(readFileSync('art/source/hub-nameplates.json','utf8')) as HubArtMaster);
 writeFileSync('art/source/hub-labels.svg',masters.labels);writeFileSync('art/source/hub-buildings.svg',masters.buildings);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)writeHubMasters();
