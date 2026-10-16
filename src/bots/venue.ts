import routeData from './lyra-routes.json';

export const ROUTES = routeData;
export type Tile = readonly number[];
export type Destination = typeof ROUTES.destinations[number];
export type Language = 'en' | 'my';
const key = (tile: Tile) => `${tile[0]},${tile[1]}`;
const allowed = new Set(ROUTES.allowedCells.map(key));
const same = (a: Tile, b: Tile) => key(a) === key(b);
export const center = (tile: Tile) => ({ x: tile[0] * 32 + 16, y: tile[1] * 32 + 16 });
export function tileOf(position: { x: number; y: number }): Tile {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw Error('Unknown player position');
  return [Math.floor(position.x / 32), Math.floor(position.y / 32)];
}

/** BFS never admits a native portal, interaction area or reserved startup cell. */
export function planRoute(from: Tile, to: Tile): Tile[] {
  if (!allowed.has(key(from)) || !allowed.has(key(to))) throw Error('Position outside audited normal route graph');
  const queue: Tile[] = [from], previous = new Map<string, Tile | null>([[key(from), null]]);
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    if (same(cell, to)) {
      const result = [cell];
      let parent = previous.get(key(cell));
      while (parent) { result.unshift(parent); parent = previous.get(key(parent)); }
      return result;
    }
    for (const next of [[cell[0] + 1, cell[1]], [cell[0] - 1, cell[1]], [cell[0], cell[1] + 1], [cell[0], cell[1] - 1]]) {
      if (allowed.has(key(next)) && !previous.has(key(next))) { previous.set(key(next), cell); queue.push(next); }
    }
  }
  throw Error('No audited route to destination');
}

/** One-use prefix: actual native spawn column, straight north to row 64. */
export function startupRoute(from: Tile): Tile[] {
  if (allowed.has(key(from))) return planRoute(from, ROUTES.home);
  if (!ROUTES.startupReservedCells.some(cell => same(from, cell))) throw Error('Unknown startup position');
  const prefix: Tile[] = [];
  for (let y = from[1]; y > 64; y--) prefix.push([from[0], y]);
  return [...prefix, ...planRoute([from[0], 64], ROUTES.home)];
}

const names = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces', 'Solar Hall', 'Lunar Hall', 'Mazes', 'Park', 'Harbor', 'Exploration'];
const myNames = ['မိဿ', 'ပြိဿ', 'မေထုန်', 'ကရကဋ်', 'သိဟ်', 'ကန်', 'တူ', 'ဗြိစ္ဆာ', 'ဓနု', 'မကရ', 'ကုမ်', 'မိန်', 'ဆိုလာခန်းမ', 'လူနာခန်းမ', 'ဝင်္ကပါ', 'ပန်းခြံ', 'ဆိပ်ကမ်း', 'စူးစမ်းလေ့လာရေး'];
const aliases = new Map<string, Destination>();
for (const [i, destination] of ROUTES.destinations.entries()) {
  for (const alias of [destination.id, destination.onward, names[i].toLowerCase(), myNames[i], ...(i < 12 ? [String(i + 1), `room ${i + 1}`, `speaker ${names[i].toLowerCase()}`] : [])]) aliases.set(alias, destination);
}
for (const [alias, index] of [['solar', 12], ['lunar', 13], ['maze', 14], ['festival park', 15], ['harbour', 16], ['shipyard', 16], ['campus', 17]] as const) aliases.set(alias, ROUTES.destinations[index]);
export type Command = { kind: 'help' | 'rooms' | 'stop' | 'unknown'; language: Language } | { kind: 'go'; language: Language; destination: Destination };
export function parseCommand(message: string): Command {
  const language: Language = /[\u1000-\u109f]/.test(message) ? 'my' : 'en';
  const text = message.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[၀-၉]/g, d => String('၀၁၂၃၄၅၆၇၈၉'.indexOf(d)));
  if (['help', 'အကူအညီ'].includes(text)) return { kind: 'help', language };
  if (['rooms', 'အခန်းများ'].includes(text)) return { kind: 'rooms', language };
  if (['stop', 'ရပ်'].includes(text)) return { kind: 'stop', language };
  const alias = text.replace(/^(?:go|သွား)\s+/, '');
  const destination = aliases.get(alias);
  return destination ? { kind: 'go', destination, language } : { kind: 'unknown', language };
}
export function label(destination: Destination, language: Language): string {
  const index = ROUTES.destinations.findIndex(d => d.id === destination.id);
  return language === 'my' ? myNames[index] : names[index];
}
export const help = (language: Language) => language === 'my'
  ? 'အကူအညီ • အခန်းများ • သွား <အမည် သို့မဟုတ် ၁–၁၂> • ရပ်။ လိုက်လျှောက်လိုပါက ကိုယ်တိုင် လိုက်လာပါ။'
  : 'help • rooms • go <destination or 1–12> • stop. Walk along with me if you want an escort.';
export const rooms = (language: Language) => (language === 'my' ? 'အခန်းများ: ' : 'Rooms: ') + ROUTES.destinations.map((d, i) => `${i < 12 ? `${i + 1} ` : ''}${label(d, language)}`).join(', ');
export const busy = (language: Language) => language === 'my' ? 'အခြားဧည့်သည်ကို လမ်းပြနေပါသည်။ ခဏစောင့်ပါ။' : 'I’m busy guiding another visitor. Please wait.';
export const gateReply = (destination: Destination, language: Language, arrived = false) => language === 'my'
  ? `${label(destination, language)} သို့ ${arrived ? 'ရောက်ပါပြီ' : 'လမ်းပြပါမည်'}။ ရှေ့ရှိ ${destination.gate} ဝင်ပေါက်မှ ဆက်သွားနိုင်ပါသည်။ ဝင်ပေါက်မတိုင်မီ ရပ်ပါမည်။`
  : `${arrived ? 'Here is' : 'I’ll guide you to'} ${label(destination, language)}. The ${destination.gate} gate leads onward to ${destination.onward}. I stop before the portal.`;
