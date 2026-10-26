import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {MapLayout,LayoutAnimatedOverlay} from './types';
const pairs=()=>JSON.parse(readFileSync('world/leo-lion-head.json','utf8')).producerInputs as Record<string,[string,string]>;
export function leoInputSha(path:string,pin:string):string{const pair=pairs()[path];return pair&&pair[0]===pin?pair[1]:pin;}
export function advanceLeoOverlay(original:LayoutAnimatedOverlay):LayoutAnimatedOverlay{
 const o=structuredClone(original);for(const input of o.provenance?.inputs??[]){const pair=pairs()[input.path];if(!pair)continue;
  if(!pair.includes(input.sha256)||createHash('sha256').update(readFileSync(input.path)).digest('hex')!==pair[1])throw Error('Leo lion head: unreviewed producer '+input.path);
  input.sha256=pair[1];
 }return o;
}
export function advanceLeoProvenance<T extends MapLayout>(original:T):T{const l=structuredClone(original);if(l.animatedOverlays)l.animatedOverlays=l.animatedOverlays.map(advanceLeoOverlay);return l;}
export function priorLeoProvenance<T extends MapLayout>(original:T):T{const l=structuredClone(original),table=pairs();for(const o of l.animatedOverlays??[])for(const input of o.provenance?.inputs??[]){const pair=table[input.path];if(pair&&input.sha256===pair[1])input.sha256=pair[0];}return l;}
