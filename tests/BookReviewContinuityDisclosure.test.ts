import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  bookReviewContinuityIndicator,
  bookReviewToggleAriaLabel,
  BookReviewContinuityDisclosure
} from "../src/companion/BookReviewContinuityDisclosure";

test("collapsed Book Review with findings keeps a compact count", () => {
  const disclosure = new BookReviewContinuityDisclosure();
  disclosure.present("Book.md", 2);
  disclosure.setBookReviewExpanded("Book.md", false);
  deepEqual(disclosure.present("Book.md", 2), {
    count: 2,
    reviewedCount: 0,
    indicator: "Continuity 2",
    bookReviewExpanded: false,
    continuityExpanded: true
  });
});

test("no findings has no indicator", () => {
  const disclosure = new BookReviewContinuityDisclosure();
  equal(disclosure.present("Book.md", 0).indicator, "");
  equal(bookReviewContinuityIndicator(0), "");
});

test("reviewed-only findings use a non-warning compact indicator", () => {
  const disclosure = new BookReviewContinuityDisclosure();
  const presentation = disclosure.present("Book.md", 0, 2);
  equal(presentation.indicator, "Reviewed 2");
  equal(presentation.bookReviewExpanded, false);
  equal(bookReviewContinuityIndicator(0, 2), "Reviewed 2");
});

test("finding count updates without changing disclosure choice", () => {
  const disclosure = new BookReviewContinuityDisclosure();
  disclosure.present("Book.md", 1);
  disclosure.setBookReviewExpanded("Book.md", false);
  equal(disclosure.present("Book.md", 3).indicator, "Continuity 3");
  equal(disclosure.present("Book.md", 3).bookReviewExpanded, false);
  equal(disclosure.present("Book.md", 0).indicator, "");
});

test("manual collapse is respected after the initial reveal", () => {
  const disclosure = new BookReviewContinuityDisclosure();
  const first = disclosure.present("Book.md", 1);
  equal(first.bookReviewExpanded, true);
  equal(first.continuityExpanded, true);

  disclosure.setBookReviewExpanded("Book.md", false);
  disclosure.setContinuityExpanded("Book.md", false);
  const refreshed = disclosure.present("Book.md", 2);
  equal(refreshed.bookReviewExpanded, false);
  equal(refreshed.continuityExpanded, false);

  disclosure.present("Book.md", 0);
  const returned = disclosure.present("Book.md", 1);
  equal(returned.bookReviewExpanded, false);
  equal(returned.continuityExpanded, false);
});

test("presentation is independent per active book", () => {
  const disclosure = new BookReviewContinuityDisclosure();
  disclosure.present("One.md", 1);
  disclosure.setBookReviewExpanded("One.md", false);
  equal(disclosure.present("Two.md", 2).bookReviewExpanded, true);
  equal(disclosure.present("One.md", 1).bookReviewExpanded, false);
});

test("indicator stays concise for keyboard labels and narrow sidebars", () => {
  const indicator = bookReviewContinuityIndicator(12);
  equal(indicator, "Continuity 12");
  equal(indicator.includes("\n"), false);
  equal(bookReviewToggleAriaLabel(false, indicator), "Expand Book Review · Continuity 12");
  equal(bookReviewToggleAriaLabel(true, indicator), "Collapse Book Review · Continuity 12");
  equal(bookReviewToggleAriaLabel(false, ""), "Expand Book Review");
});
