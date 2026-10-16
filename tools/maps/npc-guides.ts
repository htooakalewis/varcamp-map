import type { MapLayout } from './types';

const retiredHosts = {
  overworld: 'guide',
  'orbit-maze': 'maze-keeper',
  'comet-maze': 'maze-keeper',
  'shipyard-beach': 'dockmaster',
} as const;

/** Compatibility for older authoring callers: retire only the four static Q&A hosts. */
export function addNpcGuides(layouts: MapLayout[]): MapLayout[] {
  return layouts.map(source => {
    const npc = retiredHosts[source.id as keyof typeof retiredHosts];
    if (!npc) return source;
    const layout = structuredClone(source);
    layout.placements = layout.placements.filter(p => p.id !== `npc-character-${npc}`);
    layout.signs = layout.signs?.filter(s => s.name !== `npc-name-${npc}`);
    layout.areas = layout.areas.filter(a => a.name !== `npc-${npc}`);
    return layout;
  });
}
