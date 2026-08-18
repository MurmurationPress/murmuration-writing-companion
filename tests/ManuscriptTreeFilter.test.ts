import { deepEqual, equal, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import type { ManuscriptDocumentRecord, ManuscriptOrderNode } from "../src/manuscript/ManuscriptOrder";
import {
  clearManuscriptSearchOnEscape,
  filterManuscriptTree,
  manuscriptPartIsCollapsed
} from "../src/manuscript/ManuscriptTreeFilter";

function entry(path: string, title: string, kind: "part" | "scene", parentPath: string | null): ManuscriptDocumentRecord {
  return { path, basename: title, title, kind, bookPath: "Book.md", parentPath };
}

const roots: readonly ManuscriptOrderNode[] = [
  {
    entry: entry("Containment.md", "Containment", "part", "Book.md"),
    children: [
      { entry: entry("Arrival.md", "First Arrival", "scene", "Containment.md"), children: [] },
      { entry: entry("Wild A.md", "Tobias in the Wilderness", "scene", "Containment.md"), children: [] }
    ]
  },
  {
    entry: entry("Aftermath.md", "Aftermath", "part", "Book.md"),
    children: [
      { entry: entry("Wild B.md", "Wilderness Return", "scene", "Aftermath.md"), children: [] },
      { entry: entry("Arrival 2.md", "First Arrival", "scene", "Aftermath.md"), children: [] }
    ]
  },
  { entry: entry("Prologue.md", "Direct Prologue", "scene", "Book.md"), children: [] }
];

test("matches Part titles case-insensitively and retains their normal branch", () => {
  const result = filterManuscriptTree(roots, "  CoNtAiN  ");
  deepEqual(result.map((node) => node.entry.title), ["Containment"]);
  strictEqual(result[0], roots[0]);
  deepEqual(result[0].children.map((node) => node.entry.title), ["First Arrival", "Tobias in the Wilderness"]);
});

test("matches Scene substrings and retains each containing Part in manuscript order", () => {
  const result = filterManuscriptTree(roots, "wilderness");
  deepEqual(result.map((node) => node.entry.title), ["Containment", "Aftermath"]);
  deepEqual(result.map((node) => node.children.map((child) => child.entry.title)), [
    ["Tobias in the Wilderness"],
    ["Wilderness Return"]
  ]);
});

test("keeps identical matching Scene names in separate contextual branches", () => {
  const result = filterManuscriptTree(roots, "first arrival");
  deepEqual(result.map((node) => [node.entry.title, node.children[0]?.entry.path]), [
    ["Containment", "Arrival.md"],
    ["Aftermath", "Arrival 2.md"]
  ]);
});

test("matches direct Book-level Scenes and represents no matches as an empty projection", () => {
  deepEqual(filterManuscriptTree(roots, "prologue").map((node) => node.entry.path), ["Prologue.md"]);
  deepEqual(filterManuscriptTree(roots, "not present"), []);
});

test("empty and whitespace queries restore the exact authoritative projection", () => {
  strictEqual(filterManuscriptTree(roots, ""), roots);
  strictEqual(filterManuscriptTree(roots, "   \t"), roots);
});

test("filtering does not mutate manuscript order, records, selection, or metadata", () => {
  const before = JSON.stringify(roots);
  const selection = { bookPath: "Book.md", contextPath: "Arrival.md" };
  const selectedBefore = { ...selection };
  filterManuscriptTree(roots, "arrival");
  equal(JSON.stringify(roots), before);
  deepEqual(selection, selectedBefore);
});

test("search temporarily reveals Parts without changing normal collapse state", () => {
  const collapsed = new Set(["Containment.md"]);
  equal(manuscriptPartIsCollapsed(collapsed.has("Containment.md"), false, false), true);
  equal(manuscriptPartIsCollapsed(collapsed.has("Containment.md"), true, false), false);
  equal(collapsed.has("Containment.md"), true);
  equal(manuscriptPartIsCollapsed(collapsed.has("Containment.md"), false, false), true);
});

test("Escape clears only a non-empty active query", () => {
  equal(clearManuscriptSearchOnEscape("wilderness", "Escape"), "");
  equal(clearManuscriptSearchOnEscape("", "Escape"), "");
  equal(clearManuscriptSearchOnEscape("wilderness", "Enter"), "wilderness");
});
