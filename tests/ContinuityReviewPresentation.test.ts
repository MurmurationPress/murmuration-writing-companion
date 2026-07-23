import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  buildContinuityObservation,
  ContinuityObservation,
  ObservationEvidence,
  ObservationNoteReference
} from "../src/observations/ContinuityObservation";
import type { ContinuityReviewItem } from "../src/observations/ContinuityReview";
import {
  continuityListNavigationIntent,
  continuityNoteLabel,
  continuityUnresolvedReference,
  CONTINUITY_DIAGNOSTIC_DETAILS_OPEN_BY_DEFAULT,
  projectContinuityReviewPresentation
} from "../src/companion/ContinuityReviewPresentation";
import { CONTINUITY_REVIEW_ROW_LAYOUT } from "../src/ui/ContinuityReviewStyles";

const note = (
  role: "manuscript" | "story_world",
  path: string,
  label?: string
): ObservationNoteReference => ({ role, path, label });

function observation(options: {
  kind: string;
  primary: ObservationNoteReference;
  evidence: readonly ObservationEvidence[];
  summary?: string;
}): ContinuityObservation {
  return buildContinuityObservation({
    kind: options.kind,
    severity: "review",
    classification: "review_concern",
    primary: options.primary,
    evidence: options.evidence,
    summary: options.summary ?? "Story World source data needs review",
    explanation: "The authoritative values require editorial review.",
    rule: { id: "mwc.test.presentation", version: 1 },
    logicalOccurrence: { primary: options.primary.path, kind: options.kind }
  });
}

function item(value: ContinuityObservation): ContinuityReviewItem {
  const sourceNotes = value.evidence.flatMap((evidence) => (
    evidence.value.kind === "resolved_note" ? [evidence.value.note] : []
  ));
  return {
    observation: value,
    match: { observation: value, state: "unresolved", record: null },
    inclusionReason: "primary-manuscript",
    locations: [{
      path: "Book/Absence/Tobias.md",
      label: "Tobias in the Wilderness",
      kind: "chapter",
      order: 2,
      partPath: "Book/Absence.md",
      partLabel: "Absence"
    }],
    entities: sourceNotes.filter((entry) => entry.role === "story_world")
  };
}

test("chronology rows expose part, title-first location and a specific finding", () => {
  const scene = note("manuscript", "Book/Absence/Tobias.md", "Tobias in the Wilderness");
  const previous = note("manuscript", "Book/Absence/Domestic.md", "Domestic Distance");
  const value = observation({
    kind: "manuscript.chronology.reversal",
    primary: scene,
    summary: "Scene chronology reverses manuscript order",
    evidence: [
      { role: "previous_scene_story_date", source: { note: previous, property: ["story_date"] }, value: { kind: "date", value: "2028-05-03", precision: "day" } },
      { role: "later_scene_story_date", source: { note: scene, property: ["story_date"] }, value: { kind: "date", value: "2028-05-02", precision: "day" } }
    ]
  });
  const presentation = projectContinuityReviewPresentation(item(value));
  equal(presentation.listContext, "Absence");
  equal(presentation.primaryTitle, "Tobias in the Wilderness");
  equal(presentation.finding, "Story date reverses manuscript order");
  equal(presentation.primaryTarget.path, scene.path);
  deepEqual(presentation.evidenceGroups[0], {
    name: "Story dates",
    rows: [
      { label: "Domestic Distance", value: "3 May 2028", evidence: value.evidence.find((entry) => entry.role === "previous_scene_story_date")! },
      { label: "Tobias in the Wilderness", value: "2 May 2028", evidence: value.evidence.find((entry) => entry.role === "later_scene_story_date")! }
    ]
  });
});

test("generic Story World source findings are enriched with the affected entity", () => {
  const chapter = note("manuscript", "Book/Absence/Tobias.md", "Tobias in the Wilderness");
  const event = note("story_world", "World/Robin Born.md", "Robin is Born");
  const value = observation({
    kind: "chapter-context.source-data.malformed",
    primary: chapter,
    evidence: [{
      role: "source_data",
      source: { note: event, property: ["world_time"] },
      value: { kind: "malformed", raw: "tomorrow", reason: "invalid_date" }
    }]
  });
  const presentation = projectContinuityReviewPresentation(item(value));
  equal(presentation.primaryTitle, "Robin is Born");
  equal(presentation.finding, "Event date needs review");
  equal(presentation.primaryTarget.path, event.path);
  equal(presentation.locationContext, "Absence · Tobias in the Wilderness");
});

test("labels prefer the observation title and fall back to basename", () => {
  equal(continuityNoteLabel(note("manuscript", "Book/Raw Filename.md", "Readable Title")), "Readable Title");
  equal(continuityNoteLabel(note("manuscript", "Book/Raw Filename.md")), "Raw Filename");
});

test("related notes collapse duplicate evidence targets and exclude the primary action", () => {
  const scene = note("manuscript", "Book/Absence/Tobias.md", "Tobias in the Wilderness");
  const related = note("manuscript", "Book/Absence/Domestic.md", "Domestic Distance");
  const value = observation({
    kind: "manuscript.chronology.reversal",
    primary: scene,
    evidence: [
      { role: "previous_scene_story_date", source: { note: related, property: ["story_date"] }, value: { kind: "date", value: "2028-05-03", precision: "day" } },
      { role: "scene_order_key", source: { note: related, property: ["manuscript_order_key"] }, value: { kind: "value", value: "A" } },
      { role: "later_scene_story_date", source: { note: scene, property: ["story_date"] }, value: { kind: "date", value: "2028-05-02", precision: "day" } }
    ]
  });
  const presentation = projectContinuityReviewPresentation(item(value));
  deepEqual(presentation.relatedNotes.map((entry) => entry.path), [related.path]);
  equal(presentation.technicalEvidence.length, 3);
  equal(presentation.evidenceGroups.some((group) => group.rows.some((row) => row.value === "A")), false);
});

