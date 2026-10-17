import{isDeepStrictEqual}from'node:util';
import{readStandingCaptions}from'../art/standing-captions';
import type{MapLayout,TiledMap,TileLayer,ObjectLayer}from'./types';
function need(v:unknown,message:string):asserts v{if(!v)throw Error(message);}
export function assertNativeStandingCaptions(map:TiledMap,layout:MapLayout):void{
 const resource=readStandingCaptions(layout);if(!resource)return;
 const atlases=map.tilesets.filter(t=>t.name==='standing-captions');need(atlases.length===1,'Caption atlas missing/ambiguous');const atlas=atlases[0];
 need(isDeepStrictEqual(atlas,{firstgid:atlas.firstgid,name:'standing-captions',tilewidth:32,tileheight:32,columns:resource.width/32,tilecount:resource.width*resource.height/1024,image:'../'+resource.image,imagewidth:resource.width,imageheight:resource.height,properties:[{name:'tilesetCopyright',type:'string',value:'Original VarCamp pixel glyph captions; CC0-1.0'},{name:'captionAtlasSha256',type:'string',value:resource.pngSha256}]}),'Caption atlas has undeclared metadata');
 need(atlas.image==='../'+resource.image&&atlas.imagewidth===resource.width&&atlas.imageheight===resource.height&&atlas.tilewidth===32&&atlas.tileheight===32&&atlas.columns===resource.width/32&&atlas.tilecount===resource.width*resource.height/1024,'Caption atlas geometry/image changed');
 need(atlas.properties?.some(p=>p.name==='captionAtlasSha256'&&p.value===resource.pngSha256),'Caption atlas source hash changed');
 need(!atlas.tiles?.some(t=>t.animation||t.properties?.some(p=>p.name==='collides'&&p.value!==false)),'Caption atlas may not collide/animate');
 const floor=map.layers.findIndex(l=>l.name==='floorLayer');need(floor>=0,'Caption floor missing');
 const names=new Set(resource.rows.map(r=>'standing-caption-'+r.sign.name));need(map.layers.filter(l=>l.name.startsWith('standing-caption-')).length===names.size,'Unexpected caption layer');
 for(const row of resource.rows){
  const rows=map.layers.filter(l=>l.name==='standing-caption-'+row.sign.name);need(rows.length===1&&rows[0].type==='tilelayer','Caption layer missing/ambiguous');const layer=rows[0]as TileLayer;
  need(map.layers.indexOf(layer)>floor&&map.layers.slice(map.layers.indexOf(layer)+1).every(l=>!l.name.startsWith('scenery-aboveAvatar-')),'Caption must be created after raised face artwork');
  need(layer.visible&&layer.opacity===1&&layer.properties?.some(p=>p.name==='captionText'&&p.value===row.sign.text)&&layer.properties?.some(p=>p.name==='captionFace'&&p.value===row.face),'Caption semantic metadata changed');
  need(layer.x===0&&layer.y===0&&layer.width===map.width&&layer.height===map.height&&!('offsetx'in layer)&&!('offsety'in layer),'Caption native position changed');
  const expected=Array(map.width*map.height).fill(0);for(let y=0;y<row.sign.height;y++)for(let x=0;x<row.sign.width;x++)expected[(row.sign.y+y)*map.width+row.sign.x+x]=atlas.firstgid+(row.atlasY+y)*atlas.columns!+row.atlasX+x;
  need(isDeepStrictEqual(layer.data,expected),'Caption local tiles/face footprint changed');
  need(!map.layers.some(l=>l.type==='objectgroup'&&l.objects.some(o=>o.name===row.sign.name&&o.text)),'Unsupported standing text object remains');
 }
}
/** Separate forward operation: adds ONLY one validated caption resource; scenery refiner stays strict. */
export function refineStandingCaptions(original:TiledMap,intended:TiledMap,layout:MapLayout):TiledMap{
 const resource=readStandingCaptions(layout);need(resource&&resource.rows.length,'No linked captions to refine');assertNativeStandingCaptions(intended,layout);
 need(original.width===intended.width&&original.height===intended.height,'Caption map dimensions changed');need(!original.tilesets.some(t=>t.name==='standing-captions'||t.image==='../'+resource.image)&&!original.layers.some(l=>l.name.startsWith('standing-caption-')),'Caption atlas/layers already present');
 const output=structuredClone(original),text=output.layers.filter(l=>l.name==='wayfinding-text');need(text.length===1&&text[0].type==='objectgroup','Original text layer missing/ambiguous');const objects=text[0]as ObjectLayer;
 for(const row of resource.rows){const s=row.sign,pad=s.padding??0,found=objects.objects.filter(o=>o.name===s.name);need(found.length===1,'Original caption text missing/ambiguous');const actual=found[0];
  const expected={id:actual.id,name:s.name,x:s.x*32+pad,y:s.y*32+pad,width:s.width*32-pad*2,height:s.height*32-pad*2,rotation:0,visible:true,text:{text:s.text,color:s.color??'#f1d9a0',fontfamily:'Arial',pixelsize:s.fontSize??18,bold:false,wrap:true,halign:s.align??'left',valign:'top'}};
  need(isDeepStrictEqual(actual,expected),'Original caption text signature changed');objects.objects=objects.objects.filter(o=>o!==actual);
 }
 const atlas=intended.tilesets.find(t=>t.name==='standing-captions')!,firstgid=Math.max(...original.tilesets.map(t=>t.firstgid+(t.tilecount??0)));output.tilesets.push({...structuredClone(atlas),firstgid});
 let next=Math.max(output.nextlayerid??1,...output.layers.map(l=>l.id+1));
 for(const row of resource.rows){const layer=structuredClone(intended.layers.find(l=>l.name==='standing-caption-'+row.sign.name))as TileLayer;layer.id=next++;layer.data=layer.data.map(g=>g?firstgid+g-atlas.firstgid:0);output.layers.push(layer);}
 output.nextlayerid=next;assertNativeStandingCaptions(output,layout);return output;
}
