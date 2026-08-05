import { deepEqual, equal } from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";
import {
  beginExactContentRestoration,
  cancelExactContentRestoration,
  completeExactContentRestoration,
  exactContentIsProtected,
  hasExactContentProtection
} from "../src/manuscript/ExactContentProtection";
import {
  manuscriptPreparationActionsNeedInstallation,
  manuscriptPreparationUndoNoticeVisible
} from "../src/manuscript/ManuscriptPreparationActions";
import { manuscriptSequenceReconciliationScope } from "../src/manuscript/ManuscriptSequenceReconciliation";
import { manuscriptPreparationContentMatchesUndoState } from "../src/manuscript/ManuscriptPreparationUndoComparison";

const fixtureRoot = path.resolve("examples/v2-onboarding/migration-vault");
const reportingProperties = ["manuscript_sequence", "book_scene_number", "series_scene_number"];

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function fixtureFiles(directory = fixtureRoot): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await fixtureFiles(entryPath));
    else files.push(entryPath);
  }
  return files.sort();
}

function simulatePreparedContent(content: string, index: number): string {
  if (!content.startsWith("---")) return content;
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const delimiter = `${newline}---${newline}`;
  const boundary = content.indexOf(delimiter, 3);
  if (boundary < 0) return content;
  const inserted = [
    `type: scene`,
    `parent: "[[The Low Water Ledger]]"`,
    `manuscript_order_key: TEST${index}`,
    `manuscript_sequence: 01.01.${String(index).padStart(3, "0")}`,
    `book_scene_number: ${index}`,
    `series_scene_number: ${index}`
  ].join(newline);
  return `${content.slice(0, boundary)}${newline}${inserted}${content.slice(boundary)}`;
}

async function restoreAndRunReportingReconcile(
  originals: Map<string, string>,
  current: Map<string, string>,
  authority: object
): Promise<void> {
  beginExactContentRestoration(authority, originals);
  for (const [file, content] of originals) current.set(file, content);
  completeExactContentRestoration(authority, [...originals.keys()]);
  for (const file of originals.keys()) {
    if (!await exactContentIsProtected(authority, file, async () => current.get(file)!)) {
      current.set(file, `${current.get(file)}\nreporting-reconciled`);
    }
  }
}

test("preparation Undo retains exact SHA-256 for every migration fixture file", async () => {
  const originals = new Map<string, string>();
  for (const file of await fixtureFiles()) originals.set(file, await readFile(file, "utf8"));
  const beforeHashes = new Map([...originals].map(([file, content]) => [file, hash(content)]));
  const current = new Map([...originals].map(([file, content], index) => [file, simulatePreparedContent(content, index + 1)]));

  await restoreAndRunReportingReconcile(originals, current, {});

  deepEqual(
    [...current].map(([file, content]) => [file, hash(content)]),
    [...beforeHashes]
  );
  for (const [file, original] of originals) {
    if (!file.endsWith(".md")) continue;
    for (const property of reportingProperties) {
      equal(new RegExp(`^${property}:`, "m").test(current.get(file)!), new RegExp(`^${property}:`, "m").test(original));
    }
  }
});

test("Undo restores original reporting values and unrelated formatting", async () => {
  const original = "---\ncustom: 'kept'\nseries_scene_number: 81\nmanuscript_sequence: \"02.03.004\"\nbook_scene_number: 27\n---\n\nProse.\n";
  const originals = new Map([["Scene.md", original]]);
  const current = new Map([["Scene.md", simulatePreparedContent(original, 1)]]);
  await restoreAndRunReportingReconcile(originals, current, {});
  equal(current.get("Scene.md"), original);
});

test("Undo preserves Windows CRLF bytes and property absence", async () => {
  const original = "---\r\ndemonstration_note: Keep this.\r\n---\r\n\r\nWindows prose.\r\n";
  const originals = new Map([["Windows Scene.md", original]]);
  const current = new Map([["Windows Scene.md", simulatePreparedContent(original, 1)]]);
  await restoreAndRunReportingReconcile(originals, current, {});
  equal(current.get("Windows Scene.md"), original);
  equal(hash(current.get("Windows Scene.md")!), hash(original));
});

