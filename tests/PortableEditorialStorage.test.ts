import { deepEqual, equal, ok, rejects } from "node:assert/strict";
import { test } from "node:test";
import type { EditorialStore } from "../src/editorial/EditorialNote";
import {
  AtomicTextFileStore,
  EditorialStorageError,
  markEditorialPageDeleted,
  moveEditorialPage,
  parsePortableEditorialStore,
  PORTABLE_EDITORIAL_DATA_PATH,
  PORTABLE_EDITORIAL_SCHEMA_VERSION,
  PortableEditorialFileSystem,
  PortableEditorialStorage,
  portableEditorialStoragePaths,
  reconcileEditorialPagePresence,
  restoreEditorialPage,
  serializePortableEditorialStore
} from "../src/editorial/PortableEditorialStorage";

const NOW = "2032-04-01T12:00:00.000Z";
const CHAPTER_PATH = "PRIME Trilogy/EMERGENCE/PART ONE/Chapter One.md";

class MemoryFileSystem implements PortableEditorialFileSystem {
  readonly files = new Map<string, string>();
  readonly directories = new Set<string>();
  readonly operations: string[] = [];
  failRename:
    | { sourcePath: string; targetPath: string }
    | null = null;

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path);
  }

  async read(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`Missing file: ${path}`);
    this.operations.push(`read:${path}`);
    return content;
  }

  async write(path: string, content: string): Promise<void> {
    this.operations.push(`write:${path}`);
    this.files.set(path, content);
  }

  async rename(sourcePath: string, targetPath: string): Promise<void> {
    this.operations.push(`rename:${sourcePath}->${targetPath}`);

    if (
      this.failRename?.sourcePath === sourcePath
      && this.failRename.targetPath === targetPath
    ) {
      this.failRename = null;
      throw new Error("Simulated rename failure");
    }

    const content = this.files.get(sourcePath);
    if (content === undefined) throw new Error(`Missing source: ${sourcePath}`);
    if (this.files.has(targetPath)) throw new Error(`Target exists: ${targetPath}`);

    this.files.set(targetPath, content);
    this.files.delete(sourcePath);
  }

  async remove(path: string): Promise<void> {
    this.operations.push(`remove:${path}`);
    this.files.delete(path);
    this.directories.delete(path);
  }

  async mkdir(path: string): Promise<void> {
    this.operations.push(`mkdir:${path}`);
    this.directories.add(path);
  }
}

function editorialStore(body = "Check the storm date."): EditorialStore {
  return {
    pages: {
      [CHAPTER_PATH]: {
        chapterNote: {
          body,
          created: NOW,
          updated: NOW
        },
        annotations: [
          {
            id: "annotation-1",
            body: "Tobias already knows this.",
            category: "Continuity",
            status: "open",
            created: NOW,
            updated: NOW,
            anchor: {
              text: "The warning arrived first.",
              line: 42
            }
          }
        ]
      }
    }
  };
}

function createStorage(fileSystem = new MemoryFileSystem()) {
  return {
    fileSystem,
    storage: new PortableEditorialStorage(new AtomicTextFileStore(fileSystem))
  };
}

test("round trips chapter notes and annotations through the portable store", async () => {
  const { fileSystem, storage } = createStorage();
  const initial = await storage.load(undefined, NOW);
  deepEqual(initial.store, { pages: {} });
  equal(initial.source, "empty");

  await storage.save(editorialStore());

  const reloaded = await new PortableEditorialStorage(
    new AtomicTextFileStore(fileSystem)
  ).load(undefined, NOW);

  deepEqual(reloaded.store, editorialStore());
  equal(reloaded.source, "portable");
  equal(reloaded.recovered, false);
});

