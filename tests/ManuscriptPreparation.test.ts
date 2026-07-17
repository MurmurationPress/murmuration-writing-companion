import { deepEqual, equal, match } from "node:assert/strict";
import { test } from "node:test";
import {
  planManuscriptPreparation
} from "../src/manuscript/ManuscriptPreparation";
import type {
  ManuscriptDocumentRecord,
  ManuscriptOrderResult
} from "../src/manuscript/ManuscriptOrder";

const bookPath = "PRIME Trilogy/BOOK 2 - PLURALITY.md";
const partPath = "PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE.md";
const scenePath = "PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE/1 Domestic Distance.md";

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
    parentPath
  };
}

const book = record(bookPath, "PLURALITY", "book", null);
const part = record(partPath, "ABSENCE", "part", bookPath);
const scene = record(scenePath, "Domestic Distance", "scene", partPath);

function result(source: ManuscriptOrderResult["source"]): ManuscriptOrderResult {
  return {
    source,
    entries: [part, scene],
    roots: [{
      entry: part,
      children: [{ entry: scene, children: [] }]
    }],
    scenes: [scene],
    diagnostics: []
  };
}

function emptyReferences() {
  return new Map<string, readonly string[]>([
    [bookPath, []],
    [partPath, []],
    [scenePath, []]
  ]);
}

function emptyResolvedBooks() {
  return new Map<string, string | null>([
    [bookPath, null],
    [partPath, null],
    [scenePath, null]
  ]);
}

test("prepares legacy book, part and scene metadata without touching reporting fields", () => {
  const frontmatterByPath = new Map<string, Record<string, unknown>>([
    [bookPath, { type: "book", title: "PLURALITY", book: 2 }],
    [partPath, { title: "ABSENCE", Part: 1 }],
    [scenePath, { title: "Domestic Distance", book: 2, Part: 1, chapter: "2.1.1" }]
  ]);
  const plan = planManuscriptPreparation({
    book,
    result: result("legacy"),
    frontmatterByPath,
    explicitKindByPath: new Map([
      [bookPath, "book"],
      [partPath, null],
      [scenePath, null]
    ]),
    explicitParentPathByPath: new Map([
      [bookPath, null],
      [partPath, null],
      [scenePath, null]
    ]),
    explicitBookPathByPath: emptyResolvedBooks(),
    parentReferencesByPath: emptyReferences(),
    bookReferencesByPath: emptyReferences()
  });

  equal(plan.canApply, true);
  equal(plan.files.length, 3);
  const bookPlan = plan.files.find((file) => file.path === bookPath)!;
  const partPlan = plan.files.find((file) => file.path === partPath)!;
  const scenePlan = plan.files.find((file) => file.path === scenePath)!;

  deepEqual(bookPlan.mutation.set.manuscript_order, [
    "[[PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE]]",
    "[[PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE/1 Domestic Distance]]"
  ]);
  deepEqual(partPlan.mutation.set, {
    type: "part",
    parent: "[[PRIME Trilogy/BOOK 2 - PLURALITY]]"
  });
  deepEqual(scenePlan.mutation.set, {
    type: "scene",
    parent: "[[PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE]]"
  });
  deepEqual(scenePlan.mutation.remove, []);
  equal(scenePlan.beforeFrontmatter.book, 2);
  equal(scenePlan.beforeFrontmatter.Part, 1);
  equal(scenePlan.beforeFrontmatter.chapter, "2.1.1");
});

test("canonicalises valid type and parent aliases for reusable Bases", () => {
  const plan = planManuscriptPreparation({
    book,
    result: result("explicit"),
    frontmatterByPath: new Map([
      [bookPath, {
        type: "book",
        manuscript_order: [
          "[[PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE]]",
          "[[PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE/1 Domestic Distance]]"
        ]
      }],
      [partPath, { kind: "section", up: "[[BOOK 2 - PLURALITY]]" }],
      [scenePath, { type: "chapter", part_of: "[[1 ABSENCE]]" }]
    ]),
    explicitKindByPath: new Map([
      [bookPath, "book"],
      [partPath, "part"],
      [scenePath, "scene"]
    ]),
    explicitParentPathByPath: new Map([
      [bookPath, null],
      [partPath, bookPath],
      [scenePath, partPath]
    ]),
    explicitBookPathByPath: emptyResolvedBooks(),
    parentReferencesByPath: new Map([
      [bookPath, []],
      [partPath, ["[[BOOK 2 - PLURALITY]]"]],
      [scenePath, ["[[1 ABSENCE]]"]]
    ]),
    bookReferencesByPath: emptyReferences()
  });

  equal(plan.canApply, true);
  const partPlan = plan.files.find((file) => file.path === partPath)!;
  const scenePlan = plan.files.find((file) => file.path === scenePath)!;
  deepEqual(partPlan.mutation.remove, ["kind", "up"]);
  deepEqual(partPlan.mutation.set, {
    type: "part",
    parent: "[[PRIME Trilogy/BOOK 2 - PLURALITY]]"
  });
  deepEqual(scenePlan.mutation.remove, ["part_of"]);
  deepEqual(scenePlan.mutation.set, {
    type: "scene",
    parent: "[[PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE]]"
  });
});

