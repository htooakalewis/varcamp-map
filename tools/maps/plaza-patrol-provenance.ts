import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {LayoutAnimatedOverlay,MapLayout} from './types';
import {spacingInputSha,advanceSpacingOverlay,priorSpacingProvenance} from './expo-spacing-provenance';
const pairs=()=>JSON.parse(readFileSync('world/plaza-patrol.json','utf8')).producerInputs as Record<string,[string,string]>;
/** Exact prior/current input hashes, never a wildcard provenance rewrite. */
export function patrolInputSha(path:string,pin:string):string{const pair=pairs()[path];return spacingInputSha(path,pair&&pair[0]===pin?pair[1]:pin);}
export function advancePatrolOverlay(original:LayoutAnimatedOverlay):LayoutAnimatedOverlay{
 const o=structuredClone(original);for(const input of o.provenance?.inputs??[]){const pair=pairs()[input.path];if(!pair)continue;
  if(![...pair,spacingInputSha(input.path,pair[1])].includes(input.sha256)||createHash('sha256').update(readFileSync(input.path)).digest('hex')!==spacingInputSha(input.path,pair[1]))throw Error('Plaza patrol: unknown producer '+input.path);
  input.sha256=pair[1];
 }return advanceSpacingOverlay(o);
}
export function advancePatrolProvenance<T extends MapLayout>(original:T):T{const l=structuredClone(original);if(l.animatedOverlays)l.animatedOverlays=l.animatedOverlays.map(advancePatrolOverlay);return l;}
export function priorPatrolProvenance<T extends MapLayout>(original:T):T{const l=priorSpacingProvenance(original);for(const o of l.animatedOverlays??[])for(const input of o.provenance?.inputs??[]){const pair=pairs()[input.path];if(pair){if(!pair.includes(input.sha256))throw Error('Plaza patrol: unknown prior producer '+input.path);input.sha256=pair[0];}}return l;}
