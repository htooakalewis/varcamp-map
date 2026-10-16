import { afterEach, expect, it, vi } from 'vitest';
import { verifyRoomUI } from '../bots/browser-session.mjs';
import { createRunnerLifecycle, heartbeatOnce, probeHeartbeat } from '../bots/runner.mjs';
import { config } from '../bots/config.mjs';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const message = 'Open the welcome directory';
// Minimal native DOM boundary: production Locator.evaluate runs its actual inspection
// against these scoped nodes, rather than receiving a preclassified fixture result.
function node(tag = 'DIV', classes = '', children: any[] = [], attributes = {}) {
  return { tagName: tag, attributes: { class: classes, ...attributes }, content: children,
    get children() { return this.content.filter(child => typeof child !== 'string'); },
    get textContent() { return this.content.map(child => typeof child === 'string' ? child : child.textContent).join(''); },
    getAttribute(name) { return this.attributes[name] ?? null; },
  };
}
function panel() {
  const trigger = node('DIV', 'text-center leading-6 responsive-message ', [message]);
  const inner = node('DIV', 'flex items-center p-4 px-10 pointer-events-auto justify-center grow', [trigger]);
  const container = node('DIV', 'popup-container bg-contrast/80 flex flex-col backdrop-blur-md text-white min-w-60 min-h-20 rounded-lg overflow-hidden transition-all animation responsive z-20 svelte-812y8q responsive', [inner]);
  return { wrapper: node('DIV', 'popupwrapper popupwrapper-0 w-full flex-1 svelte-x7qetx', [container]), container, inner, trigger };
}
function nativeFixture(variant = 'known') {
  const tree = panel(), events: string[] = []; let modal = ['open-modal', 'stuck-modal'].includes(variant), prompt = true;
  const wrappers: any[] = variant === 'absent' ? [] : [tree.wrapper];
  const dialogs: any[] = [];
  if (variant === 'extra-text') tree.inner.content.push('Unexpected text');
  if (variant === 'whitespace') tree.trigger.content = ['  Open \n the welcome\t directory  '];
  if (variant === 'iframe-message') tree.trigger.tagName = 'IFRAME';
  if (variant === 'changed-text') tree.trigger.content = ['Open another directory'];
  if (variant === 'unknown-sibling') wrappers.push(node('DIV', 'popupwrapper popupwrapper-1', ['Unknown popup']));
  if (variant === 'duplicate') wrappers.push(panel().wrapper);
  if (variant === 'ambiguous') tree.container.content.push(node('DIV'));
  if (variant === 'wrong-wrapper') tree.wrapper.attributes.class = 'popupwrapper popupwrapper-1';
  if (variant === 'wrong-container') tree.container.attributes.class = 'other-container';
  if (variant === 'wrong-message-shape') tree.trigger.tagName = 'SPAN';
  if (variant.startsWith('extra-')) {
    const tag = variant.slice(6).toUpperCase();
    if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'IFRAME', 'DIV'].includes(tag)) tree.inner.content.push(node(tag, '', [], tag === 'A' ? { href: '/other' } : tag === 'DIV' ? { contenteditable: 'true' } : {}));
  }
  if (variant === 'editable-trigger') tree.trigger.attributes.contenteditable = 'true';
  if (variant === 'tab-control') tree.trigger.attributes.tabindex = '0';
  if (variant === 'role-control') tree.trigger.attributes.role = 'button';
  if (variant === 'panel-dialog') { tree.container.attributes.role = 'dialog'; dialogs.push(tree.container); }
  if (variant === 'external-dialog') dialogs.push(node('DIV', '', [], { role: 'dialog' }));
  if (variant === 'alertdialog') dialogs.push(node('DIV', '', [], { role: 'alertdialog' }));
  if (variant === 'aria-modal') dialogs.push(node('DIV', '', [], { 'aria-modal': 'true' }));
  const wrappersHandles = wrappers.map(element => ({ async isVisible() { return true; }, async evaluate(fn) { if (variant === 'unreadable') throw Error('unreadable wrapper'); return fn(element); } }));
  const welcome = { async isVisible() { if (wrappers.length > 1 && variant === 'duplicate') throw Error('ambiguous welcome action'); return variant !== 'hidden-action' && wrappers.length > 0 && tree.trigger.textContent.replace(/\s+/gu, ' ').trim() === message; }, async click() { events.push('welcome-click'); modal = true; } };
  const close = { async isVisible() { return modal; }, async click() { events.push('modal-close'); if (variant !== 'stuck-modal') modal = false; }, async waitFor({ state }) { if ((state === 'visible') !== modal) throw Error('directory modal did not reach required state'); } };
  const media = { async isVisible() { return prompt; }, async click({ timeout }) { events.push(`media-click:${timeout}`); if (variant !== 'unresolved-media') prompt = false; }, async waitFor() { if (prompt) throw Error('media popup remains visible'); } };
  const page = { getByText: () => welcome, getByTestId: id => id === 'close-modal-button' ? close : { async waitFor() { if (variant === 'missing-control') throw Error('missing device control'); }, async getAttribute() { return variant === 'media-on' ? 'bg-success' : 'bg-danger'; } }, getByRole: () => media,
    locator: selector => ({ async all() {
      const parts = selector.split(',').map(value => value.trim());
      for (const part of parts) if (!['.popupwrapper', '[role="dialog"]', '[role="alertdialog"]', '[aria-modal]'].includes(part)) throw Error(`Unsupported fixture selector: ${part}`);
      const matched = dialogs.filter(element => parts.some(part => part === '[aria-modal]' ? element.getAttribute('aria-modal') !== null : part === `[role="${element.getAttribute('role')}"]`));
      return [...(parts.includes('.popupwrapper') ? wrappersHandles : []), ...matched.map(() => ({ async isVisible() { return true; } }))];
    } }),
    async evaluate() { events.push('permissions'); return variant === 'permissions-prompt' ? ['prompt', 'denied'] : ['denied', 'denied']; },
  };
  const identity = { playerId: 4, name: config.botName, roomId: config.roomUrl };
  vi.stubGlobal('WA', { player: { playerId: 4, name: config.botName }, room: { id: config.roomUrl } });
  vi.stubGlobal('__lyraDevelopmentHealth', { started: true, stopped: null, playerId: 4 });
  const evidenceAt=Date.now(); vi.stubGlobal('__varcampGuideEvidence', { state: 'progress', steps: 1,at:evidenceAt,leaseDeadline:evidenceAt+10000,operationBudgetMs:10000,persona:'lyra',controllerGeneration:7,playerId:4,name:config.botName,roomId:config.roomUrl });
  const frame = { async waitForFunction(fn) { expect(fn()).toBe(true); events.push('step-progress'); }, async evaluate(fn, value) { events.push('identity'); return fn(value); } };
  return { page, frame, events, identity, wrappersHandles, get modal() { return modal; }, get welcomeVisible() { return wrappers.length > 0; } };
}
it.each(['known', 'absent', 'whitespace'])('post-start room observation accepts %s native panel state without replaying fresh onboarding', async variant => {
  const f = nativeFixture(variant); let scheduled = 0; const state = createRunnerLifecycle();
  await heartbeatOnce({ state, expected: f.identity, probe: () => probeHeartbeat({ state, page: f.page, frame: f.frame }), schedule: () => { scheduled++; } });
  expect(state.snapshot().healthy).toBe(true); expect(scheduled).toBe(1); expect(f.modal).toBe(false);
  expect(f.events).not.toContain('welcome-click'); expect(f.events).not.toContain('modal-close');
  expect(f.events).toContain('identity'); expect(f.events).toContain('media-click:5000');
  expect(f.welcomeVisible).toBe(variant !== 'absent');
});
const rejected = ['unknown-sibling', 'extra-text', 'changed-text', 'extra-button', 'extra-input', 'extra-select', 'extra-textarea', 'extra-a', 'extra-iframe', 'extra-div', 'role-control', 'editable-trigger', 'tab-control', 'panel-dialog', 'alertdialog', 'aria-modal', 'duplicate', 'ambiguous', 'wrong-wrapper', 'wrong-container', 'wrong-message-shape', 'iframe-message', 'external-dialog', 'hidden-action', 'unreadable', 'open-modal', 'stuck-modal', 'unresolved-media', 'media-on', 'missing-control', 'permissions-prompt'];
it.each(rejected)('post-start strict room observation rejects %s without treating it as a known panel', async variant => {
  const f = nativeFixture(variant);
  await expect(verifyRoomUI(f.page, { assertLive() {} })).rejects.toThrow();
  expect(f.events).not.toContain('welcome-click'); expect(f.events).not.toContain('modal-close');
});
it('the production heartbeat accepts only the same known panel without reopening its directory', async () => {
  const f = nativeFixture(); const state = createRunnerLifecycle(); let scheduled = 0;
  await heartbeatOnce({ state, expected: f.identity, probe: () => probeHeartbeat({ state, page: f.page, frame: f.frame }), schedule: () => { scheduled++; } });
  expect(state.snapshot().healthy).toBe(true); expect(scheduled).toBe(1); expect(f.events).not.toContain('welcome-click'); expect(f.events).not.toContain('modal-close');
});
it.each(['unknown-sibling', 'panel-dialog', 'alertdialog', 'aria-modal', 'extra-button', 'duplicate', 'unresolved-media', 'media-on', 'missing-control', 'permissions-prompt'])('the production heartbeat fails %s without ready or scheduling', async variant => {
  const f = nativeFixture(variant); const logs: string[] = []; const state = createRunnerLifecycle({ log: event => logs.push(event.event) });
  await state.ready(f.identity); logs.length = 0;
  await heartbeatOnce({ state, expected: f.identity, probe: () => probeHeartbeat({ state, page: f.page, frame: f.frame }), schedule: () => logs.push('scheduled') });
  expect(state.snapshot().healthy).toBe(false); expect(logs).not.toContain('ready'); expect(logs).not.toContain('scheduled'); expect(f.events).not.toContain('welcome-click');
});
it.each(['deadline', 'fatal'])('the production panel classifier retains the five-second/fatal boundary on %s with no late resurrection', async reason => {
  vi.useFakeTimers(); const f = nativeFixture(); const logs: string[] = []; const state = createRunnerLifecycle({ log: event => logs.push(event.event) });
  await state.ready(f.identity); logs.length = 0;
  let release, reached = false, settled = false;
  f.wrappersHandles[0].evaluate = async fn => { reached = true; return new Promise(resolve => { release = () => resolve(fn(panel().wrapper)); }); };
  const tick = heartbeatOnce({ state, expected: f.identity, probe: () => probeHeartbeat({ state, page: f.page, frame: f.frame }), schedule: () => logs.push('scheduled') }).then(() => { settled = true; });
  try {
    await vi.advanceTimersByTimeAsync(0); expect(reached).toBe(true);
    if (reason === 'deadline') await vi.advanceTimersByTimeAsync(5000); else { state.fail(Error('native fatal during panel inspection')); await vi.advanceTimersByTimeAsync(0); }
    expect(settled).toBe(true); expect(state.snapshot().healthy).toBe(false);
    release(); await tick; await vi.advanceTimersByTimeAsync(10000);
    expect(state.snapshot().healthy).toBe(false); expect(logs).not.toContain('ready'); expect(logs).not.toContain('scheduled'); expect(f.events).not.toContain('identity');
  } finally { release?.(); await tick; }
});
