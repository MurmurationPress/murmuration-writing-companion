import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import type {
  ManuscriptDocumentRecord,
  ManuscriptOrderResult
} from "../src/manuscript/ManuscriptOrder";
import { visibleManuscriptOrder } from "../src/manuscript/VisibleManuscriptOrder";

const bookPath = "Books/PLURALITY.md";

function record(
  path: string,
  title: string,
  kind: ManuscriptDocumentRecord["kind"],
  parentPath: string | null
): ManuscriptDocumentRecord {
  return {
    path,
    basename: path.split("/").pop()!.replace(/\.md$/i, ""),
    title,
    kind,
    bookPath,
    parentPath,
    orderKey: "I000000000",
    orderKeyPresent: true,
    explicitParent: kind !== "book",
    parentReferenceInvalid: false
  };
}

function result(entries: readonly ManuscriptDocumentRecord[]): ManuscriptOrderResult {
  return {
    source: "distributed",
    entries,
    roots: [],
    scenes: entries.filter((entry) => entry.kind === "scene"),
    diagnostics: []
  };
}

test("keeps valid scenes beneath their part", () => {
  const part = record("Books/PLURALITY/ABSENCE.md", "ABSENCE", "part", bookPath);
  const scene = record(
    "Books/PLURALITY/ABSENCE/Domestic Distance.md",
    "Domestic Distance",
    "scene",
    part.path
  );

  const visible = visibleManuscriptOrder(bookPath, result([part, scene]));

  deepEqual(visible.roots.map((node) => node.entry.title), ["ABSENCE"]);
  deepEqual(visible.roots[0].children.map((node) => node.entry.title), [
    "Domestic Distance"
  ]);
  equal(visible.diagnostics.length, 0);
});

test("promotes a scene whose parent is another scene", () => {
  const first = record("Books/PLURALITY/First.md", "First", "scene", bookPath);
  const hidden = record("Books/PLURALITY/Hidden.md", "Hidden", "scene", first.path);

  const visible = visibleManuscriptOrder(bookPath, result([first, hidden]));

  deepEqual(visible.roots.map((node) => node.entry.title), ["First", "Hidden"]);
  equal(visible.roots.every((node) => node.children.length === 0), true);
  equal(
    visible.diagnostics.some((diagnostic) => (
      diagnostic.kind === "invalid_parent_kind" && diagnostic.path === hidden.path
    )),
    true
  );
});

test("promotes a part whose parent is not the book", () => {
  const first = record("Books/PLURALITY/First.md", "First", "scene", bookPath);
  const displacedPart = record(
    "Books/PLURALITY/EXPERIMENT.md",
    "EXPERIMENT",
    "part",
    first.path
  );

  const visible = visibleManuscriptOrder(bookPath, result([first, displacedPart]));

  deepEqual(visible.roots.map((node) => node.entry.title), ["First", "EXPERIMENT"]);
  equal(
    visible.diagnostics.some((diagnostic) => (
      diagnostic.kind === "invalid_parent_kind" && diagnostic.path === displacedPart.path
    )),
    true
  );
});
