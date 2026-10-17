import type {Sprite,TileCatalog} from '../art/catalog';
import type {MapLayout} from './types';
/** Shared author/compiler validation; visual depth never invents a support mask. */
export function validateSpriteDepth(id:string,s:Sprite):void {
 if(s.upperCells!==undefined){
  const seen=new Set<string>();
  if(!Array.isArray(s.upperCells))throw Error(`${id}: upper cells must be an array`);
  for(const cell of s.upperCells){
   if(!Array.isArray(cell)||cell.length!==2||!cell.every(Number.isInteger)||cell[0]<0||cell[1]<0||cell[0]>=s.rect.width||cell[1]>=s.rect.height||seen.has(cell.join(',')))throw Error(`${id}: invalid or duplicate upper cell`);
   seen.add(cell.join(','));
  }
 }
 if(s.standingRole!==undefined&&!['face','support'].includes(s.standingRole))throw Error(`${id}: invalid standing role`);
}
export function validateStandingSigns(layout:MapLayout,catalog:TileCatalog):void {
 const placements=new Map(layout.placements.map(p=>[p.id,p])),faces=new Set<string>(),supports=new Set<string>();
 for(const sign of layout.standingSigns??[]){
  if(!sign||typeof sign!=='object')throw Error('Invalid standing sign assembly');
  const image=sign.faceKind==='image',key=(image?'image:':'placement:')+sign.face;
  if(!sign||Object.keys(sign).some(k=>!['face','supports','text','faceKind'].includes(k))||sign.faceKind!==undefined&&!image||typeof sign.face!=='string'||!Array.isArray(sign.supports)||!sign.supports.length||faces.has(key))throw Error('Invalid or duplicate standing sign assembly');
  const placement=placements.get(sign.face),face=image?layout.images?.find(p=>p.name===sign.face):placement,sprite=placement&&catalog[placement.sprite];
  if(image){if(!face||!('standing'in face)||face.standing!==true||sign.text!==undefined)throw Error(`${sign.face}: standing image face missing`);}
  else if(!placement||sprite?.standingRole!=='face'||placement.layer==='terrain'||placement.renderRole==='grounded'||placement.renderRole==='cutaway'||!(sprite.upperCells===undefined?sprite.level==='aboveAvatar':sprite.upperCells.length===sprite.rect.width*sprite.rect.height))throw Error(`${sign.face}: standing face must remain above the floor`);
  if(!face)throw Error(`${sign.face}: standing face missing`);
  faces.add(key);
  for(const id of sign.supports){
   const p=placements.get(id),s=p&&catalog[p.sprite];
   if(typeof id!=='string'||supports.has(id)||!p||s?.standingRole!=='support'||p.layer==='terrain'||(p.renderRole==='canopy'||p.renderRole==='cutaway')||!(s.upperCells===undefined?s.level==='belowAvatar':s.upperCells.length===0)||p.width!==1||p.height!==1||s.rect.width!==1||s.rect.height!==1||s.blockingCells.length!==1||s.blockingCells[0][0]!==0||s.blockingCells[0][1]!==0||p.x<face.x||p.x>=face.x+face.width||p.y!==face.y+face.height-(image?1:0))throw Error(`${sign.face}: standing support linkage/footprint invalid`);
   supports.add(id);
  }
  if(sign.text!==undefined){const text=layout.signs?.find(s=>s.name===sign.text);if(!text||text.x!==face.x||text.y!==face.y||text.width!==face.width||text.height!==face.height)throw Error(`${sign.face}: standing text must match its face`);}
 }
 for(const p of layout.placements){const role=catalog[p.sprite]?.standingRole;if(role==='face'&&!faces.has('placement:'+p.id)||role==='support'&&!supports.has(p.id))throw Error(`${p.id}: standing ${role} missing assembly linkage`);}
 for(const image of layout.images??[])if(image.standing===true&&!faces.has('image:'+image.name))throw Error(`${image.name}: standing image missing assembly linkage`);
}

import type {TiledMap,TileLayer} from './types';
/** Forward authoring only: retain native reservations, portals and all non-prop data. */
export function refineSolidProps(original:TiledMap,intended:TiledMap):TiledMap {
 if(original.width!==intended.width||original.height!==intended.height||original.tilewidth!==intended.tilewidth||original.tileheight!==intended.tileheight)throw Error('Native refinement dimensions differ');
 const output=structuredClone(original),scenery=(name:string)=>/^scenery-(belowAvatar|aboveAvatar)-\d+$/.test(name);
 const tile=(m:TiledMap,name:string)=>{const found=m.layers.filter(l=>l.name===name);if(found.length!==1||found[0].type!=='tilelayer')throw Error(`Native refinement missing/ambiguous layer ${name}`);return found[0] as TileLayer;};
 const remap=(raw:number):number=>{
  if(!raw)return 0;
  const gid=(raw&0x0fffffff)>>>0,source=intended.tilesets.filter(t=>gid>=t.firstgid&&gid<t.firstgid+(t.tilecount??0));
  if(source.length!==1)throw Error('Native refinement missing/ambiguous source atlas');
  const s=source[0],targets=original.tilesets.filter(t=>s.name==='navigation-mask'?t.name===s.name:t.name!=='navigation-mask'&&t.image===s.image);
  if(targets.length!==1)throw Error(`Native refinement missing/ambiguous atlas ${s.image}`);
  const target=targets[0];
  for(const k of ['tilewidth','tileheight','columns','tilecount','imagewidth','imageheight']as const)if(s[k]!==target[k])throw Error(`Native refinement atlas geometry changed: ${s.image}`);
  const local=gid-s.firstgid;
  if(s.name==='navigation-mask'){
   const collides=(t:typeof s)=>t.tiles?.find(t=>t.id===local)?.properties?.find(p=>p.name==='collides')?.value;
   if(collides(s)!==collides(target))throw Error('Native refinement collision tile identity changed');
  }
  return ((target.firstgid+local)|(raw&0xf0000000))>>>0;
 };
 const replacements=new Map(intended.layers.filter(l=>scenery(l.name)).map(l=>{if(l.type!=='tilelayer')throw Error('Native scenery must be tile layers');return[l.name,{...l,data:l.data.map(remap)}]as const;}));
 for(const layer of output.layers)if(scenery(layer.name)){
  if(layer.type!=='tilelayer')throw Error('Native scenery must be tile layers');
  layer.data=replacements.get(layer.name)?.data??Array(original.width*original.height).fill(0);replacements.delete(layer.name);
 }
 let next=Math.max(output.nextlayerid??1,...output.layers.map(l=>l.id+1));
 for(const[name,layer]of replacements){
  const upper=name.startsWith('scenery-aboveAvatar-'),floor=output.layers.findIndex(l=>l.name==='floorLayer');if(floor<0)throw Error('Native refinement missing floor layer');
  let at=floor;
  if(upper){at=floor+1;for(let i=floor+1;i<output.layers.length;i++)if(output.layers[i].name.startsWith('scenery-aboveAvatar-'))at=i+1;}
  output.layers.splice(at,0,{...layer,id:next++});
 }
 output.nextlayerid=next;
 tile(output,'physical-collisions').data=tile(intended,'physical-collisions').data.map(remap);
 return output;
}
