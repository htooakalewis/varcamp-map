import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLyraController, type Audience, type GuideRequest, type LyraAdapter, type Point } from '../src/bots/controller';
import { center, help, parseCommand, rooms, ROUTES, startupRoute } from '../src/bots/venue';
import * as profiles from '../src/bots/personas';

const native = () => JSON.parse(readFileSync('maps/overworld.tmj', 'utf8'));
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
type Member = { id: number; name?: string };
function fixture(key: 'lyra' | 'nova' | 'orion', id: number) {
  const persona = profiles.PERSONAS[key];
  let position = center(persona.home), chat = (_: GuideRequest) => {}, bubble = (_: Audience) => {};
  let pending: ((value: Point & { cancelled: boolean }) => void) | undefined;
  const replies: string[] = [], moves: Point[] = [], disposed: string[] = [], diagnostics: string[] = [];
  const api: LyraAdapter = {
    self: () => ({ id, name: persona.name }), map: async () => native(), roomId: () => 'test', position: async () => position,
    move: p => { expect(pending, 'one awaited native move per controller').toBeUndefined(); moves.push(p); return new Promise(resolve => { pending = resolve; }); },
    reply: (_recipient, text) => { replies.push(text); }, diagnostic: text => { diagnostics.push(text); },
    onRequest: cb => { chat = cb; return () => { disposed.push('chat'); }; },
    onAudience: cb => { bubble = cb; return () => { disposed.push('bubble'); }; },
  };
  const c = createLyraController(api, undefined, persona);
  const meeting = (members: Member[]) => {
    let join = (_: Member) => {}, leave = (_: number) => {}, end = () => {};
    bubble({ participants: members, onJoin: cb => { join = cb; return () => { disposed.push('join'); }; }, onLeave: cb => { leave = cb; return () => { disposed.push('leave'); }; }, onEnd: cb => { end = cb; return () => { disposed.push('end'); }; } });
    return { join: (p: Member) => join(p), leave: (id: number) => leave(id), end: () => end() };
  };
  return { c, api, replies, moves, disposed, diagnostics, meeting,
    chat: (text: string, authorId: number | undefined = 1, authorName?: string) => chat({ text, authorId, authorName }),
    step: async () => { if (pending) { position = moves.at(-1)!; const resolve = pending; pending = undefined; resolve({ ...position, cancelled: false }); await flush(); await vi.advanceTimersByTimeAsync(100); } },
    stop: async () => { c.stop(); if (pending) { const resolve = pending; pending = undefined; resolve({ ...moves.at(-1)!, cancelled: true }); } await c.done; },
  };
}
const human = { id: 1, name: 'Visitor' }, other = { id: 2, name: 'Other visitor' };
const bots = [{ id: 10, name: 'Lyra[BOT]' }, { id: 20, name: 'Nova[BOT]' }, { id: 30, name: 'Orion[BOT]' }];
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('fixed persona and name-first contract', () => {
  it('defaults absent persona but rejects explicitly invalid keys and never accepts arbitrary configuration', () => {
    for (const metadata of [undefined, null, {}, { official: 'metadata' }]) expect(profiles.personaFromMetadata(metadata)).toBe(profiles.PERSONAS.lyra);
    for (const key of ['lyra', 'nova', 'orion'] as const) expect(profiles.personaFromMetadata({ persona: key, home: [0, 0], name: 'Injected' })).toBe(profiles.PERSONAS[key]);
    for (const persona of ['aster', '', null, undefined, 7, {}, ['nova']]) expect(() => profiles.personaFromMetadata({ persona })).toThrow(/persona/i);
  });
  it('independently confines distinct homes and cyclic patrols to every existing audited cell and unchanged startup escape', () => {
    expect(ROUTES.allowedCells).toHaveLength(743); expect(ROUTES.startupReservedCells).toHaveLength(4);
    const allowed = new Set(ROUTES.allowedCells.map(p => p.join(',')));
    expect(new Set(Object.values(profiles.PERSONAS).map(p => p.home.join(','))).size).toBe(3);
    for (const p of Object.values(profiles.PERSONAS)) {
      expect(p.patrol[0]).toEqual(p.home); expect(p.patrol.at(-1)).toEqual(p.home);
      for (const cell of [p.home, ...p.patrol]) expect(allowed.has(cell.join(','))).toBe(true);
      for (const spawn of ROUTES.startupReservedCells) {
        const route = startupRoute(spawn, p.home);
        expect(route.slice(0, spawn[1] - 64 + 1)).toEqual(Array.from({ length: spawn[1] - 63 }, (_, i) => [spawn[0], spawn[1] - i]));
        expect(route.at(-1)).toEqual(p.home);
      }
    }
  });
  it('keeps all twelve bare mixed-case/whitespace/Burmese names and numeric aliases; prompts advertise names and targeting', () => {
    const english = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    const burmese = ['မိဿ', 'ပြိဿ', 'မေထုန်', 'ကရကဋ်', 'သိဟ်', 'ကန်', 'တူ', 'ဗြိစ္ဆာ', 'ဓနု', 'မကရ', 'ကုမ်', 'မိန်'];
    for (let i = 0; i < 12; i++) for (const alias of [`  ${english[i].toUpperCase()}  `, burmese[i], String(i + 1), String(i + 1).replace(/\d/g, d => '၀၁၂၃၄၅၆၇၈၉'[Number(d)])]) expect(parseCommand(alias)).toMatchObject({ kind: 'go', destination: { id: `speaker-${english[i].toLowerCase()}` } });
    for (const lang of ['en', 'my'] as const) {
      expect(help(lang)).not.toMatch(/1–12|၁–၁၂/); expect(rooms(lang)).not.toMatch(/\d/);
      expect(help(lang)).toContain('Talk to Nearby Guides');
    }
    expect(help('en')).toMatch(/Gemini.*Cancer.*Libra/);
  });
});

