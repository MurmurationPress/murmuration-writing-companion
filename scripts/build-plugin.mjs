import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { build, analyzeMetafile } from "esbuild";

const analyze = process.argv.includes("--analyze");
const result = await build({
  entryPoints: ["src/entry.ts"],
  bundle: true,
  external: ["obsidian", "node:*"],
  format: "cjs",
  target: "es2018",
  outfile: "main.js",
  minify: true,
  metafile: analyze,
  logLevel: "info"
});

if (analyze && result.metafile) {
  const bundle = await readFile("main.js");
  console.log(`Production bundle: ${bundle.byteLength} bytes (${gzipSync(bundle).byteLength} bytes gzip)`);
  console.log(await analyzeMetafile(result.metafile, { verbose: true }));
}
