import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  continuityReviewActionPresentation,
  openContinuityReviewFromEntryPoint
} from "../src/companion/ContinuityReviewEntryPoint";

test("a safe selected book exposes a visible labelled action with active count", () => {
  deepEqual(continuityReviewActionPresentation(true, 3), {
    label: "Continuity Review · 3",
    disabled: false,
    tooltip: "Open Continuity Review for the selected manuscript book with 3 active findings"
  });
});

test("zero active findings keeps the action visible without a noisy zero", () => {
  equal(continuityReviewActionPresentation(true, 0).label, "Continuity Review");
  equal(continuityReviewActionPresentation(true, 0).disabled, false);
});

test("no safe selected book gives an explanatory disabled action", () => {
  const presentation = continuityReviewActionPresentation(false, null);
  equal(presentation.disabled, true);
  equal(presentation.label, "Continuity Review");
  equal(presentation.tooltip.includes("safe authoritative manuscript order"), true);
});

test("Book Review and Manuscript navigator share one book-explicit activation path", async () => {
  const requests: Array<[string, string]> = [];
  const host = {
    activateContinuityReviewForBook: async (bookPath: string, contextPath: string) => {
      requests.push([bookPath, contextPath]);
    }
  };
  await openContinuityReviewFromEntryPoint(host, "Books/Plurality.md", "Books/Plurality/Scene.md");
  await openContinuityReviewFromEntryPoint(host, "Books/Emergence.md", "Books/Emergence/Chapter.md");
  deepEqual(requests, [
    ["Books/Plurality.md", "Books/Plurality/Scene.md"],
    ["Books/Emergence.md", "Books/Emergence/Chapter.md"]
  ]);
});

test("Book Review can use an explicit action prefix with the same count semantics", () => {
  equal(
    continuityReviewActionPresentation(true, 2, "Open Continuity Review").label,
    "Open Continuity Review · 2"
  );
});
