import {isDeepStrictEqual} from 'node:util';
import {EXPO_BOOTHS,expoPlacements,isExpoPlaza} from './expo-plaza';
import type {MapLayout,Placement} from './types';

/** Finite successor to the original expo: native furniture and exact logo pixels,
 * with open fronts inside the existing booth envelopes. No atlas or control changes. */
export function refineExpoBooths(original:MapLayout):MapLayout {
 if(original.id!=='overworld'||original.width!==128||original.height!==128||!isExpoPlaza(original))throw Error('Booth refinement requires the existing128-square expo');
 const expected=expoPlacements(),owned=new Set(expected.map(p=>p.id));
 for(const p of expected){const rows=original.placements.filter(v=>v.id===p.id);if(rows.length!==1||!isDeepStrictEqual(rows[0],p))throw Error('Booth refinement requires the exact original fixture: '+p.id);}
 const l=structuredClone(original);
 l.placements=l.placements.flatMap((p):Placement[]=>{
  if(!owned.has(p.id))return[p];
  if(p.sprite.startsWith('sticker-')||p.sprite==='balloons-party')return[];
  const side=/^expo-(west|east)-(north|south)-side-/.exec(p.id);
  if(side)return[{...p,y:side[2]==='north'?73:85,height:4}];
  if(/^expo-(west|east)-north-seal-\d+-77$|^expo-(west|east)-south-seal-\d+-83$/.test(p.id))return[];
  const b=EXPO_BOOTHS.find(b=>p.id===`expo-${b.id}-counter`||p.id===`expo-${b.id}-chair`);
  if(b&&p.id.endsWith('-counter'))return[{...p,sprite:'desk-curved',x:b.interior.x+1,y:b.row==='north'?77:82,width:4,height:3,...(b.row==='north'?{flipY:true}:{})}];
  if(b)return[{...p,y:b.row==='north'?77:84}];
  return[p];
 });
 for(const b of EXPO_BOOTHS)if(b.mark){
  const image=l.images!.find(i=>i.x===b.logo.x&&i.y===b.logo.y&&i.width===b.logo.width&&i.height===b.logo.height);
  if(!image)throw Error('Booth logo missing: '+b.id);
  image.y=b.row==='north'?75:85;
 }
 return l;
}
