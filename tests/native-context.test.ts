import{readFileSync}from'node:fs';
import{expect,it}from'vitest';
import{loadTileCatalog}from'../tools/art/catalog';
import{assertCurrentNativeMap}from'../tools/maps/current-native';
import{validateMap,validateWam}from'../tools/maps/validate';
import{WORLD_CATALOG}from'../src/world/catalog';
import type{MapLayout,TiledMap,WamFile,TiledTileset}from'../tools/maps/types';
import{mutateNativeContext}from'./helpers/native-context-mutations';
import{assertNativeAirborne}from'../tools/maps/airborne';
import context from'../art/source/native-ownership-context.json';
const read=<T>(p:string):T=>JSON.parse(readFileSync(p,'utf8'))as T;
const load=(id:string)=>({id,map:read<TiledMap>(`maps/${id}.tmj`),layout:read<MapLayout>(`world/layouts/${id}.json`),wam:read<WamFile>(`maps/${id}.wam`),catalog:loadTileCatalog()});
const check=(a:ReturnType<typeof load>)=>assertCurrentNativeMap(a.id,a.map,a.layout,a.wam,a.catalog);


for(const id of Object.keys(context.maps))it(`${id}: actual current native ownership control passes`,()=>{const a=load(id);expect(()=>check(a)).not.toThrow();});
for(const id of ['overworld','shipyard-beach','constellation-shore'])for(const kind of ['unused-body','unused-geometry','unused-name','unused-missing','unused-range','unused-extra'])it(`${id}: rejects ${kind} historical atlas drift at real current entry`,()=>{const a=load(id);mutateNativeContext(a.map,kind);expect(()=>check(a)).toThrow(/Native (context|projection)/);});
for(const id of ['overworld','shipyard-beach','constellation-shore','air-district'])for(const kind of ['unknown-text','protected-text','protected-offset','protected-property','protected-missing','protected-order'])it(`${id}: rejects ${kind} protected nonfloor ownership drift at real current entry`,()=>{const a=load(id);if(kind==='unknown-text')expect(()=>check(a)).not.toThrow();mutateNativeContext(a.map,kind);if(kind==='unknown-text')expect(()=>assertNativeAirborne(a.map,a.layout)).not.toThrow();expect(validateMap(a.map,WORLD_CATALOG)).toEqual([]);expect(()=>check(a)).toThrow(kind==='unknown-text'?(id==='air-district'?/World ambient unknown or retired native ownership: unowned-rendered-text/:/Native context protected nonfloor layer bodies\/roster changed/):/Native (context|projection)|World ambient/);});
it('comet-maze: retired original plant interval remains unavailable to a new unused atlas owner',()=>{const a=load('comet-maze'),row=context.maps['comet-maze'],old=row.retired[0],template=a.map.tilesets[0];a.map.tilesets.push({...structuredClone(template),name:'unowned-retired-range-reuse',firstgid:old.firstgid,tilecount:1,columns:1,imagewidth:32,imageheight:32}as TiledTileset);expect(()=>check(a)).toThrow(/Native (context|projection)/);});
it('current native ownership does not restrict independent valid organizer WAM extras',()=>{const a=load('overworld');a.wam.entities['organizer-extra']={x:640,y:640,name:'Organizer decoration',prefabRef:{collectionName:'test-organizer-collection',id:'plant'},properties:[]};a.wam.areas.push({id:'organizer-extra-area',name:'Organizer lounge',visible:true,x:640,y:640,width:32,height:32,properties:[]});expect(validateWam(a.wam)).toEqual([]);expect(()=>check(a)).not.toThrow();});
it.each(['missing-row','extra-row','schema'])('refuses %s ledger DATA rather than disabling current-domain ownership',kind=>{const mutable=context as unknown as{schema:string;maps:Record<string,unknown>},original=mutable.maps.overworld,schema=mutable.schema;try{if(kind==='missing-row')delete mutable.maps.overworld;if(kind==='extra-row')mutable.maps['unregistered-map']=original;if(kind==='schema')mutable.schema='unregistered-context-v0';const a=load('overworld');expect(()=>check(a)).toThrow(/Native context.*(schema|roster)/);}finally{mutable.maps.overworld=original;delete mutable.maps['unregistered-map'];mutable.schema=schema;}});

it.each(['shipyard-beach','constellation-shore'])('%s: appending the same unknown text after birds is independently rejected by terminal airborne order',id=>{const a=load(id);mutateNativeContext(a.map,'unknown-text');const n=a.map.layers.findIndex(l=>l.name==='unowned-rendered-text'),[text]=a.map.layers.splice(n,1);a.map.layers.push(text);expect(()=>assertNativeAirborne(a.map,a.layout)).toThrow(/Airborne safety airborne birds are not at the end/);expect(()=>check(a)).toThrow(/Airborne safety airborne birds are not at the end/);});
