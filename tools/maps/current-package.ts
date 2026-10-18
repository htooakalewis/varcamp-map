import type {MapLayout,TiledMap,WamFile} from './types';
import {WORLD_CATALOG} from '../../src/world/catalog';

/** A complete world build selects maps by the closed catalog, never by optional
 * markers inside possibly missing source data. Generic single-map validation is separate. */
export function assertCurrentMapRoster(files:readonly string[]):void {
 const actual=files.filter(f=>f.endsWith('.tmj')||f.endsWith('.wam')).slice().sort();
 const expected=Object.keys(WORLD_CATALOG).flatMap(id=>[id+'.tmj',id+'.wam']).sort();
 if(actual.length!==expected.length||actual.some((name,i)=>name!==expected[i]))throw Error('Current world roster must contain exactly one native TMJ/WAM pair per declared map');
}
/** Filename is the independent identity anchor. Removing all visual/source
 * markers cannot silently disable a domain's current-map acceptance guard. */
export function assertDeclaredMapIdentity(id:string,map:TiledMap,layout:MapLayout,wam:WamFile):void {
 const definition=WORLD_CATALOG[id as keyof typeof WORLD_CATALOG];
 const native=map.properties?.filter(p=>p.name==='worldMapId')??[];
 if(!Object.hasOwn(WORLD_CATALOG,id)||!definition||layout.id!==id||native.length!==1||native[0].type!=='string'||native[0].value!==id)throw Error(`Current map filename/source/native identity mismatch: ${id}`);
 if(map.width!==definition.width||map.height!==definition.height||layout.width!==definition.width||layout.height!==definition.height)throw Error(`Current map dimensions disagree with declared identity: ${id}`);
 if(wam.mapUrl!==id+'.tmj')throw Error(`Current WAM source must reference its declared native map: ${id}`);
}
