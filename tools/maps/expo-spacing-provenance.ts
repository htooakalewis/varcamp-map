import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {MapLayout,LayoutAnimatedOverlay} from './types';
import {fountainInputSha,advanceFountainOverlay,priorFountainProvenance} from './fountain-motion-provenance';
const pairs=()=>JSON.parse(readFileSync('world/expo-spacing.json','utf8')).producerInputs as Record<string,[string,string]>;
export function spacingInputSha(path:string,pin:string):string{const pair=pairs()[path];return fountainInputSha(path,pair&&pair[0]===pin?pair[1]:pin);}
export function advanceSpacingOverlay(original:LayoutAnimatedOverlay):LayoutAnimatedOverlay{
 const o=structuredClone(original),table=pairs();for(const input of o.provenance?.inputs??[]){const pair=table[input.path];if(!pair)continue;
  if(!pair.includes(input.sha256)||createHash('sha256').update(readFileSync(input.path)).digest('hex')!==pair[1])throw Error('Expo spacing: unreviewed producer '+input.path);
  input.sha256=pair[1];
 }return advanceFountainOverlay(o);
}
export function advanceSpacingProvenance<T extends MapLayout>(original:T):T{const l=structuredClone(original);if(l.animatedOverlays)l.animatedOverlays=l.animatedOverlays.map(advanceSpacingOverlay);return l;}
/** Retract this exact pair only; earlier epochs retain their own input validators. */
export function priorSpacingProvenance<T extends MapLayout>(original:T):T{const l=priorFountainProvenance(original),table=pairs();for(const o of l.animatedOverlays??[])for(const input of o.provenance?.inputs??[]){const pair=table[input.path];if(pair&&input.sha256===pair[1])input.sha256=pair[0];}return l;}
