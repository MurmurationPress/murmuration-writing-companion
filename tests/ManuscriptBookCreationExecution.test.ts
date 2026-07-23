import { equal, match } from "node:assert/strict";
import { test } from "node:test";
import type { ManuscriptVaultEntry } from "../src/manuscript/ManuscriptBookCreation";
import {
  executeManuscriptBookCreation,
  InvalidManuscriptBookConfirmationError,
  ManuscriptBookCreationAdapter
} from "../src/manuscript/ManuscriptBookCreationExecution";

interface Handle { path: string; markdown: string }

class MemoryAdapter implements ManuscriptBookCreationAdapter<Handle> {
  entries: ManuscriptVaultEntry[] = [{ path: "Books", kind: "folder" }];
  readonly books = [{ path: "Books/ONE.md", title: "ONE" }];
  foldersCreated: string[] = [];
  filesCreated: Handle[] = [];
  cleanupCalls = 0;
  recognised = true;
  readBack: string | null = null;
  beforeFinalSnapshot: (() => void) | null = null;
  snapshotCount = 0;

  snapshot() {
    this.snapshotCount += 1;
    if (this.snapshotCount === 2) this.beforeFinalSnapshot?.();
    return { books: this.books, entries: [...this.entries] };
  }
  async createFolder(path: string) {
    this.foldersCreated.push(path);
    this.entries.push({ path, kind: "folder" });
  }
  async createFile(path: string, markdown: string) {
    const handle = { path, markdown };
    this.filesCreated.push(handle);
    this.entries.push({ path, kind: "file" });
    return handle;
  }
  async readFile(handle: Handle) { return this.readBack ?? handle.markdown; }
  async cleanupReadBackMismatch() { this.cleanupCalls += 1; }
  async waitForRecognition() { return this.recognised; }
}

const preview = { title: "FEVER", path: "Books/FEVER.md" };

test("planning, previewing, and abandoning a plan perform no writes", () => {
  const adapter = new MemoryAdapter();
  adapter.snapshot();
  equal(adapter.foldersCreated.length, 0);
  equal(adapter.filesCreated.length, 0);
});

test("invalid confirmation and a stale collision write no note", async () => {
  const invalid = new MemoryAdapter();
  await executeManuscriptBookCreation(invalid, { title: "", path: "Books/X.md" }).then(
    () => { throw new Error("Expected invalid confirmation"); },
    (error) => equal(error instanceof InvalidManuscriptBookConfirmationError, true)
  );
  equal(invalid.filesCreated.length, 0);

  const stale = new MemoryAdapter();
  stale.beforeFinalSnapshot = () => stale.entries.push({ path: preview.path, kind: "file" });
  await executeManuscriptBookCreation(stale, preview).then(
    () => { throw new Error("Expected stale confirmation"); },
    (error) => match(String(error), /already exists/)
  );
  equal(stale.filesCreated.length, 0);
});

test("overlapping double submission creates at most one note", async () => {
  const adapter = new MemoryAdapter();
  const [first, second] = await Promise.all([
    executeManuscriptBookCreation(adapter, preview),
    executeManuscriptBookCreation(adapter, preview)
  ]);
  equal(adapter.filesCreated.length, 1);
  equal(first.handle, second.handle);
});

test("success writes only the exact minimal book note", async () => {
  const adapter = new MemoryAdapter();
  const result = await executeManuscriptBookCreation(adapter, preview);
  equal(result.status, "recognised");
  equal(adapter.filesCreated.length, 1);
  equal(adapter.filesCreated[0].markdown, "---\ntype: book\ntitle: \"FEVER\"\n---\n");
  equal(adapter.foldersCreated.length, 0);
});

test("only explicitly planned missing folders are created", async () => {
  const adapter = new MemoryAdapter();
  await executeManuscriptBookCreation(adapter, { title: "FEVER", path: "Books/Future/FEVER.md" });
  equal(adapter.foldersCreated.join("|"), "Books/Future");
});

test("recognition delay preserves the verified created note", async () => {
  const adapter = new MemoryAdapter();
  adapter.recognised = false;
  const result = await executeManuscriptBookCreation(adapter, preview);
  equal(result.status, "recognition-delayed");
  equal(adapter.filesCreated.length, 1);
  equal(adapter.cleanupCalls, 0);
});

test("read-back mismatch limits cleanup to the adapter's created handle", async () => {
  const adapter = new MemoryAdapter();
  adapter.readBack = "changed";
  await executeManuscriptBookCreation(adapter, preview).then(
    () => { throw new Error("Expected verification failure"); },
    (error) => match(String(error), /did not match/)
  );
  equal(adapter.filesCreated.length, 1);
  equal(adapter.cleanupCalls, 1);
});
