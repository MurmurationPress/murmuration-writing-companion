import { equal } from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { FilenameTitlePreference, filenameTitlePreferenceKey } from "../src/companion/FilenameTitlePreference";

test("filename/title notices default on, persist off and can be restored per vault", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const key = filenameTitlePreferenceKey("mwc", "/vault-a");
  const preference = new FilenameTitlePreference(storage, key);
  equal(preference.get(), true);
  preference.set(false);
  equal(new FilenameTitlePreference(storage, key).get(), false);
  equal(new FilenameTitlePreference(storage, filenameTitlePreferenceKey("mwc", "/vault-b")).get(), true);
  preference.set(true);
  equal(new FilenameTitlePreference(storage, key).get(), true);
  equal(new FilenameTitlePreference(null, key).get(), true);
  values.set(key, "malformed");
  equal(new FilenameTitlePreference(storage, key).get(), true);
});

test("both browsing mismatch presentations are gated, detection and alignment actions remain available", () => {
  const source = readFileSync("src/manuscript/ManuscriptNavigatorView.ts", "utf8");
  for (const name of ["private renderNameMismatchIndicator", "private renderMetadataTooltip"]) {
    const body = source.slice(source.indexOf(name)).split("\n  }")[0];
    equal(body.includes("this.plugin.filenameTitlePreference.get()"), true);
  }
  equal(source.includes("const mismatch = detectManuscriptNameMismatch(adapter.snapshot(path))"), true);
});

test("Navigator rendering suppresses mismatches immediately and restores them when enabled", async () => {
  const { createRequire } = await import("node:module");
  const { runInNewContext } = await import("node:vm");
  const { build } = createRequire(import.meta.url)("esbuild") as typeof import("esbuild");
  const result = await build({ entryPoints: ["src/manuscript/ManuscriptNavigatorView.ts"], bundle: true,
    platform: "node", format: "cjs", external: ["obsidian"], write: false, logLevel: "silent" });
  class HostClass {}
  class File { path = "Scene.md"; basename = "Scene"; extension = "md"; }
  const obsidian = new Proxy({}, { get: (_, key) => key === "TFile" ? File : HostClass });
  const module = { exports: {} as any };
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: () => obsidian });
  const preference = new FilenameTitlePreference(null, "test");
  const entry = { path: "Scene.md", kind: "scene" };
  const file = new File();
  let indicators = 0;
  const view = { plugin: { filenameTitlePreference: preference }, app: {
    vault: { getAbstractFileByPath: () => file },
    metadataCache: { getFileCache: () => ({ frontmatter: { title: "Different title" } }) }
  } };
  const render = () => module.exports.ManuscriptNavigatorView.prototype.renderNameMismatchIndicator.call(view,
    { createSpan: () => { indicators++; } }, entry);
  render(); equal(indicators, 1);
  preference.set(false); render(); render(); equal(indicators, 1);
  preference.set(true); render(); equal(indicators, 2);
});

test("vault identity ignores Obsidian per-launch resource hosts and cache-busting queries", () => {
  equal(filenameTitlePreferenceKey("mwc", "app://first-launch/path/My%20Vault?123"),
    filenameTitlePreferenceKey("mwc", "app://second-launch/path/My%20Vault?456"));
  equal(filenameTitlePreferenceKey("mwc", "/path/My Vault"),
    filenameTitlePreferenceKey("mwc", "app://host/path/My%20Vault?456"));
});
