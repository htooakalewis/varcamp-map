import type { MapLayout } from './types';

/** Authored scenes are the source of initial exports. No generated facades or random landscaping. */
export function composeZodiacWheel(authored: MapLayout[]): MapLayout[] {
  return structuredClone(authored);
}
