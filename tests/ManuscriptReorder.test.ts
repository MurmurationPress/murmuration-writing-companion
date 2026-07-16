import { deepEqual, equal, match } from "node:assert/strict";
import { test } from "node:test";
import type { ManuscriptDocumentRecord } from "../src/manuscript/ManuscriptOrder";
import {
  manuscriptOrderReferences,
  proposeManuscriptMove,
  siblingMoveRequest
} from "../src/manuscript/ManuscriptReorder";

const bookPath = "Books/PLURALITY.md";

function record(
  path: string,
  title: string,
  kind: ManuscriptDocumentRecord["kind"],
  parentPath: string | null
): ManuscriptDocumentRecord {
  return {
    path,
    basename: path.split("/").pop()!.replace(/\.md$/i, ""),
    title,
    kind,
    bookPath,
    parentPath
  };
}

const absence = record("Books/PLURALITY/1 ABSENCE.md", "ABSENCE", "part", bookPath);
const domestic = record(
  "Books/PLURALITY/1 ABSENCE/1 Domestic Distance.md",
  "Domestic Distance",
  "scene",
  absence.path
);
const wilderness = record(
  "Books/PLURALITY/1 ABSENCE/2 Tobias in the Wilderness.md",
  "Tobias in the Wilderness",
  "scene",
  absence.path
);
const experiment = record("Books/PLURALITY/2 EXPERIMENT.md", "EXPERIMENT", "part", bookPath);
const monitoring = record(
  "Books/PLURALITY/2 EXPERIMENT/1 JANUS Monitoring.md",
  "JANUS Monitoring",
  "scene",
  experiment.path
);
const prime = record(
  "Books/PLURALITY/2 EXPERIMENT/2 Prime Without Interpreter.md",
  "Prime Without Interpreter",
  "scene",
  experiment.path
);
const prologue = record("Books/PLURALITY/0 Prologue.md", "Prologue", "scene", bookPath);

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

test("moves a scene across parts and records one parent change", () => {
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
  equal(
    proposal.entries.find((entry) => entry.path === wilderness.path)?.parentPath,
    experiment.path
  );
  deepEqual(proposal.entries.map((entry) => entry.title), [
    "Prologue",
    "ABSENCE",
    "Domestic Distance",
    "EXPERIMENT",
    "JANUS Monitoring",
    "Prime Without Interpreter",
    "Tobias in the Wilderness"
  ]);
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
  equal(
    proposal.entries.find((entry) => entry.path === monitoring.path)?.parentPath,
    bookPath
  );
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

test("builds canonical path-qualified order references", () => {
  deepEqual(manuscriptOrderReferences([absence, domestic]), [
    "[[Books/PLURALITY/1 ABSENCE]]",
    "[[Books/PLURALITY/1 ABSENCE/1 Domestic Distance]]"
  ]);
});

test("builds keyboard sibling requests without crossing parents", () => {
  deepEqual(siblingMoveRequest(bookPath, entries, wilderness.path, -1), {
    movedPath: wilderness.path,
    targetPath: domestic.path,
    position: "before"
  });
  equal(siblingMoveRequest(bookPath, entries, domestic.path, -1), null);
  deepEqual(siblingMoveRequest(bookPath, entries, absence.path, 1), {
    movedPath: absence.path,
    targetPath: experiment.path,
    position: "after"
  });
});
