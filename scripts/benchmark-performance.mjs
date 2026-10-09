import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.resolve(process.argv[2] ?? root);
const temporary = await mkdtemp(path.join(tmpdir(), "mwc-performance-"));
try {
  const outfile = path.join(temporary, "benchmark.mjs");
  await build({ entryPoints: [path.join(root, "benchmarks/RuntimeBaseline.ts")], bundle: true,
    platform: "node", format: "esm", outfile, logLevel: "silent",
    plugins: [{ name: "measured-source", setup(builder) {
      builder.onResolve({ filter: /(?:^|\/)src\// }, args => {
        const suffix = args.path.slice(args.path.indexOf("src/") + 4);
        return { path: path.join(sourceRoot, "src", `${suffix}.ts`) };
      });
    } }] });
  const { runtimeBaseline } = await import(pathToFileURL(outfile).href);
  const fixtures = [100, 1000, 10000].map(size => {
    runtimeBaseline(size); // Unreported warmup, including projection/parser JIT work.
    const runs = Array.from({ length: 5 }, () => runtimeBaseline(size));
    return { ...runs[0], samples: runs[0].samples.map((sample, i) => {
      const times = runs.map(run => run.samples[i].elapsedMs).sort((a, b) => a - b);
      const { elapsedMs, ...counts } = sample;
      return { ...counts, medianMs: times[2], maxMs: times[4] };
    }) };
  });
  console.log(JSON.stringify({ repetitions: 5, warmups: 1, node: process.version, note: "Synthetic adapter/projection timings; not Obsidian DOM or end-to-end editor timings. Counts are deterministic; durations are informational.",
    fixtures }, null, 2));
} finally { await rm(temporary, { recursive: true, force: true }); }
