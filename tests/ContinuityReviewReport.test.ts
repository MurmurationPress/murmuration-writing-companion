import { deepEqual, equal, match, rejects } from "node:assert/strict";
import { test } from "node:test";
import { buildContinuityObservation, ContinuityObservation, ObservationNoteReference } from "../src/observations/ContinuityObservation";
import { ContinuityDispositionRecord, setContinuityDisposition } from "../src/observations/ContinuityDisposition";
import {
  ContinuityReviewFilters,
  ContinuityReviewInput,
  ContinuityReviewManuscriptScope,
  projectContinuityReview
} from "../src/observations/ContinuityReview";
import {
  buildContinuityReviewReportChoices,
  continuityReviewReportFilename,
  generateContinuityReviewReport,
  sanitizeContinuityReviewReportFilename
} from "../src/companion/ContinuityReviewReport";
import {
  ContinuityReviewReportDestinationExistsError,
  copyContinuityReviewReport,
  saveContinuityReviewReport
} from "../src/companion/ContinuityReviewReportActions";
import { explicitManuscriptKind } from "../src/manuscript/ManuscriptMetadata";
import { parseStoryWorldEntity } from "../src/story-world/StoryWorldIndex";
import { isContinuityReviewReportFrontmatter } from "../src/companion/ContinuityReviewReportClassification";

const book: ObservationNoteReference = { role: "manuscript", path: "Books/FEVER.md", label: "FEVER" };
const sceneA: ObservationNoteReference = { role: "manuscript", path: "Books/FEVER/Part 1/A.md", label: "First Scene" };
const sceneB: ObservationNoteReference = { role: "manuscript", path: "Books/FEVER/Part 2/B.md", label: "Second Scene" };
const event: ObservationNoteReference = { role: "story_world", path: "Story World/Events/Arrival.md", label: "Arrival" };

function observation(options: {
  occurrence: string;
  primary?: ObservationNoteReference;
  source?: ObservationNoteReference;
  kind?: string;
  severity?: "information" | "review" | "conflict";
  evidenceKind?: "date" | "value" | "unresolved";
}): ContinuityObservation {
  const primary = options.primary ?? sceneA;
  const source = options.source ?? primary;
  const value = options.evidenceKind === "date"
    ? { kind: "date" as const, value: "2029-01-12", precision: "day" }
    : options.evidenceKind === "unresolved"
      ? { kind: "unresolved_reference" as const, reference: "[[Missing]]", reason: "missing" as const }
      : { kind: "value" as const, value: options.occurrence };
  return buildContinuityObservation({
    kind: options.kind ?? "chapter-context.test",
    severity: options.severity ?? "review",
    classification: options.evidenceKind === "unresolved" ? "unresolved_evidence" : "review_concern",
    primary,
    evidence: [{
      role: options.evidenceKind === "date" ? "chapter_date" : "source_data",
      source: { note: source, property: options.evidenceKind === "date" ? ["story_date"] : ["world_context"] },
      value
    }],
    summary: `Finding ${options.occurrence}`,
    explanation: `Explanation ${options.occurrence}`,
    rule: { id: `mwc.test.${options.kind ?? "report"}`, version: 2 },
    logicalOccurrence: options.occurrence
  });
}

function manuscriptScope(): ContinuityReviewManuscriptScope {
  return {
    book,
    manuscriptPaths: new Set([book.path, sceneA.path, sceneB.path]),
    locations: new Map([
      [sceneA.path, { path: sceneA.path, label: "First Scene", kind: "chapter", order: 0, partPath: "Books/FEVER/Part 1.md", partLabel: "Part One" }],
      [sceneB.path, { path: sceneB.path, label: "Second Scene", kind: "chapter", order: 1, partPath: "Books/FEVER/Part 2.md", partLabel: "Part Two" }]
    ]),
    explicitlyReferencedStoryWorldPaths: new Set([event.path])
  };
}

const filters = (patch: Partial<ContinuityReviewFilters> = {}): ContinuityReviewFilters => ({
  queue: "all", type: null, locationPath: null, entityPath: null, ...patch
});

