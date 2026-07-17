import { deepEqual, equal, match, notEqual } from "node:assert/strict";
import { test } from "node:test";
import type { ManuscriptDocumentRecord } from "../src/manuscript/ManuscriptOrder";
import { evenlySpacedManuscriptOrderKeys } from "../src/manuscript/ManuscriptOrderKey";
import {
  manuscriptOrderReferences,
  planDistributedManuscriptMoveWrites,
  proposeManuscriptMove,
  siblingMoveRequest
} from "../src/manuscript/ManuscriptReorder";

const bookPath = "Books/PLURALITY.md";

function record(
  path: string,
  title: string,
  kind: ManuscriptDocumentRecord["kind"],
  parentPath: string | null,
  orderKey: string
): ManuscriptDocumentRecord {
  return {
    path,
    basename: path.split("/").pop()!.replace(/\.md$/i, ""),
    title,
    kind,
    bookPath,
    parentPath,
    orderKey,
    orderKeyPresent: true,
    explicitParent: true,
    parentReferenceInvalid: false
  };
}

const rootKeys = evenlySpacedManuscriptOrderKeys(3);
const absenceKeys = evenlySpacedManuscriptOrderKeys(2);
const experimentKeys = evenlySpacedManuscriptOrderKeys(2);

const prologue = record("Books/PLURALITY/0 Prologue.md", "Prologue", "scene", bookPath, rootKeys[0]);
const absence = record("Books/PLURALITY/1 ABSENCE.md", "ABSENCE", "part", bookPath, rootKeys[1]);
const domestic = record(
  "Books/PLURALITY/1 ABSENCE/1 Domestic Distance.md",
  "Domestic Distance",
  "scene",
  absence.path,
  absenceKeys[0]
);
const wilderness = record(
  "Books/PLURALITY/1 ABSENCE/2 Tobias in the Wilderness.md",
  "Tobias in the Wilderness",
  "scene",
  absence.path,
  absenceKeys[1]
);
const experiment = record("Books/PLURALITY/2 EXPERIMENT.md", "EXPERIMENT", "part", bookPath, rootKeys[2]);
const monitoring = record(
  "Books/PLURALITY/2 EXPERIMENT/1 JANUS Monitoring.md",
  "JANUS Monitoring",
  "scene",
  experiment.path,
  experimentKeys[0]
);
const prime = record(
  "Books/PLURALITY/2 EXPERIMENT/2 Prime Without Interpreter.md",
  "Prime Without Interpreter",
  "scene",
  experiment.path,
  experimentKeys[1]
);

const entries = [
  prologue,
  absence,
  domestic,
  wilderness,
  experiment,
  monitoring,
  prime
];

test("reorders scenes within one part without changing parent", () => {
  const proposal = proposeManuscriptMove(bookPath, entries, {
    movedPath: wilderness.path,
    targetPath: domestic.path,
    position: "before"
  });

  equal(proposal.valid, true);
  equal(proposal.movedPath, wilderness.path);
  equal(proposal.parentChange, null);
  deepEqual(proposal.entries.map((entry) => entry.title), [
    "Prologue",
    "ABSENCE",
    "Tobias in the Wilderness",
    "Domestic Distance",
    "EXPERIMENT",
    "JANUS Monitoring",
    "Prime Without Interpreter"
  ]);
});

test("plans an ordinary reorder as one moved-note write", () => {
  const proposal = proposeManuscriptMove(bookPath, entries, {
    movedPath: wilderness.path,
    targetPath: domestic.path,
    position: "before"
  });
  const writes = planDistributedManuscriptMoveWrites(bookPath, proposal);

  equal(writes.valid, true);
  equal(writes.rebalanced, false);
  equal(writes.changes.length, 1);
  equal(writes.changes[0].path, wilderness.path);
  equal(writes.changes[0].beforeParentPath, absence.path);
  equal(writes.changes[0].afterParentPath, absence.path);
  notEqual(writes.changes[0].beforeOrderKey, writes.changes[0].afterOrderKey);
});

