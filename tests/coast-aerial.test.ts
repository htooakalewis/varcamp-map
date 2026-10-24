import{readFileSync}from'node:fs';
import{expect,it}from'vitest';
import{assertCurrentNativeMap}from'../tools/maps/current-native';
import{assertCoastAerialLayout,assertNativeCoastAerial,orderCoastAerialOverlays}from'../tools/maps/coast-aerial';
import type{MapLayout,TiledMap,WamFile}from'../tools/maps/types';
const read=<T>(p:string):T=>JSON.parse(readFileSync(p,'utf8'));
const current=(id:string)=>({id,map:read<TiledMap>(`maps/${id}.tmj`),layout:read<MapLayout>(`world/layouts/${id}.json`),wam:read<WamFile>(`maps/${id}.wam`)});
const catalog=read<any>('art/tile-catalog.json');
it.each(['shipyard-beach','constellation-shore'])('%s keeps aircraft behind attendees and finite safe birds above scenery',id=>{
 const{map,layout}=current(id),floor=map.layers.findIndex(l=>l.name==='floorLayer');
 const aerial=layout.animatedOverlays!.filter(o=>o.name==='coastal-flight'||o.name.includes('gull-'));
 expect(aerial.length).toBe(id==='shipyard-beach'?3:2);
 for(const o of aerial){expect(o.level,o.name).toBe(o.name==='coastal-flight'?'belowAvatar':'aboveScenery');const index=map.layers.findIndex(l=>l.name===o.name);expect(o.name==='coastal-flight'?index<floor:index>floor,o.name).toBe(true);}
 if(id==='shipyard-beach')expect(aerial.find(o=>o.name==='coastal-flight')).toMatchObject({x:0,y:11,width:48,height:3});
});
it('the real current entry cannot opt out of the required aircraft by coherently removing source and native layer',()=>{
 const a=current('shipyard-beach');a.layout.animatedOverlays=a.layout.animatedOverlays!.filter(o=>o.name!=='coastal-flight');a.map.layers=a.map.layers.filter(l=>l.name!=='coastal-flight');
 expect(()=>assertCurrentNativeMap(a.id,a.map,a.layout,a.wam,catalog)).toThrow(/animation safety|coast aerial/i);
});
it.each(['shipyard-beach','constellation-shore'])('%s current entry accepts its complete foreground-safe native package',id=>{
 const a=current(id);expect(()=>assertCurrentNativeMap(id,a.map,a.layout,a.wam,catalog)).not.toThrow();
});
it.each(['missing-all','missing-gull','extra-gull','above-avatar','implicit-depth','old-arrival-band','aquatic-after-aerial','terrain-drift','prop-footprint-drift','entry-overlap','exit-overlap','activity-overlap'])('rejects unsafe source recipe: %s',kind=>{
 const{layout}=current('shipyard-beach'),air=layout.animatedOverlays!.find(o=>o.name==='coastal-flight')!;
 if(kind==='missing-all')layout.animatedOverlays=[];
 if(kind==='missing-gull')layout.animatedOverlays=layout.animatedOverlays!.filter(o=>o.name!=='coast-life-harbor-gull-north');
 if(kind==='extra-gull')layout.animatedOverlays!.push({...air,name:'coast-life-unowned-gull-north'});
 if(kind==='above-avatar')air.level='aboveAvatar';
 if(kind==='implicit-depth')delete air.level;
 if(kind==='old-arrival-band')air.y=6;
 if(kind==='aquatic-after-aerial'){const o=layout.animatedOverlays!.shift()!;layout.animatedOverlays!.push(o);}
 if(kind==='terrain-drift')layout.placements.find(p=>p.layer==='terrain'&&p.x===0&&p.y===11)!.sprite='ground-grass';
 if(kind==='prop-footprint-drift')layout.placements.push({id:'unsafe-new-band-prop',sprite:'bench',x:0,y:11,width:1,height:1,layer:'decoration'});
 if(kind==='entry-overlap')layout.entries.push({name:'unsafe',x:0,y:11,width:1,height:1});
 if(kind==='exit-overlap')layout.exits.push({...layout.exits[0],name:'unsafe',x:0,y:11,width:1,height:1});
 if(kind==='activity-overlap')layout.areas.push({...layout.areas[0],id:'unsafe',x:0,y:11,width:1,height:1});
 expect(()=>assertCoastAerialLayout(layout)).toThrow(/animation safety|coast aerial/i);
});
it.each(['physical-drift','above-native','missing-native'])('rejects unsafe native recipe: %s',kind=>{
 const{map,layout}=current('shipyard-beach');
 if(kind==='physical-drift'){const l=map.layers.find(l=>l.name==='physical-collisions')!;if(l.type==='tilelayer')l.data[11*48]=0;}
 if(kind==='above-native'){const i=map.layers.findIndex(l=>l.name==='coastal-flight'),[l]=map.layers.splice(i,1);map.layers.push(l);}
 if(kind==='missing-native')map.layers=map.layers.filter(l=>l.name!=='coastal-flight');
 expect(()=>assertNativeCoastAerial(map,layout,catalog)).toThrow(/animation safety|coast aerial/i);
});
it('uses stable source role ordering without changing overlay bodies',()=>{
 const{layout}=current('shipyard-beach'),rows=layout.animatedOverlays!,scrambled=[rows.at(-1)!,...rows.slice(0,-1)],result=orderCoastAerialOverlays(scrambled);
 expect(result.every(r=>scrambled.includes(r))).toBe(true);expect(scrambled[0]).toBe(rows.at(-1));
 expect(result.filter(o=>!o.name.includes('gull-')&&o.name!=='coastal-flight')).toEqual(rows.filter(o=>!o.name.includes('gull-')&&o.name!=='coastal-flight'));
});
