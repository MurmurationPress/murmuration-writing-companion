import { build, version } from "esbuild";
import path from "node:path";
import { productionBuildOptions } from "./production-build.mjs";
import { bundleReport } from "./bundle-policy.mjs";

// Optional archived source root must include src AND tsconfig.json. No build assets are written.
const result = await build({ ...productionBuildOptions(), absWorkingDir: path.resolve(process.argv[2] ?? "."),
  write: false, metafile: true, logLevel: "silent" });
const output = Object.values(result.metafile.outputs)[0];
console.log(JSON.stringify({ node: process.version, esbuild: version,
  ...bundleReport(result.outputFiles[0].contents),
  contributors: Object.entries(output.inputs).map(([path, value]) => ({ path, bytes: value.bytesInOutput }))
    .sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path)),
  thirdPartyInputs: Object.keys(result.metafile.inputs).filter(path => path.includes("node_modules")),
  externalImports: [...new Set(output.imports.filter(item => item.external).map(item => item.path))].sort()
}, null, 2));
