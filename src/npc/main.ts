/// <reference types="@workadventure/iframe-api-typings" />
import { NPCS, type NpcId } from './interactions';
import { venueDestination } from '../navigation';
import './style.css';

const endpoint = 'https://varcamp.3-1-133-135.sslip.io/varcamp-npc';
const id: NpcId = Object.hasOwn(NPCS, location.hash.slice(1)) ? location.hash.slice(1) as NpcId : 'guide';
const host = document.getElementById('npc')!;
host.innerHTML = `<header><p class="eyebrow">VARCAMP · FRIENDLY NPC</p><h1></h1><p id="status" role="status">Connecting to your guide…</p></header><section aria-label="Conversation"><div id="conversation" aria-live="polite"></div><div class="suggestions"><button data-question="How do I move and interact?">Controls</button><button data-question="Where are the 12 speaker rooms?">Speaker rooms</button><button data-question="Can I have a maze hint?">Maze hint</button><button data-question="How do I get to the harbor, shore and FA SHIP?">Harbor & Shore</button></div><form><label for="question">Ask your guide</label><textarea id="question" name="question" maxlength="600" rows="3" required placeholder="e.g. How do I return to the plaza?"></textarea><button type="submit">Send question</button></form><p class="note">Only the question you submit goes to the guide service. AI replies, when enabled, use OpenRouter. Event directions and hints also work offline.</p></section><footer><button data-plaza>Return to Plaza</button><button data-close>Close guide</button></footer>`;
host.querySelector('h1')!.textContent = NPCS[id].name;
const status = host.querySelector<HTMLElement>('#status')!;
const conversation = host.querySelector<HTMLElement>('#conversation')!;
const input = host.querySelector<HTMLTextAreaElement>('#question')!;
const submit = host.querySelector<HTMLButtonElement>('[type="submit"]')!;
let busy = false, alive = true, controller: AbortController | undefined;
let session: string = crypto.randomUUID();
try { const existing = sessionStorage.getItem('varcamp-npc-session'); if (existing && /^[a-zA-Z0-9-]{8,64}$/.test(existing)) session = existing; else sessionStorage.setItem('varcamp-npc-session', session); } catch { /* Ephemeral modal token still works when storage is unavailable. */ }
function line(author: string, text: string): void {
 const item = document.createElement('article'), label = document.createElement('strong'), body = document.createElement('p');
 label.textContent = author; body.textContent = text; item.append(label, body); conversation.append(item);
 while (conversation.children.length > 12) conversation.firstElementChild?.remove();
 item.scrollIntoView({ block: 'nearest' });
}
line(NPCS[id].name, 'Welcome! Ask about directions, controls or maze hints. I’m a map guide, and I can help you find your way.');
void fetch(`${endpoint}/health`).then(r => r.json()).then((health: { mode?: string }) => { if (alive) status.textContent = health.mode === 'openrouter' ? 'AI guide available · replies use OpenRouter' : 'Offline guide · AI is not configured'; }).catch(() => { if (alive) status.textContent = 'Guide service unavailable · use Quest Journal for directions'; });
async function ask(question: string): Promise<void> {
 if (busy || !alive || !question.trim()) return;
 busy = true; submit.disabled = true; controller = new AbortController();
 line('You', question); input.value = ''; status.textContent = 'Your guide is thinking…';
 const deadline = setTimeout(() => controller?.abort(), 20000);
 try {
  const response = await fetch(`${endpoint}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ npc: id, message: question.trim().slice(0, 600), session }), signal: controller.signal });
  if (!response.ok) throw Error('Unavailable');
  const answer = await response.json() as { mode?: string; reply?: unknown };
  if (typeof answer.reply !== 'string') throw Error('Invalid reply');
  if (alive) { line(NPCS[id].name, answer.reply); status.textContent = answer.mode === 'openrouter' ? 'AI reply · OpenRouter' : 'Offline guide reply'; }
 } catch { if (alive) { line(NPCS[id].name, 'I cannot reach the guide service right now. Open Quest Journal for venue directions and full maze hints, or use Return to Plaza below.'); status.textContent = 'Guide service unavailable'; } }
 finally { clearTimeout(deadline); busy = false; if (alive) { submit.disabled = false; input.focus(); } }
}
host.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); void ask(input.value); });
host.addEventListener('click', event => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (button?.dataset.question) void ask(button.dataset.question); });
void WA.onInit().then(() => {
 host.querySelector('[data-close]')!.addEventListener('click', () => WA.ui.modal.closeModal());
 host.querySelector('[data-plaza]')!.addEventListener('click', () => { const room = venueDestination(WA.room.id, 'overworld'); WA.ui.modal.closeModal(); WA.nav.goToRoom(room); });
}).catch(() => { status.textContent = 'Open this guide from the VarCamp map'; });
window.addEventListener('pagehide', () => { alive = false; controller?.abort(); }, { once: true });