test("derived reporting updates do not make immediate Undo stale", () => {
  const prepared = "---\r\ntype: scene\r\nparent: \"[[Book]]\"\r\nmanuscript_order_key: AAAAA\r\n---\r\n\r\nProse.\r\n";
  const reconciled = "---\r\ntype: scene\r\nparent: \"[[Book]]\"\r\nmanuscript_order_key: AAAAA\r\nmanuscript_sequence: 01.01.001\r\nbook_scene_number: 1\r\nseries_scene_number: 1\r\n---\r\n\r\nProse.\r\n";
  equal(manuscriptPreparationContentMatchesUndoState(reconciled, prepared), true);
});

test("authored changes still make immediate Undo stale", () => {
  const prepared = "---\ntype: scene\nparent: \"[[Book]]\"\n---\n\nOriginal prose.\n";
  const edited = "---\ntype: scene\nparent: \"[[Book]]\"\nmanuscript_sequence: 01.01.001\n---\n\nEdited prose.\n";
  equal(manuscriptPreparationContentMatchesUndoState(edited, prepared), false);
});

test("failed restoration cancels protection while completed rollback remains exact", async () => {
  const authority = {};
  const originals = new Map([["Restored.md", "original"], ["Failed.md", "before"]]);
  beginExactContentRestoration(authority, originals);
  completeExactContentRestoration(authority, ["Restored.md"]);
  cancelExactContentRestoration(authority, ["Failed.md"]);
  equal(await exactContentIsProtected(authority, "Restored.md", async () => "original"), true);
  equal(await exactContentIsProtected(authority, "Failed.md", async () => "before"), false);
});

test("a later author edit releases exact-content protection", async () => {
  const authority = {};
  beginExactContentRestoration(authority, new Map([["Scene.md", "original"]]));
  completeExactContentRestoration(authority, ["Scene.md"]);
  equal(await exactContentIsProtected(authority, "Scene.md", async () => "edited"), false);
  equal(await exactContentIsProtected(authority, "Scene.md", async () => "original"), false);
});

test("a reporting write queued before Undo is stopped at its mutation boundary", () => {
  const authority = {};
  equal(hasExactContentProtection(authority, "Scene.md"), false);
  beginExactContentRestoration(authority, new Map([["Scene.md", "original"]]));
  equal(hasExactContentProtection(authority, "Scene.md"), true);
  completeExactContentRestoration(authority, ["Scene.md"]);
  equal(hasExactContentProtection(authority, "Scene.md"), true);
});

test("startup defers reporting writes for legacy Books until preparation succeeds", () => {
  const legacy = { id: "legacy" };
  const distributed = { id: "distributed" };
  const scope = manuscriptSequenceReconciliationScope([
    { source: "legacy_array", value: legacy, paths: ["Legacy Book.md", "Legacy Scene.md"] },
    { source: "distributed", value: distributed, paths: ["Prepared Book.md", "Prepared Scene.md"] }
  ]);
  deepEqual(scope.projectable, [distributed]);
  deepEqual([...scope.deferredPaths], ["Legacy Book.md", "Legacy Scene.md"]);
});

test("Navigator reinstalls detached preparation actions and retains connected ones", () => {
  equal(manuscriptPreparationActionsNeedInstallation(undefined), true);
  equal(manuscriptPreparationActionsNeedInstallation({ prepare: { isConnected: true }, undo: { isConnected: true } }), false);
  equal(manuscriptPreparationActionsNeedInstallation({ prepare: { isConnected: false }, undo: { isConnected: true } }), true);
  equal(manuscriptPreparationActionsNeedInstallation({ prepare: { isConnected: true }, undo: { isConnected: false } }), true);
  equal(manuscriptPreparationUndoNoticeVisible(false, false), false);
  equal(manuscriptPreparationUndoNoticeVisible(true, false), true);
  equal(manuscriptPreparationUndoNoticeVisible(true, true), true);
});
