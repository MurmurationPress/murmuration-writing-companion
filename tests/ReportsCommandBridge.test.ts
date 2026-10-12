import { test } from "node:test";
import { deepEqual, equal, strictEqual } from "node:assert/strict";
import { installReportsCommandBridge } from "../src/reports/ReportsCommandBridge";
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function fixture() {
  const commands = new Map<string, () => void>();
  const notices: string[] = [];
  let active: { path: string; extension: string } | null = { path: "Definitions/A.md", extension: "md" };
  const app: Parameters<typeof installReportsCommandBridge>[0]["app"] = { workspace: { getActiveFile: () => active } };
  const setCapability = (value: unknown) => {
    if (value === undefined) delete (app as { murmurationReports?: unknown }).murmurationReports;
    else (app as { murmurationReports?: unknown }).murmurationReports = value;
  };
  const host = { app, addCommand: (command: { id: string; callback: () => void }) => commands.set(command.id, command.callback) };
  return { app, host, commands, notices, setCapability, setActive: (value: typeof active) => { active = value; }, install: () => installReportsCommandBridge(host, message => notices.push(message)) };
}

test("bridge preserves both old IDs and only resolves Reports when invoked", async () => {
  const f = fixture();
  f.install();
  deepEqual([...f.commands.keys()], ["generate-derived-artefact", "generate-all-derived-artefacts"]);
  equal(f.notices.length, 0);
  f.commands.get("generate-derived-artefact")!();
  f.commands.get("generate-all-derived-artefacts")!();
  await tick();
  equal(f.notices.length, 2);
  equal(f.notices.every(message => message.includes("Enable Murmuration Reports") && message.includes("Existing saved outputs remain available")), true);
});

test("released v1 structured results are forwarded unchanged; active Unicode path is captured before awaits", async () => {
  const f = fixture();
  f.setActive({ path: "Definitions Ω/Trend with spaces.md", extension: "md" });
  const result = { definitionPath: "Definitions Ω/Trend with spaces.md", outputPath: "Outputs Ω/Trend.svg", status: "blocked", message: "Explicit adoption required", observations: 2, recoveryPaths: ["Outputs Ω/Trend.svg.murmuration-report-backup"] };
  let receivedPath = "";
  let shown: readonly unknown[] | undefined;
  f.setCapability({ version: 1, generateDefinition: async (path: string) => { await tick(); receivedPath = path; return result; }, generateAll: async () => [], showResults: (results: readonly unknown[]) => { shown = results; } });
  f.install();
  f.commands.get("generate-derived-artefact")!();
  f.setActive({ path: "Definitions/Other.md", extension: "md" });
  await tick(); await tick();
  equal(receivedPath, result.definitionPath);
  strictEqual(shown?.[0], result);
  equal(f.notices.length, 0);
});

test("generate-all delegates once to the Reports coordinator without a current note or blanket adoption", async () => {
  const f = fixture();
  f.setActive(null);
  const results = [
    { definitionPath: "A.md", status: "created", message: "Verified" },
    { definitionPath: "B.md", status: "failed", message: "Malformed observations; output retained" },
    { definitionPath: "C.md", status: "blocked", message: "Explicit adoption required" }
  ];
  let calls = 0;
  let shown: readonly unknown[] | undefined;
  f.setCapability({ version: 1, generateDefinition: async () => { throw Error("Batch must not run its own per-definition loop"); }, generateAll: async () => { calls++; return results; }, showResults: (value: readonly unknown[]) => { shown = value; } });
  f.install();
  f.commands.get("generate-all-derived-artefacts")!();
  await tick();
  equal(calls, 1);
  strictEqual(shown, results);
  equal(f.notices.length, 0);
});

test("either loading order and disable/re-enable resolve the current capability without re-registering commands", async () => {
  for (const reportsFirst of [false, true]) {
    const f = fixture();
    const calls: string[] = [];
    const capability = (label: string) => ({ version: 1, generateDefinition: async (path: string) => { calls.push(label); return { definitionPath: path, status: "unchanged", message: "Verified" }; }, generateAll: async () => [], showResults: () => {} });
    if (reportsFirst) f.setCapability(capability("old"));
    f.install();
    if (!reportsFirst) f.setCapability(capability("old"));
    f.commands.get("generate-derived-artefact")!(); await tick();
    f.setCapability(undefined);
    f.commands.get("generate-derived-artefact")!(); await tick();
    f.setCapability(capability("new"));
    f.commands.get("generate-derived-artefact")!(); await tick();
    deepEqual(calls, ["old", "new"]);
    equal(f.notices.length, 1);
    equal(f.commands.size, 2);
  }
});

test("absent or incompatible capability never accesses vault files, settings or hotkey storage", async () => {
  const f = fixture();
  const files = new Map([["Reports/Trend.svg", "Saved SVG"], ["Reports/Table.md", "Saved Markdown"], ["Definitions/Trend.md", "Definition"], [".obsidian/hotkeys.json", "User hotkeys"]]);
  const settings = { companionFontSize: 17, unknownLegacyKey: { preserve: true } };
  const before = JSON.stringify({ files: [...files], settings });
  for (const name of ["vault", "plugins", "metadataCache", "settings", "saveData", "loadData"]) Object.defineProperty(f.app, name, { get: () => { throw Error(`Bridge must not access ${name}`); } });
  f.install();
  for (const version of [undefined, 0, 2]) {
    f.setCapability(version === undefined ? undefined : { version, generateDefinition: () => { throw Error("Incompatible capability must not be called"); } });
    f.commands.get("generate-derived-artefact")!();
    f.commands.get("generate-all-derived-artefacts")!();
    await tick();
  }
  equal(f.notices.length, 6);
  equal(JSON.stringify({ files: [...files], settings }), before);
});

test("null and non-Markdown active files block single generation without blocking batch", async () => {
  const f = fixture();
  let calls = 0;
  f.setCapability({ version: 1, generateDefinition: () => { throw Error("No active definition"); }, generateAll: async () => { calls++; return []; }, showResults: () => {} });
  f.install();
  for (const active of [null, { path: "Chart.svg", extension: "svg" }]) {
    f.setActive(active);
    f.commands.get("generate-derived-artefact")!();
    f.commands.get("generate-all-derived-artefacts")!(); await tick();
  }
  equal(calls, 2);
  deepEqual(f.notices, ["Open a report definition note first.", "Open a report definition note first."]);
});

test("generation and result-presentation rejections become notices and do not write a fallback output", async () => {
  const f = fixture();
  let shown = 0;
  f.setCapability({ version: 1, generateDefinition: async () => { throw Error("Reports disabled during request"); }, generateAll: async () => [], showResults: () => { shown++; throw Error("Result presentation unavailable"); } });
  f.install();
  f.commands.get("generate-derived-artefact")!(); await tick();
  f.commands.get("generate-all-derived-artefacts")!(); await tick();
  deepEqual(f.notices, ["Could not generate reports: Reports disabled during request", "Could not generate reports: Result presentation unavailable"]);
  equal(shown, 1);
});
