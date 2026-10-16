import { guardMap } from './map-guard';
import { addressedCommand, PERSONAS, personaByName, type Persona } from './personas';
import { busy, center, gateReply, help, parseCommand, planRoute, rooms, startupRoute, tileOf, type Destination, type Language, type Tile } from './venue';

export type Point = { x: number; y: number };
export type Dispose = () => void;
export interface Participant { id: number; name?: string }
/** Numeric participants remain supported for existing controller adapters. Native adapters supply names. */
export type BubbleMember = number | Participant;
export interface Bubble {
  participants: BubbleMember[];
  onJoin(callback: (member: BubbleMember) => void): Dispose;
  onLeave(callback: (id: number) => void): Dispose;
  onEnd(callback: () => void): Dispose;
}
export interface ChatEvent { text: string; authorId: number | undefined; authorName?: string }
export interface LyraAdapter {
  /** Public identity, read after WA.onInit; omitted only by legacy isolated adapters. */
  self?(): Participant;
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
export function createLyraController(api: LyraAdapter, scheduler: Scheduler = clock, persona: Persona = PERSONAS.lyra): LyraController {
  let started = false, active = false, ready = false, finished = false, room = '', current: Tile = persona.home;
  let self: Participant = { id: -1, name: persona.name };
  let mode: 'startup' | 'patrol' | 'escort' | 'return' = 'startup', corner = 1;
  let startup: Tile[] = [], startupDeadline = 0, lastActivity = -Infinity;
  let escort: { owner: number; destination: Destination; language: Language } | undefined;
  const visitors = new Map<number, Visitor>(), participants = new Set<number>();
  const botCandidates = new Map<number, Persona>();
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
    participants.clear(); botCandidates.clear(); visitors.clear(); wake?.(); wake = undefined;
    api.diagnostic(`${persona.name} stopped: ${reason}`);
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
  // Membership and election are independent of escort availability. Self is often omitted
  // from public native meeting snapshots, so include its validated identity explicitly.
  const elected = () => ![...botCandidates].some(([id, candidate]) =>
    candidate.rank < persona.rank || candidate.rank === persona.rank && id < self.id);
  const greet = (id: number) => {
    if (!ready || !elected()) return;
    const value = visitor(id);
    if (value && scheduler.now() - value.greeted >= 120000) {
      value.greeted = scheduler.now();
      api.say(`Hi, I’m ${persona.name}. Type Gemini, Cancer or Libra for a walking guide; help shows how to address each guide.`);
    }
  };
  const botMember = (id: number, candidate: Persona) => {
    participants.delete(id); visitors.delete(id); botCandidates.set(id, candidate);
    if (escort?.owner === id) { escort = undefined; if (mode !== 'startup') mode = 'return'; }
  };
  const addMember = (member: BubbleMember) => {
    const { id, name } = typeof member === 'number' ? { id: member, name: undefined } : member;
    if (!active || !Number.isFinite(id) || id === self.id) return;
    const candidate = personaByName(name);
    if (candidate) { botMember(id, candidate); return; }
    botCandidates.delete(id);
    if (participants.size >= 256 && !participants.has(id)) return;
    // During async validation retain current membership only, without greeting or activity.
    if (ready && !visitor(id)) return;
    participants.add(id);
    if (ready) lastActivity = scheduler.now();
  };
  const onBubble = (bubble: Bubble) => {
    if (!active) return;
    for (const off of meetingSubscriptions.splice(0)) off();
    participants.clear(); botCandidates.clear();
    // Complete the entire snapshot before any greeting: array ordering cannot elect a peer late.
    for (const member of bubble.participants) addMember(member);
    meetingSubscriptions = [bubble.onJoin(member => {
      addMember(member);
      const id = typeof member === 'number' ? member : member.id;
      if (participants.has(id)) greet(id);
    }), bubble.onLeave(id => { participants.delete(id); botCandidates.delete(id); }), bubble.onEnd(() => {
      participants.clear(); botCandidates.clear();
      for (const off of meetingSubscriptions.splice(0)) off();
    })];
    if (ready) for (const id of participants) greet(id);
  };
  const reply = (value: Visitor | undefined, text: string) => {
    if (!value || scheduler.now() - value.replied < 2000) return;
    value.replied = scheduler.now(); api.say(text);
  };
  const onChat = ({ text, authorId, authorName }: ChatEvent) => {
    if (!ready || !active || authorId === undefined || authorId === self.id ||
      !participants.has(authorId) && !botCandidates.has(authorId)) return;
    const authorPersona = personaByName(authorName);
    if (authorPersona) {
      // A public author name can fill a missing participant name. Keep that bot out
      // of subsequent human activity and cooldown accounting, not just this reply.
      botMember(authorId, authorPersona); return;
    }
    if (botCandidates.has(authorId)) return;
    const addressed = addressedCommand(text);
    if (addressed.target && addressed.target !== persona.key) return;
    const command = parseCommand(addressed.text), language = command.language;
    lastActivity = scheduler.now();
    const value = visitor(authorId);
    if (!value) return;
    // A bare stop reaches every local sender-owned escort even when another guide
    // is elected or its last reply is throttled. Never clear a different owner's escort.
    if (command.kind === 'stop' && !addressed.target) {
      const otherOwner = escort && escort.owner !== authorId;
      if (escort?.owner === authorId) { escort = undefined; if (mode !== 'startup') mode = 'return'; }
      if (elected()) reply(value, otherOwner && botCandidates.size === 0 ? busy(language) : language === 'my'
        ? 'ဤအဖွဲ့တွင် သင့်ကို လမ်းပြနေသော လမ်းပြများ ရပ်ရန် တောင်းဆိုပြီးပါပြီ။'
        : 'Stop requested for guides escorting you in this bubble.');
      return;
    }
    if (!addressed.target && !elected()) return;
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
      const target = mode === 'escort' && escort ? escort.destination.tile : mode === 'return' ? persona.home : persona.patrol[corner];
      if (same(current, target)) {
        if (mode === 'escort' && escort) { reply(visitors.get(escort.owner), gateReply(escort.destination, escort.language, true)); mode = 'return'; continue; }
        if (mode === 'return') { escort = undefined; mode = 'patrol'; corner = 1; continue; }
        // The authored closing waypoint repeats home; count each cyclic corner only once.
        corner = (corner + 1) % (persona.patrol.length - 1);
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
      self = api.self?.() ?? self;
      if (!Number.isFinite(self.id) || personaByName(self.name)?.key !== persona.key) throw Error('Guide identity does not match fixed persona');
      // Native meetings.onJoin is non-replaying. Subscribe before the first asynchronous
      // map/position guard and cache live membership until validation completes.
      subscriptions.push(api.onBubble(onBubble));
      await guardMap(await api.map()); if (!active || !checkRoom()) { finish(); return; }
      current = tileOf(await api.position()); if (!active || !checkRoom()) { finish(); return; }
      startup = startupRoute(current, persona.home).slice(1); startupDeadline = scheduler.now() + 60000;
      ready = true;
      subscriptions.push(api.onChat(onChat));
      if (participants.size) lastActivity = scheduler.now();
      for (const id of participants) greet(id);
      monitor();
      void loop().catch(error => stop(error instanceof Error ? error.message : String(error))).finally(finish);
    } catch (error) { stop(error instanceof Error ? error.message : String(error)); finish(); }
  };
  return { done, start, stop };
}