function input(): { value: ContinuityReviewInput; records: ContinuityDispositionRecord[] } {
  const unresolved = observation({ occurrence: "unresolved", primary: sceneB, severity: "conflict", evidenceKind: "date" });
  const intentional = observation({ occurrence: "intentional", primary: sceneA, source: event, kind: "chapter-context.event.after-chapter" });
  const deferred = observation({ occurrence: "deferred", primary: sceneB, source: event, kind: "chapter-context.relationship.after-valid-until" });
  const resolved = observation({ occurrence: "resolved", primary: sceneA, severity: "information" });
  const stale = observation({ occurrence: "stale-current", primary: sceneB, evidenceKind: "unresolved" });
  const stalePrior = observation({ occurrence: "stale-prior", primary: sceneB });
  const records = [
    setContinuityDisposition(intentional, "intentional", "Deliberate exception", "2026-01-01T00:00:00.000Z"),
    setContinuityDisposition(deferred, "deferred", "Revise in pass three", "2026-01-02T00:00:00.000Z"),
    setContinuityDisposition(resolved, "resolved", null, "2026-01-03T00:00:00.000Z"),
    { ...setContinuityDisposition(stalePrior, "intentional", "Prior evidence", "2026-01-04T00:00:00.000Z"), lineageKey: stale.lineageKey }
  ];
  return {
    value: {
      observations: [unresolved, intentional, deferred, resolved, stale],
      dispositions: new Map(records.map((record) => [record.lineageKey, record])),
      manuscriptScope: manuscriptScope()
    },
    records
  };
}

test("whole-Book report includes all current disposition states, counts, notes and rule versions", () => {
  const fixture = input();
  const projection = projectContinuityReview(fixture.value, filters());
  const report = generateContinuityReviewReport({
    book, scope: "book", filters: [], items: projection.items,
    generatedAt: "2026-07-25T14:00:00.000Z", pluginVersion: "0.16.0"
  }).markdown;
  match(report, /Total observations:\*\* 5/);
  match(report, /Conflict: 1/);
  match(report, /Deferred: 1/);
  match(report, /Intentional: 1/);
  match(report, /Resolved: 1/);
  match(report, /Stale: 1/);
  match(report, /Deliberate exception/);
  match(report, /Revise in pass three/);
  match(report, /mwc\.test\./);
});

test("whole-Book scope ignores UI filters while filtered scope contains exactly visible items and records filters", () => {
  const fixture = input();
  const currentFilters = filters({ type: "chapter-context.event.after-chapter", entityPath: event.path });
  const filtered = projectContinuityReview(fixture.value, currentFilters);
  const choices = buildContinuityReviewReportChoices({
    input: fixture.value, filteredProjection: filtered, filters: currentFilters,
    generatedAt: "2026-07-25T14:00:00.000Z", pluginVersion: "0.16.0"
  });
  match(choices.book.markdown, /Total observations:\*\* 5/);
  match(choices.filtered.markdown, /Total observations:\*\* 1/);
  match(choices.filtered.markdown, /Queue:\*\* All/);
  match(choices.filtered.markdown, /Type:\*\* Chapter context · Event · After chapter/);
  match(choices.filtered.markdown, /Entity:\*\* Arrival/);
});

test("report sections retain authoritative manuscript order across Parts", () => {
  const early = observation({ occurrence: "early", primary: sceneA, severity: "review" });
  const late = observation({ occurrence: "late", primary: sceneB, severity: "conflict" });
  const projected = projectContinuityReview({ observations: [late, early], dispositions: new Map(), manuscriptScope: manuscriptScope() }, filters());
  const markdown = generateContinuityReviewReport({ book, scope: "book", filters: [], items: projected.items, generatedAt: "2026-07-25T14:00:00.000Z", pluginVersion: "test" }).markdown;
  equal(markdown.indexOf("Explanation early") < markdown.indexOf("Explanation late"), true);
  match(markdown, /\[\[Books\/FEVER\/Part 1\|Part One\]\] → \[\[Books\/FEVER\/Part 1\/A\|First Scene\]\]/);
  match(markdown, /\[\[Books\/FEVER\/Part 2\|Part Two\]\] → \[\[Books\/FEVER\/Part 2\/B\|Second Scene\]\]/);
});

