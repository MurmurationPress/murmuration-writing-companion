import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { buildContinuityObservation } from "../src/observations/ContinuityObservation";
import type { ContinuityReviewItem } from "../src/observations/ContinuityReview";
import {
  buildContinuityDiagnosticPayload,
  ContinuityDiagnosticPreference,
  shouldShowContinuityDiagnostics
} from "../src/companion/ContinuityDiagnostics";

function reviewItem(): ContinuityReviewItem {
  const chapter = { role: "manuscript" as const, path: "Books/Scene.md", label: "Scene" };
  const observation = buildContinuityObservation({
    kind: "chapter-context.reference.unresolved",
    severity: "review",
    classification: "unresolved_evidence",
    primary: chapter,
    evidence: [{
      role: "world_context_reference",
      source: { note: chapter, property: ["world_context", 2] },
      value: { kind: "unresolved_reference", reference: "[[Missing Entity]]", reason: "not_indexed" }
    }],
    summary: "Reference unresolved",
    explanation: "Private prose must never enter diagnostics.",
    rule: { id: "mwc.test.unresolved", version: 3 },
    logicalOccurrence: "missing"
  });
  return {
    observation,
    match: { observation, state: "unresolved", record: null },
    inclusionReason: "primary-manuscript",
    locations: [],
    entities: []
  };
}

test("diagnostic information is hidden by default and can be explicitly enabled", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }
  } as Storage;
  const preference = new ContinuityDiagnosticPreference(storage, "diagnostics");
  equal(shouldShowContinuityDiagnostics(preference), false);
  preference.set(true);
  equal(shouldShowContinuityDiagnostics(new ContinuityDiagnosticPreference(storage, "diagnostics")), true);
});

test("copy diagnostics contains support identity and paths but no evidence or prose content", () => {
  const item = reviewItem();
  const payload = buildContinuityDiagnosticPayload(item, "Books/PLURALITY.md", "0.16.0");
  deepEqual(payload.rule, { id: "mwc.test.unresolved", version: 3 });
  equal(payload.lineage, item.observation.lineageKey);
  equal(payload.fingerprint, item.observation.fingerprint);
  deepEqual(payload.sources, [{ path: "Books/Scene.md", propertyPath: ["world_context", 2] }]);
  deepEqual(payload.resolution, { match: "unresolved", disposition: null });
  equal(payload.selectedBook, "Books/PLURALITY.md");
  equal(payload.pluginVersion, "0.16.0");
  const copied = JSON.stringify(payload);
  equal(copied.includes("Private prose"), false);
  equal(copied.includes("[[Missing Entity]]"), false);
});

test("diagnostic projection does not mutate observation identity or disposition state", () => {
  const item = reviewItem();
  const before = { lineage: item.observation.lineageKey, fingerprint: item.observation.fingerprint, match: item.match };
  buildContinuityDiagnosticPayload(item, "Books/PLURALITY.md", "0.16.0");
  deepEqual({ lineage: item.observation.lineageKey, fingerprint: item.observation.fingerprint, match: item.match }, before);
});
