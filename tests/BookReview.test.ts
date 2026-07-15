import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import type { PageEditorialNotes } from "../src/editorial/EditorialNote";
import {
  getBookHierarchyReferences,
  getBookReviewMode,
  getBookReviewStatusOptions,
  getBookReviewStatusValue,
  isBookFrontmatter,
  setBookReviewMode,
  updateBookReviewStatusFrontmatter
} from "../src/editorial/BookReview";

function page(): PageEditorialNotes {
  return {
    chapterNote: { body: "", created: "now", updated: "now" },
    annotations: []
  };
}

test("recognises explicit book notes and hierarchy references", () => {
  equal(isBookFrontmatter({ "Document Type": "Book" }), true);
  equal(isBookFrontmatter({ type: "chapter" }), false);
  deepEqual(
    getBookHierarchyReferences({ book: "[[PLURALITY]]", parent: ["[[Part One]]"] }),
    { bookReferences: ["[[PLURALITY]]"], parentReferences: ["[[Part One]]"] }
  );
});

test("stores one canonical review mode on the book editorial record", () => {
  const editorialPage = page();
  equal(setBookReviewMode(editorialPage, "continuity"), true);
  equal(getBookReviewMode(editorialPage), "continuity");
  equal(setBookReviewMode(editorialPage, "continuity"), false);
  equal(setBookReviewMode(editorialPage, null), true);
  equal(getBookReviewMode(editorialPage), null);
});

test("preserves unknown review statuses until deliberately changed", () => {
  deepEqual(getBookReviewStatusOptions("paused"), [
    { value: "", label: "—" },
    { value: "paused", label: "paused (current)", preserved: true },
    { value: "not_started", label: "Not started" },
    { value: "in_progress", label: "In progress" },
    { value: "complete", label: "Complete" }
  ]);
});

test("writes status through an existing alias and removes duplicates", () => {
  const frontmatter: Record<string, unknown> = {
    "Book Review Status": "paused",
    review_status: "not_started",
    title: "PLURALITY"
  };

  updateBookReviewStatusFrontmatter(frontmatter, "in_progress");
  deepEqual(frontmatter, {
    "Book Review Status": "in_progress",
    title: "PLURALITY"
  });
  deepEqual(getBookReviewStatusValue(frontmatter), {
    property: "Book Review Status",
    value: "in_progress"
  });
});