test("moves a scene across parts and writes parent plus key on that scene", () => {
  const proposal = proposeManuscriptMove(bookPath, entries, {
    movedPath: wilderness.path,
    targetPath: experiment.path,
    position: "inside-end"
  });

  equal(proposal.valid, true);
  deepEqual(proposal.parentChange, {
    path: wilderness.path,
    beforeParentPath: absence.path,
    afterParentPath: experiment.path
  });
  deepEqual(proposal.entries.map((entry) => entry.title), [
    "Prologue",
    "ABSENCE",
    "Domestic Distance",
    "EXPERIMENT",
    "JANUS Monitoring",
    "Prime Without Interpreter",
    "Tobias in the Wilderness"
  ]);

  const writes = planDistributedManuscriptMoveWrites(bookPath, proposal);
  equal(writes.valid, true);
  equal(writes.rebalanced, false);
  deepEqual(writes.changes.map((change) => change.path), [wilderness.path]);
  equal(writes.changes[0].afterParentPath, experiment.path);
});

test("moves a complete part while preserving contained scene order", () => {
  const proposal = proposeManuscriptMove(bookPath, entries, {
    movedPath: experiment.path,
    targetPath: absence.path,
    position: "before"
  });

  equal(proposal.valid, true);
  equal(proposal.parentChange, null);
  deepEqual(proposal.entries.map((entry) => entry.title), [
    "Prologue",
    "EXPERIMENT",
    "JANUS Monitoring",
    "Prime Without Interpreter",
    "ABSENCE",
    "Domestic Distance",
    "Tobias in the Wilderness"
  ]);
  deepEqual(
    planDistributedManuscriptMoveWrites(bookPath, proposal).changes.map((change) => change.path),
    [experiment.path]
  );
});

test("allows a scene to become a direct child of the book", () => {
  const proposal = proposeManuscriptMove(bookPath, entries, {
    movedPath: monitoring.path,
    targetPath: prologue.path,
    position: "after"
  });

  equal(proposal.valid, true);
  deepEqual(proposal.parentChange, {
    path: monitoring.path,
    beforeParentPath: experiment.path,
    afterParentPath: bookPath
  });
  const writes = planDistributedManuscriptMoveWrites(bookPath, proposal);
  equal(writes.changes.length, 1);
  equal(writes.changes[0].path, monitoring.path);
  equal(writes.changes[0].afterParentPath, bookPath);
});

test("rebalances only the destination sibling set when no key gap remains", () => {
  const first = record("Books/PLURALITY/A.md", "A", "scene", bookPath, "000000000A");
  const second = record("Books/PLURALITY/B.md", "B", "scene", bookPath, "000000000B");
  const third = record("Books/PLURALITY/C.md", "C", "scene", bookPath, "000000000C");
  const proposal = proposeManuscriptMove(bookPath, [first, second, third], {
    movedPath: third.path,
    targetPath: second.path,
    position: "before"
  });
  const writes = planDistributedManuscriptMoveWrites(bookPath, proposal);

  equal(writes.valid, true);
  equal(writes.rebalanced, true);
  deepEqual(new Set(writes.changes.map((change) => change.path)), new Set([
    first.path,
    second.path,
    third.path
  ]));
});

test("rejects moving a part beneath one of its scenes", () => {
  const proposal = proposeManuscriptMove(bookPath, entries, {
    movedPath: absence.path,
    targetPath: domestic.path,
    position: "after"
  });

  equal(proposal.valid, false);
  match(proposal.message, /descendant/i);
  deepEqual(proposal.entries, entries);
});

test("rejects dropping a part inside another part", () => {
  const proposal = proposeManuscriptMove(bookPath, entries, {
    movedPath: absence.path,
    targetPath: experiment.path,
    position: "inside-end"
  });

  equal(proposal.valid, false);
  match(proposal.message, /only scenes/i);
});

test("retains path-qualified legacy order references for migration tooling", () => {
  deepEqual(manuscriptOrderReferences([absence, domestic]), [
    "[[Books/PLURALITY/1 ABSENCE]]",
    "[[Books/PLURALITY/1 ABSENCE/1 Domestic Distance]]"
  ]);
});

test("builds keyboard sibling requests across root parts and scenes", () => {
  deepEqual(siblingMoveRequest(bookPath, entries, wilderness.path, -1), {
    movedPath: wilderness.path,
    targetPath: domestic.path,
    position: "before"
  });
  equal(siblingMoveRequest(bookPath, entries, domestic.path, -1), null);
  deepEqual(siblingMoveRequest(bookPath, entries, absence.path, -1), {
    movedPath: absence.path,
    targetPath: prologue.path,
    position: "before"
  });
  deepEqual(siblingMoveRequest(bookPath, entries, absence.path, 1), {
    movedPath: absence.path,
    targetPath: experiment.path,
    position: "after"
  });
});
