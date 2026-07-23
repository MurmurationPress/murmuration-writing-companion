import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  buildContinuityObservation,
  ContinuityObservation,
  ObservationNoteReference
} from "../src/observations/ContinuityObservation";
import {
  ContinuityDispositionRecord,
  setContinuityDisposition
} from "../src/observations/ContinuityDisposition";
import {
  ContinuityReviewFilters,
  ContinuityReviewManuscriptScope,
  continuityReviewInclusionReason,
  projectContinuityReview,
  reconcileContinuityReviewFilters
} from "../src/observations/ContinuityReview";

const chapter = (path = "Book/Part/Scene.md", label = "Readable Scene"): ObservationNoteReference => ({
  role: "manuscript", path, label
});
const world = (path = "World/Event.md", label = "The Event"): ObservationNoteReference => ({
  role: "story_world", path, label
});

function observation(options: {
  primary?: ObservationNoteReference;
  source?: ObservationNoteReference;
  kind?: string;
  occurrence?: string;
} = {}): ContinuityObservation {
  const primary = options.primary ?? chapter();
  const source = options.source ?? primary;
  return buildContinuityObservation({
    kind: options.kind ?? "chapter-context.test",
    severity: "conflict",
    classification: "contradiction",
    primary,
    evidence: [{
      role: "test",
      source: { note: source, property: ["story_date"] },
      value: { kind: "value", value: options.occurrence ?? "current" }
    }],
    summary: "Test continuity",
    explanation: "Authoritative evidence conflicts.",
    rule: { id: "mwc.test.review", version: 1 },
    logicalOccurrence: options.occurrence ?? "one"
  });
}

function scope(): ContinuityReviewManuscriptScope {
  return {
    book: chapter("Book/Book.md", "The Book"),
    manuscriptPaths: new Set(["Book/Book.md", "Book/Part.md", "Book/Part/Scene.md"]),
    locations: new Map([
      ["Book/Part.md", { path: "Book/Part.md", label: "Part One", kind: "part", order: 0, partPath: null, partLabel: null }],
      ["Book/Part/Scene.md", { path: "Book/Part/Scene.md", label: "Readable Scene", kind: "chapter", order: 0, partPath: "Book/Part.md", partLabel: "Part One" }]
    ]),
    explicitlyReferencedStoryWorldPaths: new Set(["World/Event.md"])
  };
}

const filters = (overrides: Partial<ContinuityReviewFilters> = {}): ContinuityReviewFilters => ({
  queue: "active", type: null, locationPath: null, entityPath: null, ...overrides
});

test("selected-book scope uses only manuscript membership and direct Story World references", () => {
  const selected = scope();
  equal(continuityReviewInclusionReason(observation(), selected), "primary-manuscript");
  equal(continuityReviewInclusionReason(observation({ primary: world("World/Other.md"), source: chapter() }), selected), "supporting-manuscript");
  equal(continuityReviewInclusionReason(observation({ primary: world() }), selected), "referenced-story-world");
  equal(continuityReviewInclusionReason(observation({ primary: world("World/Other.md") }), selected), null);
  equal(continuityReviewInclusionReason(observation({ primary: world("World/Other.md"), source: world() }), selected), null);
  equal(continuityReviewInclusionReason(observation({ primary: chapter("Other/Scene.md") }), selected), null);
});

test("historical disposition records never fabricate review items", () => {
  const absent = observation({ occurrence: "absent" });
  const record = setContinuityDisposition(absent, "intentional", null, "2026-01-01T00:00:00.000Z");
  const projected = projectContinuityReview({
    observations: [], dispositions: new Map([[record.lineageKey, record]]), manuscriptScope: scope()
  }, filters({ queue: "all" }));
  deepEqual(projected.items, []);
  deepEqual(projected.counts, { active: 0, reviewed: 0, displayed: 0 });
});

