import { readFile, writeFile } from "node:fs/promises";
import { build, analyzeMetafile } from "esbuild";

import { productionBuildOptions } from "./production-build.mjs";
import { bundleReport, printBundleReport, enforceBundleBudget } from "./bundle-policy.mjs";

import { stylesheetBytes, shippedAssetsReport } from "./build-styles.mjs";

const analyze = process.argv.includes("--analyze");
const result = await build({
  ...productionBuildOptions(),
  metafile: analyze,
  logLevel: "info"
});

const css = await stylesheetBytes();
await writeFile("styles.css", css);
console.log(JSON.stringify(shippedAssetsReport(await readFile("main.js"), css, await readFile("manifest.json"))));
const report = bundleReport(await readFile("main.js"));
printBundleReport(report);
enforceBundleBudget(report);

if (analyze && result.metafile) {
  console.log(await analyzeMetafile(result.metafile, { verbose: true }));
}
