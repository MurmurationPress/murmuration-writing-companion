import { deepEqual, equal, match, rejects } from "node:assert/strict";
import { test } from "node:test";
import {
  confirmManuscriptBookRemoval,
  executeManuscriptBookRemoval,
  manuscriptBookRemovalActionVisible,
  manuscriptBookRemovalConfirmation,
  ManuscriptBookRemovalAdapter,
  ManuscriptBookRemovalSnapshot,
  planManuscriptBookRemoval
} from "../src/manuscript/ManuscriptBookRemoval";

const book = { path: "Books/Book.md", title: "The Book", kind: "book" as const, parentPath: null };
const part = { path: "Books/Part.md", title: "Part", kind: "part" as const, parentPath: book.path };
const chapter = { path: "Books/Chapter.md", title: "Chapter", kind: "chapter" as const, parentPath: book.path };
const scene = { path: "Books/Scene.md", title: "Scene", kind: "scene" as const, parentPath: book.path };

function snapshot(overrides: Partial<ManuscriptBookRemovalSnapshot> = {}): ManuscriptBookRemovalSnapshot {
  return {
    selectedBookPath: book.path,
    bookPath: book.path,
    source: "distributed",
    structuralErrors: [],
    entries: [book],
    mtime: 10,
    size: 100,
    ...overrides
  };
}

class Adapter implements ManuscriptBookRemovalAdapter {
  readonly trashed: string[] = [];
  refreshes = 0;
  constructor(public current = snapshot()) {}
  async snapshot() { return this.current; }
  async trashBook(path: string) { this.trashed.push(path); }
  refreshNavigator() { this.refreshes += 1; }
}

test("an empty authoritative Book exposes a valid Remove Book action", () => {
  equal(manuscriptBookRemovalActionVisible("book", false), true);
  equal(manuscriptBookRemovalActionVisible("part", false), false);
  equal(manuscriptBookRemovalActionVisible("book", true), false);
  deepEqual(planManuscriptBookRemoval(snapshot()).errors, []);
  deepEqual(planManuscriptBookRemoval(snapshot({ source: "none" })).errors, []);
});

test("confirmation identifies the Book and Obsidian trash", () => {
  const message = manuscriptBookRemovalConfirmation(planManuscriptBookRemoval(snapshot()));
  match(message, /The Book/);
  match(message, /Book note will be moved to Obsidian trash/);
  match(message, /No Parts, Chapters or Scenes will be deleted/);
});

test("cancelling confirmation performs no writes or refresh", async () => {
  const adapter = new Adapter();
  equal(await confirmManuscriptBookRemoval(false, adapter, planManuscriptBookRemoval(snapshot())), false);
  deepEqual(adapter.trashed, []);
  equal(adapter.refreshes, 0);
});

test("confirmation trashes only the Book and refreshes after success", async () => {
  const adapter = new Adapter();
  await executeManuscriptBookRemoval(adapter, planManuscriptBookRemoval(snapshot()));
  deepEqual(adapter.trashed, [book.path]);
  equal(adapter.refreshes, 1);
});

test("assigned Parts, directly assigned Scenes and Chapters each block without mutation", async () => {
  for (const item of [part, scene, chapter]) {
    const current = snapshot({ entries: [book, item] });
    const before = JSON.stringify(current);
    const plan = planManuscriptBookRemoval(current);
    match(plan.errors.join(" "), new RegExp(`${item.kind}s?`, "i"));
    equal(JSON.stringify(current), before);
    const adapter = new Adapter(current);
    await rejects(executeManuscriptBookRemoval(adapter, plan), /never deleted, detached, reassigned or rewritten/);
    deepEqual(adapter.trashed, []);
    equal(adapter.refreshes, 0);
  }
});

test("no contained manuscript content is cascade-deleted", async () => {
  const current = snapshot({ entries: [book, part, chapter, scene] });
  const adapter = new Adapter(current);
  await rejects(executeManuscriptBookRemoval(adapter, planManuscriptBookRemoval(current)));
  deepEqual(adapter.trashed, []);
  deepEqual(current.entries, [book, part, chapter, scene]);
});

test("trash failure leaves navigator and manuscript intact", async () => {
  const adapter = new Adapter();
  adapter.trashBook = async () => { throw new Error("Obsidian trash failed"); };
  await rejects(executeManuscriptBookRemoval(adapter, planManuscriptBookRemoval(snapshot())), /Obsidian trash failed/);
  deepEqual(adapter.trashed, []);
  equal(adapter.refreshes, 0);
});

test("state changes between confirmation and execution are revalidated", async () => {
  const adapter = new Adapter(snapshot({ entries: [book, scene] }));
  await rejects(executeManuscriptBookRemoval(adapter, planManuscriptBookRemoval(snapshot())), /still contains 1 scene/);
  deepEqual(adapter.trashed, []);
  equal(adapter.refreshes, 0);
});

test("changed Book notes and malformed, legacy or non-authoritative entries reject safely", async () => {
  for (const current of [
    snapshot({ entries: [] }),
    snapshot({ entries: [{ ...book, parentPath: "Other.md" }] }),
    snapshot({ selectedBookPath: "Books/Other.md" }),
    snapshot({ source: "legacy" }),
    snapshot({ structuralErrors: ["Malformed manuscript order."] })
  ]) equal(planManuscriptBookRemoval(current).errors.length > 0, true);
  const adapter = new Adapter(snapshot({ mtime: 11 }));
  await rejects(executeManuscriptBookRemoval(adapter, planManuscriptBookRemoval(snapshot())), /became stale/);
  deepEqual(adapter.trashed, []);
});
