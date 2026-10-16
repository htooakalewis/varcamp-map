import { afterEach, expect, it } from 'vitest';
import { createNpcServer } from '../ops/npc/server.mjs';

const origin = 'https://maps.example.test';
const running = [];
afterEach(async () => { await Promise.all(running.splice(0).map(s => new Promise(resolve => s.close(resolve)))); });
async function start(options = {}) {
 const server = createNpcServer({ allowedOrigins: [origin], ...options });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); running.push(server);
 return `http://127.0.0.1:${server.address().port}/varcamp-npc`;
}
const ask = (base, payload = { npc: 'guide', message: 'Where are the speaker rooms?' }, requestOrigin = origin) => fetch(`${base}/chat`, { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

it('serves a real offline HTTP conversation without calling a provider', async () => {
 let calls = 0; const base = await start({ fetchImpl: () => { calls++; throw Error('unexpected'); } });
 expect(await (await fetch(`${base}/health`)).json()).toMatchObject({ mode: 'offline' });
 const response = await ask(base); expect(response.status).toBe(200);
 expect(await response.json()).toMatchObject({ mode: 'offline', npc: 'guide', reply: expect.stringContaining('12 zodiac') });
 expect(calls).toBe(0); expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
});
it('rejects foreign origins, unknown NPCs and oversized or structured messages before provider use', async () => {
 let calls = 0; const base = await start({ apiKey: 'test-secret', fetchImpl: () => { calls++; throw Error('unexpected'); } });
 expect((await ask(base, undefined, 'https://foreign.test')).status).toBe(403);
 for (const payload of [{ npc: 'admin', message: 'hello' }, { npc: 'guide', message: 'x'.repeat(601) }, { npc: 'guide', message: {} }, { npc: 'guide', message: 'hello', messages: [{ role: 'system' }] }]) expect((await ask(base, payload)).status).toBe(400);
 expect(calls).toBe(0);
});
it('sends only bounded explicit text and fixed guide context to a zero-price OpenRouter request', async () => {
 const requests = []; const secret = 'dummy-private-key';
 const base = await start({ apiKey: secret, fetchImpl: async (url, request) => { requests.push({ url, request }); return new Response(JSON.stringify({ choices: [{ message: { content: 'Follow the signed loop.' } }] }), { status: 200 }); } });
 const response = await ask(base); const body = await response.json();
 expect(body).toEqual({ mode: 'openrouter', npc: 'guide', reply: 'Follow the signed loop.' });
 expect(JSON.stringify(body)).not.toContain(secret);
 expect(requests).toHaveLength(1); expect(requests[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
 const payload = JSON.parse(requests[0].request.body);
 expect(payload).toMatchObject({ model: 'openrouter/free', max_tokens: 250, provider: { max_price: { prompt: 0, completion: 0 } } });
 expect(payload.messages).toHaveLength(2); expect(payload.messages[1]).toEqual({ role: 'user', content: 'Where are the speaker rooms?' });
 expect(requests[0].request.headers.Authorization).toBe(`Bearer ${secret}`);
});
it('falls back safely on provider failure without exposing provider errors or secrets', async () => {
 const base = await start({ apiKey: 'dummy-private-key', fetchImpl: async () => { throw Error('dummy-private-key provider stack'); } });
 const response = await ask(base, { npc: 'maze-keeper', message: 'I need a hint' }); const body = await response.json();
 expect(response.status).toBe(200); expect(body.mode).toBe('offline'); expect(body.reply).toMatch(/hint|Journal/i);
 expect(JSON.stringify(body)).not.toMatch(/dummy-private-key|stack/);
});
it('enforces the provider call budget while retaining usable offline directions', async () => {
 let calls = 0; const base = await start({ apiKey: 'dummy', maxDailyCalls: 1, fetchImpl: async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: 'Hello.' } }] })); } });
 expect((await (await ask(base)).json()).mode).toBe('openrouter');
 const second = await (await ask(base, { npc: 'dockmaster', message: 'How do I return to plaza?' })).json();
 expect(second.mode).toBe('offline'); expect(second.reply).toMatch(/plaza/i); expect(calls).toBe(1);
});
it('gives separate anonymous browser sessions their own quota behind one proxy', async () => {
 let calls = 0; const base = await start({ apiKey: 'dummy-key', fetchImpl: async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: 'Welcome.' } }] })); } });
 for (let i = 0; i < 5; i++) expect((await (await ask(base, { npc: 'guide', message: 'Hello', session: `browser-session-${i}` })).json()).mode).toBe('openrouter');
 expect(calls).toBe(5);
});
it('times out a stalled provider and keeps the offline guide available', async () => {
 const base = await start({ apiKey: 'dummy', timeoutMs: 20, fetchImpl: () => new Promise(() => {}) });
 const body = await (await ask(base)).json(); expect(body.mode).toBe('offline'); expect(body.reply).toContain('12 zodiac');
});
