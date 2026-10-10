import { deepEqual, equal, rejects } from 'node:assert/strict';
import { test } from 'node:test';
import { numberingHarness } from './helpers/ManuscriptNumberingHarness';
import { File } from './helpers/ManuscriptPreparationHarness';

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test('explicit mixed hierarchy refresh is Book-local, preserves prose/metadata and is idempotent even with stale cache', async () => {
  const h = numberingHarness();
  await h.edit('First.md', fm => { fm.series_scene_number = 82; });
  const unrelated = new Map(['Beta.md', 'Other.md', '.trash/Discard.md'].map(p => [p, h.contents.get(p)]));
  const originalScan = h.app.vault.getMarkdownFiles;
  h.app.vault.getMarkdownFiles = () => { throw new Error('No vault scans during numbering'); };
  const before = h.writes(); equal(await h.renumber(), 5); equal(h.writes() - before, 5);
  for (const [i, path] of ['Prologue.md', 'First.md', 'Last.md'].entries()) {
    const fm = h.cache.get(path)!.frontmatter!;
    equal(fm.book_scene_number, i + 1); equal(fm.series_scene_number, undefined);
    equal(fm.manuscript_series_number, 'authored alias'); deepEqual(fm.custom, { retained: true });
    equal(h.contents.get(path)!.split('---\n').pop(), '\nUnchanged synthetic prose.\n');
  }
  equal(h.service.isCurrent(h.book()), true);
  for (const [path, bytes] of unrelated) equal(h.contents.get(path), bytes);
  const count = h.writes(); equal(await h.renumber(), 0); equal(h.writes(), count);
  h.cache.get('First.md')!.frontmatter!.book_scene_number = 999; // lagging cache cannot cause a redundant write
  equal(await h.renumber(), 0); equal(h.writes(), count);
  h.app.vault.getMarkdownFiles = originalScan;
});

test('freshness survives restart, external reporting edits, tail deletion and restoration', async () => {
  const h = numberingHarness(); equal(h.service.isCurrent(h.book()), false); await h.renumber();
  const restarted = new h.api.ManuscriptSequencePropertyService(h.app);
  equal(restarted.isCurrent(h.book()), true);
  await h.edit('First.md', fm => { delete fm.book_scene_number; });
  equal(restarted.isCurrent(h.book()), false); await h.renumber();
  const tail = h.loaded.get('Last.md'); h.loaded.delete('Last.md'); h.settle();
  equal(new h.api.ManuscriptSequencePropertyService(h.app).isCurrent(h.book()), false);
  await h.renumber(); equal(h.service.isCurrent(h.book()), true);
  h.loaded.set('Last.md', tail!); h.settle(); equal(h.service.isCurrent(h.book()), false);
});

test('cross-Book moves stale both Books even when the moved scene keeps number 1', async () => {
  const h = numberingHarness(); await h.renumber(); await h.renumber('Beta.md');
  await h.edit('Prologue.md', fm => { fm.parent = '[[Beta]]'; fm.manuscript_order_key = '9000000000'; });
  equal(h.service.isCurrent(h.book()), false); equal(h.service.isCurrent(h.book('Beta.md')), false);
  const other = h.contents.get('Other.md'); await h.renumber(); equal(h.contents.get('Other.md'), other);
  equal(h.service.isCurrent(h.book('Beta.md')), false); await h.renumber('Beta.md');
  equal(h.cache.get('Prologue.md')!.frontmatter!.book_scene_number, 1);
  equal(h.service.isCurrent(h.book('Beta.md')), true);
});

test('prose, context and neutral renames do not stale a snapshot or write numbers', async () => {
  const h = numberingHarness(); await h.renumber();
  await h.edit('First.md', fm => { fm.pov = 'Someone'; fm.date = '2026-01-01'; });
  const file = h.loaded.get('First.md') as File;
  await h.app.vault.modify(file, h.contents.get(file.path)! + 'More prose.');
  await h.app.vault.rename(file, 'Renamed Scene.md'); h.settle();
  equal(h.service.isCurrent(h.book()), true);
  equal(new h.api.ManuscriptSequencePropertyService(h.app).isCurrent(h.book()), true);
  const before = h.writes(); equal(await h.renumber(), 0); equal(h.writes(), before);
});

test('reorders, insertion, changed parentage and corrupt tokens invalidate reporting', async () => {
  const h = numberingHarness(); await h.renumber();
  await h.edit('Part.md', fm => { fm.manuscript_order_key = 'D000000000'; }); equal(h.service.isCurrent(h.book()), false);
  await h.renumber();
  h.add('Inserted.md', { type: 'scene', parent: '[[Alpha]]', manuscript_order_key: 'E000000000' }); h.settle();
  equal(h.service.isCurrent(h.book()), false); await h.renumber();
  await h.edit('First.md', fm => { fm.mwc_scene_numbering_token = 'external replacement'; }); equal(h.service.isCurrent(h.book()), false);
});