test("migrates legacy plugin data once without duplicating records", async () => {
  const { fileSystem, storage } = createStorage();
  const legacy = {
    pages: {
      [CHAPTER_PATH]: {
        documentNotes: [
          {
            id: "legacy-1",
            body: "First legacy note",
            category: "Editorial",
            status: "open",
            created: "2032-03-01T10:00:00.000Z",
            updated: "2032-03-01T10:05:00.000Z"
          },
          {
            id: "legacy-2",
            body: "Second legacy note",
            category: "Editorial",
            status: "open",
            created: "2032-03-02T10:00:00.000Z",
            updated: "2032-03-02T10:05:00.000Z"
          }
        ],
        annotations: editorialStore().pages[CHAPTER_PATH].annotations
      }
    }
  };

  const migrated = await storage.load(legacy, NOW);
  equal(migrated.source, "legacy");
  equal(migrated.migrated, true);
  equal(
    migrated.store.pages[CHAPTER_PATH].chapterNote.body,
    "First legacy note\n\nSecond legacy note"
  );
  equal(migrated.store.pages[CHAPTER_PATH].annotations.length, 1);

  const writesAfterMigration = fileSystem.operations.filter(
    (operation) => operation.startsWith("write:")
  ).length;
  const repeated = await new PortableEditorialStorage(
    new AtomicTextFileStore(fileSystem)
  ).load(legacy, NOW);

  equal(repeated.source, "portable");
  equal(repeated.migrated, false);
  equal(repeated.store.pages[CHAPTER_PATH].annotations.length, 1);
  equal(
    fileSystem.operations.filter((operation) => operation.startsWith("write:"))
      .length,
    writesAfterMigration
  );
});

test("preserves unknown root, page, annotation and anchor fields", async () => {
  const { fileSystem, storage } = createStorage();
  const seeded = {
    schemaVersion: 1,
    futureRoot: { enabled: true },
    pages: {
      [CHAPTER_PATH]: {
        futurePage: "retained",
        chapterNote: {
          body: "Note",
          created: NOW,
          updated: NOW,
          futureNote: 7
        },
        annotations: [
          {
            id: "annotation-1",
            body: "Body",
            category: "Continuity",
            status: "open",
            created: NOW,
            updated: NOW,
            futureAnnotation: "retained",
            anchor: {
              text: "Extract",
              line: 3,
              futureAnchor: true
            }
          }
        ]
      }
    }
  };
  fileSystem.files.set(PORTABLE_EDITORIAL_DATA_PATH, JSON.stringify(seeded));

  const loaded = await storage.load(undefined, NOW);
  await storage.save(loaded.store);

  const saved = JSON.parse(
    fileSystem.files.get(PORTABLE_EDITORIAL_DATA_PATH) ?? "{}"
  );
  equal(saved.schemaVersion, PORTABLE_EDITORIAL_SCHEMA_VERSION);
  deepEqual(saved.futureRoot, { enabled: true });
  equal(saved.pages[CHAPTER_PATH].futurePage, "retained");
  equal(saved.pages[CHAPTER_PATH].chapterNote.futureNote, 7);
  equal(
    saved.pages[CHAPTER_PATH].annotations[0].futureAnnotation,
    "retained"
  );
  equal(
    saved.pages[CHAPTER_PATH].annotations[0].anchor.futureAnchor,
    true
  );
});

test("moves editorial data with a renamed chapter", () => {
  const store = editorialStore();
  const nextPath = "PRIME Trilogy/EMERGENCE/PART ONE/Renamed Chapter.md";
  const originalPage = store.pages[CHAPTER_PATH];

  equal(moveEditorialPage(store, CHAPTER_PATH, nextPath), true);
  equal(store.pages[CHAPTER_PATH], undefined);
  equal(store.pages[nextPath], originalPage);
  equal(moveEditorialPage(store, CHAPTER_PATH, nextPath), false);
});

test("marks deleted chapters without discarding their editorial data", () => {
  const store = editorialStore();
  const originalPage = store.pages[CHAPTER_PATH];

  equal(markEditorialPageDeleted(store, CHAPTER_PATH, NOW), true);
  equal(store.pages[CHAPTER_PATH], originalPage);
  equal(store.pages[CHAPTER_PATH].deletedAt, NOW);
  equal(store.pages[CHAPTER_PATH].annotations.length, 1);
  equal(markEditorialPageDeleted(store, CHAPTER_PATH, NOW), false);
});

