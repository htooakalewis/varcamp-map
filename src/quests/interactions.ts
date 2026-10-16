import type { WorkAdventureApi } from '../runtime';
import { openJournal, publishView } from '../runtime';
import type { ProgressStore } from './store';
import { canEnterObservatory, canCompleteComet, COMET_CHECKPOINT_IDS, summarizeProgress, type FlagKey } from './model';
import { emptyJournalView, SAVE_ERROR, type JournalView } from '../journal/view';
import { ELEMENT_IDS, SIGN_IDS, WORLD_CATALOG, type MapId } from '../world/catalog';
import { venueDestination } from '../navigation';
const title = (s: string) => s[0].toUpperCase() + s.slice(1);
export function registerInteractions(api: WorkAdventureApi, store: ProgressStore, catalog: typeof WORLD_CATALOG): () => void {
 const map = new URL(api.room.id).pathname.split('/').at(-1)!.replace(/\.(wam|tmj)$/, '') as MapId;
 if (!Object.hasOwn(catalog, map)) return () => {};
 const pending = new Set<FlagKey>();
 let errorMessage: string | undefined, ready = false, alive = true;
 const subscriptions: { unsubscribe(): void }[] = [];
 const actions = new Set<{ remove(): Promise<void> }>();
 const sync = () => {
  if (!alive) return;
  let view: JournalView = { ...emptyJournalView };
  try { view = { ready: true, summary: summarizeProgress(store.get()), pendingKeys: [...pending], ...(errorMessage ? { errorMessage } : {}) }; ready = true; }
  catch { ready = false; }
  publishView(api, view);
 };
 sync();
 function bind(area: string, message: string, callback: () => void | Promise<boolean>) {
  let handle: { remove(): Promise<void> } | undefined;
  let inside = false, inFlight = false;
  const remove = () => { const old = handle; handle = undefined; if (old) { actions.delete(old); void old.remove().catch(() => {}); } };
  const offer = () => {
   if (!alive || !inside || inFlight || handle) return;
   const offered = api.ui.displayActionMessage({ message, callback: () => {
    if (!alive || !inside || inFlight || handle !== offered) return;
    // The pinned host consumes the popup before delivering activation. Clear
    // our ownership immediately, and clean its script-local registry as well.
    remove(); inFlight = true;
    void (async () => {
     let retry = false;
     try { retry = await callback() === true; }
     finally { inFlight = false; if (retry) offer(); }
    })();
   } });
   handle = offered; actions.add(offered);
  };
  subscriptions.push(api.mapEditor.area.onEnter(area).subscribe(() => { inside = true; remove(); offer(); }));
  subscriptions.push(api.mapEditor.area.onLeave(area).subscribe(() => { inside = false; remove(); }));
 }
 async function collect(key: FlagKey): Promise<boolean> {
  if (pending.has(key)) return false;
  pending.add(key); errorMessage = undefined; sync();
  try { await store.saveFlag(key); return false; }
  catch { errorMessage = SAVE_ERROR; return true; }
  finally { pending.delete(key); sync(); }
 }
 if (map === 'overworld' || map === 'campus-exploration') bind('welcome-directory', 'Open the welcome directory', () => openJournal(api, 'directory'));
 if (map === 'stargazer-terrace') {
  bind('observatory-telescope', 'Look through the telescope · four saved sigils required', () => {
   if (ready && canEnterObservatory(store.get())) api.nav.goToRoom(venueDestination(api.room.id, 'hidden-observatory'));
   else openJournal(api);
  });
 }
 for (const sign of SIGN_IDS) if (map === `speaker-${sign}`) bind(`beacon-${sign}`, `Discover ${title(sign)}`, () => collect(`varcamp2026.sign.${sign}`));
 for (const element of ELEMENT_IDS) if (map === `${element}-district`) {
  bind(`sigil-${element}`, `Collect the ${title(element)} sigil`, () => collect(`varcamp2026.sigil.${element}`));
 }
 if (map === 'orbit-maze') bind('maze-finish', 'Complete the Orbit Maze', () => collect('varcamp2026.mazeComplete'));
 if (map === 'comet-maze') {
  for (const id of COMET_CHECKPOINT_IDS) bind(`comet-checkpoint-${id}`, `Collect Comet checkpoint ${id}`, () => collect(`varcamp2026.comet.checkpoint.${id}`));
  bind('comet-finish', 'Complete Comet Maze · three saved checkpoints required', () => {
   if (ready && canCompleteComet(store.get())) return collect('varcamp2026.cometComplete');
   openJournal(api);
   return undefined;
  });
 }
 if (map === 'hidden-observatory') bind('observatory-discovery', 'Discover the observatory · four saved sigils required', () => collect('varcamp2026.observatoryDiscovered'));
 return () => { alive = false; subscriptions.forEach(s => s.unsubscribe()); actions.forEach(a => { void a.remove().catch(() => {}); }); actions.clear(); };
}
