import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import type {
  EditorialStore,
  PageEditorialNotes
} from "../src/editorial/EditorialNote";
import {
  EDITORIAL_PASS_OPTIONS,
  ensureEditorialPassHistory,
  getEditorialPassChecklist,
  setEditorialPassCompleted
} from "../src/editorial/EditorialPass";
import {
  moveEditorialPage,
  parsePortableEditorialStore,
  serializePortableEditorialStore
} from "../src/editorial/PortableEditorialStorage";

const CHAPTER_PATH = "PRIME Trilogy/PLURALITY/PART ONE/Domestic Distance.md";
const COMPLETE_AT = "2029-01-12T10:00:00.000Z";
const REOPEN_AT = "2029-01-13T11:00:00.000Z";

function page(): PageEditorialNotes {
  return {
    chapterNote: {
      body: "",
      created: COMPLETE_AT,
      updated: COMPLETE_AT
    },
    annotations: []
  };
}

test("creates the canonical editorial checklist in workflow order", () => {
  const checklist = getEditorialPassChecklist(page());

  deepEqual(
    checklist.map((item) => item.key),
    [...EDITORIAL_PASS_OPTIONS]
  );
  deepEqual(
    checklist.map((item) => item.label),
    ["Draft", "Structure", "Character", "Dialogue", "Continuity", "Style", "Proof"]
  );
  equal(checklist.every((item) => !item.completed), true);
});

test("completes and reopens passes independently without erasing history", () => {
  const editorialPage = page();

  equal(
    setEditorialPassCompleted(
      editorialPage,
      "continuity",
      true,
      COMPLETE_AT,
      "event-complete"
    ),
    true
  );
  equal(
    setEditorialPassCompleted(
      editorialPage,
      "style",
      true,
      COMPLETE_AT,
      "event-style"
    ),
    true
  );
  equal(
    setEditorialPassCompleted(
      editorialPage,
      "continuity",
      false,
      REOPEN_AT,
      "event-reopen"
    ),
    true
  );

  const checklist = getEditorialPassChecklist(editorialPage);
  const continuity = checklist.find((item) => item.key === "continuity")!;
  const style = checklist.find((item) => item.key === "style")!;

  equal(continuity.completed, false);
  equal(continuity.completedAt, undefined);
  equal(continuity.lastChangedAt, REOPEN_AT);
  deepEqual(
    continuity.history.map((event) => [event.action, event.at]),
    [
      ["completed", COMPLETE_AT],
      ["reopened", REOPEN_AT]
    ]
  );
  equal(style.completed, true);
  equal(style.completedAt, COMPLETE_AT);
});

test("does not append duplicate state transitions", () => {
  const editorialPage = page();

  equal(
    setEditorialPassCompleted(
      editorialPage,
      "draft",
      true,
      COMPLETE_AT,
      "event-1"
    ),
    true
  );
  equal(
    setEditorialPassCompleted(
      editorialPage,
      "draft",
      true,
      REOPEN_AT,
      "event-2"
    ),
    false
  );
  equal(editorialPage.editorialPassHistory?.length, 1);

  editorialPage.editorialPassHistory?.push({
    id: "event-1",
    pass: "draft",
    action: "reopened",
    at: REOPEN_AT
  });

  const draft = getEditorialPassChecklist(editorialPage)[0];
  equal(draft.completed, true);
  equal(draft.history.length, 1);
});

test("migrates missing or malformed history without discarding original data", () => {
  const missing = page();
  equal(ensureEditorialPassHistory(missing), true);
  deepEqual(missing.editorialPassHistory, []);

  const malformed = {
    ...page(),
    editorialPassHistory: { legacy: "retain me" }
  } as unknown as PageEditorialNotes;

  equal(ensureEditorialPassHistory(malformed), true);
  deepEqual(malformed.editorialPassHistory, [{ legacy: "retain me" }]);
  equal(getEditorialPassChecklist(malformed).every((item) => !item.completed), true);

  setEditorialPassCompleted(
    malformed,
    "proof",
    true,
    COMPLETE_AT,
    "event-proof"
  );
  deepEqual(malformed.editorialPassHistory?.[0], { legacy: "retain me" });
  equal(malformed.editorialPassHistory?.length, 2);
});

test("keeps current frontmatter focus independent from completed-pass history", () => {
  const editorialPage = page();
  const frontmatter = { editorial_pass: "dialogue" };

  setEditorialPassCompleted(
    editorialPage,
    "continuity",
    true,
    COMPLETE_AT,
    "event-continuity"
  );

  deepEqual(frontmatter, { editorial_pass: "dialogue" });
  equal(
    getEditorialPassChecklist(editorialPage)
      .find((item) => item.key === "continuity")?.completed,
    true
  );
});

test("round trips pass history through portable storage and chapter moves", () => {
  const editorialPage = page();
  setEditorialPassCompleted(
    editorialPage,
    "structure",
    true,
    COMPLETE_AT,
    "event-structure"
  );

  const store: EditorialStore = {
    pages: {
      [CHAPTER_PATH]: editorialPage
    }
  };
  const serialized = serializePortableEditorialStore(store);
  const parsed = parsePortableEditorialStore(serialized, COMPLETE_AT).store;

  deepEqual(parsed.pages[CHAPTER_PATH].editorialPassHistory, [
    {
      id: "event-structure",
      pass: "structure",
      action: "completed",
      at: COMPLETE_AT
    }
  ]);

  const movedPath = "PRIME Trilogy/PLURALITY/PART ONE/Renamed Distance.md";
  equal(moveEditorialPage(parsed, CHAPTER_PATH, movedPath), true);
  equal(
    getEditorialPassChecklist(parsed.pages[movedPath])
      .find((item) => item.key === "structure")?.completed,
    true
  );
});
