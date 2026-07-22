import { deepEqual, equal, notEqual, throws } from "node:assert/strict";
import { test } from "node:test";
import {
  buildContinuityObservation,
  canonicalObservationEncoding,
  normalizeObservationValue,
  normalizeObservationSet,
  observationNavigationTargets,
  observationSourceNotes
} from "../src/observations/ContinuityObservation";

const primary = { role: "story_world" as const, path: "World/Event.md", label: "Event" };
const input = {
  kind: "temporal.example",
  severity: "review" as const,
  classification: "review_concern" as const,
  primary,
  evidence: [{
    role: "time",
    source: { note: primary, property: ["world_time"] },
    value: { kind: "value" as const, value: { precision: "day", at: "2027-01-01" } }
  }],
  summary: "Review event time",
  explanation: "Review this time.",
  rule: { id: "mwc.test.time", version: 1 },
  logicalOccurrence: { property: "world_time" }
};

test("canonical encoding sorts object keys and normalises scalar values", () => {
  equal(
    canonicalObservationEncoding({ z: -0, a: { y: 2, x: "e\u0301" } }),
    '{"a":{"x":"é","y":2},"z":0}'
  );
  deepEqual(normalizeObservationValue({ position: { start: 1 }, date: new Date("2027-01-01T00:00:00.000Z") }), {
    date: "2027-01-01T00:00:00.000Z"
  });
  throws(() => normalizeObservationValue(Number.NaN), /finite numbers/);
  const cyclic: unknown[] = [];
  cyclic.push(cyclic);
  throws(() => normalizeObservationValue(cyclic), /cycles/);
  throws(() => normalizeObservationValue(new Map()), /plain objects/);
  throws(() => normalizeObservationValue(Symbol("unsupported")), /Unsupported/);
  deepEqual(normalizeObservationSet(["b", "a", "b"]), ["a", "b"]);
});

test("fingerprints ignore explanation, labels and severity but include authoritative evidence", () => {
  const original = buildContinuityObservation(input);
  const presentationChange = buildContinuityObservation({
    ...input,
    severity: "information",
    primary: { ...primary, label: "Renamed display label" },
    summary: "Different summary",
    explanation: "Different display wording."
  });
  equal(presentationChange.fingerprint, original.fingerprint);
  equal(presentationChange.lineageKey, original.lineageKey);

  const changedEvidence = buildContinuityObservation({
    ...input,
    evidence: [{
      ...input.evidence[0],
      value: { kind: "value", value: { precision: "day", at: "2027-01-02" } }
    }]
  });
  notEqual(changedEvidence.fingerprint, original.fingerprint);
  equal(changedEvidence.lineageKey, original.lineageKey);

  const changedRule = buildContinuityObservation({ ...input, rule: { ...input.rule, version: 2 } });
  notEqual(changedRule.fingerprint, original.fingerprint);
  equal(changedRule.lineageKey, original.lineageKey);
});

test("path identity makes rename stability deliberately best-effort", () => {
  const original = buildContinuityObservation(input);
  const renamed = buildContinuityObservation({
    ...input,
    primary: { ...primary, path: "World/Renamed Event.md" }
  });
  notEqual(renamed.fingerprint, original.fingerprint);
  notEqual(renamed.lineageKey, original.lineageKey);
});

test("derives supporting notes and default navigation from evidence", () => {
  const support = { role: "manuscript" as const, path: "Scenes/One.md", label: "One" };
  const observation = buildContinuityObservation({
    ...input,
    evidence: [
      ...input.evidence,
      {
        role: "scene",
        source: { note: support, property: ["story_date"] },
        value: { kind: "resolved_note", note: primary } as const
      }
    ]
  });
  deepEqual(observationSourceNotes(observation).map((note) => note.path), ["Scenes/One.md", "World/Event.md"]);
  deepEqual(observationNavigationTargets(observation).map((target) => target.kind), ["note", "property", "property"]);
});

test("treats evidence as a set while preserving authoritative value-list order", () => {
  const otherEvidence = {
    role: "scope",
    source: { note: primary, property: ["world_scope"] },
    value: { kind: "value" as const, value: ["Book One", "Series"] }
  };
  const forward = buildContinuityObservation({ ...input, evidence: [...input.evidence, otherEvidence] });
  const reversed = buildContinuityObservation({ ...input, evidence: [otherEvidence, ...input.evidence] });
  const duplicated = buildContinuityObservation({ ...input, evidence: [otherEvidence, ...input.evidence, otherEvidence] });
  equal(forward.fingerprint, reversed.fingerprint);
  equal(forward.fingerprint, duplicated.fingerprint);

  const reorderedList = buildContinuityObservation({
    ...input,
    evidence: [{ ...otherEvidence, value: { kind: "value", value: ["Series", "Book One"] } }]
  });
  notEqual(reorderedList.fingerprint, forward.fingerprint);
});

test("deduplicates exact evidence without collapsing equal values at separate paths", () => {
  const firstPath = input.evidence[0];
  const secondPath = {
    ...firstPath,
    source: { note: primary, property: ["world_time", "at"] }
  };
  const onePath = buildContinuityObservation({ ...input, evidence: [firstPath, firstPath] });
  const twoPaths = buildContinuityObservation({ ...input, evidence: [firstPath, secondPath, firstPath] });
  equal(
    onePath.fingerprint,
    buildContinuityObservation({ ...input, evidence: [firstPath] }).fingerprint
  );
  notEqual(twoPaths.fingerprint, onePath.fingerprint);
});

test("keeps evidence failure states and date precision distinct", () => {
  const source = { note: primary, property: ["world_time"] };
  const values = [
    { kind: "missing" as const },
    { kind: "value" as const, value: null },
    { kind: "value" as const, value: false },
    { kind: "value" as const, value: 1 },
    { kind: "value" as const, value: "1" },
    { kind: "unsupported" as const, raw: "sometime", reason: "unsupported_time_form" },
    { kind: "malformed" as const, raw: "2027-99-01", reason: "invalid_calendar_date" },
    { kind: "unresolved_reference" as const, reference: "[[Unknown]]", reason: "missing" as const },
    { kind: "unresolved_reference" as const, reference: "[[Robin]]", reason: "ambiguous" as const },
    { kind: "date" as const, value: "2027", precision: "year" },
    { kind: "date" as const, value: "2027", precision: "day" }
  ];
  const fingerprints = values.map((value) => buildContinuityObservation({
    ...input,
    evidence: [{ role: "time", source, value }]
  }).fingerprint);
  equal(new Set(fingerprints).size, values.length);
});

test("resolved-note labels and aliases do not participate in identity", () => {
  const evidenceFor = (label: string) => [{
    role: "event",
    source: { note: primary, property: ["world_context", 0] },
    value: { kind: "resolved_note" as const, note: { ...primary, label } }
  }];
  equal(
    buildContinuityObservation({ ...input, evidence: evidenceFor("Robin") }).fingerprint,
    buildContinuityObservation({ ...input, evidence: evidenceFor("Robin Vale") }).fingerprint
  );
});

test("builder rejects incomplete observations and remains synchronous", () => {
  throws(() => buildContinuityObservation({ ...input, summary: "" }), /summary/);
  throws(() => buildContinuityObservation({ ...input, evidence: [] }), /evidence/);
  throws(() => buildContinuityObservation({ ...input, rule: { id: input.rule.id, version: 0 } }), /version/);
  equal(buildContinuityObservation(input) instanceof Promise, false);
});
