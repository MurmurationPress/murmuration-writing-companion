import { deepEqual, equal, match, rejects } from "node:assert/strict";
import { test } from "node:test";
import {
  confirmManuscriptPartRemoval,
  executeManuscriptPartRemoval,
  manuscriptPartRemovalActionVisible,
  manuscriptPartRemovalConfirmation,
  ManuscriptPartRemovalAdapter,
  ManuscriptPartRemovalSnapshot,
  planManuscriptPartRemoval
} from "../src/manuscript/ManuscriptPartRemoval";

const book = { path: "Books/Book.md", title: "Book", kind: "book" as const, parentPath: null, orderKey: null };
const part = { path: "Books/Part.md", title: "FEVER", kind: "part" as const, parentPath: book.path, orderKey: "A000000000" };
const scene = { path: "Books/Scene.md", title: "Scene", kind: "scene" as const, parentPath: part.path, orderKey: "B000000000" };
const chapter = { path: "Books/Chapter.md", title: "Chapter", kind: "scene" as const, parentPath: part.path, orderKey: "C000000000" };

function snapshot(overrides: Partial<ManuscriptPartRemovalSnapshot> = {}): ManuscriptPartRemovalSnapshot {
  return {
    selectedBookPath: book.path,
    bookPath: book.path,
    source: "distributed",
    structuralErrors: [],
    entries: [book, part],
    partPath: part.path,
    mtime: 10,
    size: 100,
    ...overrides
  };
}

class Adapter implements ManuscriptPartRemovalAdapter {
  readonly trashed: string[] = [];
  refreshes = 0;
  constructor(public current = snapshot()) {}
  async snapshot() { return this.current; }
  async trashPart(path: string) { this.trashed.push(path); }
  refreshNavigator() { this.refreshes += 1; }
}

test("an empty authoritative Part exposes a valid Remove Part plan", () => {
  equal(manuscriptPartRemovalActionVisible("part", false), true);
  equal(manuscriptPartRemovalActionVisible("scene", false), false);
  equal(manuscriptPartRemovalActionVisible("part", true), false);
  const plan = planManuscriptPartRemoval(snapshot());
  equal(plan.errors.length, 0);
  equal(plan.path, part.path);
  deepEqual(plan.containedItems, []);
});

test("confirmation identifies the Part and Obsidian trash without implying cascade deletion", () => {
  const message = manuscriptPartRemovalConfirmation(planManuscriptPartRemoval(snapshot()));
  match(message, /FEVER/);
  match(message, /Obsidian trash/);
  match(message, /No Chapters or Scenes will be deleted/);
});

test("cancelling confirmation changes nothing", async () => {
  const adapter = new Adapter();
  equal(await confirmManuscriptPartRemoval(false, adapter, planManuscriptPartRemoval(snapshot())), false);
  deepEqual(adapter.trashed, []);
  equal(adapter.refreshes, 0);
});

test("confirmation trashes only the Part and refreshes promptly", async () => {
  const adapter = new Adapter();
  await executeManuscriptPartRemoval(adapter, planManuscriptPartRemoval(snapshot()));
  deepEqual(adapter.trashed, [part.path]);
  equal(adapter.refreshes, 1);
});

test("trash failure reports through the caller without a false refresh", async () => {
  const adapter = new Adapter();
  adapter.trashPart = async () => { throw new Error("Obsidian trash failed"); };
  await rejects(executeManuscriptPartRemoval(adapter, planManuscriptPartRemoval(snapshot())), /Obsidian trash failed/);
  equal(adapter.refreshes, 0);
});

test("a Part containing a Scene is blocked without mutation or cascade deletion", async () => {
  const current = snapshot({ entries: [book, part, scene] });
  const before = JSON.stringify(current);
  const plan = planManuscriptPartRemoval(current);
  match(plan.errors.join(" "), /Move or remove the contained manuscript item/);
  equal(JSON.stringify(current), before);
  const adapter = new Adapter(current);
  await rejects(executeManuscriptPartRemoval(adapter, plan), /Chapters and Scenes are never deleted or reassigned automatically/);
  deepEqual(adapter.trashed, []);
  equal(adapter.refreshes, 0);
});

test("a Chapter normalised through existing manuscript recognition is also blocked", () => {
  const plan = planManuscriptPartRemoval(snapshot({ entries: [book, part, chapter] }));
  equal(plan.containedItems[0].title, "Chapter");
  match(plan.errors.join(" "), /contained manuscript item/);
});

test("malformed, stale and non-authoritative Parts are rejected safely", async () => {
  for (const current of [
    snapshot({ entries: [book] }),
    snapshot({ source: "legacy" }),
    snapshot({ structuralErrors: ["Malformed manuscript order."] }),
    snapshot({ entries: [book, { ...part, parentPath: "Other.md" }] })
  ]) equal(planManuscriptPartRemoval(current).errors.length > 0, true);
  const adapter = new Adapter(snapshot({ mtime: 11 }));
  await rejects(executeManuscriptPartRemoval(adapter, planManuscriptPartRemoval(snapshot())), /became stale/);
  deepEqual(adapter.trashed, []);
});
