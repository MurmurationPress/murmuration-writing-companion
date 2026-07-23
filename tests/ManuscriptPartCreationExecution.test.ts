import { equal, match } from "node:assert/strict";
import { test } from "node:test";
import { evenlySpacedManuscriptOrderKeys } from "../src/manuscript/ManuscriptOrderKey";
import { ManuscriptPartCreationSnapshot, planManuscriptPartCreation, revalidateManuscriptPartPlan } from "../src/manuscript/ManuscriptPartCreation";
import { executeManuscriptNoteCreation, InvalidManuscriptNoteConfirmationError, ManuscriptNoteCreationAdapter } from "../src/manuscript/ManuscriptNoteCreationExecution";

interface Handle { path: string; markdown: string }
const bookPath = "Books/Book 4.md";
const [firstKey, secondKey] = evenlySpacedManuscriptOrderKeys(2);

function snapshot(): ManuscriptPartCreationSnapshot {
  return {
    selectedBookPath: bookPath, selectionRevision: 1,
    book: { path: bookPath, title: "Book 4", source: "distributed", diagnostics: [] },
    directChildren: [
      { path: "Books/One.md", title: "One", kind: "scene", parentPath: bookPath, orderKey: firstKey },
      { path: "Books/Two.md", title: "Two", kind: "part", parentPath: bookPath, orderKey: secondKey }
    ],
    parts: [{ path: "Books/Two.md", title: "Two", bookPath }],
    entries: [{ path: "Books", kind: "folder" }], associatedBookFolder: null
  };
}

class Adapter implements ManuscriptNoteCreationAdapter<Handle, ManuscriptPartCreationSnapshot> {
  current = snapshot(); files: Handle[] = []; folders: string[] = []; cleanup = 0;
  recognition: "recognised" | "recognition-delayed" | "structurally-invalid" = "recognised";
  gate: Promise<void> | null = null;
  snapshot() { return this.current; }
  async createFolder(path: string) { this.folders.push(path); this.current = { ...this.current, entries: [...this.current.entries, { path, kind: "folder" }] }; }
  async createFile(path: string, markdown: string) { if (this.gate) await this.gate; const handle = { path, markdown }; this.files.push(handle); return handle; }
  async readFile(handle: Handle) { return handle.markdown; }
  async cleanupReadBackMismatch() { this.cleanup += 1; }
  async waitForRecognition() { return this.recognition; }
}

function preview() {
  return planManuscriptPartCreation(snapshot(), { title: "FEVER", path: "Books/FEVER.md", placementId: "after:Books/One.md" });
}

test("stale Part confirmation writes nothing", async () => {
  const plan = preview(); const adapter = new Adapter();
  adapter.current = { ...adapter.current, directChildren: [adapter.current.directChildren[1], adapter.current.directChildren[0]] };
  await executeManuscriptNoteCreation(adapter, plan.path, (current) => revalidateManuscriptPartPlan(plan, current)).then(
    () => { throw new Error("Expected stale plan"); },
    (error) => equal(error instanceof InvalidManuscriptNoteConfirmationError, true)
  );
  equal(adapter.files.length, 0);
});

test("double submit creates one exact Part note and no sibling writes", async () => {
  const plan = preview(); const adapter = new Adapter();
  const before = JSON.stringify(adapter.current.directChildren);
  await Promise.all([
    executeManuscriptNoteCreation(adapter, plan.path, (current) => revalidateManuscriptPartPlan(plan, current)),
    executeManuscriptNoteCreation(adapter, plan.path, (current) => revalidateManuscriptPartPlan(plan, current))
  ]);
  equal(adapter.files.length, 1);
  equal(adapter.files[0].markdown, plan.markdown);
  equal(JSON.stringify(adapter.current.directChildren), before);
});

test("delayed or structurally incorrect recognition preserves the Part", async () => {
  for (const status of ["recognition-delayed", "structurally-invalid"] as const) {
    const plan = preview(); const adapter = new Adapter(); adapter.recognition = status;
    const result = await executeManuscriptNoteCreation(adapter, plan.path, (current) => revalidateManuscriptPartPlan(plan, current));
    equal(result.status, status); equal(adapter.files.length, 1); equal(adapter.cleanup, 0);
  }
});

test("explicit missing-folder creation precedes exact note creation", async () => {
  const initial = { ...snapshot(), entries: [] };
  const plan = planManuscriptPartCreation(initial, { title: "FEVER", path: "Books/Future/FEVER.md", placementId: "after:Books/One.md" });
  const adapter = new Adapter(); adapter.current = initial;
  await executeManuscriptNoteCreation(adapter, plan.path, (current) => revalidateManuscriptPartPlan(plan, current));
  equal(adapter.folders.join("|"), "Books|Books/Future"); equal(adapter.files.length, 1);
});

test("unsafe structure fails before folder or note writes", async () => {
  const plan = preview(); const adapter = new Adapter();
  adapter.current = { ...adapter.current, book: { ...adapter.current.book!, diagnostics: [{ kind: "duplicate_order_key", message: "unsafe" }] } };
  await executeManuscriptNoteCreation(adapter, plan.path, (current) => revalidateManuscriptPartPlan(plan, current)).catch((error) => match(String(error), /Reconcile/));
  equal(adapter.folders.length, 0); equal(adapter.files.length, 0);
});
