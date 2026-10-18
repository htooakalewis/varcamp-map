import sharp from 'sharp';
export interface CoastRasterOptions {width:number;height:number;prefix:string;groundPrefix:string;image:string}
/** Pure deterministic two-pixel curve/terrain/animation renderer shared by the approved coasts. */
export async function renderCoast(recipe:any,options:CoastRasterOptions){
 const W=options.width*16,H=options.height*16,points=recipe.points.map(([x,y]:number[])=>[x/2,y/2]),poly:number[][]=[];
 for(let i=0;i<points.length;i++)for(let s=0;s<8;s++){const t=s/8,p0=points[(i+points.length-1)%points.length],p1=points[i],p2=points[(i+1)%points.length],p3=points[(i+2)%points.length];poly.push([0,1].map(a=>.5*((2*p1[a])+(-p0[a]+p2[a])*t+(2*p0[a]-5*p1[a]+4*p2[a]-p3[a])*t*t+(-p0[a]+3*p1[a]-3*p2[a]+p3[a])*t*t*t)));}
 const inside=new Uint8Array(W*H),distance=new Float32Array(W*H).fill(1e6);
 for(let y=0;y<H;y++){const crossings:number[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if((a[1]>y+.5)!==(b[1]>y+.5))crossings.push(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));}crossings.sort((a,b)=>a-b);for(let n=0;n<crossings.length;n+=2)for(let x=Math.max(0,Math.ceil(crossings[n]-.5));x<Math.min(W,crossings[n+1]-.5);x++)inside[y*W+x]=1;}
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(inside[i]!==inside[i-1]||inside[i]!==inside[i+1]||inside[i]!==inside[i-W]||inside[i]!==inside[i+W])distance[i]=0;}
 for(let y=1;y<H;y++)for(let x=1;x<W-1;x++){const i=y*W+x;distance[i]=Math.min(distance[i],distance[i-1]+1,distance[i-W]+1,distance[i-W-1]+1.4143,distance[i-W+1]+1.4143);}
 for(let y=H-2;y>=0;y--)for(let x=W-2;x>0;x--){const i=y*W+x;distance[i]=Math.min(distance[i],distance[i+1]+1,distance[i+W]+1,distance[i+W-1]+1.4143,distance[i+W+1]+1.4143);}
 const catalog:Record<string,any>={},sand=await sharp('assets/tilesets/original/beach-lounge.png').ensureAlpha().raw().toBuffer({resolveWithObject:true}),water=await sharp('assets/tilesets/lpc-water/water.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const ground:any[]=[],edges:{x:number;y:number;land:boolean;tile:number}[]=[];
 for(let y=0;y<options.height;y++)for(let x=0;x<options.width;x++){const center=(y*16+8)*W+x*16+8,isLand=inside[center]===1;let edge=false;for(let dy=0;dy<16&&!edge;dy++)for(let dx=0;dx<16;dx++)if(distance[(y*16+dy)*W+x*16+dx]<=10){edge=true;break;}
  let sprite:string;if(edge){const tile=edges.length*4;edges.push({x,y,land:isLand,tile});sprite=`${options.prefix}-${isLand?'land':'water'}-${tile}`;catalog[sprite]={sheet:options.image,sourceId:'lpc-water',rect:{x:tile%64,y:Math.floor(tile/64),width:1,height:1},blockingCells:isLand?[]:[[0,0]],level:'belowAvatar'};}else sprite=isLand?`beach-sand-${(x*7+y*11)%16}`:`naval-water-${(x+y)%3}`;
  ground.push({id:`${options.groundPrefix}-${x}-${y}`,sprite,x,y,width:1,height:1,layer:'terrain'});
 }
 const columns=64,atlasWidth=columns*32,rows=Math.ceil(edges.length*4/columns),height=rows*32;if(height>1024)throw Error(`Organic coast exceeds one bounded atlas (${edges.length} edge cells)`);
 const pixels=Buffer.alloc(atlasWidth*height*4),mix=(a:number[],b:number[],t:number)=>a.map((v,i)=>Math.round(v*(1-t)+b[i]*t));
 for(const e of edges)for(let frame=0;frame<4;frame++)for(let yy=0;yy<32;yy+=2)for(let xx=0;xx<32;xx+=2){const gx=e.x*32+xx,gy=e.y*32+yy,index=(gy/2)*W+gx/2,d=distance[index]*2*(inside[index]?1:-1),variant=(e.x*7+e.y*11)%16,sandIndex=((128+Math.floor(variant/8)*32+yy)*sand.info.width+(variant%8)*32+xx)*4,waterIndex=((160+yy)*water.info.width+((e.x+e.y+frame)%3)*32+xx)*4;
  const nativeSea=Array.from(water.data.subarray(waterIndex,waterIndex+3)),sea=mix(nativeSea,[38,128,138],.72),dry=Array.from(sand.data.subarray(sandIndex,sandIndex+3));let color:number[];
  if(d>recipe.wetSandPixels)color=dry;else if(d>=0){const grain=((gx*13+gy*7)%17===0)?-7:0;color=mix([205+grain,179+grain,126+grain],dry,d/recipe.wetSandPixels);}else color=mix([112,176,174],sea,Math.min(1,-d/recipe.shallowWaterPixels));
  const pulse=recipe.tidePixels[frame]+2*Math.sin(gx/61+gy/89),crest=Math.abs(d-pulse);if(crest<3.4&&((gx+gy*3+frame*7)%23)<20)color=[242,237,210];else if(crest<7&&d<pulse)color=mix(color,[211,224,204],.35);
  if(d< -12&&d> -31&&Math.abs(d+21+frame*2+2*Math.sin(gx/47))<1.7&&((gx*3+gy)%19)<10)color=mix(color,[199,224,211],.55);
  const tile=e.tile+frame,tx=tile%columns*32+xx,ty=Math.floor(tile/columns)*32+yy;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const n=((ty+dy)*atlasWidth+tx+dx)*4;pixels[n]=color[0];pixels[n+1]=color[1];pixels[n+2]=color[2];pixels[n+3]=255;}
 }
 const png=await sharp(pixels,{raw:{width:atlasWidth,height,channels:4}}).png().toBuffer();
 return {png,ground,edges,catalog,width:atlasWidth,height};
}
