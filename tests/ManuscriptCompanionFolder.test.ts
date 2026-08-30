import { equal, rejects } from "node:assert/strict";
import { test } from "node:test";
import {
  cleanupManuscriptCompanionFolder,
  createManuscriptCompanionFolder,
  ManuscriptCompanionFolderAdapter,
  ManuscriptCompanionFolderCollisionError
} from "../src/manuscript/ManuscriptCompanionFolder";

interface Entry { readonly kind: "file" | "folder"; children: string[] }
class Vault implements ManuscriptCompanionFolderAdapter<Entry> {
  readonly entries = new Map<string, Entry>(); failCreate = false;
  current(path: string) { return this.entries.get(path) ?? null; }
  kind(entry: Entry) { return entry.kind; }
  async create(path: string) {
    if (this.failCreate) throw new Error("simulated folder failure");
    const entry: Entry = { kind: "folder", children: [] }; this.entries.set(path, entry); return entry;
  }
  isEmpty(entry: Entry) { return entry.children.length === 0; }
  async remove(entry: Entry) { for (const [path, candidate] of this.entries) if (candidate === entry) this.entries.delete(path); }
}

const path = "Books/EMERGENCE/HIVE MINDS (II)!";

test("creates the exact companion folder and safely rolls it back while empty", async () => {
  const vault = new Vault(); const created = await createManuscriptCompanionFolder(vault, path);
  equal(vault.current(path), created.handle);
  equal(await cleanupManuscriptCompanionFolder(vault, created), true);
  equal(vault.current(path), null);
});

test("file and folder collisions are rejected without overwriting", async () => {
  for (const kind of ["file", "folder"] as const) {
    const vault = new Vault(); const existing: Entry = { kind, children: [] }; vault.entries.set(path, existing);
    await rejects(createManuscriptCompanionFolder(vault, path), ManuscriptCompanionFolderCollisionError);
    equal(vault.current(path), existing);
  }
});

test("creation failure leaves no companion folder", async () => {
  const vault = new Vault(); vault.failCreate = true;
  await rejects(createManuscriptCompanionFolder(vault, path), /simulated folder failure/);
  equal(vault.current(path), null);
});

test("rollback preserves a folder containing newly added content", async () => {
  const vault = new Vault(); const created = await createManuscriptCompanionFolder(vault, path);
  created.handle.children.push("User note.md");
  equal(await cleanupManuscriptCompanionFolder(vault, created), false);
  equal(vault.current(path), created.handle);
});

test("rollback never removes a replacement folder", async () => {
  const vault = new Vault(); const created = await createManuscriptCompanionFolder(vault, path);
  const replacement: Entry = { kind: "folder", children: [] }; vault.entries.set(path, replacement);
  equal(await cleanupManuscriptCompanionFolder(vault, created), false);
  equal(vault.current(path), replacement);
});