describe('three-guide public bubble simulations', () => {
  it('elects before any greeting from complete differently ordered snapshots with self omitted; bare and explicit escorts have correct goals', async () => {
    const hs = [fixture('lyra', 10), fixture('nova', 20), fixture('orion', 30)];
    await Promise.all(hs.map(h => h.c.start()));
    hs.forEach((h, i) => h.meeting([human, ...bots.filter((_, j) => j !== i).reverse()]));
    expect(hs.map(h => h.replies.length)).toEqual([1, 0, 0]); expect(hs[0].replies[0]).toContain('Lyra[BOT]');
    hs.forEach(h => h.chat('  gEmInI  ')); expect(hs.map(h => h.replies.length)).toEqual([2, 0, 0]);
    hs.forEach(h => h.chat('nOvA [bot]: Cancer')); hs.forEach(h => h.chat('Orion, Libra'));
    expect(hs[1].replies.at(-1)).toContain('Cancer'); expect(hs[2].replies.at(-1)).toContain('Libra');
    const targets = [[82, 104], [63, 109], [25, 71]];
    for (let i = 0; i < hs.length; i++) {
      for (let n = 0; n < 250 && !hs[i].moves.some(p => p.x === center(targets[i]).x && p.y === center(targets[i]).y); n++) await hs[i].step();
      expect(hs[i].moves).toContainEqual(center(targets[i]));
    }
    await Promise.all(hs.map(h => h.stop()));
  });
  it('uses truthful per-persona greetings, ignores bot chat via member name and event fallback, and keeps bot-only patrol moving', async () => {
    for (const [i, key] of (['lyra', 'nova', 'orion'] as const).entries()) {
      const h = fixture(key, bots[i].id); await h.c.start();await flush();
      h.meeting([...bots.filter((_, j) => i !== j), { id: 99 }]); // fallback catches a bot whose participant name was unavailable
      h.chat('help', bots[(i + 1) % 3].id); h.chat('Gemini', 99, '  NOVA[BOT]  '); h.chat('help', bots[i].id); h.chat('help', 700); h.chat('help', undefined);
      // Unknown 99 is a human until its public author name identifies it; known bots never greet.
      expect(h.replies.every(r => r.includes(bots[i].name))).toBe(true);
      const b = h.meeting(bots.filter((_, j) => i !== j)); const count = h.replies.length;
      await h.step(); expect(h.moves.length).toBeGreaterThan(1); expect(h.replies).toHaveLength(count); b.end();
      h.meeting([human]); expect(h.replies.at(-1)).toContain(bots[i].name); await h.stop();
    }
  });
  it('removes a nameless participant from human activity when public chat author identity reveals a reserved bot', async () => {
    const h = fixture('lyra', 10); await h.c.start();await flush(); h.meeting([{ id: 99 }]);
    const count = h.replies.length; h.chat('Gemini', 99, 'Nova[BOT]');
    expect(h.replies).toHaveLength(count); await h.step();
    expect(h.moves.length, 'a known bot must not retain a human patrol pause').toBeGreaterThan(1);
    await h.stop();
  });
  it('stops every sender-owned escort before election/cooldown while retaining another owner and serialized moves', async () => {
    const hs = [fixture('lyra', 10), fixture('nova', 20), fixture('orion', 30)]; await Promise.all(hs.map(h => h.c.start()));
    hs.forEach(h => h.meeting([...bots, human, other]));
    for (const text of ['Lyra, Gemini', 'Nova, Cancer']) hs.forEach(h => h.chat(text)); hs.forEach(h => h.chat('Orion, Libra', 2));
    const before = hs.map(h => h.replies.length); hs.forEach(h => h.chat('stop')); expect(hs.map(h => h.replies.length)).toEqual(before);
    await vi.advanceTimersByTimeAsync(2000); hs.forEach(h => h.chat('stop'));
    expect(hs[0].replies.at(-1)).toMatch(/guides escorting you in this nearby group/); expect(hs[1].replies.length).toBe(before[1]); expect(hs[2].replies.length).toBe(before[2]);
    // A different owner cannot cancel Orion, even with explicit targeting.
    hs.forEach(h => h.chat('Orion, stop')); expect(hs[2].replies.at(-1)).toMatch(/busy/i);
    for (let n = 0; n < 160; n++) for (const h of hs) await h.step();
    expect(hs[0].moves).not.toContainEqual(center([82, 104])); expect(hs[1].moves).not.toContainEqual(center([63, 109])); expect(hs[2].moves).toContainEqual(center([25, 71]));
    await Promise.all(hs.map(h => h.stop()));
  });
  it('reelects on joins/leaves, tie-breaks duplicate personas numerically, and only recognizes anchored prefixes', async () => {
    const h = fixture('nova', 20); await h.c.start();await flush(); const b = h.meeting([human, bots[2]]);
    expect(h.replies).toHaveLength(1); b.join(bots[0]); h.chat('help'); expect(h.replies).toHaveLength(1);
    b.leave(10); h.chat('help'); expect(h.replies).toHaveLength(2); await vi.advanceTimersByTimeAsync(2000);
    b.join({ id: 19, name: 'nova[bot]' }); h.chat('Cancer'); expect(h.replies).toHaveLength(2);
    b.leave(19); b.join({ id: 21, name: 'Nova[BOT]' }); h.chat('Cancer'); expect(h.replies.at(-1)).toContain('Cancer');
    await vi.advanceTimersByTimeAsync(2000); h.chat('please ask Orion, Libra'); expect(h.replies.at(-1)).toContain('Talk to Nearby Guides');
    h.chat('Lyra, stop'); const count = h.replies.length; await vi.advanceTimersByTimeAsync(2000); h.chat('Nova: stop'); expect(h.replies.length).toBe(count + 1); expect(h.replies.at(-1)).toMatch(/stopped|home/i); await h.stop();
  });
  it('documents divergent snapshots as locally deterministic without pretending global exactly-once', async () => {
    const a = fixture('lyra', 10), b = fixture('nova', 20); await a.c.start(); await b.c.start();
    a.meeting([human]); b.meeting([human]); // supported API has not exposed the peer to either guide
    a.chat('Gemini'); b.chat('Gemini'); expect(a.replies.at(-1)).toContain('Gemini'); expect(b.replies.at(-1)).toContain('Gemini');
    await a.stop(); await b.stop();
  });
  it('caches only current membership through deferred map validation, and disposes early subscriptions on invalid map/stop', async () => {
    const h = fixture('lyra', 10); let resolveMap!: (map: unknown) => void; h.api.map = () => new Promise(resolve => { resolveMap = resolve; });
    const start = h.c.start(); const b = h.meeting([human, bots[1]]); b.leave(1); b.join(other); expect(h.replies).toEqual([]);
    resolveMap(native()); await start; expect(h.replies).toHaveLength(1); h.chat('Gemini', 1); expect(h.replies).toHaveLength(1); h.chat('Cancer', 2); expect(h.replies.at(-1)).toContain('Cancer'); await h.stop(); expect(h.disposed.sort()).toEqual(['bubble', 'chat', 'end', 'join', 'leave']);
    const bad = fixture('nova', 20); bad.api.map = async () => ({ ...native(), width: 64 }); await bad.c.start(); expect(bad.disposed).toContain('bubble'); expect(bad.moves).toEqual([]); await bad.stop();
    const stopped = fixture('orion', 30); let resolve!: (map: unknown) => void; stopped.api.map = () => new Promise(r => { resolve = r; }); const starting = stopped.c.start(); stopped.meeting([human]); stopped.c.stop(); resolve(native()); await starting; await stopped.c.done; expect(stopped.replies).toEqual([]); expect(stopped.disposed.sort()).toEqual(['bubble', 'end', 'join', 'leave']);
  });
});

