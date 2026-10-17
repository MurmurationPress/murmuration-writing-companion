import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import { mapReadingBoundary, projectReadingSource, readingSelectionStillValid } from "../src/companion/ReadingAnnotationSelection";
import { createAnnotationExportAnchor } from "../src/editorial/AnnotationExportAnchor";
import { resolveAnnotationSourceRange } from "../src/companion/AnnotationNavigation";

test("formatted render offsets map to Markdown across emphasis and links", () => {
  const source = "A **bold** word and an *italic* [link](https://example.org).";
  const rendered = "A bold word and an italic link.";
  equal(projectReadingSource(source)?.text, rendered);
  const from = mapReadingBoundary(source, rendered, 2, false)!;
  const to = mapReadingBoundary(source, rendered, rendered.indexOf("link") + 4, true)!;
  equal(source.slice(from, to), "bold** word and an *italic* [link");
});

test("UTF-16 offsets and folded whitespace are preserved", () => {
  const source = "A **😀** word\ncontinued.";
  const rendered = "A 😀 word\ncontinued.";
  const from = mapReadingBoundary(source, rendered, 2, false)!;
  const to = mapReadingBoundary(source, rendered, 4, true)!;
  equal(source.slice(from, to), "😀");
});

test("host section positions disambiguate repeated extracts, even on one line", async () => {
  const source = "---\ntitle: Synthetic\n---\n\nRepeated. Repeated.\n\nRepeated.";
  const from = source.indexOf("Repeated.", source.indexOf("Repeated.") + 1);
  const anchor = await createAnnotationExportAnchor(source, from, from + 9);
  deepEqual(await resolveAnnotationSourceRange(source, anchor), { fromOffset: from, toOffset: from + 9, exact: true });
  const metadataChanged = source.replace("Synthetic", "Changed title");
  const expected = metadataChanged.indexOf("Repeated.", metadataChanged.indexOf("Repeated.") + 1);
  deepEqual(await resolveAnnotationSourceRange(metadataChanged, anchor), { fromOffset: expected, toOffset: expected + 9, exact: true });
});

test("paragraph-spanning source slices retain formatting and paragraph separators", async () => {
  const source = "First **paragraph**.\n\nSecond *paragraph*.";
  const first = "First **paragraph**.";
  const second = "Second *paragraph*.";
  const from = mapReadingBoundary(first, "First paragraph.", 6, false)!;
  const to = first.length + 2 + mapReadingBoundary(second, "Second paragraph.", 16, true)!;
  const anchor = await createAnnotationExportAnchor(source, from, to);
  equal(anchor.text, "paragraph**.\n\nSecond *paragraph");
  ok(anchor.range);
  deepEqual(await resolveAnnotationSourceRange(source, anchor), { fromOffset: from, toOffset: to, exact: true });
});

test("unverifiable renderings and invalid boundaries fail closed", () => {
  for (const [source, rendered] of [["Text", "Changed"], ["![[embed]]", "embed"], ["<b>HTML</b>", "HTML"], ["$math$", "math"], ["[a|b]", "b"]]) {
    equal(mapReadingBoundary(source, rendered, 0, false), null);
  }
  equal(mapReadingBoundary("Text", "Text", -1, false), null);
  equal(mapReadingBoundary("Text", "Text", 20, true), null);
});

test("stale prose cannot be saved, while derived metadata changes preserve the selection", () => {
  const captured = "---\ntitle: Keep\n---\n\nA **selected** passage.\n";
  equal(readingSelectionStillValid(captured, captured.replace("selected", "different")), false);
  equal(readingSelectionStillValid(captured, captured.replace("Keep\n", "Keep\nmwc_open_annotations: 2\n")), true);
  equal(readingSelectionStillValid(captured, captured + "New passage.\n"), false);
});

test("validation retains original note across focus changes and renames, rejecting deletion or replacement", async () => {
  const { validateReadingSelection } = await import("../src/companion/ReadingAnnotationSelection");
  const { rejects } = await import("node:assert/strict");
  const original = { path: "Original.md" }, other = { path: "Other.md" };
  let active = other;
  let present: unknown = original;
  const reads: unknown[] = [];
  const vault = { lookup: (_: string) => present, read: async (file: typeof original) => { reads.push(file); return file === original ? "Captured prose." : "Other prose."; } };
  await validateReadingSelection(original, "Captured prose.", vault);
  active = original; original.path = "Renamed.md";
  await validateReadingSelection(original, "Captured prose.", vault);
  deepEqual(reads, [original, original]); equal(active, original);
  present = { path: original.path };
  await rejects(validateReadingSelection(original, "Captured prose.", vault), /selected note has changed/);
  present = null;
  await rejects(validateReadingSelection(original, "Captured prose.", vault), /selected note has changed/);
});

test("ordinary literal punctuation, inline code and piped link labels map without whole-paragraph exclusions", () => {
  for (const [source, rendered] of [
    ["The price is $5 and a < b | c.", "The price is $5 and a < b | c."],
    ["Text with `*literal*` and **bold**.", "Text with *literal* and bold."],
    ["Text around [[Other#Heading|alias]] here.", "Text around alias here."],
    ["An under_score and **bold**.", "An under_score and bold."],
    ["A literal * in prose.", "A literal * in prose."]
  ]) {
    const from = mapReadingBoundary(source, rendered, 0, false)!;
    const to = mapReadingBoundary(source, rendered, rendered.length, true)!;
    equal(source.slice(from, to), source);
  }
});

test("changed modern anchors never label a guessed duplicate occurrence exact", async () => {
  const source = "same same\n\nTail.";
  const anchor = await createAnnotationExportAnchor(source, 5, 9);
  const range = await resolveAnnotationSourceRange(source + "\nEdited elsewhere.", anchor);
  equal(range?.exact, false);
  deepEqual(range, { fromOffset: 0, toOffset: 9, exact: false });
  const unique = await createAnnotationExportAnchor("Unique passage.\nTail.", 0, 15);
  equal((await resolveAnnotationSourceRange("---\ntitle: Unique passage.\n---\nUnique passage.\nChanged tail.", unique))?.exact, true);
});

test("ambiguous fallback stays in the body when derived frontmatter was added after capture", async () => {
  const anchor = await createAnnotationExportAnchor("same same\nTail.", 5, 9);
  const content = "---\nmwc_open_annotations: 1\n---\nsame same\nChanged tail.";
  const range = await resolveAnnotationSourceRange(content, anchor);
  deepEqual(range, { fromOffset: content.indexOf("same same"), toOffset: content.indexOf("same same") + 9, exact: false });
});
