import { deepEqual, equal, notEqual, throws } from "node:assert/strict";
import { test } from "node:test";
import {
  buildContinuityObservation,
  ContinuityObservation,
  DeterministicValue
} from "../src/observations/ContinuityObservation";
import {
  matchContinuityDisposition,
  normalizeContinuityDispositionNote,
  projectContinuityDispositionQueue,
  reviseContinuityDispositionNote,
  setContinuityDisposition
} from "../src/observations/ContinuityDisposition";

const FIRST = "2026-07-01T10:00:00.000Z";
const LATER = "2026-07-02T10:00:00.000Z";

function observation(
  value: string,
  options: { ruleVersion?: number; occurrence?: DeterministicValue; primary?: string } = {}
): ContinuityObservation {
  const path = options.primary ?? "Manuscript/Scene B.md";
  const note = { role: "manuscript" as const, path, label: "Scene B" };
  return buildContinuityObservation({
    kind: "test.continuity",
    severity: "review",
    classification: "review_concern",
    primary: note,
    evidence: [{
      role: "story_date",
      source: { note, property: ["story_date"] },
      value: { kind: "date", value, precision: "year" }
    }],
    summary: "Scene chronology needs review",
    explanation: "Explicit test evidence.",
    rule: { id: "mwc.test.continuity", version: options.ruleVersion ?? 1 },
    logicalOccurrence: options.occurrence ?? { scene: path }
  });
}

test("records intentional and deferred decisions with stable first review time", () => {
  const current = observation("2023");
  const intentional = setContinuityDisposition(
    current,
    "intentional",
    "  Deliberate flashback.\r\n  ",
    FIRST
  );
  equal(intentional.note, "Deliberate flashback.");
  equal(intentional.firstReviewedAt, FIRST);
  equal(intentional.updatedAt, FIRST);
  equal(intentional.primaryPath, current.primary.path);

  const deferred = setContinuityDisposition(current, "deferred", undefined, LATER, intentional);
  equal(deferred.disposition, "deferred");
  equal(deferred.note, "Deliberate flashback.");
  equal(deferred.firstReviewedAt, FIRST);
  equal(deferred.updatedAt, LATER);
});

test("normalises optional notes and updates only changed notes", () => {
  const record = setContinuityDisposition(observation("2023"), "intentional", "Note", FIRST);
  equal(reviseContinuityDispositionNote(record, " Note ", LATER), record);
  const revised = reviseContinuityDispositionNote(record, "New note", LATER);
  equal(revised.note, "New note");
  equal(revised.updatedAt, LATER);
  equal(revised.firstReviewedAt, FIRST);
  equal(normalizeContinuityDispositionNote("  "), null);
  throws(() => normalizeContinuityDispositionNote("x".repeat(501)), /500/);
});

test("matches only by lineage and fingerprint", () => {
  const before = observation("2023");
  const record = setContinuityDisposition(before, "intentional", null, FIRST);
  equal(matchContinuityDisposition(before, [record]).state, "current");

  const changedEvidence = observation("2024");
  equal(changedEvidence.lineageKey, before.lineageKey);
  notEqual(changedEvidence.fingerprint, before.fingerprint);
  const stale = matchContinuityDisposition(changedEvidence, [record]);
  equal(stale.state, "stale");
  equal(stale.record?.note, null);

  const changedLineage = observation("2023", { occurrence: { scene: "another" } });
  equal(matchContinuityDisposition(changedLineage, [record]).state, "unresolved");
});

test("a rule version change is stale without changing lineage", () => {
  const v1 = observation("2023", { ruleVersion: 1 });
  const v2 = observation("2023", { ruleVersion: 2 });
  equal(v2.lineageKey, v1.lineageKey);
  notEqual(v2.fingerprint, v1.fingerprint);
  equal(
    matchContinuityDisposition(v2, [setContinuityDisposition(v1, "intentional", null, FIRST)]).state,
    "stale"
  );
});

test("resolved observations remain active, disappear historically, and return active", () => {
  const current = observation("2023");
  const record = setContinuityDisposition(current, "resolved", "Changed source", FIRST);
  equal(projectContinuityDispositionQueue([current], [record]).active.length, 1);
  equal(projectContinuityDispositionQueue([], [record]).active.length, 0);
  equal(projectContinuityDispositionQueue([current], [record]).active.length, 1);
});

test("intentional and deferred are reviewed only while current; stale returns active", () => {
  const before = observation("2023");
  const intentional = setContinuityDisposition(before, "intentional", null, FIRST);
  deepEqual(
    projectContinuityDispositionQueue([before], [intentional]).reviewed.map((item) => item.state),
    ["current"]
  );
  const changed = observation("2024");
  deepEqual(
    projectContinuityDispositionQueue([changed], [intentional]).active.map((item) => item.state),
    ["stale"]
  );
});

test("observations sharing notes remain isolated by lineage", () => {
  const first = observation("2023", { occurrence: { ordinal: 0 } });
  const second = observation("2023", { occurrence: { ordinal: 1 } });
  notEqual(first.lineageKey, second.lineageKey);
  const record = setContinuityDisposition(first, "intentional", null, FIRST);
  equal(matchContinuityDisposition(first, [record]).state, "current");
  equal(matchContinuityDisposition(second, [record]).state, "unresolved");
});

test("clearing or deleting editorial disposition data restores unresolved observations", () => {
  const current = observation("2023");
  const record = setContinuityDisposition(current, "intentional", null, FIRST);
  equal(matchContinuityDisposition(current, [record]).state, "current");
  equal(matchContinuityDisposition(current, []).state, "unresolved");
  equal(projectContinuityDispositionQueue([current], []).active.length, 1);
});

test("stale observations disappear and reactivate from live projections without reload", () => {
  const original = observation("2023");
  const changed = observation("2024");
  const record = setContinuityDisposition(original, "intentional", "Flashback", FIRST);

  equal(projectContinuityDispositionQueue([changed], [record]).active[0].state, "stale");
  equal(projectContinuityDispositionQueue([], [record]).active.length, 0);
  equal(projectContinuityDispositionQueue([], [record]).reviewed.length, 0);
  equal(projectContinuityDispositionQueue([changed], [record]).active[0].state, "stale");

  const rereviewed = setContinuityDisposition(changed, "intentional", undefined, LATER, record);
  equal(projectContinuityDispositionQueue([changed], [rereviewed]).active.length, 0);
  equal(projectContinuityDispositionQueue([changed], [rereviewed]).reviewed[0].state, "current");
});
