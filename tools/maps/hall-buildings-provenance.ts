import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {MapLayout,LayoutAnimatedOverlay} from './types';
const pairs=()=>JSON.parse(readFileSync('world/hall-buildings.json','utf8')).producerInputs as Record<string,[string,string]>;
export function hallBuildingsInputSha(path:string,pin:string):string{const p=pairs()[path];return p&&p[0]===pin?p[1]:pin;}
export function advanceHallBuildingsOverlay(original:LayoutAnimatedOverlay):LayoutAnimatedOverlay{
 const o=structuredClone(original);for(const input of o.provenance?.inputs??[]){const pair=pairs()[input.path];if(!pair)continue;
  if(!pair.includes(input.sha256)||createHash('sha256').update(readFileSync(input.path)).digest('hex')!==pair[1])throw Error('Hall buildings: unreviewed producer '+input.path);input.sha256=pair[1];
 }return o;
}
export function advanceHallBuildingsProvenance<T extends MapLayout>(original:T):T{const l=structuredClone(original);if(l.animatedOverlays)l.animatedOverlays=l.animatedOverlays.map(advanceHallBuildingsOverlay);return l;}
export function priorHallBuildingsProvenance<T extends MapLayout>(original:T):T{const l=structuredClone(original),table=pairs();for(const o of l.animatedOverlays??[])for(const input of o.provenance?.inputs??[]){const p=table[input.path];if(p&&input.sha256===p[1])input.sha256=p[0];}return l;}
