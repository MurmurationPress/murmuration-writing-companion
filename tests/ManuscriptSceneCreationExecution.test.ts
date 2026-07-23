import { equal } from "node:assert/strict";
import { test } from "node:test";
import { evenlySpacedManuscriptOrderKeys } from "../src/manuscript/ManuscriptOrderKey";
import { ManuscriptSceneCreationSnapshot, planManuscriptSceneCreation, revalidateManuscriptScenePlan } from "../src/manuscript/ManuscriptSceneCreation";
import { executeManuscriptNoteCreation, InvalidManuscriptNoteConfirmationError, ManuscriptNoteCreationAdapter } from "../src/manuscript/ManuscriptNoteCreationExecution";

interface Handle { path: string; markdown: string }
const bookPath = "Books/Book 4.md"; const partPath = "Books/FEVER.md"; const [key] = evenlySpacedManuscriptOrderKeys(1);
function snapshot(): ManuscriptSceneCreationSnapshot {
  return {
    selectedBookPath: bookPath, selectionRevision: 1, contextPath: partPath,
    book: { path: bookPath, title: "Book 4", source: "distributed", diagnostics: [], associatedFolder: null },
    parents: [{ path: bookPath, title: "Book 4", kind: "book", associatedFolder: null }, { path: partPath, title: "FEVER", kind: "part", associatedFolder: null }],
    orderedEntries: [{ path: partPath, title: "FEVER", kind: "part", parentPath: bookPath, orderKey: key }], orderedScenes: [], entries: [{ path: "Books", kind: "folder" }]
  };
}
class Adapter implements ManuscriptNoteCreationAdapter<Handle, ManuscriptSceneCreationSnapshot> {
  current = snapshot(); files: Handle[] = []; folders: string[] = []; cleanup = 0;
  recognition: "recognised" | "recognition-delayed" | "structurally-invalid" = "recognised";
  snapshot() { return this.current; }
  async createFolder(path: string) { this.folders.push(path); this.current = { ...this.current, entries: [...this.current.entries, { path, kind: "folder" }] }; }
  async createFile(path: string, markdown: string) { const file = { path, markdown }; this.files.push(file); return file; }
  async readFile(file: Handle) { return file.markdown; }
  async cleanupReadBackMismatch() { this.cleanup += 1; }
  async waitForRecognition() { return this.recognition; }
}
const preview = () => planManuscriptSceneCreation(snapshot(), { title: "Opening", path: "Books/FEVER/Opening.md", parentPath: partPath, placementId: "start", acceptDate: false });

test("stale confirmation writes no folder or Scene", async () => {
  const plan = preview(); const adapter = new Adapter(); adapter.current = { ...adapter.current, contextPath: "Missing.md" };
  await executeManuscriptNoteCreation(adapter, plan.path, (current) => revalidateManuscriptScenePlan(plan, current)).then(() => { throw new Error("expected stale"); }, (error) => equal(error instanceof InvalidManuscriptNoteConfirmationError, true));
  equal(adapter.folders.length, 0); equal(adapter.files.length, 0);
});

test("double submit creates one exact Scene and changes no sibling snapshot", async () => {
  const plan = preview(); const adapter = new Adapter(); const siblings = JSON.stringify(adapter.current.orderedEntries);
  await Promise.all([
    executeManuscriptNoteCreation(adapter, plan.path, (current) => revalidateManuscriptScenePlan(plan, current)),
    executeManuscriptNoteCreation(adapter, plan.path, (current) => revalidateManuscriptScenePlan(plan, current))
  ]);
  equal(adapter.files.length, 1); equal(adapter.files[0].markdown, plan.markdown); equal(JSON.stringify(adapter.current.orderedEntries), siblings);
});

test("delayed and structurally invalid recognition preserve the Scene", async () => {
  for (const status of ["recognition-delayed", "structurally-invalid"] as const) {
    const adapter = new Adapter(); adapter.recognition = status;
    const result = await executeManuscriptNoteCreation(adapter, preview().path, (current) => revalidateManuscriptScenePlan(preview(), current));
    equal(result.status, status); equal(adapter.files.length, 1); equal(adapter.cleanup, 0);
  }
});
