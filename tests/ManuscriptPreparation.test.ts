import { deepEqual, equal, match } from "node:assert/strict";
import { test } from "node:test";
import {
  planManuscriptPreparation
} from "../src/manuscript/ManuscriptPreparation";
import type {
  ManuscriptDocumentRecord,
  ManuscriptOrderResult
} from "../src/manuscript/ManuscriptOrder";
import {
  compareManuscriptOrderKeys,
  manuscriptOrderKey
} from "../src/manuscript/ManuscriptOrderKey";

const bookPath = "PRIME Trilogy/BOOK 2 - PLURALITY.md";
const partPath = "PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE.md";
const directPath = "PRIME Trilogy/BOOK 2 - PLURALITY/0 Prologue.md";
const firstScenePath = "PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE/1 Domestic Distance.md";
const secondScenePath = "PRIME Trilogy/BOOK 2 - PLURALITY/1 ABSENCE/2 Tobias in the Wilderness.md";

function record(
  path: string,
  title: string,
  kind: ManuscriptDocumentRecord["kind"],
  parentPath: string | null,
  orderKey: string | null = null,
  orderKeyPresent = false
): ManuscriptDocumentRecord {
  return {
    path,
    basename: path.split("/").pop()!.replace(/\.md$/i, ""),
    title,
    kind,
    bookPath,
    parentPath,
    orderKey,
    orderKeyPresent,
    explicitParent: kind !== "book",
    parentReferenceInvalid: false
  };
}

const book = record(bookPath, "PLURALITY", "book", null);
const direct = record(directPath, "Prologue", "scene", bookPath);
const part = record(partPath, "ABSENCE", "part", bookPath);
const firstScene = record(firstScenePath, "Domestic Distance", "scene", partPath);
const secondScene = record(secondScenePath, "Tobias in the Wilderness", "scene", partPath);

function result(
  source: ManuscriptOrderResult["source"],
  entries: readonly ManuscriptDocumentRecord[] = [direct, part, firstScene, secondScene],
  diagnostics: ManuscriptOrderResult["diagnostics"] = []
): ManuscriptOrderResult {
  return {
    source,
    entries,
    roots: [
      { entry: entries[0], children: [] },
      { entry: entries[1], children: [
        { entry: entries[2], children: [] },
        { entry: entries[3], children: [] }
      ] }
    ],
    scenes: entries.filter((entry) => entry.kind === "scene"),
    diagnostics
  };
}

function legacyFrontmatter() {
  return new Map<string, Record<string, unknown>>([
    [bookPath, {
      type: "book",
      title: "PLURALITY",
      book: 2,
      manuscript_order: [
        `[[${directPath.replace(/\.md$/, "")}]]`,
        `[[${partPath.replace(/\.md$/, "")}]]`,
        `[[${firstScenePath.replace(/\.md$/, "")}]]`,
        `[[${secondScenePath.replace(/\.md$/, "")}]]`
      ]
    }],
    [directPath, { title: "Prologue", book: 2, chapter: "2.0.1" }],
    [partPath, { title: "ABSENCE", Part: 1 }],
    [firstScenePath, { title: "Domestic Distance", book: 2, Part: 1, chapter: "2.1.1" }],
    [secondScenePath, { title: "Tobias in the Wilderness", book: 2, Part: 1, chapter: "2.1.2" }]
  ]);
}

test("migrates a valid legacy array into independent sibling keys", () => {
  const plan = planManuscriptPreparation({
    book,
    result: result("legacy_array"),
    frontmatterByPath: legacyFrontmatter()
  });

  equal(plan.canApply, true);
  equal(plan.files.length, 5);

  const bookPlan = plan.files.find((file) => file.path === bookPath)!;
  equal(bookPlan.mutation.remove.includes("manuscript_order"), true);
  equal(Object.prototype.hasOwnProperty.call(bookPlan.mutation.set, "manuscript_order"), false);

  const rootPlans = [directPath, partPath].map((path) => (
    plan.files.find((file) => file.path === path)!
  ));
  const rootKeys = rootPlans.map((file) => (
    manuscriptOrderKey(file.mutation.set.manuscript_order_key)
  ));
  equal(rootKeys.every(Boolean), true);
  equal(compareManuscriptOrderKeys(rootKeys[0]!, rootKeys[1]!), -1);

  const scenePlans = [firstScenePath, secondScenePath].map((path) => (
    plan.files.find((file) => file.path === path)!
  ));
  const sceneKeys = scenePlans.map((file) => (
    manuscriptOrderKey(file.mutation.set.manuscript_order_key)
  ));
  equal(sceneKeys.every(Boolean), true);
  equal(compareManuscriptOrderKeys(sceneKeys[0]!, sceneKeys[1]!), -1);
  equal(rootKeys[0], sceneKeys[0]);
  equal(rootKeys[1], sceneKeys[1]);
});

