import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  deletionContextFor,
  captureLastKnownManuscriptSnapshot,
  ManuscriptEventGeneration,
  reconcileManuscriptSelection,
  LastKnownManuscriptSnapshot
} from "../src/manuscript/ManuscriptIntegrity";
import { ManuscriptBookSelection } from "../src/manuscript/ManuscriptBookSelection";

function selection(bookPath: string | null, contextPath: string | null, revision = 1): ManuscriptBookSelection {
  return { bookPath, contextPath, revision, source: "manuscript-navigator" };
}

test("scene deletion falls forward, backward, parent, then Book using settled survivors", () => {
  const snapshot: LastKnownManuscriptSnapshot = {
    generation: 1,
    bookPaths: ["Book.md"],
    entriesByPath: new Map([["Middle.md", {
      path: "Middle.md", kind: "scene", bookPath: "Book.md", parentPath: "Part.md",
      orderKey: "b", previousPath: "First.md", nextPath: "Last.md", globalPosition: 2,
      selectedBookPath: "Book.md", selectedContextPath: "Middle.md", active: true
    }]])
  };
  equal(deletionContextFor(snapshot, "Middle.md", new Set(["First.md", "Last.md", "Part.md", "Book.md"]))?.fallbackPath, "Last.md");
  equal(deletionContextFor(snapshot, "Middle.md", new Set(["First.md", "Part.md", "Book.md"]))?.fallbackPath, "First.md");
  equal(deletionContextFor(snapshot, "Middle.md", new Set(["Part.md", "Book.md"]))?.fallbackPath, "Part.md");
  equal(deletionContextFor(snapshot, "Middle.md", new Set(["Book.md"]))?.fallbackPath, "Book.md");
});

test("selection reconciliation clears stale context atomically while retaining its Book", () => {
  deepEqual(reconcileManuscriptSelection(
    selection("Book.md", "Deleted.md"),
    new Set(["Book.md"]),
    new Set(["Book.md", "Next.md"]),
    "Book.md",
    { deletedPath: "Deleted.md", bookPath: "Book.md", fallbackPath: "Next.md" }
  ), { bookPath: "Book.md", contextPath: "Next.md", changed: true, missingBook: false });
});

test("missing Book uses only the supplied deterministic fallback and never active-note inference", () => {
  deepEqual(reconcileManuscriptSelection(
    selection("Deleted Book.md", "Deleted Scene.md"),
    new Set(["Other Book.md"]),
    new Set(["Other Book.md"]),
    "Other Book.md"
  ), { bookPath: "Other Book.md", contextPath: "Other Book.md", changed: true, missingBook: true });
});

test("path and batch generations reject obsolete delete/restore work", () => {
  const generations = new ManuscriptEventGeneration();
  const deletion = generations.touch("Scene.md");
  const restoration = generations.touch("Scene.md");
  equal(generations.isCurrent("Scene.md", deletion.pathGeneration, deletion.batchGeneration), false);
  equal(generations.isCurrent("Scene.md", restoration.pathGeneration, restoration.batchGeneration), true);
  generations.touch("Other.md");
  equal(generations.isCurrent("Scene.md", restoration.pathGeneration, restoration.batchGeneration), false);
});

test("settled snapshot retains sparse keys and parent-local neighbours without becoming authority", () => {
  const entries = [
    { path: "Part.md", kind: "part" as const, parentPath: "Book.md", orderKey: "a" },
    { path: "First.md", kind: "scene" as const, parentPath: "Part.md", orderKey: "a" },
    { path: "Middle.md", kind: "scene" as const, parentPath: "Part.md", orderKey: "m" },
    { path: "Last.md", kind: "scene" as const, parentPath: "Part.md", orderKey: "z" }
  ];
  const library = {
    books: [{
      file: { path: "Book.md" },
      result: { entries },
      filesByPath: new Map(entries.map((entry) => [entry.path, { path: entry.path }]))
    }],
    owningBookPathByFile: new Map(), unresolved: []
  } as never;
  const snapshot = captureLastKnownManuscriptSnapshot(
    library, selection("Book.md", "Middle.md"), "Middle.md", 7
  );
  const middle = snapshot.entriesByPath.get("Middle.md")!;
  equal(middle.orderKey, "m");
  equal(middle.previousPath, "First.md");
  equal(middle.nextPath, "Last.md");
  equal(middle.active, true);
  equal(snapshot.generation, 7);
});
