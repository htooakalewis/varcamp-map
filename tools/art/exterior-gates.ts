import {readFileSync,writeFileSync} from 'node:fs';
/** Original native-pixel masonry/timber gates. Upright elevations; side gates are authored, never rotated. */
export const EXTERIOR_GATE_COPY:Record<string,string>={solar:'SOLAR HALL',lunar:'LUNAR HALL',maze:'ORBIT MAZE',festival:'PARK / ARCADE',shipyard:'STAR HARBOR',campus:'EXPLORATION'};
export const EXTERIOR_ROAD_COPY:Record<string,string>={north:'HALLS / MAZES',west:'PARK / ARCADE',east:'BEACH / SHIP',south:'GARDEN / CAFE'};
export function renderExteriorGates():string{
 const glyphs=JSON.parse(readFileSync('art/source/hub-nameplates.json','utf8')).glyphs as Record<string,string[]>;
 const text=(s:string,y:number,w:number,scale=1)=>{const ink=s.length*6*scale-scale,left=Math.floor((w-ink)/2);if(left<6)throw Error('Gate copy lacks padding: '+s);let out='';for(const[i,c]of[...s].entries())for(const[j,row]of glyphs[c].entries())for(let x=0;x<5;x++)if(row[x]==='1')out+=`<rect x="${left+i*6*scale+x*scale}" y="${y+j*scale}" width="${scale}" height="${scale}" fill="#ffe7ac"/>`;return out;};
 const colors:Record<string,string[]>={solar:['#dbba63','#936c37','#ffe19a'],lunar:['#a9c6e0','#435b82','#d6eef7'],maze:['#ba9bdb','#61517e','#d7c1f0'],festival:['#b6ca8b','#51704a','#d6e9a9'],shipyard:['#c4a071','#77533e','#e9d19b'],campus:['#bcd0aa','#537b70','#e2edc1']};
 const symbol=(id:string,x:number,y:number)=>{
  const begin=`<g transform="translate(${x} ${y})">`,end='</g>';
  const shapes:Record<string,string>={solar:'<circle cx="16" cy="16" r="9" fill="#f7d570"/><path d="M16 0v4m0 24v4M0 16h4m24 0h4M4 4l4 4m16 16 4 4M4 28l4-4M24 8l4-4" stroke="#f7d570" stroke-width="3"/>',lunar:'<path d="M22 2a15 15 0 1 0 7 25A14 14 0 0 1 22 2z" fill="#cfeaf4"/>',maze:'<path d="M2 28V2h28v28H8V8h16v16H14V14h5" fill="none" stroke="#d6c0f4" stroke-width="4"/>',festival:'<path d="M16 30V12M16 21C-4 23 0 2 4 2c15 0 14 14 12 19M16 15C16 0 31 0 31 3c0 13-9 17-15 12" fill="#c7e6a0" stroke="#8fae71" stroke-width="2"/>',shipyard:'<path d="M16 0v24M7 6h18M2 20q1 12 14 10t14-10M2 20l6 3M30 20l-6 3" fill="none" stroke="#e5d1a0" stroke-width="4"/><circle cx="16" cy="3" r="3" fill="#e5d1a0"/>',campus:'<path d="M2 10h22v12q0 8-11 8T2 22z" fill="#d7e9b6"/><path d="M24 12h6v9h-6M6 6l3-5m6 5 3-5" fill="none" stroke="#d7e9b6" stroke-width="3"/>'};return begin+shapes[id]+end;
 };
 let svg='<svg xmlns="http://www.w3.org/2000/svg" width="512" height="704" shape-rendering="crispEdges">';
 for(const[i,[id,copy]]of Object.entries(EXTERIOR_GATE_COPY).entries()){
  const[trim,stone,light]=colors[id],side=id==='festival'||id==='shipyard',x=i%2*256,y=Math.floor(i/2)*192;
  svg+=`<g id="gate-${id}" transform="translate(${x} ${y})">`;
  if(side){
   // Horizontal passage stays four tiles high. Its north/south piers and upright nameplate remain camera-upright.
   svg+=`<path d="M8 6h240v26H8z M8 160h240v26H8z" fill="${stone}"/><path d="M8 6h240v7H8z M8 160h240v7H8z" fill="${trim}"/><path d="M12 27h236v5H12z M12 181h236v5H12z" fill="#142439"/><path d="M16 32v128 M240 32v128" stroke="#d7b77c" stroke-width="3" stroke-dasharray="8 8" opacity=".55"/><rect x="30" y="1" width="196" height="30" fill="#112536" stroke="${trim}" stroke-width="2"/>${text(copy,9,256,2)}`;
   for(const px of[16,212])svg+=`<rect x="${px}" y="163" width="28" height="23" fill="#142c39"/>${symbol(id,px+2,160)}`;
  }else{
   svg+=`<path d="M4 22h56v170H4z M196 22h56v170h-56z" fill="${stone}"/><path d="M4 22h9v163H4z M196 22h9v163h-9z" fill="${trim}"/><path d="M52 22h8v170h-8z M244 22h8v170h-8z" fill="#142439"/><path d="M0 178h64v14H0z M192 178h64v14h-64z" fill="${trim}"/><path d="M0 24L32 8h192l32 16v24H0z" fill="#162b42" stroke="${trim}" stroke-width="3"/><rect x="28" y="14" width="200" height="26" fill="#112536"/>${text(copy,20,256,2)}`;
   for(const px of[16,208])svg+=`<rect x="${px-4}" y="71" width="40" height="48" fill="#142c39" stroke="${trim}" stroke-width="2"/>${symbol(id,px,80)}<path d="M${px} 135h32 M${px} 151h32" stroke="${light}" stroke-width="3"/>`;
   for(const py of[55,126,165])svg+=`<path d="M14 ${py}h38 M206 ${py}h38" stroke="${trim}" stroke-width="2"/>`;
  }
  if(id==='shipyard')svg+='<path d="M16 167h224 M16 177h224" stroke="#513a30" stroke-width="2"/>';
  svg+='</g>';
 }
 // Compact double-line road plaques and a plaza-return plaque; original block glyphs, no font dependency.
 for(const[i,[id,copy]]of Object.entries({...EXTERIOR_ROAD_COPY,plaza:'PLAZA'}).entries()){
  const x=i%4*128,y=576+Math.floor(i/4)*32;svg+=`<g id="road-${id}" transform="translate(${x} ${y})"><rect x="1" y="1" width="126" height="30" fill="#cdb07b"/><rect x="4" y="4" width="120" height="24" fill="#112536"/>${text(id==='plaza'?'RETURN TO':'OUTER ROAD',7,128)}${text(copy,18,128)}</g>`;
 }
 svg+='</svg>\n';return svg;
}
export function writeExteriorGates():void{writeFileSync('art/source/exterior-gates.svg',renderExteriorGates());}
