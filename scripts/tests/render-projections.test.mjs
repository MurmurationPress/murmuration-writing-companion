import { test } from 'node:test';
import { equal, throws, deepEqual } from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('display projections reuse authority while creation and undated offers still read fresh structure', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'mwc-render-test-'));
  try {
    const outfile = path.join(directory, 'projections.mjs');
    await build({ stdin: { contents: `
      export { snapshotManuscriptPartCreation as part } from './src/manuscript/ObsidianManuscriptPartCreation';
      export { snapshotManuscriptSceneCreation as scene } from './src/manuscript/ObsidianManuscriptSceneCreation';
      export { getObsidianManuscriptStoryDateOffer as offer } from './src/manuscript/ObsidianManuscriptStoryDateOffer';
      export { TFile } from 'obsidian';
    `, resolveDir: process.cwd() }, outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    plugins: [{ name: 'synthetic-host', setup(b) {
      b.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'synthetic' }));
      b.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents: 'export class TFile {} export class TFolder {}' }));
    } }] });
    const { part, scene, offer, TFile } = await import(pathToFileURL(outfile).href);
    let scans = 0;
    let metadata = { story_date: '2030-01-02' };
    const target = Object.assign(new TFile(), { path: 'Scene.md', basename: 'Scene', extension: 'md' });
    const host = { app: {
      vault: { getMarkdownFiles() { scans++; throw Error('fresh authority'); }, getAllLoadedFiles: () => [], getAbstractFileByPath: () => null },
      metadataCache: { getFileCache: () => ({ frontmatter: metadata }) }
    }, getCurrentChapter: () => target, manuscriptBookSelection: { get: () => ({ bookPath: 'Book.md', revision: 1, contextPath: 'Book.md' }) } };
    const bookFile = Object.assign(new TFile(), { path: 'Book.md', basename: 'Book', extension: 'md' });
    const book = { file: bookFile, record: { title: 'Book' }, result: { entries: [], scenes: [], source: 'none', diagnostics: [] }, filesByPath: new Map() };
    const library = { books: [book] };
    equal(part(host, library).book.title, 'Book');
    equal(scene(host, library).book.title, 'Book');
    equal(scans, 0);
    // No persistent cache: the next published library/selection is observed.
    equal(scene(host, { books: [] }).book, null);
    throws(() => part(host), /fresh authority/);
    throws(() => scene(host), /fresh authority/);
    equal(scans, 2);
    for (const value of ['2030-01-02', 'Spring', { from: '2030', until: '2031' }, 42]) {
      metadata = { narrative_date: value };
      equal(offer(host, target), null);
    }
    equal(scans, 2);
    metadata = {};
    throws(() => offer(host, target), /fresh authority/);
    equal(scans, 3);
    deepEqual(metadata, {});
  } finally { await rm(directory, { recursive: true, force: true }); }
});
