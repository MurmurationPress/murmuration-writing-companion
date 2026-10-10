import { build } from 'esbuild';
import { equal } from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(path.join(tmpdir(), 'mwc-numbering-'));
try {
  const modules = new Map();
  const outfile = path.join(temporary, 'manual.mjs');
  await build({ entryPoints: [path.join(root, 'benchmarks/NumberingBaseline.ts')], outfile, bundle: true,
    platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'synthetic-host', setup(b) {
      b.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'synthetic' }));
      b.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents: 'export class TFile {} export class TFolder {}' }));
    } }] });
  modules.set('manual', await import(pathToFileURL(outfile).href));
  const results = [];
  for (const size of [30, 300, 1000]) for (const mode of ['manual']) {
    const { numberingBaseline } = modules.get(mode);
    await numberingBaseline(size, mode);
    const runs = []; for (let i = 0; i < 5; i++) runs.push(await numberingBaseline(size, mode));
    for (const run of runs) {
      const sample = name => run.samples.find(s => s.stage === name);
      equal(sample('prose-save').writes, 0);
      equal(sample('context-edit').writes, 0);
      equal(sample('book-switch').regenerationPasses, 0);
      for (const sample of run.samples) {
        equal(sample.writes, 0); equal(sample.writeAttempts, 0); equal(sample.regenerationPasses, 0);
      }
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
  console.log(JSON.stringify({ node: process.version, warmups: 1, repetitions: 5,
    note: 'Synthetic in-memory host, immediate cache visibility, batched generated events, no debounce/disk/DOM time. Refresh callbacks are not view rebuilds.', results }, null, 2));
} finally { await rm(temporary, { recursive: true, force: true }); }