test("blocks a conflicting explicit parent", () => {
  const plan = planManuscriptPreparation({
    book,
    result: result("explicit"),
    frontmatterByPath: new Map([
      [bookPath, { type: "book", manuscript_order: [] }],
      [partPath, { type: "part", parent: "[[OTHER BOOK]]" }],
      [scenePath, { type: "scene", parent: "[[1 ABSENCE]]" }]
    ]),
    explicitKindByPath: new Map([
      [bookPath, "book"],
      [partPath, "part"],
      [scenePath, "scene"]
    ]),
    explicitParentPathByPath: new Map([
      [bookPath, null],
      [partPath, "Other/OTHER BOOK.md"],
      [scenePath, partPath]
    ]),
    explicitBookPathByPath: emptyResolvedBooks(),
    parentReferencesByPath: new Map([
      [bookPath, []],
      [partPath, ["[[OTHER BOOK]]"]],
      [scenePath, ["[[1 ABSENCE]]"]]
    ]),
    bookReferencesByPath: emptyReferences()
  });

  equal(plan.canApply, false);
  match(plan.diagnostics[0].message, /conflicts/i);
});

test("blocks an unresolved explicit hierarchy reference", () => {
  const plan = planManuscriptPreparation({
    book,
    result: result("legacy"),
    frontmatterByPath: new Map([
      [bookPath, { type: "book" }],
      [partPath, { title: "ABSENCE" }],
      [scenePath, { title: "Domestic Distance", parent: "[[Missing Part]]" }]
    ]),
    explicitKindByPath: new Map([
      [bookPath, "book"],
      [partPath, null],
      [scenePath, null]
    ]),
    explicitParentPathByPath: new Map([
      [bookPath, null],
      [partPath, null],
      [scenePath, null]
    ]),
    explicitBookPathByPath: emptyResolvedBooks(),
    parentReferencesByPath: new Map([
      [bookPath, []],
      [partPath, []],
      [scenePath, ["[[Missing Part]]"]]
    ]),
    bookReferencesByPath: emptyReferences()
  });

  equal(plan.canApply, false);
  match(plan.diagnostics[0].message, /could not be resolved/i);
});

test("is idempotent once canonical metadata exists", () => {
  const plan = planManuscriptPreparation({
    book,
    result: result("explicit"),
    frontmatterByPath: new Map([
      [bookPath, {
        type: "book",
        manuscript_order: [
          "[[PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE]]",
          "[[PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE/1 Domestic Distance]]"
        ]
      }],
      [partPath, {
        type: "part",
        parent: "[[PRIME Trilogy/BOOK 2 - PLURALITY]]"
      }],
      [scenePath, {
        type: "scene",
        parent: "[[PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE]]"
      }]
    ]),
    explicitKindByPath: new Map([
      [bookPath, "book"],
      [partPath, "part"],
      [scenePath, "scene"]
    ]),
    explicitParentPathByPath: new Map([
      [bookPath, null],
      [partPath, bookPath],
      [scenePath, partPath]
    ]),
    explicitBookPathByPath: emptyResolvedBooks(),
    parentReferencesByPath: new Map([
      [bookPath, []],
      [partPath, ["[[PRIME Trilogy/BOOK 2 - PLURALITY]]"]],
      [scenePath, ["[[PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE]]"]]
    ]),
    bookReferencesByPath: emptyReferences()
  });

  equal(plan.alreadyPrepared, true);
  equal(plan.canApply, false);
  deepEqual(plan.files, []);
});
