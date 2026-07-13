import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { resolveAnnotationRange } from "../src/companion/AnnotationNavigation";

test("returns the exact range for a unique extract", () => {
  const content = "Alpha\nBeta passage\nGamma";

  deepEqual(resolveAnnotationRange(content, { text: "Beta passage", line: 2 }), {
    fromOffset: 6,
    toOffset: 18,
    exact: true
  });
});

test("chooses the repeated extract nearest the stored line", () => {
  const content = "Repeated\nMiddle\nRepeated\nEnd";
  const secondOffset = content.lastIndexOf("Repeated");

  deepEqual(resolveAnnotationRange(content, { text: "Repeated", line: 3 }), {
    fromOffset: secondOffset,
    toOffset: secondOffset + "Repeated".length,
    exact: true
  });
});

test("chooses the first exact match when no stored line is available", () => {
  const content = "Repeated\nMiddle\nRepeated";

  deepEqual(resolveAnnotationRange(content, { text: "Repeated" }), {
    fromOffset: 0,
    toOffset: "Repeated".length,
    exact: true
  });
});

test("falls back to the stored line when the extract has changed", () => {
  const content = "Alpha\nChanged passage\nGamma";
  const lineStart = content.indexOf("Changed passage");

  deepEqual(resolveAnnotationRange(content, { text: "Original passage", line: 2 }), {
    fromOffset: lineStart,
    toOffset: lineStart + "Changed passage".length,
    exact: false
  });
});

test("returns null when neither an exact extract nor stored line exists", () => {
  equal(resolveAnnotationRange("Alpha\nBeta", { text: "Missing" }), null);
});

test("uses the final available line when the stored line is beyond the document", () => {
  const content = "Alpha\nFinal line";
  const lineStart = content.indexOf("Final line");

  deepEqual(resolveAnnotationRange(content, { text: "Missing", line: 99 }), {
    fromOffset: lineStart,
    toOffset: content.length,
    exact: false
  });
});
