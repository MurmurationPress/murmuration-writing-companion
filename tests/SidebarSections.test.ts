import {
  deepEqual,
  equal,
  notEqual
} from "node:assert/strict";
import { test } from "node:test";
import {
  buildChapterContextSummary,
  buildChapterNoteSummary,
  createSidebarSectionPreferenceKey,
  DEFAULT_SIDEBAR_SECTION_STATE,
  parseSidebarSectionState,
  SidebarPreferenceStorage,
  SidebarSectionPreferences
} from "../src/companion/SidebarSections";

class MemoryStorage implements SidebarPreferenceStorage {
  readonly values = new Map<string, string>();
  writes = 0;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes += 1;
    this.values.set(key, value);
  }
}

class ThrowingStorage implements SidebarPreferenceStorage {
  getItem(): string | null {
    throw new Error("Unavailable");
  }

  setItem(): void {
    throw new Error("Unavailable");
  }
}

test("uses quiet sidebar defaults when no preference exists", () => {
  deepEqual(parseSidebarSectionState(null), DEFAULT_SIDEBAR_SECTION_STATE);
  equal(DEFAULT_SIDEBAR_SECTION_STATE.chapterContext, true);
  equal(DEFAULT_SIDEBAR_SECTION_STATE.editorialPasses, false);
  equal(DEFAULT_SIDEBAR_SECTION_STATE.chapterNotes, true);
});

test("parses valid partial preferences without trusting malformed values", () => {
  deepEqual(
    parseSidebarSectionState(JSON.stringify({
      version: 1,
      expanded: {
        chapterContext: false,
        editorialPasses: true,
        chapterNotes: "closed",
        futureSection: false
      }
    })),
    {
      chapterContext: false,
      editorialPasses: true,
      chapterNotes: true
    }
  );

  deepEqual(
    parseSidebarSectionState("{ malformed"),
    DEFAULT_SIDEBAR_SECTION_STATE
  );
  deepEqual(
    parseSidebarSectionState(JSON.stringify({
      version: 2,
      expanded: { chapterContext: false }
    })),
    DEFAULT_SIDEBAR_SECTION_STATE
  );
});

test("persists each section independently and restores it on reload", () => {
  const storage = new MemoryStorage();
  const key = "test-sidebar";
  const preferences = new SidebarSectionPreferences(storage, key);

  equal(preferences.setExpanded("chapterContext", false), true);
  equal(preferences.setExpanded("editorialPasses", true), true);
  equal(preferences.setExpanded("chapterNotes", false), true);
  equal(preferences.setExpanded("chapterNotes", false), false);
  equal(storage.writes, 3);

  deepEqual(preferences.snapshot(), {
    chapterContext: false,
    editorialPasses: true,
    chapterNotes: false
  });

  const reloaded = new SidebarSectionPreferences(storage, key);
  deepEqual(reloaded.snapshot(), preferences.snapshot());
});

test("keeps in-memory section state when browser storage is unavailable", () => {
  const preferences = new SidebarSectionPreferences(
    new ThrowingStorage(),
    "unavailable"
  );

  deepEqual(preferences.snapshot(), DEFAULT_SIDEBAR_SECTION_STATE);
  equal(preferences.setExpanded("chapterNotes", false), true);
  equal(preferences.isExpanded("chapterNotes"), false);
});

test("creates stable preference keys isolated by vault resource root", () => {
  const first = createSidebarSectionPreferenceKey(
    "murmuration-writing-companion",
    "Codex Press",
    "app://local/home/ted/Documents/Codex%20Press/"
  );
  const repeated = createSidebarSectionPreferenceKey(
    "murmuration-writing-companion",
    "Codex Press",
    "app://local/home/ted/Documents/Codex%20Press/"
  );
  const secondVault = createSidebarSectionPreferenceKey(
    "murmuration-writing-companion",
    "Codex Press",
    "app://local/home/ted/Archive/Codex%20Press/"
  );

  equal(first, repeated);
  notEqual(first, secondVault);
});

test("builds a concise Chapter Context summary from authoritative properties", () => {
  equal(
    buildChapterContextSummary(
      {
        title: "Convergence",
        POV: "[[Pip Hale|Pip]]",
        story_date: "2029-04-22",
        chapter_status: "complete",
        editorial_pass: "proof",
        change_summary: "Not included in the compact summary."
      },
      "en-GB"
    ),
    "Pip · 22 Apr 2029 · Complete · Proof"
  );

  equal(
    buildChapterContextSummary({ status: "copy edit" }, "en-GB"),
    "copy edit"
  );
  equal(buildChapterContextSummary(undefined, "en-GB"), "No chapter context");
});

test("builds one-line Chapter Note previews without leaking excess height", () => {
  equal(buildChapterNoteSummary("  First line\n\nSecond line  "), "First line Second line");
  equal(buildChapterNoteSummary("This is a long note", 12), "This is a l…");
  equal(buildChapterNoteSummary("Anything", 1), "…");
  equal(buildChapterNoteSummary("   \n "), "");
});
