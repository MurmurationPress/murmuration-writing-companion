import type { App, TFile } from 'obsidian';
import { TFile as HostFile } from 'obsidian';
import { performance } from 'node:perf_hooks';
import { ManuscriptIntegrityCoordinator } from '../src/manuscript/ManuscriptIntegrityCoordinator';
import { ManuscriptProjectionService } from '../src/manuscript/ManuscriptProjection';
import { ManuscriptBookSelectionService } from '../src/manuscript/ManuscriptBookSelection';
import { buildObsidianManuscriptLibrary } from '../src/manuscript/ObsidianManuscript';
import { evenlySpacedManuscriptOrderKeys } from '../src/manuscript/ManuscriptOrderKey';

/** Synthetic host only: never opens a vault or loads the plugin's DOM views. */
export async function numberingBaseline(size: number, mode = 'manual') {
  const files: TFile[] = [];
  const paths = new Map<string, TFile>();
  const metadata = new Map<string, { frontmatter: Record<string, unknown> }>();
  const changed = new Set<string>();
  const written = new Set<string>();
  const counts = { regenerationPasses: 0, writeAttempts: 0, writes: 0, metadataEvents: 0,
    libraryRebuilds: 0, settledRefreshes: 0, markdownEnumerations: 0 };
  const add = (path: string, frontmatter: Record<string, unknown>) => {
    const file = Object.assign(new HostFile(), { path, basename: path.replace(/\.md$/, ''), extension: 'md', parent: null });
    files.push(file); paths.set(path, file); metadata.set(path, { frontmatter }); return file;
  };
  const keys = evenlySpacedManuscriptOrderKeys(size + 1);
  for (let b = 0; b < 3; b++) {
    add(`Book${b}.md`, { type: 'book', title: `Book${b}` });
    for (let s = 0; s < size; s++) add(`B${b}S${s}.md`, {
      type: 'scene', parent: `[[Book${b}]]`, manuscript_order_key: keys[s + 1]
    });
  }
  const app = {
    vault: {
      getMarkdownFiles: () => { counts.markdownEnumerations++; return files; },
      getAbstractFileByPath: (path: string) => paths.get(path),
      read: async () => { throw new Error('Unexpected content read'); }
    },
    metadataCache: {
      getFileCache: (file: TFile) => metadata.get(file.path),
      getFirstLinkpathDest: (path: string) => paths.get(`${path}.md`) ?? paths.get(path) ?? null
    },
    fileManager: { processFrontMatter: async (file: TFile, mutate: (fm: Record<string, unknown>) => void) => {
      counts.writeAttempts++;
      const fm = metadata.get(file.path)!.frontmatter;
      const next = { ...fm }; mutate(next);
      if (JSON.stringify(next) === JSON.stringify(fm)) return;
      metadata.set(file.path, { frontmatter: next });
      counts.writes++; written.add(file.path); changed.add(file.path);
    } }
  } as unknown as App;
  const timers = new Map<number, () => void>(); let timerId = 0;
  const previousWindow = globalThis.window;
  globalThis.window = { setTimeout: (callback: () => void) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id: number) => timers.delete(id) } as unknown as Window & typeof globalThis;
  const selection = new ManuscriptBookSelectionService(null, 'synthetic');
  const projection = new ManuscriptProjectionService(app, app => {
    counts.libraryRebuilds++; return buildObsidianManuscriptLibrary(app);
  });
  const coordinator = new ManuscriptIntegrityCoordinator(app, selection, {
    activePath: () => 'B0S0.md', onSettled: () => { counts.settledRefreshes++; }
  }, projection);
  const deliver = (path: string) => {
    counts.metadataEvents++;
    const file = paths.get(path)!;
    if (projection.affectsMetadata(file)) coordinator.queue(path);
  };
  const drain = async () => {
    for (let round = 0; round < 50; round++) {
      // All production Promise continuations settle before the next synthetic host batch.
      await new Promise(resolve => setImmediate(resolve));
      for (const path of changed) deliver(path);
      changed.clear();
      if (!timers.size) return;
      const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback());
    }
    throw new Error('Synthetic event loop did not converge');
  };
  const samples: object[] = [];
  const measure = async (stage: string, action: () => void) => {
    for (const key of Object.keys(counts)) (counts as any)[key] = 0;
    written.clear(); const start = performance.now(); action(); await drain();
    samples.push({ stage, ...counts, filesWritten: written.size,
      otherBookFilesWritten: [...written].filter(path => path.startsWith('B1') || path.startsWith('B2')).length,
      viewRebuilds: null, elapsedMs: +(performance.now() - start).toFixed(3) });
  };
  try {
    await measure('startup-missing', () => coordinator.initialise());
    if (projection.get().books.length !== 3 || projection.get().books.some(book => book.result.source !== 'distributed' || book.result.diagnostics.length)) throw new Error('Invalid fixture');
    await measure('startup-repeat', () => coordinator.initialise());
    await measure('prose-save', () => deliver('B0S0.md'));
    await measure('context-edit', () => { metadata.get('B0S0.md')!.frontmatter.pov = 'Synthetic'; deliver('B0S0.md'); });
    await measure('move-last-to-first', () => { metadata.get(`B0S${size - 1}.md`)!.frontmatter.manuscript_order_key = keys[0]; deliver(`B0S${size - 1}.md`); });
    await measure('detach-first', () => { const fm = metadata.get(`B0S${size - 1}.md`)!.frontmatter;
      fm.type = 'scene-draft'; delete fm.parent; delete fm.manuscript_order_key; deliver(`B0S${size - 1}.md`); });
    await measure('restore-scene', () => { const fm = metadata.get(`B0S${size - 1}.md`)!.frontmatter;
      fm.type = 'scene'; fm.parent = '[[Book0]]'; fm.manuscript_order_key = keys[0]; deliver(`B0S${size - 1}.md`); });
    await measure('reparent-to-book1', () => { metadata.get(`B0S${size - 1}.md`)!.frontmatter.parent = '[[Book1]]'; deliver(`B0S${size - 1}.md`); });
    await measure('book-switch', () => selection.select('Book1.md', 'Book1.md', 'manuscript-navigator'));
    return { scenesPerBook: size, books: 3, mode, samples };
  } finally { coordinator.dispose(); globalThis.window = previousWindow; }
}
