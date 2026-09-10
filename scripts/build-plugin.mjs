import { readFile } from "node:fs/promises";
import { build, analyzeMetafile } from "esbuild";

import { productionBuildOptions } from "./production-build.mjs";
import { bundleReport, printBundleReport, enforceBundleBudget } from "./bundle-policy.mjs";

const analyze = process.argv.includes("--analyze");
const result = await build({
  ...productionBuildOptions(),
  metafile: analyze,
  logLevel: "info"
});

const report = bundleReport(await readFile("main.js"));
printBundleReport(report);
enforceBundleBudget(report);

if (analyze && result.metafile) {
  console.log(await analyzeMetafile(result.metafile, { verbose: true }));
}
