import { deepEqual, equal } from 'node:assert/strict';
import { test } from 'node:test';
import { numberingHarness } from './helpers/ManuscriptNumberingHarness';

test('Companion chronology consumes settled hierarchy without enumerating and converges after external movement', async () => {
  const h = numberingHarness();
  const collect = () => h.api.buildObsidianManuscriptChronology(h.app, h.loaded.get('First.md'), h.library());
  const expected = h.api.buildObsidianManuscriptChronology(h.app, h.loaded.get('First.md'));
  const enumerate = h.app.vault.getMarkdownFiles;
  h.app.vault.getMarkdownFiles = () => { throw new Error('Chronology must reuse the settled projection'); };
  deepEqual(collect(), expected);
  h.app.vault.getMarkdownFiles = enumerate;
  await h.edit('First.md', fm => { fm.parent = '[[Beta]]'; fm.manuscript_order_key = 'B000000000'; });
  h.app.vault.getMarkdownFiles = () => { throw new Error('No rendering scans'); };
  const moved = collect(); equal(moved.book.path, 'Beta.md'); equal(moved.dependencies.has('Other.md'),true);
  equal(moved.dependencies.has('Prologue.md'),false);
  equal(h.cache.get('First.md')!.frontmatter!.book_scene_number,undefined);
});
