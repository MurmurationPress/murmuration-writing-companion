import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  const text = await readFile(path.join(projectRoot, relativePath), "utf8");
  return JSON.parse(text);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [manifest, packageJson, packageLock, versions] = await Promise.all([
  readJson("manifest.json"),
  readJson("package.json"),
  readJson("package-lock.json"),
  readJson("versions.json")
]);

const version = manifest.version;
assert(version === packageJson.version, "manifest.json and package.json versions differ");
assert(version === packageLock.version, "manifest.json and package-lock.json versions differ");
assert(
  version === packageLock.packages?.[""]?.version,
  "package-lock.json root package version differs"
);
assert(
  versions[version] === manifest.minAppVersion,
  `versions.json must map ${version} to ${manifest.minAppVersion}`
);

for (const asset of ["main.js", "manifest.json", "styles.css"]) {
  const assetPath = path.join(projectRoot, asset);
  await access(assetPath);
  const details = await stat(assetPath);
  assert(details.isFile() && details.size > 0, `${asset} is missing or empty`);
}

const main = await readFile(path.join(projectRoot, "main.js"), "utf8");
const bundleBudgetBytes = 720_896;
assert(Buffer.byteLength(main) <= bundleBudgetBytes, `main.js exceeds the ${bundleBudgetBytes}-byte production bundle budget`);
assert(!main.includes("//# sourceMappingURL="), "release main.js must not reference a sourcemap");
for (const unwanted of ["main.js.map", "meta.json", "metafile.json"]) {
  try { await access(path.join(projectRoot, unwanted)); throw new Error(`${unwanted} must not be a release artefact`); }
  catch (error) { if ((error)?.code !== "ENOENT") throw error; }
}

console.log(`Release ${version} metadata and assets are consistent.`);
