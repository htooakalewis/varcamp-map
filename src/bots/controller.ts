import { guardMap } from './map-guard';
import { ROUTES, busy, center, gateReply, help, parseCommand, planRoute, rooms, startupRoute, tileOf, type Destination, type Language, type Tile } from './venue';

export type Point = { x: number; y: number };
export type Dispose = () => void;
export interface Bubble {
  participants: number[];
  onJoin(callback: (id: number) => void): Dispose;
  onLeave(callback: (id: number) => void): Dispose;
  onEnd(callback: () => void): Dispose;
}
export interface ChatEvent { text: string; authorId: number | undefined }
export interface LyraAdapter {
  map(): Promise<unknown>;
  roomId(): string;
  position(): Promise<Point>;
  move(point: Point): Promise<Point & { cancelled: boolean }>;
  say(text: string): void;
  diagnostic(text: string): void;
  onChat(callback: (event: ChatEvent) => void): Dispose;
  onBubble(callback: (bubble: Bubble) => void): Dispose;
}
export interface Scheduler {
  now(): number;
  setTimeout(callback: () => void, milliseconds: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}
const clock: Scheduler = { now: () => Date.now(), setTimeout: (cb, ms) => setTimeout(cb, ms), clearTimeout: handle => clearTimeout(handle) };
interface Visitor { seen: number; greeted: number; replied: number }
export interface LyraController {
  /** Resolves only when every in-flight API continuation has settled, even after stop. */
  readonly done: Promise<void>;
  start(): Promise<void>;
  stop(reason?: string): void;
}

/** Owns one serialized movement loop. stop invalidates work; it never guesses that a pending move ended. */
export function createLyraController(api: LyraAdapter, scheduler: Scheduler = clock): LyraController {
  let started = false, active = false, finished = false, room = '', current: Tile = ROUTES.home;
  let mode: 'startup' | 'patrol' | 'escort' | 'return' = 'startup', corner = 1;
  let startup: Tile[] = [], startupDeadline = 0, lastActivity = -Infinity, greeting = 0;
  let escort: { owner: number; destination: Destination; language: Language } | undefined;
  const visitors = new Map<number, Visitor>(), participants = new Set<number>();
  const timers = new Set<ReturnType<typeof setTimeout>>(), subscriptions: Dispose[] = [];
  let meetingSubscriptions: Dispose[] = [], wake: (() => void) | undefined;
  let finish!: () => void;
  const done = new Promise<void>(resolve => { finish = resolve; });
  const timer = (cb: () => void, ms: number) => {
    const handle = scheduler.setTimeout(() => { timers.delete(handle); if (active) cb(); }, ms); timers.add(handle); return handle;
  };
  const cancel = (handle: ReturnType<typeof setTimeout>) => { scheduler.clearTimeout(handle); timers.delete(handle); };
  const stop = (reason = 'operator stop') => {
    if (finished) return;
    active = false; finished = true;
    for (const handle of timers) scheduler.clearTimeout(handle); timers.clear();
    for (const off of [...subscriptions.splice(0), ...meetingSubscriptions.splice(0)]) off();
    participants.clear(); visitors.clear(); wake?.(); wake = undefined;
    api.diagnostic(`Lyra stopped: ${reason}`);
    if (!started) finish();
  };
  const sleep = (ms: number) => new Promise<void>(resolve => {
    if (!active) { resolve(); return; }
    wake = resolve; timer(() => { wake = undefined; resolve(); }, ms);
  });
  const checkRoom = () => {
    if (api.roomId() !== room) { stop('room changed'); return false; }
    return active;
  };
  const monitor = () => {
    if (!checkRoom()) return;
    if (mode === 'startup' && scheduler.now() > startupDeadline) { stop('startup timeout'); return; }
    timer(monitor, 100);
  };
  const visitor = (id: number) => {
    const now = scheduler.now();
    for (const [key, value] of visitors) if (now - value.seen >= 600000) visitors.delete(key);
    let value = visitors.get(id);
    if (!value) {
      // Retain recent cooldowns rather than evicting and greeting a returning visitor twice.
      if (visitors.size >= 256) return undefined;
      value = { seen: now, greeted: -Infinity, replied: -Infinity }; visitors.set(id, value);
    }
    value.seen = now; return value;
  };
  const join = (id: number) => {
    if (!active || !Number.isFinite(id)) return;
    const value = visitor(id);
    if (!value || participants.size >= 256 && !participants.has(id)) return;
    participants.add(id); lastActivity = scheduler.now();
    if (scheduler.now() - value.greeted >= 120000) {
      value.greeted = scheduler.now();
      api.say(['Hi, I’m Lyra [BOT]. Type help or rooms for an optional walking guide.', 'Welcome! I’m Lyra [BOT]. Ask for rooms, or type go and a destination.'][greeting++ % 2]);
    }
  };
  const onBubble = (bubble: Bubble) => {
    if (!active) return;
    for (const off of meetingSubscriptions.splice(0)) off(); participants.clear();
    for (const id of bubble.participants) join(id);
    meetingSubscriptions = [bubble.onJoin(join), bubble.onLeave(id => { participants.delete(id); }), bubble.onEnd(() => {
      participants.clear(); for (const off of meetingSubscriptions.splice(0)) off();
    })];
  };
  const reply = (value: Visitor | undefined, text: string) => {
    if (!value || scheduler.now() - value.replied < 2000) return;
    value.replied = scheduler.now(); api.say(text);
  };
  const onChat = ({ text, authorId }: ChatEvent) => {
    if (!active || authorId === undefined || !participants.has(authorId)) return;
    lastActivity = scheduler.now();
    const value = visitor(authorId);
    if (!value) return;
    const command = parseCommand(text), language = command.language;
    if (command.kind === 'help' || command.kind === 'unknown') { reply(value, help(language)); return; }
    if (command.kind === 'rooms') { reply(value, rooms(language)); return; }
    if (escort && escort.owner !== authorId) { reply(value, busy(language)); return; }
    if (command.kind === 'stop') {
      escort = undefined; if (mode !== 'startup') mode = 'return';
      reply(value, language === 'my' ? 'လမ်းပြခြင်း ရပ်ပါမည်။ မူလနေရာသို့ ပြန်ပါမည်။' : 'Escort stopped. I’m returning home.'); return;
    }
    if (command.kind !== 'go') return;
    escort = { owner: authorId, destination: command.destination, language };
    if (mode !== 'startup') mode = 'escort';
    reply(value, gateReply(command.destination, language));
  };
  const same = (a: Tile, b: Tile) => a[0] === b[0] && a[1] === b[1];
  const move = async (next: Tile) => {
    if (!checkRoom()) return;
    const actual = tileOf(await api.position());
    if (!active || !checkRoom()) return;
    if (!same(actual, current)) throw Error('Unexpected player position before step');
    if (Math.abs(next[0] - current[0]) + Math.abs(next[1] - current[1]) !== 1) throw Error('Non-adjacent route step');
    const timeout = timer(() => stop('movement timeout; pending move remains quarantined'), 10000);
    // Do not race this promise against a timeout: a timeout is not native cancellation.
    const result = await api.move(center(next)); cancel(timeout);
    if (!active || !checkRoom()) return;
    if (result.cancelled) throw Error('Native movement cancelled');
    if (!same(tileOf(result), next)) throw Error('Movement result outside intended cell');
    current = next;
    await sleep(100);
  };
  const loop = async () => {
    while (active && checkRoom()) {
      if (mode === 'startup') {
        const next = startup.shift();
        if (next) { await move(next); continue; }
        mode = escort ? 'escort' : 'patrol';
      }
      if (mode === 'patrol' && participants.size > 0 && scheduler.now() - lastActivity < 20000) { await sleep(100); continue; }
      const target = mode === 'escort' && escort ? escort.destination.tile : mode === 'return' ? ROUTES.home : ROUTES.patrol[corner];
      if (same(current, target)) {
        if (mode === 'escort' && escort) { reply(visitors.get(escort.owner), gateReply(escort.destination, escort.language, true)); mode = 'return'; continue; }
        if (mode === 'return') { escort = undefined; mode = 'patrol'; corner = 1; continue; }
        // The authored closing waypoint repeats home; count each cyclic corner only once.
        corner = (corner + 1) % (ROUTES.patrol.length - 1);
        await sleep(2000); continue;
      }
      await move(planRoute(current, target)[1]);
    }
  };
  const start = async () => {
    if (started || finished) return;
    started = true; active = true;
    try {
      room = api.roomId();
      await guardMap(await api.map()); if (!active || !checkRoom()) { finish(); return; }
      current = tileOf(await api.position()); if (!active || !checkRoom()) { finish(); return; }
      startup = startupRoute(current).slice(1); startupDeadline = scheduler.now() + 60000;
      subscriptions.push(api.onChat(onChat), api.onBubble(onBubble)); monitor();
      void loop().catch(error => stop(error instanceof Error ? error.message : String(error))).finally(finish);
    } catch (error) { stop(error instanceof Error ? error.message : String(error)); finish(); }
  };
  return { done, start, stop };
}
