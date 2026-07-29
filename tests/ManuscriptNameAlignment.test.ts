import { deepEqual, equal, rejects } from "node:assert/strict";
import { test } from "node:test";
import {
  detectManuscriptNameMismatch,
  executeRenameFileFromTitle,
  executeUpdateTitleFromFilename,
  ManuscriptNameAlignmentAdapter,
  ManuscriptNameSnapshot,
  normalizeManuscriptDisplayName,
  planRenameFileFromTitle,
  planUpdateTitleFromFilename,
  StaleManuscriptNameAlignmentError
} from "../src/manuscript/ManuscriptNameAlignment";
import { getChapterContextField, updateEditableChapterContextFrontmatter } from "../src/companion/ChapterContext";

function snapshot(overrides: Partial<ManuscriptNameSnapshot> = {}): ManuscriptNameSnapshot {
  return {
    path: "Books/Part/Scene Name.md",
    basename: "Scene Name",
    title: "Different Title",
    kind: "scene",
    authoritative: true,
    ...overrides
  };
}

class MemoryAdapter implements ManuscriptNameAlignmentAdapter {
  current: ManuscriptNameSnapshot | null;
  existing = new Set<string>();
  renames: Array<[string, string]> = [];
  titleUpdates: Array<[string, string]> = [];
  refreshes = 0;
  renameError: Error | null = null;
  titleError: Error | null = null;
  beforeRename: (() => void) | null = null;
  beforeTitle: (() => void) | null = null;

  constructor(current = snapshot()) { this.current = current; }
  snapshot(path: string) { return this.current?.path === path ? this.current : null; }
  targetExists(path: string) { return this.existing.has(path); }
  async rename(path: string, target: string) {
    this.beforeRename?.();
    if (this.renameError) throw this.renameError;
    this.renames.push([path, target]);
  }
  async updateTitle(path: string, title: string) {
    this.beforeTitle?.();
    if (this.titleError) throw this.titleError;
    this.titleUpdates.push([path, title]);
  }
  refresh() { this.refreshes += 1; }
}

test("normalisation trims only surrounding whitespace", () => {
  equal(normalizeManuscriptDisplayName("  Domestic Distance  "), "Domestic Distance");
  equal(normalizeManuscriptDisplayName("   "), null);
  equal(normalizeManuscriptDisplayName(undefined), null);
});

test("matching and whitespace-only differences produce no mismatch", () => {
  equal(detectManuscriptNameMismatch(snapshot({ title: "Scene Name" })), null);
  equal(detectManuscriptNameMismatch(snapshot({ title: "  Scene Name  " })), null);
});

test("the established filename-only numeric prefix distinction is allowed", () => {
  equal(detectManuscriptNameMismatch(snapshot({ basename: "12 Scene Name", title: "Scene Name" })), null);
  equal(detectManuscriptNameMismatch(snapshot({ basename: "Scene Name", title: "12 Scene Name" }))?.title, "12 Scene Name");
});

test("a genuine mismatch preserves authored case and punctuation", () => {
  deepEqual(detectManuscriptNameMismatch(snapshot()), {
    path: "Books/Part/Scene Name.md", filename: "Scene Name", title: "Different Title", kind: "scene"
  });
});

test("missing, blank and non-string titles are explicitly not mismatches", () => {
  equal(detectManuscriptNameMismatch(snapshot({ title: undefined })), null);
  equal(detectManuscriptNameMismatch(snapshot({ title: "  " })), null);
  equal(detectManuscriptNameMismatch(snapshot({ title: ["Scene Name"] })), null);
});

test("only authoritative Book, Part and Scene snapshots are eligible", () => {
  equal(detectManuscriptNameMismatch(snapshot({ authoritative: false })), null);
  for (const kind of ["book", "part", "scene"] as const) {
    equal(detectManuscriptNameMismatch(snapshot({ kind }))?.kind, kind);
  }
});

test("rename from title stays in the folder and retains md", () => {
  deepEqual(planRenameFileFromTitle(snapshot(), () => false), {
    sourcePath: "Books/Part/Scene Name.md",
    targetPath: "Books/Part/Different Title.md",
    currentFilename: "Scene Name.md",
    proposedFilename: "Different Title.md",
    errors: []
  });
});

test("conflicting, invalid, unsafe, empty and reserved filename targets are blocked", () => {
  equal(planRenameFileFromTitle(snapshot(), () => true).errors.length, 1);
  for (const title of ["Bad/Title", "Unsafe.", "CON", "\u0001bad"]) {
    equal(planRenameFileFromTitle(snapshot({ title }), () => false).errors.length > 0, true);
  }
  equal(planRenameFileFromTitle(snapshot({ title: " " }), () => false).errors.length > 0, true);
});

