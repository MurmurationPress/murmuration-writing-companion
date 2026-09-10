import { deepEqual, equal, match, ok, rejects, throws } from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { bundleReport, printBundleReport, enforceBundleBudget, BUNDLE_WARNING_THRESHOLD, BUNDLE_HARD_LIMIT } from "../bundle-policy.mjs";
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

test("CSS build retains every production contributor and produces deterministic smaller bytes", async () => {
  const options = { ...productionBuildOptions(), plugins: [], metafile: true, write: false, logLevel: "silent" };
  const before = await build(options);
  const after = await build({ ...options, plugins: [embeddedCssPlugin()] });
  const again = await build({ ...options, plugins: [embeddedCssPlugin()] });
  deepEqual(Object.keys(after.metafile.inputs).sort(), Object.keys(before.metafile.inputs).sort());
  ok(!Object.keys(after.metafile.inputs).some(path => /node_modules|benchmarks|scripts\/|tests\//.test(path)));
  ok(before.outputFiles[0].contents.length - after.outputFiles[0].contents.length > 5000);
  deepEqual(after.outputFiles[0].contents, again.outputFiles[0].contents);
  equal(after.outputFiles.length, 1); // No sidecar, split code, source map or removed runtime asset.
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
