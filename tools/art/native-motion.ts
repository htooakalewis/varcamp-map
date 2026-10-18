import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { LayoutAnimatedOverlay, TileRect } from '../maps/types';

export interface NativeMotionPose { width:number; height:number; rgba:Buffer; }
export interface NativeMotionSample { x:number; y:number; pose:number|null; }
export interface NativeMotionTrack { id:string; samples:NativeMotionSample[]; }
export interface NativeMotionSpec {
 name:string; image:string; sourceId:string; level:'belowAvatar'|'aboveAvatar'|'aboveScenery'; rect:TileRect;
 stepMs:number; periodMs:number; poses:NativeMotionPose[]; tracks:NativeMotionTrack[];
}
export interface NativeMotionDiagnostics {
 phaseCount:number; periodMs:number; stepMs:number; sharedFrameTiles:number; decodedRgbaBytes:number;
 atlas:{width:number;height:number;columns:number;tilecount:number};
 tracks:{id:string;visiblePhases:number;positionCount:number;poseCount:number}[];
}
/** Compile authored world-relative PNG poses into native synchronized carrier clocks.
 * Coordinates are relative pixels to rect, not global map pixels. A track may cross
 * a clip boundary; adjoining rectangles must receive the same clock and samples.
 * null is an explicit quiet phase. This pure compiler performs no filesystem writes.
 */
