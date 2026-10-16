import { ELEMENT_IDS, SIGN_IDS, type ElementId, type SignId } from '../world/catalog';
export const COMET_CHECKPOINT_IDS = ['1', '2', '3'] as const;
export type CometCheckpointId = typeof COMET_CHECKPOINT_IDS[number];

export interface Progress {
  signs: Record<SignId, boolean>;
  elements: Record<ElementId, boolean>;
  mazeComplete: boolean;
  observatoryDiscovered: boolean;
  cometCheckpoints: Record<CometCheckpointId, boolean>;
  cometComplete: boolean;
}
export type BadgeId = 'zodiac-explorer' | 'maze-navigator' | 'stargazer' | 'comet-trailblazer';
export interface QuestSummary {
  discoveredSigns: SignId[];
  missingSigns: SignId[];
  elements: ElementId[];
  badges: BadgeId[];
  cometCheckpoints: CometCheckpointId[];
}
export type FlagKey = `varcamp2026.sign.${SignId}` | `varcamp2026.sigil.${ElementId}` | `varcamp2026.comet.checkpoint.${CometCheckpointId}` | 'varcamp2026.cometComplete' | 'varcamp2026.mazeComplete' | 'varcamp2026.observatoryDiscovered';

export function normalizeProgress(raw: Record<string, unknown>): Progress {
  return {
    signs: Object.fromEntries(SIGN_IDS.map(id => [id, raw[`varcamp2026.sign.${id}`] === true])) as Record<SignId, boolean>,
    elements: Object.fromEntries(ELEMENT_IDS.map(id => [id, raw[`varcamp2026.sigil.${id}`] === true])) as Record<ElementId, boolean>,
    mazeComplete: raw['varcamp2026.mazeComplete'] === true,
    observatoryDiscovered: raw['varcamp2026.observatoryDiscovered'] === true,
    cometCheckpoints: Object.fromEntries(COMET_CHECKPOINT_IDS.map(id => [id, raw[`varcamp2026.comet.checkpoint.${id}`] === true])) as Record<CometCheckpointId, boolean>,
    cometComplete: raw['varcamp2026.cometComplete'] === true,
  };
}

export function canEnterObservatory(progress: Progress): boolean {
  return ELEMENT_IDS.every(id => progress.elements[id] === true);
}
export function canCompleteComet(progress: Progress): boolean {
  return COMET_CHECKPOINT_IDS.every(id => progress.cometCheckpoints[id] === true);
}

export function summarizeProgress(progress: Progress): QuestSummary {
  const discoveredSigns = SIGN_IDS.filter(id => progress.signs[id] === true);
  const badges: BadgeId[] = [];
  if (discoveredSigns.length === SIGN_IDS.length) badges.push('zodiac-explorer');
  if (progress.mazeComplete === true) badges.push('maze-navigator');
  if (canEnterObservatory(progress) && progress.observatoryDiscovered === true) badges.push('stargazer');
  if (canCompleteComet(progress) && progress.cometComplete === true) badges.push('comet-trailblazer');
  return {
    discoveredSigns,
    missingSigns: SIGN_IDS.filter(id => progress.signs[id] !== true),
    elements: ELEMENT_IDS.filter(id => progress.elements[id] === true),
    badges,
    cometCheckpoints: COMET_CHECKPOINT_IDS.filter(id => progress.cometCheckpoints[id] === true),
  };
}
