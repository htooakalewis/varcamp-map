import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {SIGN_IDS} from '../../src/world/catalog';
import template from '../../world/aries-presentation.json';
import data from '../../world/speaker-presentation.json';
import type {TileCatalog} from '../art/catalog';
import type {MapLayout,LayoutArea,LayoutSign,Placement} from './types';
type Functional=Pick<MapLayout,'width'|'height'|'entries'|'exits'|'areas'|'inspectionZones'>;
type Row={baselineFunctionalSha256:string;basePlacementsSha256:string;baseSignsSha256:string;offsetX:number;width:number;partnerXs?:number[];title:Partial<LayoutSign>;areas:LayoutArea[]};
const revision=data as unknown as {version:number;rooms:Record<string,Row>};
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function need(value:unknown,message:string):asserts value{if(!value)throw Error('Interior speaker presentation: '+message);}
export function speakerPresentation(id:string){
 const row=revision.rooms[id];if(!row)return undefined;
 need(revision.version===1&&isDeepStrictEqual(Object.keys(revision.rooms).sort(),SIGN_IDS.filter(s=>s!=='aries').map(s=>'speaker-'+s).sort()),'exact eleven-room roster');
 const sign=id.slice(8),label=sign[0].toUpperCase()+sign.slice(1),stage=row.areas[0];
 need(row.areas.length===2&&stage.id===`meeting-${sign}`&&row.areas[1].id===`${sign}-audience`,'stage/listener roster');
 const placements=template.placements.map(p=>({...p,id:p.id.replace('aries-style-',`${sign}-style-`),x:p.x+row.offsetX})) as Placement[];
 for(const p of placements){
  if(p.id.endsWith('north-wallpaper')||p.id.endsWith('header-rule')){p.x=1;p.width=row.width-2;}
  if(p.id.endsWith('stage-top')||p.id.endsWith('stage-front')){p.x=stage.x;p.width=stage.width;p.y=p.id.endsWith('stage-top')?stage.y:stage.y+stage.height-1;}
  if(p.id.endsWith('stage-west')||p.id.endsWith('stage-east')){p.x=p.id.endsWith('stage-west')?stage.x:stage.x+stage.width-1;p.y=stage.y+1;p.height=stage.height-2;}
 }
 const images=template.images.map((i,index)=>({...i,name:i.name.replace('Aries / ',label+' / '),x:index>0&&row.partnerXs?row.partnerXs[index-1]:i.x+row.offsetX}));
 if(row.partnerXs)for(const [index,p]of placements.slice(-3).entries())p.x=row.partnerXs[index];
 const signs=template.signs.map(s=>({...s,name:s.name.replace('aries-style-',`${sign}-style-`),x:s.x+row.offsetX})) as LayoutSign[];
 if(row.partnerXs)signs[0].x+=row.partnerXs[1]-(16+row.offsetX);
 return {...row,placements,images,signs};
}
export function speakerPresentationFunctional(id:string,baseline:Functional):Functional{
 const style=speakerPresentation(id);if(!style)return baseline;
 need(sha(baseline)===style.baselineFunctionalSha256,'historical functional baseline changed: '+id);
 const next=structuredClone(baseline),stage=style.areas[0];
 need(next.areas.filter(a=>a.id===stage.id).length===1,'original meeting missing: '+id);
 next.areas=next.areas.map(a=>a.id===stage.id?structuredClone(stage):a);next.areas.push(structuredClone(style.areas[1]));return next;
}
export function assertSpeakerPresentation(layout:MapLayout,catalog:TileCatalog):void{
 const style=speakerPresentation(layout.id);if(!style)return;
 const prefix=layout.id.slice(8)+'-style-';
 need(isDeepStrictEqual(layout.images,style.images),'native branding roster/geometry changed: '+layout.id);
 need(isDeepStrictEqual(layout.placements.filter(p=>p.id.startsWith(prefix)),style.placements),'wallpaper/trim changed: '+layout.id);
 need(sha(layout.placements.filter(p=>!p.id.startsWith(prefix)))===style.basePlacementsSha256,'required furnishings/zodiac/routes changed: '+layout.id);
 need(isDeepStrictEqual(layout.signs?.filter(s=>s.name.startsWith(prefix)),style.signs),'presentation captions changed: '+layout.id);
 need(sha(layout.signs?.filter(s=>!s.name.startsWith(prefix)))===style.baseSignsSha256,'original signs changed: '+layout.id);
 for(const[name,sprite]of Object.entries(template.catalog))need(isDeepStrictEqual(catalog[name],sprite),'native shared artwork/depth/collision changed: '+name);
}
/** Apply the approved template once, keeping each room's genuine original data. */
export function applySpeakerPresentation(original:MapLayout):MapLayout{
 const style=speakerPresentation(original.id);if(!style)return structuredClone(original);
 const prefix=original.id.slice(8)+'-style-';need(!original.placements.some(p=>p.id.startsWith(prefix)),'source already carries successor');
 const next=structuredClone(original),rows=style.placements;
 next.placements.splice(next.placements.findIndex(p=>p.id==='north-wall')+1,0,...structuredClone(rows.slice(0,4)));
 next.placements.splice(next.placements.findIndex(p=>p.id==='primary-screen'),0,...structuredClone(rows.slice(4,9)));
 next.placements.push(...structuredClone(rows.slice(9)));next.images=structuredClone(style.images);
 next.signs=next.signs?.map(s=>s.name==='scene-title'?{...s,...style.title}:s);next.signs?.push(...structuredClone(style.signs));
 next.areas=next.areas.map(a=>a.id===style.areas[0].id?structuredClone(style.areas[0]):a);next.areas.push(structuredClone(style.areas[1]));return next;
}
