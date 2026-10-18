import{readFileSync}from'node:fs';
import{expect,it}from'vitest';
import{loadTileCatalog}from'../tools/art/catalog';
import{assertCurrentNativeMap}from'../tools/maps/current-native';
import{validateMap,validateWam}from'../tools/maps/validate';
import{WORLD_CATALOG}from'../src/world/catalog';
import type{MapLayout,TiledMap,WamFile,ObjectLayer,TiledTileset}from'../tools/maps/types';
import context from'../art/source/native-ownership-context.json';
const read=<T>(p:string):T=>JSON.parse(readFileSync(p,'utf8'))as T;
const load=(id:string)=>({id,map:read<TiledMap>(`maps/${id}.tmj`),layout:read<MapLayout>(`world/layouts/${id}.json`),wam:read<WamFile>(`maps/${id}.wam`),catalog:loadTileCatalog()});
const check=(a:ReturnType<typeof load>)=>assertCurrentNativeMap(a.id,a.map,a.layout,a.wam,a.catalog);
const text={id:99990,name:'unowned-audience-text',type:'',x:640,y:640,width:320,height:48,rotation:0,visible:true,text:{text:'UNDECLARED NATIVE CONTENT',pixelsize:32,color:'#ff00ff',wrap:true}};
export function mutateNativeContext(map:TiledMap,kind:string):void{
 const group=map.layers.find(l=>l.name==='wayfinding-text')as ObjectLayer;
 if(kind==='unknown-text')map.layers.push({id:Math.max(...map.layers.map(l=>l.id))+1,name:'unowned-rendered-text',type:'objectgroup',visible:true,opacity:1,objects:[structuredClone(text)]});
 else if(kind==='protected-text')group.objects.push(structuredClone(text));
 else if(kind==='protected-offset')group.offsetx=64;
 else if(kind==='protected-property')group.properties=[{name:'unowned-native',type:'string',value:'changed'}];
 else if(kind==='protected-missing')map.layers=map.layers.filter(l=>l!==group);
 else if(kind==='protected-order'){const n=map.layers.indexOf(group),other=map.layers.findIndex(l=>l.name==='inspection-zones');[map.layers[n],map.layers[other]]=[map.layers[other],map.layers[n]];}
 else{
  // These genuine reserved sheets have no current native references and no
  // declared current-source role; an author-output-only proof cannot own them.
  const names=map.properties?.find(p=>p.name==='worldMapId')?.value==='overworld'?['art-12']:['beach-surf-north','art-1'];
  const set=map.tilesets.find(t=>names.includes(t.name??''));if(!set)throw Error('Missing actual historical unused test set');
  if(kind==='unused-body')set.properties=[{name:'unowned',type:'string',value:'drift'}];
  else if(kind==='unused-geometry'){set.columns=1;set.imagewidth=32;}
  else if(kind==='unused-name')set.name='unowned-historical-name';
  else if(kind==='unused-missing')map.tilesets=map.tilesets.filter(t=>t!==set);
  else if(kind==='unused-range')set.firstgid=Math.max(...map.tilesets.map(t=>t.firstgid+t.tilecount!))+100;
  else if(kind==='unused-extra')map.tilesets.push({...structuredClone(set),name:'unowned-extra-reservation',firstgid:Math.max(...map.tilesets.map(t=>t.firstgid+t.tilecount!))+100});
  else throw Error('Unknown test mutation');
 }
}

for(const id of Object.keys(context.maps))it(`${id}: actual current native ownership control passes`,()=>{const a=load(id);expect(()=>check(a)).not.toThrow();});
for(const id of ['overworld','shipyard-beach','constellation-shore'])for(const kind of ['unused-body','unused-geometry','unused-name','unused-missing','unused-range','unused-extra'])it(`${id}: rejects ${kind} historical atlas drift at real current entry`,()=>{const a=load(id);mutateNativeContext(a.map,kind);expect(()=>check(a)).toThrow(/Native (context|projection)/);});
for(const id of ['overworld','shipyard-beach','constellation-shore','air-district'])for(const kind of ['unknown-text','protected-text','protected-offset','protected-property','protected-missing','protected-order'])it(`${id}: rejects ${kind} protected nonfloor ownership drift at real current entry`,()=>{const a=load(id);mutateNativeContext(a.map,kind);expect(validateMap(a.map,WORLD_CATALOG)).toEqual([]);expect(()=>check(a)).toThrow(/Native (context|projection)|World ambient/);});
it('comet-maze: retired original plant interval remains unavailable to a new unused atlas owner',()=>{const a=load('comet-maze'),row=context.maps['comet-maze'],old=row.retired[0],template=a.map.tilesets[0];a.map.tilesets.push({...structuredClone(template),name:'unowned-retired-range-reuse',firstgid:old.firstgid,tilecount:1,columns:1,imagewidth:32,imageheight:32}as TiledTileset);expect(()=>check(a)).toThrow(/Native (context|projection)/);});
it('current native ownership does not restrict independent valid organizer WAM extras',()=>{const a=load('overworld');a.wam.entities['organizer-extra']={x:640,y:640,name:'Organizer decoration',prefabRef:{collectionName:'test-organizer-collection',id:'plant'},properties:[]};a.wam.areas.push({id:'organizer-extra-area',name:'Organizer lounge',visible:true,x:640,y:640,width:32,height:32,properties:[]});expect(validateWam(a.wam)).toEqual([]);expect(()=>check(a)).not.toThrow();});
it.each(['missing-row','extra-row','schema'])('refuses %s ledger DATA rather than disabling current-domain ownership',kind=>{const mutable=context as unknown as{schema:string;maps:Record<string,unknown>},original=mutable.maps.overworld,schema=mutable.schema;try{if(kind==='missing-row')delete mutable.maps.overworld;if(kind==='extra-row')mutable.maps['unregistered-map']=original;if(kind==='schema')mutable.schema='unregistered-context-v0';const a=load('overworld');expect(()=>check(a)).toThrow(/Native context.*(schema|roster)/);}finally{mutable.maps.overworld=original;delete mutable.maps['unregistered-map'];mutable.schema=schema;}});
