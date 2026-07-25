import { deepEqual, equal, notEqual, ok } from "node:assert/strict";
import { test } from "node:test";
import { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";
import { buildStoryWorldReview, StoryWorldReviewDocument } from "../src/story-world/StoryWorldReview";

function entity(path: string, properties: Record<string, unknown>, options: Partial<StoryWorldEntityRecord> = {}): StoryWorldEntityRecord {
  const basename = path.split("/").pop()!.replace(/\.md$/, "");
  return {
    path, basename, entityType: "character", name: basename, aliases: [], facets: [], scope: [], status: "confirmed",
    summary: null, firstAppearance: null, sources: [], links: [], properties, ...options
  };
}

function documents(entities: readonly StoryWorldEntityRecord[]): StoryWorldReviewDocument[] {
  return entities.map((item) => ({ path: item.path, basename: item.basename, frontmatter: item.properties }));
}

function review(entities: readonly StoryWorldEntityRecord[], paths = new Set(entities.map((item) => item.path))) {
  return buildStoryWorldReview(documents(entities), entities, (reference) => {
    const match = /^\[\[([^|\]]+)/.exec(reference)?.[1];
    if (!match) return null;
    const path = match.endsWith(".md") ? match : `${match}.md`;
    return paths.has(path) ? { path, indexed: entities.some((item) => item.path === path) } : null;
  });
}

test("observes broken targets, participants and provenance without suppressing valid assertions", () => {
  const source = entity("World/A.md", {
    world_entity: "event",
    world_relationships: [
      { predicate: "knows", target: "[[World/Missing]]", status: "confirmed" },
      { predicate: "trusts", target: "[[World/B]]", status: "confirmed" }
    ],
    world_participants: ["[[World/Gone]]"],
    world_sources: ["[[World/Source Gone]]"]
  }, { entityType: "event" });
  const target = entity("World/B.md", { world_entity: "character" });
  const result = review([source, target]);
  const kinds = result.observations.map((item) => item.kind);
  ok(kinds.includes("story-world.relationship.unresolved-target"));
  ok(kinds.includes("story-world.event_participant.unresolved"));
  ok(kinds.includes("story-world.source.unresolved"));
  equal(kinds.filter((kind) => kind.includes("relationship")).length, 1);
});

test("detects canonical, alias and cross-kind lookup collisions without filename fallback", () => {
  const a = entity("World/One.md", { world_entity: "character" }, { name: "Robin", aliases: ["Pip"] });
  const b = entity("World/Two.md", { world_entity: "location" }, { name: " robin ", aliases: ["Other"] });
  const c = entity("World/Three.md", { world_entity: "character" }, { name: "Distinct", aliases: ["PIP"] });
  const d = entity("Elsewhere/One.md", { world_entity: "character" }, { name: "Separate", aliases: [] });
  const e = entity("World/Four.md", { world_entity: "character" }, { name: "Delta", aliases: [] });
  const f = entity("World/Five.md", { world_entity: "character" }, { name: "Echo", aliases: ["delta"] });
  const kinds = review([a, b, c, d, e, f]).observations.map((item) => item.kind);
  ok(kinds.includes("story-world.identity.canonical-collision"));
  ok(kinds.includes("story-world.identity.alias-collision"));
  ok(kinds.includes("story-world.identity.canonical-and-alias-collision"));
  equal(kinds.filter((kind) => kind.includes("collision")).length, 3);
});

test("observes incomplete and malformed relationships but accepts unknown predicates", () => {
  const source = entity("World/A.md", {
    world_entity: "character",
    world_relationships: [
      { target: "[[World/B]]" },
      { predicate: "knows" },
      { predicate: "unconventional-but-valid", target: "[[World/B]]", status: "confirmed" },
      { predicate: "knows", target: "[[World/B]]", status: "wrong" },
      { predicate: "knows", target: "[[World/B]]", status: "confirmed", validity: { from: "2027-13", until: "2027-01" } }
    ]
  });
  const target = entity("World/B.md", { world_entity: "character" });
  const result = review([source, target]);
  equal(result.observations.filter((item) => item.kind === "story-world.relationship.incomplete").length, 2);
  equal(result.observations.filter((item) => item.kind === "story-world.relationship.invalid-status").length, 1);
  equal(result.observations.filter((item) => item.kind === "story-world.relationship.invalid-validity").length, 1);
});

test("invalid and reversed event time is observed while an undated event stays quiet", () => {
  const invalid = entity("Events/Invalid.md", { world_entity: "event", world_time: { from: "2028-01-02", until: "2028-01-01", precision: "day" } }, { entityType: "event" });
  const undated = entity("Events/Undated.md", { world_entity: "event" }, { entityType: "event" });
  const result = review([invalid, undated]);
  equal(result.observations.filter((item) => item.kind === "story-world.event.invalid-time").length, 1);
  equal(result.observations.some((item) => item.primary.path === undated.path), false);
});

test("only opted-in unclassified notes are observed and unknown entity types remain valid", () => {
  const custom = entity("World/Custom.md", { world_entity: "my-unconventional-type", custom: true }, { entityType: "my-unconventional-type" });
  const docs: StoryWorldReviewDocument[] = [
    ...documents([custom]),
    { path: "World/Incomplete.md", basename: "Incomplete", frontmatter: { world_name: "Incomplete" } },
    { path: "Manuscript/Scene.md", basename: "Scene", frontmatter: { type: "scene", world_context: ["[[World/Custom]]"] } },
    { path: "Notes/Ordinary.md", basename: "Ordinary", frontmatter: { title: "Ordinary" } }
  ];
  const result = buildStoryWorldReview(docs, [custom], () => null);
  equal(result.observations.filter((item) => item.kind === "story-world.classification.missing").length, 1);
  equal(result.observations.some((item) => item.primary.path === custom.path), false);
});

test("severity, fingerprints, ordering and rebuilds are deterministic", () => {
  const source = entity("World/A.md", { world_entity: "character", world_relationships: [{ predicate: "knows" }] });
  const first = review([source]);
  const second = review([source]);
  deepEqual(second, first);
  equal(first.observations[0].severity, "review");
  const relabelled = entity("World/A.md", source.properties as Record<string, unknown>, { name: "Display label changed" });
  equal(review([relabelled]).observations[0].fingerprint, first.observations[0].fingerprint);
  const changed = entity("World/A.md", { world_entity: "character", world_relationships: [{ predicate: "trusts" }] });
  notEqual(review([changed]).observations[0].fingerprint, first.observations[0].fingerprint);
});

test("duplicate observations collapse by the shared fingerprint and generation performs no writes", () => {
  const source = entity("World/A.md", { world_entity: "character", world_relationships: [{ predicate: "knows" }] });
  const base = review([source]).observations[0];
  const result = buildStoryWorldReview(documents([source]), [source], () => null, [base]);
  equal(result.observations.length, 1);
  equal(result.observations[0].fingerprint, base.fingerprint);
  equal(Object.isFrozen(source.properties), false); // generation consumes ordinary snapshots and never mutates them
});