test("rename execution uses the adapter and refreshes only after success", async () => {
  const adapter = new MemoryAdapter();
  const plan = planRenameFileFromTitle(adapter.current, (path) => adapter.targetExists(path));
  await executeRenameFileFromTitle(adapter, plan);
  deepEqual(adapter.renames, [["Books/Part/Scene Name.md", "Books/Part/Different Title.md"]]);
  equal(adapter.titleUpdates.length, 0);
  equal(adapter.refreshes, 1);
});

test("rename cancellation performs no writes", () => {
  const adapter = new MemoryAdapter();
  planRenameFileFromTitle(adapter.current, (path) => adapter.targetExists(path));
  equal(adapter.renames.length, 0);
  equal(adapter.refreshes, 0);
});

test("rename revalidates mismatch and conflict immediately before execution", async () => {
  const adapter = new MemoryAdapter();
  const plan = planRenameFileFromTitle(adapter.current, () => false);
  adapter.current = snapshot({ title: "Changed Again" });
  await rejects(executeRenameFileFromTitle(adapter, plan), StaleManuscriptNameAlignmentError);
  adapter.current = snapshot();
  adapter.existing.add(plan.targetPath);
  await rejects(executeRenameFileFromTitle(adapter, plan), StaleManuscriptNameAlignmentError);
  equal(adapter.renames.length, 0);
  equal(adapter.refreshes, 0);
});

test("rename failure does not refresh or update title", async () => {
  const adapter = new MemoryAdapter();
  adapter.renameError = new Error("rename failed");
  const plan = planRenameFileFromTitle(adapter.current, () => false);
  await rejects(executeRenameFileFromTitle(adapter, plan), /rename failed/);
  equal(adapter.refreshes, 0);
  equal(adapter.titleUpdates.length, 0);
});

test("title update proposes the exact current filename", () => {
  deepEqual(planUpdateTitleFromFilename(snapshot()), {
    path: "Books/Part/Scene Name.md", oldTitle: "Different Title", proposedTitle: "Scene Name", errors: []
  });
});

test("title execution invokes only the metadata adapter and then refreshes", async () => {
  const adapter = new MemoryAdapter();
  const plan = planUpdateTitleFromFilename(adapter.current);
  await executeUpdateTitleFromFilename(adapter, plan);
  deepEqual(adapter.titleUpdates, [["Books/Part/Scene Name.md", "Scene Name"]]);
  equal(adapter.renames.length, 0);
  equal(adapter.refreshes, 1);
});

test("the existing metadata writer changes only title and preserves frontmatter", () => {
  const frontmatter: Record<string, unknown> = {
    title: "Different Title",
    manuscript_order_key: "a0",
    parent: "[[Part]]",
    custom: { retained: true }
  };
  updateEditableChapterContextFrontmatter(frontmatter, getChapterContextField("title"), "Scene Name");
  deepEqual(frontmatter, {
    title: "Scene Name",
    manuscript_order_key: "a0",
    parent: "[[Part]]",
    custom: { retained: true }
  });
});

test("title cancellation performs no writes", () => {
  const adapter = new MemoryAdapter();
  planUpdateTitleFromFilename(adapter.current);
  equal(adapter.titleUpdates.length, 0);
  equal(adapter.refreshes, 0);
});

test("title update revalidates immediately before writing", async () => {
  const adapter = new MemoryAdapter();
  const plan = planUpdateTitleFromFilename(adapter.current);
  adapter.current = snapshot({ title: "New Intentional Title" });
  await rejects(executeUpdateTitleFromFilename(adapter, plan), StaleManuscriptNameAlignmentError);
  equal(adapter.titleUpdates.length, 0);
  equal(adapter.refreshes, 0);
});

test("metadata failure leaves alignment state and navigator refresh untouched", async () => {
  const adapter = new MemoryAdapter();
  adapter.titleError = new Error("metadata failed");
  const before = adapter.current;
  await rejects(executeUpdateTitleFromFilename(adapter, planUpdateTitleFromFilename(before)), /metadata failed/);
  equal(adapter.current, before);
  equal(adapter.refreshes, 0);
  equal(adapter.renames.length, 0);
});

test("missing, stale, malformed, trashed and non-authoritative adapter states reject safely", async () => {
  const initial = new MemoryAdapter();
  const rename = planRenameFileFromTitle(initial.current, () => false);
  const title = planUpdateTitleFromFilename(initial.current);
  for (const current of [null, snapshot({ authoritative: false }), snapshot({ title: "" })]) {
    const adapter = new MemoryAdapter();
    adapter.current = current;
    await rejects(executeRenameFileFromTitle(adapter, rename), StaleManuscriptNameAlignmentError);
    await rejects(executeUpdateTitleFromFilename(adapter, title), StaleManuscriptNameAlignmentError);
  }
});
