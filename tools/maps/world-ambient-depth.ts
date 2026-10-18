import type{MapLayout}from'./types';
import type{TileCatalog}from'../art/catalog';
import type{ArtRgba}from'../art/native-png';
/** The same source partition as builder.ts. Only an owning fixture's existing
 * upper art can authorize upper FX; gardens, water and air keep their own role. */
export function ambientDepthOwner(layout:MapLayout,e:any,catalog:TileCatalog){
 if(['gull','fish','ripples','leaves'].includes(e.kind))return null;
 const p=layout.placements.find(p=>p.id===e.anchor);if(!p||['x','y','width','height'].some(k=>(p as any)[k]!==e.clip[k]))throw Error('World ambient depth owner changed: '+e.name);
 const s=catalog[p.sprite],visual=p.renderRole==='cutaway'?catalog['floor-inlay']:s;if(!s||!visual)throw Error('World ambient depth owner sprite missing');
 const level=p.renderRole==='canopy'?'aboveAvatar':p.renderRole?'belowAvatar':s.level,explicit=s.upperCells===undefined?null:new Set(s.upperCells.map(([x,y])=>y*s.rect.width+x));
 const upperCells:number[][]=[];for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.layer!=='terrain'&&p.renderRole!=='cutaway'&&(explicit?explicit.has((y%s.rect.height)*s.rect.width+x%s.rect.width):level==='aboveAvatar'))upperCells.push([x,y]);
 return{placement:{id:p.id,sprite:p.sprite,x:p.x,y:p.y,width:p.width,height:p.height,layer:p.layer,renderRole:p.renderRole??null},visual:{sheet:visual.sheet,rect:visual.rect},upperCells};
}
/** One physical support calculation for the actual producer and current gate.
 * Receipt bitmaps never authorize new pixels. Existing catalog upper ownership
 * and the owning source PNG's exact alpha255 pixels supply that authority. */
export function opaqueAmbientOwnerSupport(owner:NonNullable<ReturnType<typeof ambientDepthOwner>>,width:number,height:number,image:ArtRgba):Buffer{
 const r=owner.visual.rect,rw=r.width*32,rh=r.height*32;
 if(image.rgba.length!==image.width*image.height*4||r.x*32+rw>image.width||r.y*32+rh>image.height)throw Error('World ambient owner PNG geometry changed');
 const support=Buffer.alloc(width*height),upper=new Set(owner.upperCells.map(([x,y])=>`${x},${y}`));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(upper.has(`${Math.floor(x/32)},${Math.floor(y/32)}`)&&image.rgba[((r.y*32+y%rh)*image.width+r.x*32+x%rw)*4+3]===255)support[y*width+x]=1;
 return support;
}
