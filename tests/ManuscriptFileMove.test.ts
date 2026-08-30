import { deepEqual, equal, rejects } from "node:assert/strict";
import { test } from "node:test";
import {
  manuscriptFileDestination,
  ManuscriptFileMoveAdapter,
  ManuscriptFileMoveCollisionError,
  moveManuscriptFile
} from "../src/manuscript/ManuscriptFileMove";

class Vault implements ManuscriptFileMoveAdapter {
  readonly files = new Map<string, { parent: string; manuscript_order_key: string }>();
  failNextMove = false;
  failAfterNextMove = false;

  exists(path: string) { return this.files.has(path); }
  async move(beforePath: string, afterPath: string) {
    if (this.failNextMove) {
      this.failNextMove = false;
      throw new Error("simulated vault rename failure");
    }
    const frontmatter = this.files.get(beforePath);
    if (!frontmatter) throw new Error("missing source");
    if (this.files.has(afterPath)) throw new Error("adapter refused overwrite");
    this.files.delete(beforePath);
    this.files.set(afterPath, frontmatter);
    if (this.failAfterNextMove) {
      this.failAfterNextMove = false;
      throw new Error("simulated failure after vault rename");
    }
  }
}

const bookFolder = "Books/EMERGENCE";
const partA = `${bookFolder}/MISALIGNMENT`;
const partB = `${bookFolder}/HIVE MINDS`;
const name = "Machine Ecology (revised!).md";

async function reparentAndUndo(sourceFolder: string, targetFolder: string) {
  const vault = new Vault();
  const source = manuscriptFileDestination(sourceFolder, name);
  const destination = manuscriptFileDestination(targetFolder, name);
  const before = { parent: `[[${sourceFolder}]]`, manuscript_order_key: "000000000A" };
  vault.files.set(source, { ...before });

  const metadata = vault.files.get(source)!;
  metadata.parent = `[[${targetFolder}]]`;
  metadata.manuscript_order_key = "000000000Z";
  await moveManuscriptFile(vault, source, destination);

  equal(vault.exists(source), false, "the source is removed");
  equal(vault.exists(destination), true, "one file exists at the destination");
  deepEqual(vault.files.get(destination), {
    parent: `[[${targetFolder}]]`, manuscript_order_key: "000000000Z"
  });

  await moveManuscriptFile(vault, destination, source);
  Object.assign(vault.files.get(source)!, before);
  equal(vault.exists(destination), false, "Undo removes the destination");
  deepEqual(vault.files.get(source), before, "Undo restores path and ordering metadata");
}

test("Part A to Part B moves the Scene and Undo restores it", async () => {
  await reparentAndUndo(partA, partB);
});

test("Part to Book moves the Scene and Undo restores it", async () => {
  await reparentAndUndo(partA, bookFolder);
});

test("Book to Part moves the Scene and Undo restores it", async () => {
  await reparentAndUndo(bookFolder, partB);
});

test("a destination collision is rejected without overwriting or duplicating", async () => {
  const vault = new Vault();
  const source = `${partA}/${name}`; const destination = `${partB}/${name}`;
  vault.files.set(source, { parent: "old", manuscript_order_key: "A" });
  vault.files.set(destination, { parent: "unrelated", manuscript_order_key: "B" });
  await rejects(moveManuscriptFile(vault, source, destination), ManuscriptFileMoveCollisionError);
  equal(vault.files.size, 2); equal(vault.files.get(source)?.parent, "old");
  equal(vault.files.get(destination)?.parent, "unrelated");
});

test("a vault move failure leaves the original path and metadata unchanged", async () => {
  const vault = new Vault(); const source = `${partA}/${name}`; const destination = `${partB}/${name}`;
  const before = { parent: `[[${partA}]]`, manuscript_order_key: "000000000A" };
  vault.files.set(source, { ...before }); vault.failNextMove = true;
  await rejects(moveManuscriptFile(vault, source, destination), /simulated vault rename failure/);
  equal(vault.exists(destination), false); deepEqual(vault.files.get(source), before);
});

test("a rename that reports failure after moving is restored to the source", async () => {
  const vault = new Vault(); const source = `${partA}/${name}`; const destination = `${partB}/${name}`;
  const before = { parent: `[[${partA}]]`, manuscript_order_key: "000000000A" };
  vault.files.set(source, { ...before }); vault.failAfterNextMove = true;
  await rejects(moveManuscriptFile(vault, source, destination), /failure after vault rename/);
  equal(vault.exists(destination), false); deepEqual(vault.files.get(source), before);
});

test("a same-path move is a safe no-op", async () => {
  const vault = new Vault(); const path = `${partA}/${name}`;
  vault.files.set(path, { parent: "same", manuscript_order_key: "A" });
  await moveManuscriptFile(vault, path, path);
  equal(vault.files.size, 1);
});
