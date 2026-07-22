import { deepEqual, equal, notEqual } from "node:assert/strict";
import { test } from "node:test";
import { observeTimelineAssertionContradictions } from "../src/story-world/StoryWorldEventSceneGraph";
import { StoryWorldEntityRecord, StoryWorldIndex } from "../src/story-world/StoryWorldIndex";
import { observeIncompleteEntityRelationships } from "../src/story-world/StoryWorldObservations";
import { observationSourceNotes } from "../src/observations/ContinuityObservation";

function entity(path: string, properties: Record<string, unknown>): StoryWorldEntityRecord {
  const name = path.split("/").pop()!.replace(/\.md$/, "");
  return {
    path, basename: name, entityType: "event", name, aliases: [], facets: [], scope: [],
    status: "confirmed", summary: null, firstAppearance: null, sources: [], links: [], properties
  };
}

test("produces deterministic evidence for incomplete Story World relationships", () => {
  const source = entity("World/Pip.md", {
    world_relationships: [{ predicate: "knows", unconventional: { keep: true } }],
    unknown_property: "remains valid"
  });
  const [first] = observeIncompleteEntityRelationships(source);
  const [second] = observeIncompleteEntityRelationships(source);
  equal(first.fingerprint, second.fingerprint);
  equal(first.classification, "required_incomplete");
  deepEqual(first.evidence[0].source.property, ["world_relationships", 0]);
  deepEqual((first.evidence[0].value as { raw: unknown }).raw, {
    predicate: "knows",
    unconventional: { keep: true }
  });
  const [unknownPropertyChanged] = observeIncompleteEntityRelationships(entity("World/Pip.md", {
    world_relationships: [{ predicate: "knows", unconventional: { keep: true } }],
    unknown_property: "changed but not consumed"
  }));
  equal(unknownPropertyChanged.fingerprint, first.fingerprint);

  const [changed] = observeIncompleteEntityRelationships(entity("World/Pip.md", {
    world_relationships: [{ predicate: "knows", unconventional: { keep: false } }]
  }));
  notEqual(changed.fingerprint, first.fingerprint);
  equal(changed.lineageKey, first.lineageKey);
});

test("rebuilding unchanged indexed Markdown reproduces the Story World observation", () => {
  const index = new StoryWorldIndex();
  const documents = [{
    path: "World/Pip.md",
    basename: "Pip",
    frontmatter: {
      world_entity: "character",
      world_name: "Pip",
      world_relationships: [{ predicate: "knows" }]
    }
  }];
  index.rebuild(documents);
  const first = observeIncompleteEntityRelationships(index.getByPath("World/Pip.md")!);
  index.rebuild(documents);
  const second = observeIncompleteEntityRelationships(index.getByPath("World/Pip.md")!);
  deepEqual(second, first);
});

test("keeps separate and structurally identical incomplete assertions distinct", () => {
  const observations = observeIncompleteEntityRelationships(entity("World/Pip.md", {
    world_relationships: [
      { predicate: "knows" },
      { predicate: "trusts" },
      { predicate: "knows" }
    ]
  }));
  equal(observations.length, 3);
  equal(new Set(observations.map((item) => item.lineageKey)).size, 3);
  equal(new Set(observations.map((item) => item.fingerprint)).size, 3);
  deepEqual(observations.map((item) => item.evidence[0].source.property), [
    ["world_relationships", 0],
    ["world_relationships", 1],
    ["world_relationships", 2]
  ]);
});

test("unrelated insertion does not churn relationship lineage", () => {
  const before = observeIncompleteEntityRelationships(entity("World/Pip.md", {
    world_relationships: [{ predicate: "knows" }]
  }))[0];
  const after = observeIncompleteEntityRelationships(entity("World/Pip.md", {
    world_relationships: [
      { predicate: "trusts", target: "[[Robin]]", status: "confirmed" },
      { predicate: "knows" }
    ]
  }))[0];
  equal(after.lineageKey, before.lineageKey);
  notEqual(after.fingerprint, before.fingerprint);
  deepEqual(after.evidence[0].source.property, ["world_relationships", 1]);
});

