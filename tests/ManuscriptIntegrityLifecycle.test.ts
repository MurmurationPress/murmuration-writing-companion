import { equal, rejects } from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

test('coordinator unload cancels reporting and ignores late layout/metadata callbacks', async () => {
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
  await rejects(coordinator.rebuildReportingSequence(), /cancelled/);
  await new Promise(resolve => setImmediate(resolve));
  equal(builds, 1); equal(settled, 1); equal(scans, 0); equal(timers.size, 0); equal(errors.length, 0);
});
