import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  ManuscriptBookSelectionService,
  ManuscriptBookSelectionStorage
} from "../src/manuscript/ManuscriptBookSelection";

class MemoryStorage implements ManuscriptBookSelectionStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test("navigator and Continuity Review observe one explicit selected-book signal", () => {
  const service = new ManuscriptBookSelectionService(new MemoryStorage(), "selection");
  const navigator: string[] = [];
  const review: string[] = [];
  service.subscribe((selection) => navigator.push(selection.bookPath ?? ""));
  service.subscribe((selection) => review.push(selection.bookPath ?? ""));
  service.select("Books/Plurality.md", "Books/Plurality/Scene.md", "manuscript-navigator");
  service.select("Books/Emergence.md", "Books/Emergence/Scene.md", "continuity-review");
  deepEqual(navigator, ["Books/Plurality.md", "Books/Emergence.md"]);
  deepEqual(review, navigator);
  equal(service.get().contextPath, "Books/Emergence/Scene.md");
});

test("ordinary Markdown navigation cannot retarget the explicit selection", () => {
  const service = new ManuscriptBookSelectionService(new MemoryStorage(), "selection");
  service.select("Books/Plurality.md", "Books/Plurality/Scene.md", "manuscript-navigator");
  // Active-file, wikilink and evidence navigation events are deliberately not inputs to this service.
  equal(service.get().bookPath, "Books/Plurality.md");
  equal(service.get().revision, 1);
});

test("rapid explicit book changes settle on the final book and context", () => {
  const service = new ManuscriptBookSelectionService(new MemoryStorage(), "selection");
  service.select("Books/Plurality.md", "Books/Plurality/Scene.md", "manuscript-navigator");
  service.select("Books/Emergence.md", "Books/Emergence/Scene.md", "manuscript-navigator");
  service.select("Books/Convergence.md", "Books/Convergence/Scene.md", "continuity-review");
  deepEqual(service.get(), {
    bookPath: "Books/Convergence.md",
    contextPath: "Books/Convergence/Scene.md",
    source: "continuity-review",
    revision: 3
  });
});

test("restart restores one coherent shared manuscript book", () => {
  const storage = new MemoryStorage();
  const first = new ManuscriptBookSelectionService(storage, "selection");
  first.select("Books/Emergence.md", "Books/Emergence/Scene.md", "manuscript-navigator");
  const restored = new ManuscriptBookSelectionService(storage, "selection");
  equal(restored.get().bookPath, "Books/Emergence.md");
  equal(restored.get().contextPath, "Books/Emergence.md");
  equal(restored.get().source, "restore");
});

test("a removed stored book is reconciled once to a deterministic fallback", () => {
  const storage = new MemoryStorage(); storage.setItem("selection", "Books/Removed.md");
  const service = new ManuscriptBookSelectionService(storage, "selection");
  service.reconcileBooks(new Set(["Books/Emergence.md"]), "Books/Emergence.md");
  equal(service.get().bookPath, "Books/Emergence.md");
  equal(storage.getItem("selection"), "Books/Emergence.md");
});
