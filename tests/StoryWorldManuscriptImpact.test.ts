import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  buildStoryWorldManuscriptImpact,
  filterStoryWorldManuscriptImpact,
  ManuscriptImpactSceneInput,
  ManuscriptImpactSelection
} from "../src/story-world/StoryWorldManuscriptImpact";

const event: ManuscriptImpactSelection = {
  path: "Story World/Events/Arrival.md", label: "Arrival", kind: "event", temporalValue: "2029-01-12"
};

function scene(patch: Partial<ManuscriptImpactSceneInput> = {}): ManuscriptImpactSceneInput {
  return {
    path: "Books/FEVER/Part 1/Scene.md", title: "Scene", bookPath: "Books/FEVER.md", bookTitle: "FEVER",
    partPath: "Books/FEVER/Part 1.md", partTitle: "Part 1", order: 0, pov: "Robin", storyDate: "2029-01-11",
    direct: false, structuredLabels: [], continuityLabels: [], ...patch
  };
}

test("collapses direct and derived evidence into one authoritative Scene row", () => {
  const projection = buildStoryWorldManuscriptImpact(event, [scene({
    direct: true,
    relativeTimingLabel: "1 day before Arrival",
    structuredLabels: ["Participant source", "Participant source"],
    continuityLabels: ["Date conflict"]
  })]);
  equal(projection.results.length, 1);
  deepEqual(projection.results[0].evidence.map((evidence) => evidence.kind), [
    "direct", "temporal", "structured", "continuity"
  ]);
  equal(projection.results[0].timing, "before");
  equal(projection.results[0].evidence[1].label, "Derived: 1 day before Arrival");
});

test("classifies before, during and after with partial precision preserved", () => {
  const selection = { ...event, temporalValue: { shape: "range", from: "2029-03", to: "2029-05", precision: "month" } };
  const projection = buildStoryWorldManuscriptImpact(selection, [
    scene({ path: "Before.md", storyDate: "2028" }),
    scene({ path: "During.md", storyDate: "2029-04" }),
    scene({ path: "After.md", storyDate: "2030" })
  ]);
  deepEqual(projection.results.map((result) => result.timing), ["before", "during", "after"]);
});

test("undated and malformed Scenes remain when supported by direct evidence", () => {
  const projection = buildStoryWorldManuscriptImpact(event, [
    scene({ path: "Undated.md", storyDate: undefined, direct: true }),
    scene({ path: "Malformed.md", storyDate: "soon", direct: true }),
    scene({ path: "NoEvidence.md", storyDate: undefined })
  ]);
  deepEqual(projection.results.map((result) => result.scene.path), ["Undated.md", "Malformed.md"]);
  equal(projection.results.every((result) => result.timing === null), true);
});

test("an undated event explains temporal unavailability without hiding direct impact", () => {
  const projection = buildStoryWorldManuscriptImpact(
    { ...event, temporalValue: undefined, temporalUnavailableReason: "Event is undated." },
    [scene({ direct: true })]
  );
  equal(projection.temporalUnavailableReason, "Event is undated.");
  equal(projection.results.length, 1);
});

test("relationship validity ranges use the shared interval semantics", () => {
  const relationship: ManuscriptImpactSelection = {
    path: "Person.md#relationship:0", label: "Robin knows Tobias", kind: "relationship",
    temporalValue: { from: "2029-01-01", until: "2029-02-01", precision: "day" }
  };
  equal(buildStoryWorldManuscriptImpact(relationship, [scene({ storyDate: "2029-01-20" })]).results[0].timing, "during");
});

test("filters evidence, timing and current Book deterministically", () => {
  const projection = buildStoryWorldManuscriptImpact(event, [
    scene({ path: "Direct.md", direct: true }),
    scene({ path: "Other.md", bookPath: "Books/OTHER.md", bookTitle: "OTHER", storyDate: "2029-01-13" })
  ]);
  deepEqual(filterStoryWorldManuscriptImpact(projection, "direct", null).map((row) => row.scene.path), ["Direct.md"]);
  deepEqual(filterStoryWorldManuscriptImpact(projection, "after", null).map((row) => row.scene.path), ["Other.md"]);
  deepEqual(filterStoryWorldManuscriptImpact(projection, "current-book", "Books/FEVER.md").map((row) => row.scene.path), ["Direct.md"]);
  deepEqual(filterStoryWorldManuscriptImpact(projection, "current-book", null), []);
});

test("empty and unknown entity types degrade without inference", () => {
  const unknown = { ...event, kind: "entity" as const, label: "Unconventional item", temporalValue: undefined };
  const projection = buildStoryWorldManuscriptImpact(unknown, [scene({ storyDate: undefined })]);
  equal(projection.results.length, 0);
  equal(projection.temporalUnavailableReason !== null, true);
});

test("rebuilding is equivalent and never mutates source inputs", () => {
  const scenes = [scene({ direct: true })];
  const before = JSON.stringify(scenes);
  const first = buildStoryWorldManuscriptImpact(event, scenes);
  const second = buildStoryWorldManuscriptImpact(event, scenes);
  deepEqual(first, second);
  equal(JSON.stringify(scenes), before);
});
