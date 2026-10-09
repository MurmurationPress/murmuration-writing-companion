import { equal } from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

test('display snapshots avoid library enumeration, read fresh title aliases, and mutation snapshots revalidate membership', async () => {
  const { build } = createRequire(import.meta.url)('esbuild') as typeof import('esbuild');
  const result = await build({ entryPoints: [resolve('src/manuscript/ObsidianManuscriptNameAlignment.ts')],
    bundle: true, platform: 'node', format: 'cjs', write: false,
    plugins: [{ name: 'host-types', setup(b) {
      b.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'host' }));
      b.onLoad({ filter: /.*/, namespace: 'host' }, () => ({ contents: 'export class TFile { static [Symbol.hasInstance](f) { return f?.syntheticFile === true; } } export class TFolder {}' }));
    } }] });
  const module = { exports: {} as any };
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports });
  const files = ['Book','Scene'].map(basename => ({ basename, path: `${basename}.md`, extension: 'md', parent: null, syntheticFile: true }));
  const book = { type: 'book' };
  const scene: Record<string, unknown> = { type: 'scene', parent: '[[Book]]', manuscript_order_key: '0000000001', 'Title': 'Authored title' };
  let enumerations = 0; let missing = false;
  const app = { vault: {
    getAbstractFileByPath: (path: string) => missing ? null : files.find(f => f.path === path) ?? null,
    getMarkdownFiles: () => { enumerations++; return files; }
  }, metadataCache: {
    getFileCache: (file: { path: string }) => ({ frontmatter: file.path === 'Book.md' ? book : scene }),
    getFirstLinkpathDest: (reference: string) => files.find(f => f.basename === reference) ?? null
  } };
  const entry = { path: 'Scene.md', kind: 'scene' };
  const display = () => module.exports.snapshotManuscriptNameForDisplay(app, entry);
  equal(display().title, 'Authored title');
  scene.Title = 'Changed title'; equal(display().title, 'Changed title');
  delete scene.Title; equal(display().title, undefined);
  scene.title = 42; equal(display().title, 42); // Preserve type; mismatch policy decides validity.
  equal(module.exports.snapshotManuscriptNameForDisplay(app, { ...entry, kind: "other" }), null);
  equal(module.exports.snapshotManuscriptNameForDisplay(app, { ...entry, path: ".trash/Scene.md" }), null);
  equal(enumerations, 0);
  missing = true; equal(display(), null); missing = false;
  const adapter = new module.exports.ObsidianManuscriptNameAlignmentAdapter({ app, refreshManuscriptNavigator() {} });
  equal(adapter.snapshot('Scene.md').kind, 'scene'); equal(enumerations, 1);
  scene.type = 'scene-draft'; delete scene.parent; delete scene.manuscript_order_key;
  equal(adapter.snapshot('Scene.md'), null); equal(enumerations, 2);
});
