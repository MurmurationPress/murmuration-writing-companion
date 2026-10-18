import { deepEqual, equal, match, ok, rejects, throws } from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { bundleReport, printBundleReport, enforceBundleBudget, BUNDLE_WARNING_THRESHOLD, BUNDLE_HARD_LIMIT } from "../bundle-policy.mjs";
import { stylesheetBuildOptions, shippedAssetsReport } from "../build-styles.mjs";
import { productionBuildOptions } from "../production-build.mjs";
import { minifyEmbeddedCss, embeddedCssPlugin } from "../minify-embedded-css.mjs";

for (const [size, expected] of [[BUNDLE_WARNING_THRESHOLD, "ok"], [BUNDLE_WARNING_THRESHOLD + 1, "warning"], [BUNDLE_HARD_LIMIT, "warning"], [BUNDLE_HARD_LIMIT + 1, "fail"]]) {
  test(`raw bundle policy at ${size} bytes: ${expected}`, () => {
    const report = bundleReport(Buffer.alloc(size, "x"));
    equal(report.status, expected); equal(report.rawBytes, size);
    equal(report.remainingHeadroom, BUNDLE_HARD_LIMIT - size);
    equal(report.warningThreshold, 669696); equal(report.hardLimit, 720896);
    ok(report.gzipBytes > 0 && report.gzipBytes < report.rawBytes);
    if (expected === "fail") throws(() => enforceBundleBudget(report), /exceeds/);
    else enforceBundleBudget(report);
  });
}

test("budget counts UTF-8 bytes, never characters or gzip", () => {
  equal(bundleReport(Buffer.from("é")).rawBytes, 2);
  const highlyCompressible = bundleReport(Buffer.alloc(BUNDLE_HARD_LIMIT + 1, " "));
  ok(highlyCompressible.gzipBytes < 1000);
  throws(() => enforceBundleBudget(highlyCompressible), /exceeds/);
});

test("CSS minification preserves descendant selectors, significant strings and calc whitespace", async () => {
  const source = 'const style = /* css */ `\n.a :hover { content: " keep   spaces "; width: calc(100% - 2px); }\n`;' + '\nconst other = `Keep this   text`;';
  const changed = await minifyEmbeddedCss(source, "Styles.ts");
  const css = runInNewContext(changed + "style");
  match(css, /\.a :hover/); match(css, /" keep   spaces "/); match(css, /calc\(100% - 2px\)/);
  equal(runInNewContext(changed + "other"), "Keep this   text");
  equal(await minifyEmbeddedCss(changed, "Styles.ts"), changed);
  await rejects(minifyEmbeddedCss('const style = /* css */ `.a { color: ${value}; }`;', "Styles.ts"), /interpolation/);
});

