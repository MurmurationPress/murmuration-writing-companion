import { equal, rejects } from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

test('coordinator performs no automatic reporting writes and ignores late callbacks after unload', async () => {
  // Bundle the real coordinator with host classes only; no Obsidian filesystem or UI.
  const { build } = createRequire(import.meta.url)('esbuild') as typeof import('esbuild');
  const result = await build({ entryPoints: [resolve('src/manuscript/ManuscriptIntegrityCoordinator.ts')],
    bundle: true, platform: 'node', format: 'cjs', write: false,
    plugins: [{ name: 'host-types', setup(builder) {
      builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'host' }));
      builder.onLoad({ filter: /.*/, namespace: 'host' }, () => ({ contents: 'export class TFile {} export class TFolder {}' }));
    } }] });
  const timers = new Map<number, () => void>(); let timerId = 0;
  const module = { exports: {} as any }; const errors: unknown[] = [];
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports,
    console: { error: (...args: unknown[]) => errors.push(args) },
    window: { setTimeout: (callback: () => void) => { timers.set(++timerId, callback); return timerId; },
      clearTimeout: (id: number) => timers.delete(id) } });
  let builds = 0, scans = 0, settled = 0;
  const library = { books: [], owningBookPathByFile: new Map(), unresolved: [] };
  const selection = { get: () => ({ bookPath: null, contextPath: null, revision: 0 }) };
  const coordinator = new module.exports.ManuscriptIntegrityCoordinator(
    { vault: { getMarkdownFiles: () => { scans++; return []; } } }, selection,
    { activePath: () => null, onSettled: () => { settled++; } },
    { rebuild: () => { builds++; return library; }, publish: () => {} });
  coordinator.initialise(); coordinator.queue('Scene.md'); equal(timers.size, 1);
  coordinator.dispose(); equal(timers.size, 0);
  coordinator.initialise(); coordinator.queue('Scene.md'); coordinator.queueRename('A.md', 'B.md');
  coordinator.metadataResolved(); coordinator.queueUnmanagedMove('A.md', 'B.md');
  await rejects(coordinator.whenSettled(), /cancelled/);
  await new Promise(resolve => setImmediate(resolve));
  equal(builds, 1); equal(settled, 1); equal(scans, 0); equal(timers.size, 0); equal(errors.length, 0);
});

test('real coordinator startup and settled edit/insert/delete/restore/move/reorder batches never persist reporting', async () => {
  const { numberingHarness } = await import('./helpers/ManuscriptNumberingHarness');
  const h = numberingHarness();
  (globalThis as any).window = { setTimeout, clearTimeout };
  const selection = new h.api.ManuscriptBookSelectionService(null, 'test');
  let settled = 0;
  const coordinator = new h.api.ManuscriptIntegrityCoordinator(h.app, selection,
    { activePath: () => 'Alpha.md', debounceMs: 0, onSettled: () => { settled++; } },
    { rebuild: () => { h.settle(); return h.library(); }, publish: () => {} });
  coordinator.initialise(); await coordinator.whenSettled(); equal(h.writes(), 0);
  const batch = async (path: string) => {
    const before = h.writes(); coordinator.queue(path); await coordinator.whenSettled();
    equal(h.writes(), before); equal(h.cache.get('First.md')!.frontmatter!.book_scene_number, undefined);
  };
  await batch('First.md'); // Ordinary prose save and metadata reconciliation.
  h.add('New.md', { type: 'scene', parent: '[[Alpha]]', manuscript_order_key: 'D000000000' }); await batch('New.md');
  const file = h.loaded.get('New.md'); h.loaded.delete('New.md'); await batch('New.md');
  h.loaded.set('New.md', file!); await batch('New.md');
  await h.edit('New.md', fm => { fm.parent = '[[Beta]]'; }); await batch('New.md');
  await h.edit('Part.md', fm => { fm.manuscript_order_key = 'E000000000'; }); await batch('Part.md');
  equal(settled, 7); coordinator.dispose();
});
