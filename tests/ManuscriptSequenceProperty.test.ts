import { deepEqual, equal, rejects } from 'node:assert/strict';
import { test } from 'node:test';
import type { App, TFile } from 'obsidian';
import type { ObsidianManuscriptLibrary } from '../src/manuscript/ObsidianManuscript';
import { ManuscriptSequencePropertyService, beginExactManuscriptContentRestoration } from '../src/manuscript/ManuscriptSequenceProperty';

function fixture() {
  const files = ['A.md', 'B.md', 'C.md'].map(path => ({ path }) as TFile);
  const metadata = new Map(files.map(file => [file.path, {} as Record<string, unknown>]));
  const writes: string[] = [];
  let passes = 0;
  let beforeWrite = async () => {};
  const app = {
    vault: { getMarkdownFiles: () => { passes++; return files; } },
    metadataCache: { getFileCache: (file: TFile) => ({ frontmatter: metadata.get(file.path) }) },
    fileManager: { processFrontMatter: async (file: TFile, mutate: (fm: Record<string, unknown>) => void) => {
      await beforeWrite(); writes.push(file.path); mutate(metadata.get(file.path)!);
    } }
  } as unknown as App;
  const library = (paths: string[], source = 'distributed') => ({ books: [{ file: { path: 'Book.md' },
    filesByPath: new Map(files.map(file => [file.path, file])), result: { source,
      roots: paths.map(path => ({ entry: { path, kind: 'scene' }, children: [] })) }
  }] }) as unknown as ObsidianManuscriptLibrary;
  const service = new ManuscriptSequencePropertyService(app);
  return { app, service, metadata, writes, library, passes: () => passes,
    beforeWrite: (callback: () => Promise<void>) => { beforeWrite = callback; } };
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test('pending requests share completion and persist only the latest authoritative order', async () => {
  const f = fixture();
  const a = f.service.reconcile(f.library(['A.md', 'B.md', 'C.md']));
  const b = f.service.reconcile(f.library(['C.md', 'B.md', 'A.md']));
  equal(a, b); await Promise.all([a, b]);
  equal(f.passes(), 1); deepEqual(f.writes, ['A.md', 'B.md', 'C.md']);
  equal(f.metadata.get('C.md')!.book_scene_number, 1);
  equal(f.metadata.get('A.md')!.book_scene_number, 3);
});

test('an active pass finishes before the latest pending pass; obsolete moves do not rewrite files', async () => {
  const f = fixture(); const entered = gate(), blocked = gate(); let first = true;
  f.beforeWrite(async () => { if (first) { first = false; entered.release(); await blocked.promise; } });
  const active = f.service.reconcile(f.library(['A.md', 'B.md', 'C.md'])); await entered.promise;
  const pending = f.service.reconcile(f.library(['B.md', 'C.md', 'A.md']));
  const latest = f.service.reconcile(f.library(['C.md', 'A.md', 'B.md']));
  equal(pending, latest); let completed = false; void latest.then(() => { completed = true; });
  await Promise.resolve(); equal(completed, false);
  blocked.release(); await Promise.all([active, pending, latest]);
  equal(f.passes(), 2); equal(f.writes.length, 6);
  equal(f.metadata.get('C.md')!.series_scene_number, 1);
  equal(f.metadata.get('B.md')!.manuscript_sequence, '01.03.000');
  await f.service.reconcile(f.library(['C.md', 'A.md', 'B.md'])); equal(f.writes.length, 6);
});

test('failure rejects its batch without poisoning the next pending reconciliation', async () => {
  const f = fixture(); const entered = gate(), blocked = gate(); let first = true;
  f.beforeWrite(async () => { if (first) { first = false; entered.release(); await blocked.promise; throw new Error('write failed'); } });
  const active = f.service.reconcile(f.library(['A.md', 'B.md', 'C.md']));
  const failure = rejects(active, /write failed/); await entered.promise;
  const next = f.service.reconcile(f.library(['C.md', 'A.md', 'B.md'])); blocked.release();
  await failure; await next; equal(f.metadata.get('C.md')!.book_scene_number, 1);
});

test('latest membership removes stale fields while preserving unrelated metadata, legacy books and exact Undo', async () => {
  const f = fixture(); await f.service.reconcile(f.library(['A.md', 'B.md', 'C.md']));
  f.metadata.get('B.md')!.custom = 'keep';
  beginExactManuscriptContentRestoration(f.app, new Map([['A.md', 'original']]));
  const first = f.service.reconcile(f.library(['B.md', 'A.md', 'C.md']));
  const latest = f.service.reconcile(f.library(['C.md'])); await Promise.all([first, latest]);
  deepEqual(f.metadata.get('B.md'), { custom: 'keep' });
  equal(f.metadata.get('A.md')!.book_scene_number, 1);
  equal(f.metadata.get('C.md')!.book_scene_number, 1);
  const writes = f.writes.length;
  await f.service.reconcile(f.library([], 'legacy')); equal(f.writes.length, writes);
});
