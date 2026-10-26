import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {MapLayout,LayoutAnimatedOverlay} from './types';
import {leoInputSha,advanceLeoOverlay,priorLeoProvenance} from './leo-lion-head-provenance';
const pairs=()=>JSON.parse(readFileSync('world/fountain-motion.json','utf8')).producerInputs as Record<string,[string,string]>;
export function fountainInputSha(path:string,pin:string):string{const pair=pairs()[path];return leoInputSha(path,pair&&pair[0]===pin?pair[1]:pin);}
export function advanceFountainOverlay(original:LayoutAnimatedOverlay):LayoutAnimatedOverlay{
 const o=structuredClone(original),table=pairs();for(const input of o.provenance?.inputs??[]){const pair=table[input.path];if(!pair)continue;
  const final=leoInputSha(input.path,pair[1]);if(![...pair,final].includes(input.sha256)||createHash('sha256').update(readFileSync(input.path)).digest('hex')!==final)throw Error('Fountain motion: unreviewed producer '+input.path);
  input.sha256=final;
 }return advanceLeoOverlay(o);
}
export function advanceFountainProvenance<T extends MapLayout>(original:T):T{const l=structuredClone(original);if(l.animatedOverlays)l.animatedOverlays=l.animatedOverlays.map(advanceFountainOverlay);return l;}
export function priorFountainProvenance<T extends MapLayout>(original:T):T{const l=priorLeoProvenance(original),table=pairs();for(const o of l.animatedOverlays??[])for(const input of o.provenance?.inputs??[]){const pair=table[input.path];if(pair&&input.sha256===pair[1])input.sha256=pair[0];}return l;}
