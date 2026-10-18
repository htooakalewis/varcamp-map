import { describe,it,expect } from 'vitest';
import {readFileSync} from 'node:fs';
describe('supported guide communication boundary',()=>{
 it('removes bot native chat/meeting dependency and disables proximity before tracking',()=>{
  const source=readFileSync('src/bots/lyra.ts','utf8');
  expect(source).not.toMatch(/WA\.chat\.|WA\.player\.meetings/);
  expect(source).toContain('createBotCommunication');
 });
 it('uses targeted replies in the controller rather than bubble broadcast',()=>{
  const source=readFileSync('src/bots/controller.ts','utf8');
  expect(source).not.toMatch(/api\.say\(/);
  expect(source).toContain('api.reply(id,');
 });
});
