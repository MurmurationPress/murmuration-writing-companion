import { test } from "node:test";
import { equal } from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("view benchmark recognises the synthetic hierarchy and counts real cold/warm adapter work", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mwc-view-test-"));
  try {
    const outfile = path.join(directory, "fixture.mjs");
    await build({ entryPoints: ["benchmarks/ViewProjectionBaseline.ts"], bundle: true, platform: "node", format: "esm", outfile,
      plugins: [{ name: "synthetic-obsidian", setup(builder) {
        builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: "obsidian", namespace: "host" }));
        builder.onLoad({ filter: /.*/, namespace: "host" }, () => ({ contents: "export class TFolder {} export class TFile {}" }));
      } }] });
    const { runtimeBaseline } = await import(pathToFileURL(outfile).href);
    const result = runtimeBaseline(100);
    equal(result.books, 1); equal(result.scenes, 78);
    const sample = name => result.samples.find(row => row.stage === name);
    equal(sample("manuscript-cold").counts.markdownEnumerations, 1);
    equal(sample("manuscript-cold").counts.cacheReads, 100);
    equal(sample("manuscript-warm-10").counts.cacheReads, 0);
    equal(sample("manuscript-warm-10").counts.markdownEnumerations, 0);
    equal(sample("manuscript-settled-rebuild").counts.cacheReads, 100);
    equal(sample("graph-adapter").counts.markdownEnumerations, 1);
    equal(sample("continuity-collection").counts.changedUpserts, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