test("restores soft-deleted editorial data when the chapter returns", () => {
  const store = editorialStore();
  markEditorialPageDeleted(store, CHAPTER_PATH, NOW);

  equal(restoreEditorialPage(store, CHAPTER_PATH), true);
  equal(store.pages[CHAPTER_PATH].deletedAt, undefined);
  equal(store.pages[CHAPTER_PATH].chapterNote.body, "Check the storm date.");
  equal(restoreEditorialPage(store, CHAPTER_PATH), false);
});

test("reconciles page presence after offline deletion and restoration", () => {
  const store = editorialStore();

  deepEqual(reconcileEditorialPagePresence(store, [], NOW), {
    deletedPaths: [CHAPTER_PATH],
    restoredPaths: []
  });
  equal(store.pages[CHAPTER_PATH].deletedAt, NOW);

  deepEqual(reconcileEditorialPagePresence(store, [CHAPTER_PATH], NOW), {
    deletedPaths: [],
    restoredPaths: [CHAPTER_PATH]
  });
  equal(store.pages[CHAPTER_PATH].deletedAt, undefined);
});

test("archives a deleted destination rather than blocking an unrelated rename", () => {
  const store = editorialStore("Incoming chapter");
  const deletedPath = "PRIME Trilogy/EMERGENCE/PART ONE/Deleted Chapter.md";
  store.pages[deletedPath] = {
    chapterNote: { body: "Deleted chapter", created: NOW, updated: NOW },
    annotations: [],
    deletedAt: NOW
  };

  equal(moveEditorialPage(store, CHAPTER_PATH, deletedPath), true);
  equal(store.pages[deletedPath].chapterNote.body, "Incoming chapter");
  equal(store.pages[CHAPTER_PATH], undefined);

  const orphan = Object.values(store.orphanedPages ?? {})[0];
  equal(orphan.originalPath, deletedPath);
  equal(orphan.deletedAt, NOW);
  equal(orphan.page.chapterNote.body, "Deleted chapter");

  const movedAgain = "PRIME Trilogy/EMERGENCE/PART ONE/Moved Again.md";
  equal(moveEditorialPage(store, deletedPath, movedAgain), true);
  equal(restoreEditorialPage(store, deletedPath), true);
  equal(store.pages[deletedPath].chapterNote.body, "Deleted chapter");
  equal(store.orphanedPages, undefined);
});

test("round trips archived orphan records", async () => {
  const { fileSystem, storage } = createStorage();
  const store = editorialStore("Incoming chapter");
  const deletedPath = "PRIME Trilogy/EMERGENCE/PART ONE/Deleted Chapter.md";
  store.pages[deletedPath] = {
    chapterNote: { body: "Deleted chapter", created: NOW, updated: NOW },
    annotations: [],
    deletedAt: NOW
  };
  moveEditorialPage(store, CHAPTER_PATH, deletedPath);

  await storage.load(undefined, NOW);
  await storage.save(store);
  const reloaded = await new PortableEditorialStorage(
    new AtomicTextFileStore(fileSystem)
  ).load(undefined, NOW);

  deepEqual(reloaded.store, store);
});

test("refuses a rename collision without changing either active page", () => {
  const store = editorialStore();
  const nextPath = "PRIME Trilogy/EMERGENCE/PART ONE/Existing.md";
  store.pages[nextPath] = {
    chapterNote: { body: "Existing", created: NOW, updated: NOW },
    annotations: []
  };
  const before = JSON.stringify(store);

  rejects(
    async () => moveEditorialPage(store, CHAPTER_PATH, nextPath),
    (error: unknown) =>
      error instanceof EditorialStorageError && error.code === "path-conflict"
  );
  equal(JSON.stringify(store), before);
});

