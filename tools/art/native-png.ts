import{inflateSync}from'node:zlib';
export interface ArtRgba{width:number;height:number;rgba:Buffer;}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
/** Synchronous current-art alpha proof only. Caps come from the three actual
 * owning/upper sheets (largest512×224); Woka and compiler caps are unchanged. */
export function decodeArtRgbaPng(bytes:Buffer,width:number,height:number):ArtRgba{
 const fail=():never=>{throw Error('Art PNG invalid bounded RGBA8 stream');};
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||width>512||height<1||height>224||width*height*4>458752||bytes.length>65536||bytes.length<57||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))fail();
 let offset=8,ended=false,afterIdat=false;const compressed:Buffer[]=[];
 while(offset<bytes.length){
  if(offset+12>bytes.length)fail();const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),end=offset+length+12;
  if(end>bytes.length||!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type))fail();
  let crc=0xffffffff;for(let i=offset+4;i<end-4;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);if(((crc^0xffffffff)>>>0)!==bytes.readUInt32BE(end-4))fail();
  if(offset===8){if(type!=='IHDR'||length!==13||bytes.readUInt32BE(offset+8)!==width||bytes.readUInt32BE(offset+12)!==height||bytes[offset+16]!==8||bytes[offset+17]!==6||bytes[offset+18]!==0||bytes[offset+19]!==0||bytes[offset+20]!==0)fail();}
  else if(type==='IHDR')fail();
  if(type==='IDAT'){if(afterIdat)fail();compressed.push(bytes.subarray(offset+8,end-4));}
  else if(compressed.length)afterIdat=true;
  if(type==='IEND'){if(length||!compressed.length||end!==bytes.length)fail();ended=true;break;}
  if(!['IHDR','IDAT'].includes(type)&&type[0]===type[0].toUpperCase())fail();offset=end;
 }
 if(!ended)fail();const input=Buffer.concat(compressed),stride=width*4;let raw:Buffer;
 try{const result=inflateSync(input,{maxOutputLength:height*(stride+1),info:true})as unknown as{engine?:{bytesWritten?:number};buffer?:Buffer};if(!result||!Buffer.isBuffer(result.buffer)||result.engine?.bytesWritten!==input.length)fail();raw=result.buffer!;}catch{fail();}
 if(raw!.length!==height*(stride+1))fail();const rgba=Buffer.alloc(width*height*4),paeth=(a:number,b:number,c:number)=>{const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;};
 for(let y=0;y<height;y++){const filter=raw![y*(stride+1)];if(filter>4)fail();for(let x=0;x<stride;x++){const a=x>=4?rgba[y*stride+x-4]:0,b=y?rgba[(y-1)*stride+x]:0,c=y&&x>=4?rgba[(y-1)*stride+x-4]:0;rgba[y*stride+x]=(raw![y*(stride+1)+x+1]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}}
 return{width,height,rgba};
}
