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
export function registerNpcInteractions(api: WorkAdventureApi): () => void {
 const map = new URL(api.room.id).pathname.split('/').at(-1)?.replace(/\.(wam|tmj)$/, '');
 const subscriptions: { unsubscribe(): void }[] = [];
 const actions = new Set<{ remove(): Promise<void> }>();
 let alive = true;
 for (const [id, npc] of Object.entries(NPCS)) {
  if (!(npc.maps as readonly string[]).includes(map ?? '')) continue;
  let handle: { remove(): Promise<void> } | undefined;
  const remove = () => { const old = handle; handle = undefined; if (old) { actions.delete(old); void old.remove().catch(() => {}); } };
  subscriptions.push(api.mapEditor.area.onEnter(npc.area).subscribe(() => {
   if (!alive) return; remove();
   const offered = api.ui.displayActionMessage({ message: `Talk to ${npc.name}`, callback: () => { if (!alive || handle !== offered) return; remove(); openNpc(api, id as NpcId); } });
   handle = offered; actions.add(offered);
  }));
  subscriptions.push(api.mapEditor.area.onLeave(npc.area).subscribe(remove));
 }
 return () => { alive = false; subscriptions.forEach(s => s.unsubscribe()); actions.forEach(a => { void a.remove().catch(() => {}); }); actions.clear(); };
}
