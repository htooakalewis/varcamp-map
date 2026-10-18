import type{TiledMap,ObjectLayer}from'../../tools/maps/types';
const birds=['coast-life-harbor-gull-north','coast-life-harbor-gull-south','coast-life-shore-gull-north','coast-life-shore-gull-south','world-ambient-fa-ship-gull-1'];
function insertBeforeAirborneTail(map:TiledMap,group:ObjectLayer){const first=map.layers.findIndex(l=>birds.includes(l.name));map.layers.splice(first<0?map.layers.length:first,0,group);}
const text={id:99990,name:'unowned-audience-text',type:'',x:640,y:640,width:320,height:48,rotation:0,visible:true,text:{text:'UNDECLARED NATIVE CONTENT',pixelsize:32,color:'#ff00ff',wrap:true}};
export function mutateNativeContext(map:TiledMap,kind:string):void{
 const group=map.layers.find(l=>l.name==='wayfinding-text')as ObjectLayer;
 if(kind==='unknown-text')insertBeforeAirborneTail(map,{id:Math.max(...map.layers.map(l=>l.id))+1,name:'unowned-rendered-text',type:'objectgroup',visible:true,opacity:1,objects:[structuredClone(text)]});
 else if(kind==='protected-text')group.objects.push(structuredClone(text));
 else if(kind==='protected-offset')group.offsetx=64;
 else if(kind==='protected-property')group.properties=[{name:'unowned-native',type:'string',value:'changed'}];
 else if(kind==='protected-missing')map.layers=map.layers.filter(l=>l!==group);
 else if(kind==='protected-order'){const n=map.layers.indexOf(group),other=map.layers.findIndex(l=>l.name==='inspection-zones');[map.layers[n],map.layers[other]]=[map.layers[other],map.layers[n]];}
 else{
  // These genuine reserved sheets have no current native references and no
  // declared current-source role; an author-output-only proof cannot own them.
  const id=String(map.properties?.find(p=>p.name==='worldMapId')?.value),name=({overworld:'art-12','shipyard-beach':'beach-surf-north','constellation-shore':'art-1'}as Record<string,string>)[id];
  const set=map.tilesets.find(t=>t.name===name);if(!name||!set)throw Error('Missing exact historical unused test subject');
  const owns=(gid:number|undefined)=>!!gid&&(gid&0x0fffffff)>=set.firstgid&&(gid&0x0fffffff)<set.firstgid+set.tilecount!;
  if(map.layers.some(l=>l.type==='tilelayer'?l.data.some(owns):l.type==='objectgroup'?l.objects.some(o=>owns(o.gid)):false))throw Error('Unused atlas test subject unexpectedly has actual native references');
  if(kind==='unused-body')set.properties=[{name:'unowned',type:'string',value:'drift'}];
  else if(kind==='unused-geometry'){set.columns=1;set.imagewidth=32;}
  else if(kind==='unused-name')set.name='unowned-historical-name';
  else if(kind==='unused-missing')map.tilesets=map.tilesets.filter(t=>t!==set);
  else if(kind==='unused-range')set.firstgid=Math.max(...map.tilesets.map(t=>t.firstgid+t.tilecount!))+100;
  else if(kind==='unused-extra')map.tilesets.push({...structuredClone(set),name:'unowned-extra-reservation',firstgid:Math.max(...map.tilesets.map(t=>t.firstgid+t.tilecount!))+100});
  else throw Error('Unknown test mutation');
 }
}
