import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PERSONAS } from '../../src/bots/personas';
import { selectProfile } from '../bots/config.mjs';
import { joinRoom } from '../bots/browser-session.mjs';
const roster = JSON.parse(readFileSync('src/bots/guide-roster.json', 'utf8'));
const keys = ['lyra', 'nova', 'orion'] as const;
function pageFixture(maximum: string | null, alter = false) {
  let value = ''; const clicks: string[] = [];
  const click = (name: string) => ({ async click() { clicks.push(name); } });
  return { clicks, page: { async goto() {}, getByTestId() { return {
    async getAttribute(name: string) { if (name !== 'maxlength') throw Error('Unexpected input attribute'); return maximum; },
    async fill(text: string) { value = alter ? text.slice(0, -1) : text.slice(0, Number(maximum)); }, async inputValue() { return value; },
  }; }, getByRole(_role: string, { name }: { name: string }) { return click(name); }, locator: click, getByText: click } };
}
it('one closed authoring roster matches actual controller and ops exports', () => {
  expect(Object.keys(roster)).toEqual(['version', 'profiles']); expect(roster.version).toBe(1);
  expect(roster.profiles.map((p: any) => p.key)).toEqual(keys);
  expect(roster.profiles.map((p: any) => p.name)).toEqual(['Lyra[BOT]', 'Nova[BOT]', 'Orion[BOT]']);
  for (const row of roster.profiles) {
    expect(Object.keys(row)).toEqual(['key', 'name', 'avatar']); expect(row.name.length).toBeLessThanOrEqual(10);
    expect(PERSONAS[row.key as typeof keys[number]].name).toBe(row.name);
    expect(selectProfile(row.key).botName).toBe(row.name); expect(selectProfile(row.key).avatar).toBe(row.avatar);
  }
});
it('all fixed names fit actual10-character input before Continue', async () => {
  for (const key of keys) { const fixture = pageFixture('10'); await joinRoom(fixture.page, selectProfile(key), { assertLive() {} }); expect(fixture.clicks.filter(n => n === 'Continue')).toHaveLength(2); }
});
it('refuses altered inputValue before first Continue', async () => {
  const fixture = pageFixture('10', true);
  await expect(joinRoom(fixture.page, selectProfile('lyra'), { assertLive() {} })).rejects.toThrow(/input|identity/i);
  expect(fixture.clicks).toEqual([]);
});
it('refuses insufficient or invalid observed maxlength before Continue', async () => {
  for (const maximum of [null, 'ten', '0', '-1', '1.5', '8']) { const fixture = pageFixture(maximum); await expect(joinRoom(fixture.page, selectProfile('lyra'), { assertLive() {} })).rejects.toThrow(/name|input|max/i); expect(fixture.clicks).toEqual([]); }
});
it('rejects a caller-supplied profile name before navigation', async () => {
  const fixture = pageFixture('10'); const profile = { ...selectProfile('lyra'), botName: 'Other[BOT]' };
  await expect(joinRoom(fixture.page, profile, { assertLive() {} })).rejects.toThrow(/fixed profile/i); expect(fixture.clicks).toEqual([]);
});