test("canonicalises type and parent without touching reporting fields", () => {
  const plan = planManuscriptPreparation({
    book,
    result: result("legacy_array"),
    frontmatterByPath: legacyFrontmatter()
  });

  const partPlan = plan.files.find((file) => file.path === partPath)!;
  const scenePlan = plan.files.find((file) => file.path === firstScenePath)!;
  deepEqual(partPlan.mutation.set.type, "part");
  deepEqual(partPlan.mutation.set.parent, `[[${bookPath.replace(/\.md$/, "")}]]`);
  deepEqual(scenePlan.mutation.set.type, "scene");
  deepEqual(scenePlan.mutation.set.parent, `[[${partPath.replace(/\.md$/, "")}]]`);
  equal(scenePlan.beforeFrontmatter.book, 2);
  equal(scenePlan.beforeFrontmatter.Part, 1);
  equal(scenePlan.beforeFrontmatter.chapter, "2.1.1");
  equal(scenePlan.mutation.remove.includes("book"), false);
  equal(scenePlan.mutation.remove.includes("Part"), false);
  equal(scenePlan.mutation.remove.includes("chapter"), false);
});

test("uses reviewed filename order when no central array exists", () => {
  const frontmatter = legacyFrontmatter();
  delete frontmatter.get(bookPath)!.manuscript_order;
  const plan = planManuscriptPreparation({
    book,
    result: result("legacy"),
    frontmatterByPath: frontmatter
  });

  equal(plan.canApply, true);
  equal(plan.files.some((file) => (
    Object.prototype.hasOwnProperty.call(file.mutation.set, "manuscript_order_key")
  )), true);
});

test("blocks ambiguous legacy filename order", () => {
  const plan = planManuscriptPreparation({
    book,
    result: result("legacy", undefined, [{
      kind: "legacy_ambiguous",
      path: secondScenePath,
      message: "Tobias in the Wilderness needs review before filename order is migrated."
    }]),
    frontmatterByPath: legacyFrontmatter()
  });

  equal(plan.canApply, false);
  match(plan.diagnostics[0].message, /needs review/i);
});

test("blocks malformed or incomplete legacy arrays", () => {
  const plan = planManuscriptPreparation({
    book,
    result: result("invalid", [], [{
      kind: "invalid_property_shape",
      message: "manuscript_order must be a YAML list."
    }]),
    frontmatterByPath: legacyFrontmatter()
  });

  equal(plan.canApply, false);
  match(plan.diagnostics[0].message, /correct/i);
});

test("removes an obsolete central array from an otherwise distributed manuscript", () => {
  const rootKeyA = "9000000000";
  const rootKeyB = "I000000000";
  const childKeyA = "C000000000";
  const childKeyB = "O000000000";
  const distributedEntries = [
    record(directPath, "Prologue", "scene", bookPath, rootKeyA, true),
    record(partPath, "ABSENCE", "part", bookPath, rootKeyB, true),
    record(firstScenePath, "Domestic Distance", "scene", partPath, childKeyA, true),
    record(secondScenePath, "Tobias in the Wilderness", "scene", partPath, childKeyB, true)
  ];
  const frontmatter = new Map<string, Record<string, unknown>>([
    [bookPath, { type: "book", manuscript_order: ["[[obsolete]]"] }],
    [directPath, { type: "scene", parent: `[[${bookPath.replace(/\.md$/, "")}]]`, manuscript_order_key: rootKeyA }],
    [partPath, { type: "part", parent: `[[${bookPath.replace(/\.md$/, "")}]]`, manuscript_order_key: rootKeyB }],
    [firstScenePath, { type: "scene", parent: `[[${partPath.replace(/\.md$/, "")}]]`, manuscript_order_key: childKeyA }],
    [secondScenePath, { type: "scene", parent: `[[${partPath.replace(/\.md$/, "")}]]`, manuscript_order_key: childKeyB }]
  ]);

  const plan = planManuscriptPreparation({
    book,
    result: result("distributed", distributedEntries, [{
      kind: "obsolete_order_array",
      path: bookPath,
      message: "manuscript_order is obsolete."
    }]),
    frontmatterByPath: frontmatter
  });

  equal(plan.canApply, true);
  deepEqual(plan.files.map((file) => file.path), [bookPath]);
  deepEqual(plan.files[0].mutation.remove, ["manuscript_order"]);
});

test("is idempotent after distributed migration", () => {
  const rootKeyA = "9000000000";
  const rootKeyB = "I000000000";
  const childKeyA = "C000000000";
  const childKeyB = "O000000000";
  const distributedEntries = [
    record(directPath, "Prologue", "scene", bookPath, rootKeyA, true),
    record(partPath, "ABSENCE", "part", bookPath, rootKeyB, true),
    record(firstScenePath, "Domestic Distance", "scene", partPath, childKeyA, true),
    record(secondScenePath, "Tobias in the Wilderness", "scene", partPath, childKeyB, true)
  ];
  const frontmatter = new Map<string, Record<string, unknown>>([
    [bookPath, { type: "book" }],
    [directPath, { type: "scene", parent: `[[${bookPath.replace(/\.md$/, "")}]]`, manuscript_order_key: rootKeyA }],
    [partPath, { type: "part", parent: `[[${bookPath.replace(/\.md$/, "")}]]`, manuscript_order_key: rootKeyB }],
    [firstScenePath, { type: "scene", parent: `[[${partPath.replace(/\.md$/, "")}]]`, manuscript_order_key: childKeyA }],
    [secondScenePath, { type: "scene", parent: `[[${partPath.replace(/\.md$/, "")}]]`, manuscript_order_key: childKeyB }]
  ]);

  const plan = planManuscriptPreparation({
    book,
    result: result("distributed", distributedEntries),
    frontmatterByPath: frontmatter
  });

  equal(plan.alreadyPrepared, true);
  equal(plan.canApply, false);
  deepEqual(plan.files, []);
});
