import { build } from 'esbuild';
import { equal } from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] ?? root);
const temporary = await mkdtemp(path.join(tmpdir(), 'mwc-numbering-'));
try {
  const modules = new Map();
  for (const mode of ['persist', 'no-numbers', 'no-reporting']) {
  const outfile = path.join(temporary, `${mode}.mjs`);
  await build({ entryPoints: [path.join(root, 'benchmarks/NumberingBaseline.ts')], outfile, bundle: true,
    platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'synthetic-host', setup(b) {
      // Counterfactual source edits exist only in the temporary benchmark bundle.
      b.onLoad({ filter: /ManuscriptSequenceProperty\.ts$/ }, async args => {
        let contents = await readFile(args.path, 'utf8');
        if (mode === 'no-numbers') contents = contents.replace(/^.*(?:BOOK_SCENE_NUMBER_PROPERTY|SERIES_SCENE_NUMBER_PROPERTY).*\n/gm, '');
        if (mode === 'no-reporting') contents = contents.replace('await this.sync(file, desired);', '// Persistence disabled for this experiment.');
        return { contents, loader: 'ts' };
      });
      b.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'synthetic' }));
      b.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents: 'export class TFile {} export class TFolder {}' }));
      b.onResolve({ filter: /(?:^|\/)src\// }, args => ({ path: path.join(source, 'src', args.path.slice(args.path.indexOf('src/') + 4) + '.ts') }));
    } }] });
  modules.set(mode, await import(pathToFileURL(outfile).href));
  }
  const results = [];
  for (const size of [30, 300, 1000]) for (const mode of ['persist', 'no-numbers', 'no-reporting']) {
    const { numberingBaseline } = modules.get(mode);
    await numberingBaseline(size, mode);
    const runs = []; for (let i = 0; i < 5; i++) runs.push(await numberingBaseline(size, mode));
    for (const run of runs) {
      const sample = name => run.samples.find(s => s.stage === name);
      equal(sample('prose-save').writes, 0);
      equal(sample('context-edit').writes, 0);
      equal(sample('book-switch').regenerationPasses, 0);
      equal(sample('startup-missing').writes, mode === 'no-reporting' ? 0 : size * 3);
      equal(sample('move-last-to-first').writes, mode === 'no-reporting' ? 0 : size);
      equal(sample('detach-first').otherBookFilesWritten, mode === 'persist' ? size * 2 : 0);
      equal(sample('detach-first').writes, mode === 'persist' ? size * 3 : mode === 'no-numbers' ? size : 0);
      // Deterministic counts across runs are the contract; timing is informational.
      for (let i = 0; i < run.samples.length; i++) for (const key of Object.keys(run.samples[i])) {
        if (key !== 'elapsedMs') equal(run.samples[i][key], runs[0].samples[i][key]);
      }
    }
    results.push({ ...runs[0], samples: runs[0].samples.map((sample, index) => {
      const times = runs.map(run => run.samples[index].elapsedMs).sort((a, b) => a - b);
      const { elapsedMs, ...rest } = sample; return { ...rest, medianMs: times[2], maxMs: times[4] };
    }) });
  }
  const { numberingBacklog } = modules.get('persist');
  const backlog = [];
  for (const size of [30, 300, 1000]) {
    await numberingBacklog(size); const runs = [];
    for (let i = 0; i < 5; i++) runs.push(await numberingBacklog(size));
    const times = runs.map(r => r.elapsedMs).sort((a, b) => a - b);
    const { elapsedMs, ...rest } = runs[0]; backlog.push({ ...rest, medianMs: times[2], maxMs: times[4] });
  }
  console.log(JSON.stringify({ node: process.version, warmups: 1, repetitions: 5,
    note: 'Synthetic in-memory host, immediate cache visibility, batched generated events, no debounce/disk/DOM time. Refresh callbacks are not view rebuilds. Backlog gate models pending I/O, not measured host delay.', results, backlog }, null, 2));
} finally { await rm(temporary, { recursive: true, force: true }); }
