import { equal } from "node:assert/strict";
import { test } from "node:test";
import { continuityDispositionPrimaryAction } from "../src/companion/ContinuityDispositionControls";
import { buildContinuityObservation } from "../src/observations/ContinuityObservation";
import {
  matchContinuityDisposition,
  setContinuityDisposition
} from "../src/observations/ContinuityDisposition";

function observation(value = "2023") {
  const note = { role: "manuscript" as const, path: "Book/Scene.md", label: "Scene" };
  return buildContinuityObservation({
    kind: "test.continuity-controls",
    severity: "review",
    classification: "review_concern",
    primary: note,
    evidence: [{
      role: "story_date",
      source: { note, property: ["story_date"] },
      value: { kind: "value", value }
    }],
    summary: "Finding",
    explanation: "Test evidence.",
    rule: { id: "mwc.test.continuity-controls", version: 1 },
    logicalOccurrence: { scene: note.path }
  });
}

test("active finding presents Mark intentional", () => {
  equal(continuityDispositionPrimaryAction(matchContinuityDisposition(observation(), [])), "mark_intentional");
});

test("current intentional finding presents the existing reset action instead of Mark intentional", () => {
  const current = observation();
  const record = setContinuityDisposition(current, "intentional", null, "2026-08-14T10:00:00.000Z");
  equal(continuityDispositionPrimaryAction(matchContinuityDisposition(current, [record])), "return_unresolved");
});

test("switching between active and intentional findings updates the primary control", () => {
  const active = observation("2023");
  const intentional = observation("2024");
  const record = setContinuityDisposition(intentional, "intentional", null, "2026-08-14T10:00:00.000Z");

  equal(continuityDispositionPrimaryAction(matchContinuityDisposition(active, [])), "mark_intentional");
  equal(continuityDispositionPrimaryAction(matchContinuityDisposition(intentional, [record])), "return_unresolved");
  equal(continuityDispositionPrimaryAction(matchContinuityDisposition(active, [])), "mark_intentional");
});

test("persisted intentional state keeps the reset control after a fresh match", () => {
  const firstRender = observation();
  const persisted = setContinuityDisposition(firstRender, "intentional", null, "2026-08-14T10:00:00.000Z");
  const rerenderedObservation = observation();

  equal(firstRender.fingerprint, rerenderedObservation.fingerprint);
  equal(continuityDispositionPrimaryAction(matchContinuityDisposition(rerenderedObservation, [persisted])), "return_unresolved");
});
