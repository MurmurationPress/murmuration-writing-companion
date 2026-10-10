import { equal, match, ok } from 'node:assert/strict';
import { test } from 'node:test';
import { numberingHarness } from './helpers/ManuscriptNumberingHarness';
import { Element } from './helpers/ManuscriptPreparationHarness';

function commandHarness() {
  const h = numberingHarness(); const status = new Element();
  let active: string | null = 'Alpha.md';
  const cleanups: Array<() => void> = [];
  const events = new Map<string, (event?: any) => unknown>();
  const workspaceEvents = new Map<string, () => void>();
  h.app.workspace.on = ((event: string, callback: () => void) => { workspaceEvents.set(event, callback); return null; }) as any;
  const host = { ...h.host, addStatusBarItem: () => status, register: (fn: () => void) => cleanups.push(fn),
    registerDomEvent: (_el: Element, event: string, callback: () => void) => events.set(event, callback) };
  (globalThis as any).document = { createDocumentFragment: () => new Element() };
  const controller = new h.api.ManuscriptNumberingCommands(host, h.library, async () => {}, () => active);
  return { ...h, controller, status, events, cleanups, context: (path: string | null) => { active = path; workspaceEvents.get('file-open')!(); } };
}

for (const path of ['Alpha.md', 'Part.md', 'First.md']) test(`registered command resolves active ${path} and status click uses same path`, async () => {
  const h = commandHarness(); h.context(path);
  equal(h.status.text, 'Scene numbers out of date'); equal(h.status.style.display, ''); match(h.status.attr['aria-label'], /Alpha/);
  await h.invoke('renumber-book-scenes'); equal(h.status.style.display, 'none'); match(h.notices.join('\n'), /verified current/);
  await h.edit('First.md', fm => { delete fm.manuscript_sequence; }); h.controller.refresh(); equal(h.status.style.display, '');
  h.events.get('click')!(); await h.tick(); equal(h.status.style.display, 'none');
  equal(h.cache.get('Other.md')!.frontmatter!.book_scene_number, undefined);
});

test('no context hides status and command offers explicit picker; cancellation writes nothing', async () => {
  const h = commandHarness(); h.context(null); equal(h.status.style.display, 'none');
  const pending = h.invoke('renumber-book-scenes'); await h.tick(); ok(h.latest());
  h.latest().close(); await pending; equal(h.writes(), 0);
  const chosen = h.invoke('renumber-book-scenes'); await h.tick();
  h.latest().selectSuggestion!(h.book('Beta.md'), {}); await chosen;
  equal(h.cache.get('Other.md')!.frontmatter!.book_scene_number, 1);
  equal(h.cache.get('First.md')!.frontmatter!.book_scene_number, undefined);
});

test('status is Book-specific; known orphaned structure blocks only its own snapshot', async () => {
  const h = commandHarness(); await h.invoke('renumber-book-scenes');
  h.context('Beta.md'); await h.invoke('renumber-book-scenes');
  await h.edit('First.md', fm => { fm.parent = '[[Missing Part]]'; });
  h.controller.refresh(); equal(h.status.style.display, 'none'); // Beta still verified
  h.context('Alpha.md'); equal(h.status.style.display, '');
  const before = h.writes(); await h.invoke('renumber-book-scenes'); equal(h.writes(), before);
  match(h.notices.join('\n'), /unassigned/); equal(h.status.style.display, '');
});

test('failure feedback leaves status stale and unloading rejects late command calls', async () => {
  const h = commandHarness(); h.context('Alpha.md'); h.failAt(2);
  await h.invoke('renumber-book-scenes'); match(h.notices.join('\n'), /Injected/); equal(h.status.style.display, '');
  h.cleanups.forEach(fn => fn()); const count = h.writes(); await h.invoke('renumber-book-scenes'); equal(h.writes(), count);
});

for (const token of ['externally replaced', 'scene', '']) test(`an orphan with replaced token ${JSON.stringify(token)} cannot be assumed to belong to another Book`, async () => {
  const h = commandHarness(); await h.invoke('renumber-book-scenes');
  h.context('Beta.md'); await h.invoke('renumber-book-scenes');
  await h.edit('First.md', fm => {
    fm.parent = '[[Missing Part]]'; fm.mwc_scene_numbering_token = token;
  });
  for (const path of ['Alpha.md', 'Beta.md']) {
    h.context(path); equal(h.status.style.display, '');
    const before = h.writes(); await h.invoke('renumber-book-scenes'); equal(h.writes(), before);
    match(h.notices.join('\n'), /unassigned/); equal(h.status.style.display, '');
  }
});

test('unload closes a pending Book picker without starting a reporting run', async () => {
  const h = commandHarness(); h.context(null);
  const pending = h.invoke('renumber-book-scenes'); await h.tick(); ok(h.latest());
  h.cleanups.forEach(fn => fn()); await pending;
  equal(h.modals.length, 0); equal(h.writes(), 0);
});
