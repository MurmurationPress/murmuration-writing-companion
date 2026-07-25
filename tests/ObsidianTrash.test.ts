import { equal } from "node:assert/strict";
import { test } from "node:test";
import {
  classifyObsidianRename,
  isObsidianTrashPath,
  shouldMigrateEditorialPathForRename
} from "../src/ObsidianTrash";

const SCENE = "Books/FEVER/Part One/Middle.md";
const TRASH = ".trash/Books/FEVER/Part One/Middle.md";

test("moving a manuscript Scene into Obsidian local trash is unmanaged deletion", () => {
  equal(classifyObsidianRename(SCENE, TRASH), "trash-delete");
});

test("editorial identity is not migrated into .trash", () => {
  equal(shouldMigrateEditorialPathForRename(SCENE, TRASH), false);
});

test("the trash copy is excluded from manuscript recognition and sequence projection", () => {
  equal(isObsidianTrashPath(TRASH), true);
  equal(isObsidianTrashPath(SCENE), false);
});

test("moving from .trash to the original path is restoration", () => {
  equal(classifyObsidianRename(TRASH, SCENE), "trash-restore");
  equal(shouldMigrateEditorialPathForRename(TRASH, SCENE), false);
});

test("same original path remains the identity reconnection point", () => {
  equal(classifyObsidianRename(TRASH, SCENE), "trash-restore");
  equal(SCENE, "Books/FEVER/Part One/Middle.md");
});

test("ordinary non-trash rename remains identity-preserving migration", () => {
  const renamed = "Books/FEVER/Part One/Middle Revised.md";
  equal(classifyObsidianRename(SCENE, renamed), "ordinary");
  equal(shouldMigrateEditorialPathForRename(SCENE, renamed), true);
});