test("canon evidence, temporal derivation and editorial disposition are visibly separate", () => {
  const dated = observation({ occurrence: "dated", primary: sceneA, source: event, evidenceKind: "date" });
  const record = setContinuityDisposition(dated, "intentional", "Author decision", "2026-01-01T00:00:00.000Z");
  const projected = projectContinuityReview({ observations: [dated], dispositions: new Map([[record.lineageKey, record]]), manuscriptScope: manuscriptScope() }, filters());
  const markdown = generateContinuityReviewReport({ book, scope: "book", filters: [], items: projected.items, generatedAt: "2026-07-25T14:00:00.000Z", pluginVersion: "test" }).markdown;
  match(markdown, /#### Derived temporal evidence/);
  match(markdown, /#### Editorial disposition/);
  match(markdown, /\[\[Story World\/Events\/Arrival\|Arrival\]\]/);
});

test("missing source notes remain readable wikilinks and are marked unavailable", () => {
  const missing = observation({ occurrence: "missing", primary: sceneA, source: event });
  const projected = projectContinuityReview({ observations: [missing], dispositions: new Map(), manuscriptScope: manuscriptScope() }, filters());
  const markdown = generateContinuityReviewReport({
    book, scope: "book", filters: [], items: projected.items,
    generatedAt: "2026-07-25T14:00:00.000Z", pluginVersion: "test", existingPaths: new Set([book.path, sceneA.path])
  }).markdown;
  match(markdown, /\[\[Story World\/Events\/Arrival\|Arrival\]\] \(source currently unavailable\)/);
  const restored = generateContinuityReviewReport({
    book, scope: "book", filters: [], items: projected.items,
    generatedAt: "2026-07-25T14:00:00.000Z", pluginVersion: "test", existingPaths: new Set([book.path, sceneA.path, event.path])
  }).markdown;
  equal(restored.includes("source currently unavailable"), false);
});

test("filename is deterministic, ISO dated and sanitised", () => {
  equal(continuityReviewReportFilename("FEVER: Book/One?", "2026-07-25", "filtered"), "Continuity Review - FEVER- Book-One- - 2026-07-25 - Filtered.md");
  equal(sanitizeContinuityReviewReportFilename("  Bad|Name.md  "), "Bad-Name.md");
});

test("report marker is excluded from manuscript and Story World authority", () => {
  const frontmatter = { type: "continuity-review-report", report_scope: "book", report_book: "[[Books/FEVER]]" };
  equal(isContinuityReviewReportFrontmatter(frontmatter), true);
  equal(explicitManuscriptKind(frontmatter), null);
  equal(parseStoryWorldEntity({ path: "Continuity Review.md", basename: "Continuity Review", frontmatter }), null);
});

test("copy is write-free and save creates exactly the preview content", async () => {
  let copied = ""; let writes = 0; let saved = "";
  const markdown = "# Exact preview\n";
  await copyContinuityReviewReport({ writeText: async (value) => { copied = value; } }, markdown);
  equal(copied, markdown); equal(writes, 0);
  await saveContinuityReviewReport({
    exists: () => false,
    create: async (_path, value) => { writes += 1; saved = value; return {}; }
  }, "Report.md", markdown);
  equal(writes, 1); equal(saved, markdown);
});

test("existing destinations are refused and vault failures propagate without replacement", async () => {
  let writes = 0;
  await rejects(() => saveContinuityReviewReport({
    exists: () => true,
    create: async () => { writes += 1; }
  }, "Existing.md", "report"), ContinuityReviewReportDestinationExistsError);
  equal(writes, 0);
  await rejects(() => saveContinuityReviewReport({
    exists: () => false,
    create: async () => { writes += 1; throw new Error("disk full"); }
  }, "New.md", "report"), /disk full/);
  equal(writes, 1);
});

test("empty reports remain useful and generation never mutates dispositions", () => {
  const fixture = input();
  const before = JSON.stringify(fixture.records);
  const empty = generateContinuityReviewReport({ book, scope: "filtered", filters: [{ label: "Queue", value: "Active" }], items: [], generatedAt: "2026-07-25T14:00:00.000Z", pluginVersion: "test" });
  match(empty.markdown, /No matching observations were present/);
  equal(JSON.stringify(fixture.records), before);
});

test("unchanged input produces equivalent content apart from the explicit timestamp", () => {
  const fixture = input();
  const items = projectContinuityReview(fixture.value, filters()).items;
  const first = generateContinuityReviewReport({ book, scope: "book", filters: [], items, generatedAt: "2026-07-25T14:00:00.000Z", pluginVersion: "test" }).markdown;
  const second = generateContinuityReviewReport({ book, scope: "book", filters: [], items, generatedAt: "2026-07-26T15:00:00.000Z", pluginVersion: "test" }).markdown;
  deepEqual(first.split("2026-07-25T14:00:00.000Z").join("TIMESTAMP"), second.split("2026-07-26T15:00:00.000Z").join("TIMESTAMP"));
});
