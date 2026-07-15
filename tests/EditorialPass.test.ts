import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import type {
  EditorialStore,
  PageEditorialNotes
} from "../src/editorial/EditorialNote";
import {
  EDITORIAL_PASS_OPTIONS,
  buildEditorialPassProjection,
  ensureEditorialPassFrontier,
  ensureEditorialPassHistory,
  getEditorialPassChecklist,
  getEditorialPassFrontier,
  setEditorialPassCompleted,
  setEditorialPassFrontier
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

test("creates the canonical ordered editorial progression", () => {
  const checklist = getEditorialPassChecklist(page());

  deepEqual(checklist.map((item) => item.key), [...EDITORIAL_PASS_OPTIONS]);
  deepEqual(
    checklist.map((item) => item.label),
    ["Draft", "Structure", "Character", "Dialogue", "Continuity", "Style", "Proof"]
  );
  equal(checklist.every((item) => !item.completed), true);
});

test("advances directly to a frontier and infers preceding passes", () => {
  const editorialPage = page();

  equal(
    setEditorialPassFrontier(
      editorialPage,
      "continuity",
      COMPLETE_AT,
      "event-continuity"
    ),
    true
  );

  const checklist = getEditorialPassChecklist(editorialPage);
  deepEqual(
    checklist.map((item) => [item.key, item.completed, item.inferred, item.frontier]),
    [
      ["draft", true, true, false],
      ["structure", true, true, false],
      ["character", true, true, false],
      ["dialogue", true, true, false],
      ["continuity", true, false, true],
      ["style", false, false, false],
      ["proof", false, false, false]
    ]
  );
  equal(editorialPage.editorialPassHistory?.length, 1);
});

test("moves the frontier backwards without deleting history", () => {
  const editorialPage = page();
  setEditorialPassFrontier(
    editorialPage,
    "continuity",
    COMPLETE_AT,
    "event-continuity"
  );

  equal(
    setEditorialPassFrontier(
      editorialPage,
      "structure",
      REOPEN_AT,
      "event-reopen"
    ),
    true
  );

  equal(getEditorialPassFrontier(editorialPage), "structure");
  deepEqual(
    editorialPage.editorialPassHistory?.map((event) => {
      const value = event as { action?: unknown; pass?: unknown };
      return [value.action, value.pass];
    }),
    [
      ["completed", "continuity"],
      ["reopened", "continuity"]
    ]
  );
});

test("reopening a pass moves to its immediately preceding pass", () => {
  const editorialPage = page();
  setEditorialPassFrontier(
    editorialPage,
    "continuity",
    COMPLETE_AT,
    "event-continuity"
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
  equal(getEditorialPassFrontier(editorialPage), "dialogue");
});

test("migrates legacy history to the furthest completed pass", () => {
  const editorialPage = page();
  editorialPage.editorialPassHistory = [
    { id: "draft", pass: "draft", action: "completed", at: COMPLETE_AT },
    { id: "style", pass: "style", action: "completed", at: COMPLETE_AT },
    { id: "continuity", pass: "continuity", action: "reopened", at: REOPEN_AT }
  ];

  deepEqual(ensureEditorialPassFrontier(editorialPage), {
    changed: true,
    frontier: "style",
    source: "history"
  });
  equal(getEditorialPassFrontier(editorialPage), "style");
});

test("seeds recognised frontmatter without inventing history", () => {
  const editorialPage = page();

  deepEqual(ensureEditorialPassFrontier(editorialPage, "Continuity"), {
    changed: true,
    frontier: "continuity",
    source: "frontmatter"
  });
  deepEqual(editorialPage.editorialPassHistory, undefined);
});

test("preserves malformed history while adding managed events", () => {
  const editorialPage = {
    ...page(),
    editorialPassHistory: { legacy: "retain me" }
  } as unknown as PageEditorialNotes;

  equal(ensureEditorialPassHistory(editorialPage), true);
  deepEqual(editorialPage.editorialPassHistory, [{ legacy: "retain me" }]);

  setEditorialPassFrontier(
    editorialPage,
    "proof",
    COMPLETE_AT,
    "event-proof"
  );
  deepEqual(editorialPage.editorialPassHistory?.[0], { legacy: "retain me" });
  equal(editorialPage.editorialPassHistory?.length, 2);
});

test("reports projection mismatches without silently rewriting Markdown", () => {
  const editorialPage = page();
  ensureEditorialPassFrontier(editorialPage, "continuity");

  equal(buildEditorialPassProjection(editorialPage, "continuity").status, "match");
  equal(buildEditorialPassProjection(editorialPage, "").status, "missing");
  equal(buildEditorialPassProjection(editorialPage, "style").status, "mismatch");
  equal(buildEditorialPassProjection(editorialPage, "line edit").status, "unknown");
});

test("round trips frontier and history through portable storage and chapter moves", () => {
  const editorialPage = page();
  setEditorialPassFrontier(
    editorialPage,
    "structure",
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

  equal(parsed.pages[CHAPTER_PATH].editorialPassFrontier, "structure");
  equal(getEditorialPassFrontier(parsed.pages[CHAPTER_PATH]), "structure");

  const movedPath = "PRIME Trilogy/PLURALITY/PART ONE/Renamed Distance.md";
  equal(moveEditorialPage(parsed, CHAPTER_PATH, movedPath), true);
  equal(getEditorialPassFrontier(parsed.pages[movedPath]), "structure");
});