test("production JavaScript is deterministic and excludes CSS, tests and instrumentation", async () => {
  const options = { ...productionBuildOptions(), plugins: [], metafile: true, write: false, logLevel: "silent" };
  const before = await build(options);
  const after = await build({ ...options, plugins: [embeddedCssPlugin()] });
  const again = await build({ ...options, plugins: [embeddedCssPlugin()] });
  deepEqual(Object.keys(after.metafile.inputs).sort(), Object.keys(before.metafile.inputs).sort());
  ok(!Object.keys(after.metafile.inputs).some(path => /node_modules|benchmarks|scripts\/|tests\//.test(path)));
  ok(!Object.keys(after.metafile.inputs).some(path => /Styles\.ts$|\.css$/.test(path)));
  deepEqual(after.outputFiles[0].contents, again.outputFiles[0].contents);
  equal(after.outputFiles.length, 1); // No split JavaScript or sourcemap; native CSS is reported separately.
  const buildScript = await readFile("scripts/build-plugin.mjs", "utf8");
  const releaseScript = await readFile("scripts/verify-release.mjs", "utf8");
  for (const source of [buildScript, releaseScript]) { match(source, /printBundleReport\(report\)/); match(source, /enforceBundleBudget\(report\)/); }
});


test("local and CI report includes raw, gzip, thresholds and remaining headroom", () => {
  const output = [];
  const log = console.log; const warn = console.warn;
  try {
    console.log = value => output.push(value); console.warn = value => output.push(value);
    const report = bundleReport(Buffer.alloc(700000)); printBundleReport(report);
    match(output[0], /700000 raw bytes; \d+ gzip bytes; warning above 669696; hard ceiling 720896; remaining headroom 20896 bytes/);
    match(output[1], /less than 50 KiB/);
  } finally { console.log = log; console.warn = warn; }
});


test("native stylesheet contains every ordered source, is deterministic and has no unresolved imports", async () => {
  const options = {...stylesheetBuildOptions(),write:false,metafile:true};
  const first=await build(options), second=await build(options);
  deepEqual(first.outputFiles[0].contents,second.outputFiles[0].contents);
  equal(first.outputFiles.length,1); equal(first.warnings.length,0);
  const output=Object.values(first.metafile.outputs)[0]; equal(output.imports.length,0);
  equal(Object.keys(first.metafile.inputs).length,11); // index + base + nine former style literals
  const text=first.outputFiles[0].text;
  ok(text.indexOf(".mwc-book-review{") < text.indexOf(".mwc-story-world-graph"));
  match(text,/calc\(/); match(text,/mwc-manuscript-chat-body/);
  const assets=shippedAssetsReport(Buffer.from('js'),first.outputFiles[0].contents,Buffer.from('{}'));
  equal(assets.totalRawBytes,first.outputFiles[0].contents.length+4);
  equal(assets.assets['styles.css'].rawBytes,first.outputFiles[0].contents.length);
});

test('release checksum inventory is reproducible, complete and rejects missing/empty assets', async () => {
  const { releaseChecksums } = await import('../release-assets.mjs');
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { createHash } = await import('node:crypto');
  const root = await mkdtemp(path.join(tmpdir(), 'mwc-release-assets-'));
  try {
    const names = ['main.js', 'manifest.json', 'styles.css'];
    for (const name of names) await writeFile(path.join(root, name), `synthetic ${name}`);
    const expected = names.map(name => `${createHash('sha256').update(`synthetic ${name}`).digest('hex')}  ${name}\n`).join('');
    equal(await releaseChecksums(root), expected);
    equal(await releaseChecksums(root), expected);
    await writeFile(path.join(root, 'styles.css'), '');
    await rejects(releaseChecksums(root), /styles.css is empty/);
    await rm(path.join(root, 'styles.css'));
    await rejects(releaseChecksums(root), /ENOENT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('publication requires the exact stable tag, current main merge and successful main push CI', async () => {
  const { assertReleaseSource } = await import('../release-source.mjs');
  const sha = 'a'.repeat(40);
  const run = { head_sha: sha, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success', path: '.github/workflows/ci.yml' };
  const candidate = { tag: '0.20.0', version: '0.20.0', headSha: sha, tagSha: sha, mainSha: sha, runs: [run] };
  equal(assertReleaseSource(candidate), run);
  for (const tag of ['v0.20.0', '0.20.0-rc.1', '0.20.1', '00.20.0']) throws(() => assertReleaseSource({ ...candidate, tag }), /Stable release tag/);
  for (const key of ['headSha', 'tagSha', 'mainSha']) throws(() => assertReleaseSource({ ...candidate, [key]: 'b'.repeat(40) }), /current main head/);
  for (const patch of [{ head_sha: 'b'.repeat(40) }, { head_branch: 'release/0.20.0' }, { event: 'pull_request' }, { status: 'in_progress' }, { conclusion: 'failure' }, { conclusion: 'cancelled' }, { path: '.github/workflows/release.yml' }]) {
    throws(() => assertReleaseSource({ ...candidate, runs: [{ ...run, ...patch }] }), /Successful post-merge main/);
  }
  throws(() => assertReleaseSource({ ...candidate, runs: [] }), /Successful post-merge main/);
  for (const patch of [{ conclusion: 'failure' }, { status: 'in_progress' }]) throws(() => assertReleaseSource({ ...candidate, runs: [{ ...run, ...patch }, run] }), /Successful post-merge main/);
});