test("recovers a complete temporary file after an interrupted first write", async () => {
  const { fileSystem, storage } = createStorage();
  const paths = portableEditorialStoragePaths();
  fileSystem.files.set(paths.temporary, serializePortableEditorialStore(editorialStore()));

  const loaded = await storage.load(undefined, NOW);

  equal(loaded.source, "temporary");
  equal(loaded.recovered, true);
  deepEqual(loaded.store, editorialStore());
  ok(fileSystem.files.has(paths.primary));
  equal(fileSystem.files.has(paths.temporary), false);
});

test("recovers the last-known-good backup and quarantines a malformed primary", async () => {
  const { fileSystem, storage } = createStorage();
  const paths = portableEditorialStoragePaths();
  fileSystem.files.set(paths.primary, "{ malformed");
  fileSystem.files.set(paths.backup, serializePortableEditorialStore(editorialStore()));

  const loaded = await storage.load(undefined, NOW);

  equal(loaded.source, "backup");
  equal(loaded.recovered, true);
  deepEqual(loaded.store, editorialStore());
  equal(fileSystem.files.get(paths.corrupt), "{ malformed");
  ok(parsePortableEditorialStore(fileSystem.files.get(paths.primary) ?? "", NOW));
  ok(fileSystem.files.has(paths.backup));
});

test("does not downgrade or overwrite an unsupported newer schema", async () => {
  const { fileSystem, storage } = createStorage();
  const paths = portableEditorialStoragePaths();
  const future = JSON.stringify({
    schemaVersion: PORTABLE_EDITORIAL_SCHEMA_VERSION + 1,
    pages: {}
  });
  fileSystem.files.set(paths.primary, future);
  fileSystem.files.set(paths.backup, serializePortableEditorialStore(editorialStore()));

  await rejects(
    storage.load(undefined, NOW),
    (error: unknown) =>
      error instanceof EditorialStorageError
      && error.code === "unsupported-version"
  );

  equal(fileSystem.files.get(paths.primary), future);
  ok(fileSystem.files.has(paths.backup));
  equal(fileSystem.files.has(paths.corrupt), false);
});

test("rejects empty or malformed storage when no valid recovery exists", async () => {
  for (const content of ["", "{ malformed"]) {
    const { fileSystem, storage } = createStorage();
    fileSystem.files.set(PORTABLE_EDITORIAL_DATA_PATH, content);

    await rejects(
      storage.load(undefined, NOW),
      (error: unknown) =>
        error instanceof EditorialStorageError
        && (error.code === "empty" || error.code === "malformed")
    );

    equal(fileSystem.files.get(PORTABLE_EDITORIAL_DATA_PATH), content);
  }
});

test("restores the previous primary when publish fails after backup rotation", async () => {
  const { fileSystem, storage } = createStorage();
  const paths = portableEditorialStoragePaths();
  const previous = serializePortableEditorialStore(editorialStore("Previous"));
  fileSystem.files.set(paths.primary, previous);
  fileSystem.failRename = {
    sourcePath: paths.temporary,
    targetPath: paths.primary
  };

  await rejects(
    storage.save(editorialStore("Replacement")),
    (error: unknown) =>
      error instanceof EditorialStorageError && error.code === "write-failed"
  );

  equal(fileSystem.files.get(paths.primary), previous);
  equal(fileSystem.files.has(paths.backup), false);
});

test("storage writes never touch manuscript Markdown", async () => {
  const { fileSystem, storage } = createStorage();
  await storage.load(undefined, NOW);
  await storage.save(editorialStore());

  for (const operation of fileSystem.operations) {
    const path = operation.includes("->")
      ? operation.slice(operation.indexOf(":") + 1).split("->")
      : [operation.slice(operation.indexOf(":") + 1)];

    for (const item of path) {
      ok(
        item.startsWith(".murmuration"),
        `Unexpected non-storage path: ${item}`
      );
    }
  }
});
