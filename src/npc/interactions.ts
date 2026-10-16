import type { WorkAdventureApi } from '../runtime';

export const NPCS = {
 guide: { name: 'Lyra · Plaza Guide', area: 'npc-guide', maps: ['overworld'] },
 'maze-keeper': { name: 'Aster · Maze Keeper', area: 'npc-maze-keeper', maps: ['orbit-maze', 'comet-maze'] },
 dockmaster: { name: 'Nova · Dockmaster', area: 'npc-dockmaster', maps: ['shipyard-beach'] },
} as const;
export type NpcId = keyof typeof NPCS;
const panelPath = import.meta.env.DEV ? './index.html' : `../src/npc/index.html?v=${import.meta.env.VARCAMP_UI_RELEASE}`;
const panelAsset = new URL(/* @vite-ignore */ panelPath, import.meta.url).href;

export function openNpc(api: WorkAdventureApi, id: NpcId): void {
 api.ui.modal.openModal({ src: `${panelAsset}#${id}`, title: NPCS[id].name, allow: null, allowApi: true, position: 'right', allowFullScreen: false, closable: true });
}
/** Retired static Q&A guides must stay inert even if a live WAM retains an old area. */
export function registerNpcInteractions(_api: WorkAdventureApi): () => void {
 return () => {};
}