test('partial failures remain stale; queued explicit requests are serialized and later repair succeeds', async () => {
  const h = numberingHarness(); h.failAt(2);
  const failed = h.renumber(); const repair = h.renumber();
  await rejects(failed, /Injected/); await repair;
  equal(h.service.isCurrent(h.book()), true);
});

test('cancellation after a committed write stops remaining files and leaves stale status', async () => {
  const h = numberingHarness(); const controller = new AbortController();
  await rejects(h.renumber('Alpha.md', { signal: controller.signal, progress: () => controller.abort() }), /cancelled/);
  equal(h.writes(), 1); equal(h.service.isCurrent(h.book()), false);
  await h.renumber(); equal(h.service.isCurrent(h.book()), true);
});

test('unload before queued work and inside host callback prevents mutation', async () => {
  const h = numberingHarness(); const pending = h.renumber(); h.service.dispose(); await rejects(pending, /cancelled/); equal(h.writes(), 0);
  const j = numberingHarness(); const entered = gate(), blocked = gate();
  const original = j.app.fileManager.processFrontMatter;
  j.app.fileManager.processFrontMatter = async (file, mutate) => { entered.release(); await blocked.promise; return original(file, mutate); };
  const active = j.renumber(); await entered.promise; const queued = j.renumber();
  j.service.dispose(); blocked.release(); await Promise.all([rejects(active, /cancelled/), rejects(queued, /cancelled/)]);
  equal(j.writes(), 0); equal(j.service.isCurrent(j.book()), false);
});

test('concurrent authority change at mutation boundary fails without overwriting it', async () => {
  const h = numberingHarness(); const original = h.app.fileManager.processFrontMatter;
  h.app.fileManager.processFrontMatter = async (file, mutate) => original(file, fm => { fm.parent = '[[Beta]]'; mutate(fm); });
  await rejects(h.renumber(), /properties changed/); equal(h.writes(), 0); equal(h.service.isCurrent(h.book()), false);
});

test('concurrent structural changes and changes during final verification never clear status', async () => {
  const h = numberingHarness();
  await rejects(h.renumber('Alpha.md', { progress: async () => { h.loaded.delete('Last.md'); h.settle(); } }), /changed/);
  equal(h.service.isCurrent(h.book()), false);
  const j = numberingHarness(); await j.renumber();
  const original = j.app.vault.read; let reads = 0;
  j.app.vault.read = async file => {
    const content = await original(file);
    if (++reads === 14) (j.loaded.get('Alpha.md') as File).stat.mtime++;
    return content;
  };
  await rejects(j.renumber(), /verification/); equal(j.service.isCurrent(j.book()), false);
});

test('protected, malformed and unresolved structure fail safely with zero writes', async () => {
  const h = numberingHarness();
  h.api.beginExactManuscriptContentRestoration(h.app, new Map([['First.md', h.contents.get('First.md')]]));
  await rejects(h.renumber(), /protected/); equal(h.writes(), 0);
  const j = numberingHarness(); await j.edit('First.md', fm => { delete fm.manuscript_order_key; });
  const before = j.writes(); await rejects(j.renumber(), /structure/); equal(j.writes(), before);
  const k = numberingHarness(); k.contents.set('First.md', 'No frontmatter'); await rejects(k.renumber(), /frontmatter/); equal(k.writes(), 0);
});

test('protection acquired while host I/O is pending prevents the mutation', async () => {
  const h = numberingHarness(); const original = h.app.fileManager.processFrontMatter;
  h.app.fileManager.processFrontMatter = async (file, mutate) => {
    h.api.beginExactManuscriptContentRestoration(h.app, new Map([[file.path, h.contents.get(file.path)]]));
    return original(file, mutate);
  };
  await rejects(h.renumber(), /protected/); equal(h.writes(), 0); equal(h.service.isCurrent(h.book()), false);
});

test('a host that skips a write cannot falsely report current', async () => {
  const h = numberingHarness(); h.app.fileManager.processFrontMatter = async () => {};
  await rejects(h.renumber(), /verified/); equal(h.service.isCurrent(h.book()), false);
});

test('deleting the only Scene leaves a stale empty Book that can be explicitly refreshed', async () => {
  const h = numberingHarness(); await h.renumber('Beta.md');
  h.loaded.delete('Other.md'); h.settle();
  equal(h.service.isCurrent(h.book('Beta.md')), false);
  const alpha = h.contents.get('Alpha.md');
  equal(await h.renumber('Beta.md'), 1);
  equal(h.service.isCurrent(h.book('Beta.md')), true);
  equal(await h.renumber('Beta.md'), 0); equal(h.contents.get('Alpha.md'), alpha);
});