export async function renderNativeMotion(spec:NativeMotionSpec):Promise<{png:Buffer;overlay:LayoutAnimatedOverlay;diagnostics:NativeMotionDiagnostics}> {
 const fail=(message:string):never=>{throw new Error(`Native motion ${spec.name}: ${message}`);};
 const integer=(n:number,min:number,max:number)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(spec.name)||!/^assets\/tilesets\/original\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.png$/.test(spec.image)||!spec.sourceId)fail('registered native original identity required');
 if(spec.level!=='belowAvatar'&&spec.level!=='aboveAvatar'&&spec.level!=='aboveScenery')fail('explicit avatar depth required');
 const {x,y,width,height}=spec.rect,count=width*height;
 if(!integer(x,0,8192)||!integer(y,0,8192)||!integer(width,1,255)||!integer(height,1,255)||count>=256)fail('use fewer than256 carrier cells at integer map coordinates');
 if(!integer(spec.stepMs,100,2147483647)||!integer(spec.periodMs,100,2147483647)||spec.periodMs%spec.stepMs!==0)fail('native clock must use integer >=100ms steps and one complete period');
 const phaseCount=spec.periodMs/spec.stepMs;
 if(phaseCount>2048)fail('at most2048 authored phases');
 if(!spec.poses.length||spec.poses.length>64||!spec.tracks.length||spec.tracks.length>8)fail('use1–64 poses and1–8 finite tracks');
 for(const pose of spec.poses)if(!integer(pose.width,1,256)||!integer(pose.height,1,256)||!Buffer.isBuffer(pose.rgba)||pose.rgba.length!==pose.width*pose.height*4)fail('pose must contain exact bounded native RGBA pixels');
 const ids=new Set<string>();
 for(const track of spec.tracks){
  if(!track.id||ids.has(track.id)||track.samples.length!==phaseCount)fail('unique track IDs and exactly one sample per phase required');ids.add(track.id);
  for(const s of track.samples)if(!integer(s.x,-8192,8192)||!integer(s.y,-8192,8192)||(s.pose!==null&&!integer(s.pose,0,spec.poses.length-1)))fail('invalid integer position or pose index');
 }
 const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 const blank=Buffer.alloc(4096),tiles:Buffer[]=[blank],known=new Map([[hash(blank),0]]);
 const sequences:number[][]=Array.from({length:count},()=>[]);
 const diagnostics:NativeMotionDiagnostics={phaseCount,periodMs:spec.periodMs,stepMs:spec.stepMs,sharedFrameTiles:0,decodedRgbaBytes:0,atlas:{width:0,height:0,columns:16,tilecount:0},tracks:spec.tracks.map(t=>({id:t.id,visiblePhases:0,positionCount:0,poseCount:0}))};
 const positions=spec.tracks.map(()=>new Set<string>()),poses=spec.tracks.map(()=>new Set<number>());
 for(let phase=0;phase<phaseCount;phase++){
  const touched=new Map<number,Buffer>();
  // Input order is the authored source-over order for simultaneous actors.
  for(const [trackIndex,track] of spec.tracks.entries()){
   const sample=track.samples[phase];if(sample.pose===null)continue;
   const pose=spec.poses[sample.pose],left=Math.max(0,sample.x),top=Math.max(0,sample.y),right=Math.min(width*32,sample.x+pose.width),bottom=Math.min(height*32,sample.y+pose.height);
   if(left>=right||top>=bottom)continue;
   let visible=false;
   for(let py=top;py<bottom;py++)for(let px=left;px<right;px++){
    const src=((py-sample.y)*pose.width+px-sample.x)*4,sa=pose.rgba[src+3];if(sa===0)continue;visible=true;
    const cell=Math.floor(py/32)*width+Math.floor(px/32);let tile=touched.get(cell);if(!tile){tile=Buffer.alloc(4096);touched.set(cell,tile);}
    const dst=((py%32)*32+px%32)*4,da=tile[dst+3];
    if(sa===255||da===0)pose.rgba.copy(tile,dst,src,src+4);
    else{const lower=da*(255-sa)/255,alpha=sa+lower;for(let c=0;c<3;c++)tile[dst+c]=Math.round((pose.rgba[src+c]*sa+tile[dst+c]*lower)/alpha);tile[dst+3]=Math.round(alpha);}
   }
   if(visible){diagnostics.tracks[trackIndex].visiblePhases++;positions[trackIndex].add(`${sample.x},${sample.y}`);poses[trackIndex].add(sample.pose);}
  }
  for(let cell=0;cell<count;cell++){
   const tile=touched.get(cell);let id=0;
   if(tile){const digest=hash(tile);const existing=known.get(digest);if(existing!==undefined)id=existing;else{if(tiles.length+count>=1024)fail('decoded native atlas exceeds4MiB');id=tiles.length;known.set(digest,id);tiles.push(tile);}}
   sequences[cell].push(id);
  }
 }
 diagnostics.sharedFrameTiles=tiles.length;
 const carrierTileIds:number[]=[],animations:LayoutAnimatedOverlay['animations']=[];
 for(const sequence of sequences){
  const id=tiles.length,frames:LayoutAnimatedOverlay['animations'][number]['frames']=[];carrierTileIds.push(id);tiles.push(Buffer.from(tiles[sequence[0]]));
  for(const tileid of sequence){const last=frames.at(-1);if(last?.tileid===tileid)last.duration+=spec.stepMs;else frames.push({tileid,duration:spec.stepMs});}
  animations.push({id,frames});
 }
 const columns=16,atlasWidth=columns*32,atlasHeight=Math.ceil(tiles.length/columns)*32;
 const pixels=Buffer.alloc(atlasWidth*atlasHeight*4);
 if(pixels.length>4*1024*1024)fail('decoded native atlas exceeds4MiB');
 for(const [id,tile] of tiles.entries())for(let row=0;row<32;row++)tile.copy(pixels,((Math.floor(id/columns)*32+row)*atlasWidth+id%columns*32)*4,row*128,(row+1)*128);
 diagnostics.atlas={width:atlasWidth,height:atlasHeight,columns,tilecount:columns*atlasHeight/32};diagnostics.decodedRgbaBytes=pixels.length;
 for(let i=0;i<spec.tracks.length;i++){diagnostics.tracks[i].positionCount=positions[i].size;diagnostics.tracks[i].poseCount=poses[i].size;}
 const png=await sharp(pixels,{raw:{width:atlasWidth,height:atlasHeight,channels:4}}).png().toBuffer();
 return{png,overlay:{name:spec.name,image:spec.image,sourceId:spec.sourceId,level:spec.level,...spec.rect,carrierTileIds,animations},diagnostics};
}
