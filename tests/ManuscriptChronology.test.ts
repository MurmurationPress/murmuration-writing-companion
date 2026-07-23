import { deepEqual, equal, notEqual } from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateManuscriptChronology,
  manuscriptChronologyOrderIsSafe,
  ManuscriptChronologyInput,
  OrderedSceneChronologyInput
} from "../src/observations/ManuscriptChronology";

function scene(path: string, storyDate: unknown): OrderedSceneChronologyInput {
  const note = { role: "manuscript" as const, path, label: path.replace(/\.md$/, "") };
  return {
    scene: note,
    parent: { role: "manuscript", path: "Book.md", label: "Book" },
    storyDate: { source: { note, property: ["story_date"] }, raw: storyDate },
    sequenceEvidence: [{
      role: "scene_order_key",
      source: { note, property: ["manuscript_order_key"] },
      value: { kind: "value", value: path }
    }]
  };
}

function input(...scenes: OrderedSceneChronologyInput[]): ManuscriptChronologyInput {
  return {
    book: { role: "manuscript", path: "Book.md", label: "Book" },
    scenes
  };
}

test("reports only proven reversals between successive supported dated scenes", () => {
  const observations = evaluateManuscriptChronology(input(
    scene("A.md", 2028),
    scene("B.md", undefined),
    scene("C.md", "2027")
  ));
  const reversal = observations.filter((item) => item.kind === "manuscript.chronology.reversal");
  equal(reversal.length, 1);
  equal(reversal[0].primary.path, "C.md");
  equal(reversal[0].severity, "review");
  equal(reversal[0].classification, "review_concern");
  equal(observations.filter((item) => item.kind === "manuscript.chronology.coverage-gap").length, 1);
});

test("keeps equal and overlapping mixed-precision intervals quiet", () => {
  equal(evaluateManuscriptChronology(input(scene("A.md", 2027), scene("B.md", "2027"))).length, 0);
  equal(evaluateManuscriptChronology(input(scene("A.md", 2027), scene("B.md", "2027-06"))).length, 0);
  equal(evaluateManuscriptChronology(input(scene("A.md", "2027-06"), scene("B.md", 2027))).length, 0);
});

test("uses one review observation for each bounded run of missing dates", () => {
  const observations = evaluateManuscriptChronology(input(
    scene("Leading.md", undefined),
    scene("A.md", "2027-01"),
    scene("B.md", undefined),
    scene("C.md", undefined),
    scene("D.md", "2027-02"),
    scene("Trailing.md", undefined)
  ));
  const gaps = observations.filter((item) => item.kind === "manuscript.chronology.coverage-gap");
  equal(gaps.length, 1);
  equal(gaps[0].primary.path, "B.md");
  equal(gaps[0].severity, "review");
  equal(gaps[0].classification, "review_concern");
  equal(gaps[0].evidence.filter((item) => item.value.kind === "missing").length, 2);
});

test("reports malformed and unsupported dates without treating them as coverage gaps", () => {
  const observations = evaluateManuscriptChronology(input(
    scene("A.md", "2027"),
    scene("Malformed.md", 2027.5),
    scene("Unsupported.md", { at: "2027", source: "calendar" }),
    scene("StructuredPoint.md", { at: "2027" }),
    scene("Range.md", { from: "2027", until: "2028" }),
    scene("B.md", "2028")
  ));
  equal(observations.filter((item) => item.kind.endsWith("malformed")).length, 1);
  equal(observations.filter((item) => item.kind.endsWith("unsupported")).length, 3);
  equal(observations.some((item) => item.kind === "manuscript.chronology.coverage-gap"), false);
  equal(observations.some((item) => item.kind === "manuscript.chronology.reversal"), false);
});

test("compares day and offset-bearing minute precision conservatively", () => {
  equal(evaluateManuscriptChronology(input(
    scene("A.md", "2027-06-02"),
    scene("B.md", "2027-06-01")
  )).filter((item) => item.kind === "manuscript.chronology.reversal").length, 1);
  equal(evaluateManuscriptChronology(input(
    scene("A.md", "2027-06-01T12:00+02:00"),
    scene("B.md", "2027-06-01T09:59Z")
  )).filter((item) => item.kind === "manuscript.chronology.reversal").length, 1);
  equal(evaluateManuscriptChronology(input(
    scene("A.md", "2027-06-01T12:00+02:00"),
    scene("B.md", "2027-06-01T09:00")
  )).length, 0);
});

test("preserves authored aliases and precision-aware date evidence", () => {
  const aliased = scene("Later.md", "2027-06");
  const custom = {
    ...aliased,
    storyDate: { ...aliased.storyDate, source: { ...aliased.storyDate.source, property: ["Narrative Date"] } }
  };
  const reversal = evaluateManuscriptChronology(input(
    scene("Earlier.md", "2028"),
    custom
  ))[0];
  deepEqual(reversal.evidence.find((item) => item.role === "later_scene_story_date")?.source.property, ["Narrative Date"]);
  equal(reversal.evidence.find((item) => item.role === "later_scene_story_date")?.value.kind, "date");
});

test("logical identity follows dated pairs while evidence changes affect fingerprints", () => {
  const before = evaluateManuscriptChronology(input(scene("A.md", 2028), scene("C.md", 2027)))[0];
  const after = evaluateManuscriptChronology(input(
    scene("A.md", 2028),
    scene("B.md", undefined),
    scene("C.md", 2026)
  )).find((item) => item.kind === "manuscript.chronology.reversal")!;
  equal(after.lineageKey, before.lineageKey);
  notEqual(after.fingerprint, before.fingerprint);
});

test("requires structurally safe distributed manuscript order", () => {
  const base = { entries: [], roots: [], scenes: [], diagnostics: [] } as const;
  equal(manuscriptChronologyOrderIsSafe({ ...base, source: "distributed" }), true);
  equal(manuscriptChronologyOrderIsSafe({ ...base, source: "legacy_array" }), false);
  equal(manuscriptChronologyOrderIsSafe({
    ...base,
    source: "distributed",
    diagnostics: [{ kind: "duplicate_order_key", path: "A.md", message: "duplicate" }]
  }), false);
  equal(manuscriptChronologyOrderIsSafe({
    ...base,
    source: "distributed",
    diagnostics: [{ kind: "obsolete_order_array", path: "Book.md", message: "obsolete" }]
  }), true);
});