test("an evidence change affects only its corresponding relationship observation", () => {
  const before = observeIncompleteEntityRelationships(entity("World/Pip.md", {
    world_relationships: [
      { predicate: "knows", review_note: "first" },
      { predicate: "trusts", review_note: "unchanged" }
    ]
  }));
  const after = observeIncompleteEntityRelationships(entity("World/Pip.md", {
    world_relationships: [
      { predicate: "knows", review_note: "changed" },
      { predicate: "trusts", review_note: "unchanged" }
    ]
  }));
  equal(after[0].lineageKey, before[0].lineageKey);
  notEqual(after[0].fingerprint, before[0].fingerprint);
  equal(after[1].lineageKey, before[1].lineageKey);
  equal(after[1].fingerprint, before[1].fingerprint);
});

test("produces a conflict observation from explicit sequence and world_time evidence", () => {
  const events = [
    entity("Events/A.md", { world_time: "2027-01-01" }),
    entity("Events/B.md", { world_time: "2026-01-01" })
  ];
  const documents = [{
    path: "Models/Sequence.md",
    name: "Sequence",
    frontmatter: {
      world_model: "timeline",
      world_assertions: [{
        subject: "[[Events/A|A]]",
        predicate: "precedes",
        target: "[[Events/B|B]]",
        status: "confirmed"
      }]
    }
  }];
  const resolve = (reference: string) => reference.includes("Events/A")
    ? "Events/A.md"
    : reference.includes("Events/B") ? "Events/B.md" : null;
  const [observation] = observeTimelineAssertionContradictions(documents, events, resolve);

  equal(observation.severity, "conflict");
  equal(observation.classification, "contradiction");
  deepEqual(observation.evidence.map((item) => item.source.property), [
    ["world_assertions", 0],
    ["world_assertions", 0, "subject"],
    ["world_time"],
    ["world_assertions", 0, "target"],
    ["world_time"]
  ]);
  deepEqual(observationSourceNotes(observation).map((note) => note.path), [
    "Events/A.md", "Events/B.md", "Models/Sequence.md"
  ]);
  equal(observeTimelineAssertionContradictions(documents, events, resolve)[0].fingerprint, observation.fingerprint);

  const displayOnlyChange = [{
    ...documents[0],
    frontmatter: {
      ...documents[0].frontmatter,
      world_assertions: [{
        ...documents[0].frontmatter.world_assertions[0],
        subject: "[[Events/A|Event A]]",
        target: "[[Events/B|Event B]]",
        predicate_label: "happens before",
        unrelated_qualifier: "display-only for this rule"
      }]
    }
  }];
  equal(
    observeTimelineAssertionContradictions(displayOnlyChange, events, resolve)[0].fingerprint,
    observation.fingerprint
  );
});

test("keeps identical timeline conflicts distinct without index-based lineage", () => {
  const events = [
    entity("Events/A.md", { world_time: "2027-01-01" }),
    entity("Events/B.md", { world_time: "2026-01-01" })
  ];
  const assertion = { subject: "[[Events/A]]", predicate: "precedes", target: "[[Events/B]]" };
  const resolve = (reference: string) => reference.includes("Events/A") ? "Events/A.md" : "Events/B.md";
  const documents = [{ path: "Models/Sequence.md", name: "Sequence", frontmatter: {
    world_model: "timeline", world_assertions: [assertion, assertion]
  } }];
  const duplicates = observeTimelineAssertionContradictions(documents, events, resolve);
  equal(duplicates.length, 2);
  equal(new Set(duplicates.map((item) => item.lineageKey)).size, 2);

  const inserted = [{ path: "Models/Sequence.md", name: "Sequence", frontmatter: {
    world_model: "timeline",
    world_assertions: [
      { subject: "[[Events/B]]", predicate: "precedes", target: "[[Events/A]]" },
      assertion,
      assertion
    ]
  } }];
  const afterInsertion = observeTimelineAssertionContradictions(inserted, events, resolve);
  deepEqual(afterInsertion.map((item) => item.lineageKey).sort(), duplicates.map((item) => item.lineageKey).sort());
});

test("does not report matching, unresolved, imprecise or non-timeline assertions", () => {
  const events = [
    entity("Events/A.md", { world_time: "2026" }),
    entity("Events/B.md", { world_time: "2027" })
  ];
  const documents = [{
    path: "Models/Sequence.md", name: "Sequence",
    frontmatter: { world_model: "causal", world_assertions: [{ subject: "[[Events/A]]", predicate: "precedes", target: "[[Events/B]]" }] }
  }];
  deepEqual(observeTimelineAssertionContradictions(documents, events, () => null), []);
});
