import sharp from 'sharp';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),read=p=>JSON.parse(readFileSync(root+'/'+p,'utf8'));
const catalog=read('art/tile-catalog.json'),usage=read('.qa/map-stability-audit/static-audit.json').usedSprites;
const images=new Map(),empty=new Map(),faint=[];
let checked=0;
for(const id of Object.keys(usage)){
 const s=catalog[id];if(!s.blockingCells.length)continue;
 if(!images.has(s.sheet))images.set(s.sheet,await sharp(root+'/'+s.sheet).ensureAlpha().raw().toBuffer({resolveWithObject:true}));
 const a=images.get(s.sheet),zero=[];
 for(const[x,y]of s.blockingCells){
  let visible=0,opaque=0;
  for(let py=0;py<32;py++)for(let px=0;px<32;px++){const alpha=a.data[(((s.rect.y+y)*32+py)*a.info.width+(s.rect.x+x)*32+px)*4+3];if(alpha>0)visible++;if(alpha>=192)opaque++;}
  checked++;
  if(!visible)zero.push([x,y]);else if(opaque<32)faint.push({sprite:id,cell:[x,y],opaque,visible});
 }
 if(zero.length)empty.set(id,zero);
}
const placements=[];
for(const f of readdirSync(root+'/world/layouts').filter(f=>f.endsWith('.json'))){
 const l=read('world/layouts/'+f),m=read('maps/'+l.id+'.tmj');
 const mask=m.layers.find(l=>l.name==='physical-collisions').data;
 const isOpen=(x,y)=>x>=0&&y>=0&&x<m.width&&y<m.height&&!mask[y*m.width+x];
 for(const p of l.placements){
  const cells=empty.get(p.sprite);if(!cells||p.renderRole==='cutaway')continue;
  const s=catalog[p.sprite];
  for(let oy=0;oy<p.height;oy+=s.rect.height)for(let ox=0;ox<p.width;ox+=s.rect.width)for(const[x,y]of cells){
   const world=[p.x+ox+x,p.y+oy+(p.flipY?s.rect.height-1-y:y)];
   if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>isOpen(world[0]+dx,world[1]+dy)))placements.push({map:l.id,id:p.id,sprite:p.sprite,cell:world,layer:p.layer});
  }
 }
}
const report={checkedSpriteCollisionCells:checked,emptySpriteCells:Object.fromEntries(empty),faintSpriteCells:faint,emptyBorderPlacements:placements};
writeFileSync(root+'/.qa/map-stability-audit/alpha-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checked,emptySprites:empty.size,emptyBorderPlacements:placements.length,faintCells:faint.length}));
console.log(JSON.stringify(placements,null,2));
