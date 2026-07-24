import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  applyManuscriptSceneDetachment,
  markdownBody,
  planManuscriptSceneDetachment,
  revalidateManuscriptSceneDetachment,
  type ManuscriptSceneDetachmentSnapshot
} from "../src/manuscript/ManuscriptSceneDetachment";

const book = { path: "Books/BOOK 4.md", title: "BOOK 4", kind: "book" as const, parentPath: null, orderKey: null };
const part = { path: "Books/FEVER.md", title: "FEVER", kind: "part" as const, parentPath: book.path, orderKey: "A000000000" };
const first = { path: "Books/First.md", title: "First", kind: "scene" as const, parentPath: part.path, orderKey: "B000000000" };
const middle = { path: "Books/Middle.md", title: "Middle", kind: "scene" as const, parentPath: part.path, orderKey: "C000000000" };
const last = { path: "Books/Last.md", title: "Last", kind: "scene" as const, parentPath: part.path, orderKey: "D000000000" };

function snapshot(overrides: Partial<ManuscriptSceneDetachmentSnapshot> = {}): ManuscriptSceneDetachmentSnapshot {
  return {
    selectedBookPath: book.path,
    selectedContextPath: middle.path,
    selectionRevision: 4,
    bookPath: book.path,
    bookTitle: book.title,
    source: "distributed",
    structuralErrors: [],
    entries: [book, part, first, middle, last],
    scenePath: middle.path,
    frontmatter: {
      type: "scene",
      title: "Middle",
      parent: "[[Books/FEVER]]",
      manuscript_order_key: middle.orderKey,
      story_date: "2033-04-12",
      pov: "[[Robin]]",
      chapter_status: "draft",
      world_context: ["[[Prime]]"],
      custom: { nested: true }
    },
    authoritativeBookProperties: [],
    mtime: 12,
    size: 100,
    sourceHash: "hash",
    ...overrides
  };
}

test("plans the exact canonical detachment and next-sibling fallback", () => {
  const plan = planManuscriptSceneDetachment(snapshot());
  equal(plan.errors.length, 0);
  equal(plan.bookPosition, 2);
  equal(plan.siblingPosition, 2);
  equal(plan.previous?.path, first.path);
  equal(plan.next?.path, last.path);
  equal(plan.fallbackPath, last.path);
  deepEqual(plan.changes.map((change) => [change.property, change.action, change.after]), [
    ["type", "replace", "scene-draft"],
    ["parent", "remove", undefined],
    ["manuscript_order_key", "remove", undefined]
  ]);
});

test("removes recognised aliases and only authoritative string Book references", () => {
  const values: Record<string, unknown> = {
    Document_Type: ["scene", "legacy"],
    Part_Of: "[[Books/FEVER]]",
    "Manuscript-Order-Key": middle.orderKey,
    owning_book: "[[Books/BOOK 4]]",
    book: 4,
    title: "Middle",
    unknown: [1, { keep: true }]
  };
  const plan = planManuscriptSceneDetachment(snapshot({
    frontmatter: values,
    authoritativeBookProperties: ["owning_book"]
  }));
  applyManuscriptSceneDetachment(values, plan);
  deepEqual(values, {
    book: 4,
    title: "Middle",
    unknown: [1, { keep: true }],
    type: "scene-draft"
  });
});

test("fallback follows next, previous, Part, then Book without changing entries", () => {
  equal(planManuscriptSceneDetachment(snapshot({ scenePath: first.path })).fallbackPath, middle.path);
  equal(planManuscriptSceneDetachment(snapshot({ scenePath: last.path })).fallbackPath, middle.path);
  equal(planManuscriptSceneDetachment(snapshot({ entries: [book, part, middle] })).fallbackPath, part.path);
  const direct = { ...middle, parentPath: book.path };
  equal(planManuscriptSceneDetachment(snapshot({ entries: [book, direct], scenePath: direct.path })).fallbackPath, book.path);
});

test("mutation preserves unrelated metadata and Markdown body bytes", () => {
  const values = JSON.parse(JSON.stringify(snapshot().frontmatter)) as Record<string, unknown>;
  const before = JSON.parse(JSON.stringify(values));
  applyManuscriptSceneDetachment(values, planManuscriptSceneDetachment(snapshot()));
  equal(values.type, "scene-draft");
  equal("parent" in values, false);
  equal("manuscript_order_key" in values, false);
  for (const property of ["title", "story_date", "pov", "chapter_status", "world_context", "custom"]) {
    deepEqual(values[property], before[property]);
  }
  const body = "First line\r\nSecond line\r\n";
  equal(markdownBody(`---\r\ntype: scene\r\n---\r\n${body}`), body);
  equal(markdownBody(`---\ntype: scene-draft\n---\n${body}`), body);
});

test("invalid authority blocks planning without mutating input", () => {
  const values = { type: "scene", parent: "[[Books/FEVER]]", manuscript_order_key: middle.orderKey };
  const plan = planManuscriptSceneDetachment(snapshot({ selectedBookPath: "Other.md", frontmatter: values }));
  equal(plan.errors.includes("The owning Book is no longer selected."), true);
  deepEqual(values, { type: "scene", parent: "[[Books/FEVER]]", manuscript_order_key: middle.orderKey });
});

test("revalidation blocks source, frontmatter, parent and key changes but permits selection revision", () => {
  const preview = planManuscriptSceneDetachment(snapshot());
  equal(revalidateManuscriptSceneDetachment(preview, snapshot({ selectionRevision: 9 })).errors.length, 0);
  for (const changed of [
    snapshot({ sourceHash: "changed-body" }),
    snapshot({ sourceHash: "changed-frontmatter", frontmatter: { ...snapshot().frontmatter, custom: "changed" } }),
    snapshot({ sourceHash: "changed-parent", entries: [book, part, first, { ...middle, parentPath: book.path }, last] }),
    snapshot({ sourceHash: "changed-key", entries: [book, part, first, { ...middle, orderKey: "Z000000000" }, last] })
  ]) {
    equal(revalidateManuscriptSceneDetachment(preview, changed).errors.includes("The confirmed Scene detachment became stale. Review it again."), true);
  }
});

test("unrelated neighbour changes recalculate fallback without invalidating the selected Scene", () => {
  const preview = planManuscriptSceneDetachment(snapshot());
  const movedLast = { ...last, parentPath: book.path };
  const current = revalidateManuscriptSceneDetachment(preview, snapshot({ entries: [book, part, first, middle, movedLast] }));
  equal(current.errors.length, 0);
  equal(current.fallbackPath, first.path);
});