test("full recollection removes an observation the producer no longer emits", () => {
  const outOfScope = observation({ kind: "chapter-context.entity.out-of-scope", occurrence: "entity-scope" });
  const before = projectContinuityReview({
    observations: [outOfScope], dispositions: new Map(), manuscriptScope: scope()
  }, filters());
  equal(before.counts.active, 1);
  const afterMetadataChange = projectContinuityReview({
    observations: [], dispositions: new Map(), manuscriptScope: scope()
  }, filters());
  equal(afterMetadataChange.counts.active, 0);
  equal(afterMetadataChange.items.length, 0);
});

test("queue preserves unresolved stale resolved intentional and deferred semantics", () => {
  const unresolved = observation({ occurrence: "unresolved" });
  const intentional = observation({ occurrence: "intentional" });
  const deferred = observation({ occurrence: "deferred" });
  const resolved = observation({ occurrence: "resolved" });
  const staleCurrent = observation({ occurrence: "stale-current" });
  const stalePrior = observation({ occurrence: "stale-prior" });
  const records = [
    setContinuityDisposition(intentional, "intentional", null, "2026-01-01T00:00:00.000Z"),
    setContinuityDisposition(deferred, "deferred", null, "2026-01-01T00:00:00.000Z"),
    setContinuityDisposition(resolved, "resolved", null, "2026-01-01T00:00:00.000Z"),
    { ...setContinuityDisposition(stalePrior, "intentional", "Prior", "2026-01-01T00:00:00.000Z"), lineageKey: staleCurrent.lineageKey }
  ];
  const dispositions = new Map(records.map((record) => [record.lineageKey, record] as const));
  const input = { observations: [unresolved, intentional, deferred, resolved, staleCurrent], dispositions, manuscriptScope: scope() };
  const active = projectContinuityReview(input, filters());
  equal(active.counts.active, 3);
  equal(active.counts.reviewed, 2);
  equal(active.items.some((item) => item.observation.fingerprint === resolved.fingerprint), true);
  equal(active.items.find((item) => item.observation.fingerprint === staleCurrent.fingerprint)?.match.state, "stale");
  const reviewed = projectContinuityReview(input, filters({ queue: "reviewed" }));
  deepEqual(new Set(reviewed.items.map((item) => item.match.record?.disposition)), new Set(["intentional", "deferred"]));
});

test("type location and entity filters remain compact and composable", () => {
  const linked = observation({ primary: chapter(), source: world(), kind: "chapter-context.event" });
  const other = observation({ primary: chapter(), kind: "manuscript-chronology.reversal", occurrence: "other" });
  const input = { observations: [linked, other], dispositions: new Map<string, ContinuityDispositionRecord>(), manuscriptScope: scope() };
  equal(projectContinuityReview(input, filters({ type: linked.kind })).items.length, 1);
  equal(projectContinuityReview(input, filters({ locationPath: "Book/Part.md" })).items.length, 2);
  equal(projectContinuityReview(input, filters({ entityPath: "World/Event.md" })).items.length, 1);
  equal(projectContinuityReview(input, filters()).filterOptions.entities[0].label, "The Event");
});

test("identical observations are deduplicated without merging distinct lineages", () => {
  const first = observation({ occurrence: "one" });
  const second = observation({ occurrence: "two" });
  const projected = projectContinuityReview({
    observations: [first, first, second], dispositions: new Map(), manuscriptScope: scope()
  }, filters());
  equal(projected.items.length, 2);
});

test("retarget preserves Queue and valid Type while clearing invalid contextual filters", () => {
  const projected = projectContinuityReview({
    observations: [observation({ kind: "shared.type" })],
    dispositions: new Map(),
    manuscriptScope: scope()
  }, filters({ queue: "all" }));
  deepEqual(reconcileContinuityReviewFilters({
    queue: "reviewed",
    type: "shared.type",
    locationPath: "Old/Part.md",
    entityPath: "World/Old.md"
  }, projected.filterOptions), {
    queue: "reviewed",
    type: "shared.type",
    locationPath: null,
    entityPath: null
  });
});
