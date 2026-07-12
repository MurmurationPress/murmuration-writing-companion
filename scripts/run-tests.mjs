import { spawnSync } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, context } from "esbuild";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsDirectory = path.join(projectRoot, "tests");
const outputDirectory = path.join(projectRoot, ".test-build");
const watchMode = process.argv.includes("--watch");

async function collectFiles(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(entryPath, extension));
    } else if (entry.name.endsWith(extension)) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

async function runNodeTests() {
  const compiledTests = await collectFiles(outputDirectory, ".mjs");
  const result = spawnSync(process.execPath, ["--test", ...compiledTests], {
    cwd: projectRoot,
    stdio: "inherit"
  });

  return result.status ?? 1;
}

const testFiles = await collectFiles(testsDirectory, ".test.ts");

if (testFiles.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

await rm(outputDirectory, { recursive: true, force: true });

const buildOptions = {
  entryPoints: testFiles,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outdir: outputDirectory,
  outbase: testsDirectory,
  entryNames: "[dir]/[name]",
  outExtension: { ".js": ".mjs" },
  sourcemap: "inline",
  logLevel: "info"
};

if (!watchMode) {
  await build(buildOptions);
  process.exitCode = await runNodeTests();
} else {
  const runTestsPlugin = {
    name: "run-tests-after-build",
    setup(esbuildBuild) {
      esbuildBuild.onEnd(async (result) => {
        if (result.errors.length > 0) return;
        process.exitCode = await runNodeTests();
      });
    }
  };

  const testContext = await context({
    ...buildOptions,
    plugins: [runTestsPlugin]
  });

  await testContext.watch();
  console.log("Watching source and test files for changes. Press Ctrl+C to stop.");

  const dispose = async () => {
    await testContext.dispose();
    process.exit();
  };

  process.once("SIGINT", dispose);
  process.once("SIGTERM", dispose);
}
