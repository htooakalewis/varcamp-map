import { SIGN_IDS } from '../../src/world/catalog';
import type { MapLayout } from './types';

/** Derive small talk scenes from the single authored district-room source. */
export function extractSpeakerMaps(layouts: MapLayout[]): MapLayout[] {
  return SIGN_IDS.map(sign => {
    const source=layouts.find(l=>l.areas.some(a=>a.name===`meeting-${sign}`));
    const zone=source?.inspectionZones.find(z=>z.name===`${sign}-room`);
    const meeting=source?.areas.find(a=>a.name===`meeting-${sign}`);
    if(!source||!zone||!meeting)throw new Error(`Missing authored ${sign} speaker module`);
    const room=source.placements.filter(p=>p.id.startsWith(`${sign}-`)&&p.x>=zone.x&&p.y>=zone.y&&p.x+p.width<=zone.x+zone.width&&p.y+p.height<=zone.y+zone.height);
    return {
      id:`speaker-${sign}`,width:32,height:36,
      placements:[
        {id:'speaker-base',sprite:'floor-charcoal',x:0,y:0,width:32,height:36,layer:'terrain'},
        {id:'speaker-north-boundary',sprite:'wall-navy',x:0,y:0,width:32,height:2,layer:'props'},
        {id:'speaker-west-boundary',sprite:'wall-navy',x:0,y:2,width:1,height:32,layer:'props'},
        {id:'speaker-east-boundary',sprite:'wall-navy',x:31,y:2,width:1,height:32,layer:'props'},
        {id:'speaker-south-boundary',sprite:'wall-navy',x:0,y:34,width:32,height:2,layer:'props'},
        ...room.map(p=>({...p,x:p.x-zone.x+2,y:p.y-zone.y+2})),
      ],
      entries:[{name:'speaker-entry',x:15,y:26,width:2,height:2,isDefault:true}],
      exits:[{name:'plaza-return',destination:'overworld',entry:`from-speaker-${sign}`,x:15,y:31,width:2,height:1}],
      areas:[{...structuredClone(meeting),x:meeting.x-zone.x+2,y:meeting.y-zone.y+2}],
      inspectionZones:[{...zone,x:2,y:2}],
      signs:[{name:'speaker-title',text:`${sign.toUpperCase()} · SPEAKER ROOM`,x:3,y:0,width:26,height:2,fontSize:14,color:'#f4d77b'},
        {name:'speaker-return-guide',text:'SOUTH DOOR → ZODIAC PLAZA',x:3,y:33,width:26,height:1,fontSize:12,color:'#f4d77b'}],
    };
  });
}