test("technical metadata is collapsed and property detail remains technical", () => {
  equal(CONTINUITY_DIAGNOSTIC_DETAILS_OPEN_BY_DEFAULT, false);
});

test("list Enter opens detail while Ctrl or Command Enter selects primary navigation", () => {
  equal(continuityListNavigationIntent({ key: "Enter", ctrlKey: false, metaKey: false }), "detail");
  equal(continuityListNavigationIntent({ key: "Enter", ctrlKey: true, metaKey: false }), "primary");
  equal(continuityListNavigationIntent({ key: "Enter", ctrlKey: false, metaKey: true }), "primary");
  equal(continuityListNavigationIntent({ key: "ArrowDown", ctrlKey: false, metaKey: false }), null);
});

test("presentation never mutates observation identity or storage semantics", () => {
  const scene = note("manuscript", "Book/Absence/Tobias.md", "Tobias in the Wilderness");
  const value = observation({
    kind: "manuscript.chronology.source-data.malformed",
    primary: scene,
    evidence: [{ role: "scene_story_date", source: { note: scene, property: ["story_date"] }, value: { kind: "malformed", raw: "bad", reason: "invalid_date" } }]
  });
  const identity = { fingerprint: value.fingerprint, lineageKey: value.lineageKey };
  projectContinuityReviewPresentation(item(value));
  deepEqual({ fingerprint: value.fingerprint, lineageKey: value.lineageKey }, identity);
});

test("scope findings identify the authoritative world_scope property to edit", () => {
  const scene = note("manuscript", "Book/Absence/Domestic.md", "Domestic Distance");
  const entity = note("story_world", "World/Pip withdraws.md", "Pip withdraws from PRIME");
  const book = note("manuscript", "Book/PLURALITY.md", "PLURALITY");
  const emergence = note("manuscript", "Book/EMERGENCE.md", "EMERGENCE");
  const value = observation({
    kind: "chapter-context.entity.out-of-scope",
    primary: scene,
    evidence: [
      { role: "entity_scope", source: { note: entity, property: ["world_scope", 0] }, value: { kind: "resolved_note", note: emergence } },
      { role: "owning_book", source: { note: scene, property: ["book"] }, value: { kind: "resolved_note", note: book } }
    ]
  });
  const presentation = projectContinuityReviewPresentation(item(value));
  equal(presentation.finding, "Referenced entity’s world_scope excludes this book");
  equal(presentation.explanation.includes("update world_scope on Pip withdraws from PRIME"), true);
  equal(presentation.evidenceGroups.some((group) => group.rows.some((row) => row.label === "Pip withdraws from PRIME · world_scope")), true);
  equal(presentation.primaryTarget.path, entity.path);
});

test("unresolved references retain the chapter as primary action and expose only the reference text for copying", () => {
  const scene = note("manuscript", "Book/Intervention/Confrontation.md", "Confrontation");
  const value = observation({
    kind: "chapter-context.reference.unresolved",
    primary: scene,
    evidence: [{
      role: "world_context_reference",
      source: { note: scene, property: ["world_context", 1] },
      value: { kind: "unresolved_reference", reference: "[[Missing Entity]]", reason: "not_indexed" }
    }]
  });
  const projected = item(value);
  equal(projectContinuityReviewPresentation(projected).primaryTarget.path, scene.path);
  equal(continuityUnresolvedReference(projected), "[[Missing Entity]]");
});

test("selected rows retain their state line and grow for long multi-line content", () => {
  deepEqual(CONTINUITY_REVIEW_ROW_LAYOUT, {
    autoHeight: true,
    clampsText: false,
    narrowActionBelowText: true
  });
  const scene = note(
    "manuscript",
    "Book/A Very Long Part/A Very Long Scene.md",
    "A very long scene title that remains completely readable at increased Obsidian zoom"
  );
  const value = observation({
    kind: "manuscript.chronology.reversal",
    primary: scene,
    summary: "A long finding that must remain visible even when it wraps onto several lines",
    evidence: [{ role: "later_scene_story_date", source: { note: scene, property: ["story_date"] }, value: { kind: "date", value: "2028-05-02", precision: "day" } }]
  });
  const reviewed: ContinuityReviewItem = { ...item(value), match: {
    observation: value,
    state: "current",
    record: {
      lineageKey: value.lineageKey,
      fingerprint: value.fingerprint,
      disposition: "deferred",
      note: null,
      firstReviewedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      observationKind: value.kind,
      ruleId: value.rule.id,
      ruleVersion: value.rule.version,
      primaryPath: value.primary.path,
      sourcePaths: [value.primary.path],
      reviewSummary: value.summary
    }
  } };
  const presentation = projectContinuityReviewPresentation(reviewed);
  equal(presentation.primaryTitle, scene.label);
  equal(presentation.stateMarker, "Deferred");
});
