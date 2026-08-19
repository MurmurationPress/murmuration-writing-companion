import { deepEqual, equal, notEqual, ok } from "node:assert/strict";
import { test } from "node:test";
import { parseWikilink, StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";
import {
  buildStoryWorldReview,
  storyWorldReviewEvidenceFingerprint,
  StoryWorldReviewDocument
} from "../src/story-world/StoryWorldReview";

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

function semanticReview(
  manuscript: readonly StoryWorldReviewDocument[],
  entities: readonly StoryWorldEntityRecord[]
) {
  const resolve = (reference: string) => {
    const parsed = parseWikilink(reference);
    if (!parsed) return null;
    const lookup = parsed.linkpath.replace(/\.md$/iu, "").trim().toLocaleLowerCase();
    const basename = lookup.split("/").pop() ?? lookup;
    const candidates = entities.filter((item) => {
      const path = item.path.replace(/\.md$/iu, "").toLocaleLowerCase();
      if (lookup.includes("/")) return path === lookup;
      return path === lookup
        || item.basename.toLocaleLowerCase() === basename
        || item.name.toLocaleLowerCase() === lookup
        || item.aliases.some((alias) => alias.toLocaleLowerCase() === lookup);
    });
    return candidates.length === 1 ? { path: candidates[0].path, indexed: true } : null;
  };
  return buildStoryWorldReview(
    [...documents(entities), ...manuscript],
    entities,
    resolve
  );
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
  equal(result.observations.some((item) => item.primary.path === undated.path && item.kind !== "story-world.entity.orphan"), false);
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
  equal(result.observations.some((item) => item.primary.path === custom.path && item.kind !== "story-world.entity.orphan"), false);
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
  equal(result.observations.filter((item) => item.fingerprint === base.fingerprint).length, 1);
  equal(Object.isFrozen(source.properties), false); // generation consumes ordinary snapshots and never mutates them
});

test("detects conservative near duplicates and avoids unrelated names", () => {
  const first = entity("World/Tobias.md", { world_entity: "character" }, { name: "Tobias-Hale" });
  const second = entity("Elsewhere/Tobias.md", { world_entity: "character" }, { name: "Tobias Hale" });
  const distinct = entity("World/Tobiasina.md", { world_entity: "character" }, { name: "Tobiasina Hale" });
  const findings = review([first, second, distinct]).observations.filter((item) => item.kind === "story-world.identity.near-canonical-collision");
  equal(findings.length, 1);
  deepEqual(new Set(findings[0].evidence.map((item) => item.source.note.path)), new Set([first.path, second.path]));
});

test("detects duplicate relationships only when the full structural assertion matches", () => {
  const source = entity("World/A.md", {
    world_entity: "character",
    world_relationships: [
      { predicate: "knows", target: "[[World/B]]", status: "confirmed", world_scope: "[[Books/One]]", sources: ["[[Notes/X]]"] },
      { predicate: "knows", target: "[[World/B]]", status: "confirmed", world_scope: "[[Books/One]]", sources: ["[[Notes/X]]"] },
      { predicate: "knows", target: "[[World/B]]", status: "planned", world_scope: "[[Books/One]]", sources: ["[[Notes/X]]"] }
    ]
  });
  const target = entity("World/B.md", { world_entity: "character" });
  equal(review([source, target], new Set([source.path, target.path, "Books/One.md", "Notes/X.md"])).observations
    .filter((item) => item.kind === "story-world.relationship.duplicate").length, 1);
});

test("event precision is compatible while incompatible duplicate event dates conflict", () => {
  const year = entity("Events/A.md", { world_entity: "event", world_time: "2026" }, { entityType: "event", name: "The Arrival" });
  const day = entity("Events/B.md", { world_entity: "event", world_time: "2026-05-13" }, { entityType: "event", name: "The Arrival" });
  const later = entity("Events/C.md", { world_entity: "event", world_time: "2027-01-01" }, { entityType: "event", name: "The Arrival" });
  equal(review([year, day]).observations.some((item) => item.kind === "story-world.event.conflicting-time"), false);
  ok(review([year, later]).observations.some((item) => item.kind === "story-world.event.conflicting-time"));
  const oneEvent = entity("Events/One.md", { world_entity: "event", world_time: ["2026", "2028-01-01"] }, { entityType: "event", name: "One Event" });
  ok(review([oneEvent]).observations.some((item) => item.kind === "story-world.event.conflicting-time"));
  const compatible = entity("Events/Compatible.md", { world_entity: "event", world_time: ["2026", "2026-05-13"] }, { entityType: "event", name: "Compatible Event" });
  equal(review([compatible]).observations.some((item) => item.kind === "story-world.event.conflicting-time"), false);
});

test("uses typed-property cardinality and ignores unknown property disagreements", () => {
  const first = entity("Locations/A.md", { world_entity: "location", timezone: "Europe/London", invented_fact: "one" }, { entityType: "location", name: "Station" });
  const second = entity("Locations/B.md", { world_entity: "location", timezone: "America/New_York", invented_fact: "two" }, { entityType: "location", name: "Station" });
  const findings = review([first, second]).observations.filter((item) => item.kind === "story-world.typed-property.single-value-conflict");
  equal(findings.length, 1);
  equal(findings[0].evidence[0].source.property[0], "timezone");
  const malformedSingle = entity("Locations/C.md", { world_entity: "location", timezone: ["Europe/London", "Asia/Tokyo"] }, { entityType: "location", name: "Other Station" });
  equal(review([malformedSingle]).observations.filter((item) => item.kind === "story-world.typed-property.single-value-conflict").length, 1);
  const references = [
    entity("References/A.md", { world_entity: "reference", reference_authors: ["A", "B"] }, { entityType: "reference", name: "Paper" }),
    entity("References/B.md", { world_entity: "reference", reference_authors: ["C"] }, { entityType: "reference", name: "Paper" })
  ];
  equal(review(references).observations.some((item) => item.kind === "story-world.typed-property.single-value-conflict"), false);
});

test("reports ambiguous and explicit broken Story World manuscript links but ignores ordinary unresolved links", () => {
  const robin = entity("World/Robin.md", { world_entity: "character" }, { name: "Robin", aliases: [] });
  const alias = entity("World/Bird.md", { world_entity: "character" }, { name: "Bird", aliases: ["Robin"] });
  const docs: StoryWorldReviewDocument[] = [
    ...documents([robin, alias]),
    { path: "Book/Scene.md", basename: "Scene", frontmatter: { type: "scene" }, links: [
      { raw: "[[Robin|Robin said]]", linkpath: "Robin", displayText: "Robin said", start: 10, end: 30 },
      { raw: "[[Story World/Missing]]", linkpath: "Story World/Missing", displayText: null, start: 40, end: 63 },
      { raw: "[[Draft thought]]", linkpath: "Draft thought", displayText: null, start: 70, end: 87 }
    ] }
  ];
  const kinds = buildStoryWorldReview(docs, [robin, alias], () => null).observations.map((item) => item.kind);
  equal(kinds.filter((kind) => kind === "story-world.link.ambiguous").length, 1);
  equal(kinds.filter((kind) => kind === "story-world.link.broken").length, 1);
  const qualified = { ...docs[2], links: [{ raw: "[[World/Robin]]", linkpath: "World/Robin", displayText: null, start: 0, end: 15 }] };
  equal(buildStoryWorldReview([...documents([robin, alias]), qualified], [robin, alias], () => null).observations
    .some((item) => item.kind === "story-world.link.ambiguous"), false);
});

test("orphan review respects manuscript links, semantic links and scoped POV descendants", () => {
  const linked = entity("World/Linked.md", { world_entity: "character" });
  const target = entity("World/Target.md", { world_entity: "location" });
  const source = entity("World/Source.md", { world_entity: "character", world_relationships: [{ predicate: "visits", target: "[[World/Target]]" }] }, { links: ["[[World/Target]]"] });
  const orphan = entity("World/Orphan.md", { world_entity: "weather-system" }, { entityType: "weather-system" });
  const base = entity("World/Base.md", { world_entity: "pov-profile" }, { entityType: "pov-profile" });
  const owner = entity("World/Owner.md", { world_entity: "character", pov_profile: "[[World/Base]]" });
  const scoped = entity("World/Scoped.md", { world_entity: "pov-profile", pov_extends: "[[World/Base]]", world_scope: ["[[Books/One]]"] }, { entityType: "pov-profile" });
  const all = [linked, target, source, orphan, base, owner, scoped];
  const docs: StoryWorldReviewDocument[] = [...documents(all), {
    path: "Book/Scene.md", basename: "Scene", frontmatter: { type: "scene" }, links: [{ raw: "[[World/Linked]]", linkpath: "World/Linked", displayText: null, start: 0, end: 16 }]
  }];
  const result = buildStoryWorldReview(docs, all, (reference) => {
    const path = `${parseTarget(reference)}.md`;
    return all.some((item) => item.path === path) ? { path, indexed: true } : null;
  });
  const orphanPaths = result.observations.filter((item) => item.kind === "story-world.entity.orphan").map((item) => item.primary.path);
  deepEqual(orphanPaths, [orphan.path, owner.path, source.path]);
});

test("world_context semantic references prevent orphans through canonical, alias and qualified identity", () => {
  const canonical = entity("World/Intervention.md", { world_entity: "event" }, {
    entityType: "event", name: "First Routing Intervention"
  });
  const alias = entity("World/Four deaths.md", { world_entity: "event", aliases: ["Four deaths"] }, {
    entityType: "event", name: "Four PRIME-Linked Deaths Identified", aliases: ["Four deaths"]
  });
  const qualified = entity("Story World/Locations/Reserve.md", { world_entity: "location" }, {
    entityType: "location", name: "Coastal Reserve"
  });
  const scene: StoryWorldReviewDocument = {
    path: "Books/One/Scene.md", basename: "Scene", links: [],
    frontmatter: {
      type: "scene",
      world_context: [
        "[[First Routing Intervention]]",
        "[[Four deaths]]",
        "[[Story World/Locations/Reserve]]"
      ]
    }
  };
  const result = semanticReview([scene], [canonical, alias, qualified]);
  equal(result.observations.some((item) => item.kind === "story-world.entity.orphan"), false);
});

test("unresolved, ambiguous and malformed world_context values never guess away an orphan", () => {
  const first = entity("World/One.md", { world_entity: "event" }, {
    entityType: "event", name: "Collision", aliases: ["Shared"]
  });
  const second = entity("World/Two.md", { world_entity: "event" }, {
    entityType: "event", name: "Other", aliases: ["Shared"]
  });
  const scene: StoryWorldReviewDocument = {
    path: "Books/One/Scene.md", basename: "Scene", links: [],
    frontmatter: { type: "scene", world_context: ["[[Shared]]", "[[Missing]]", "not a link", 42] }
  };
  const orphanPaths = semanticReview([scene], [first, second]).observations
    .filter((item) => item.kind === "story-world.entity.orphan")
    .map((item) => item.primary.path);
  deepEqual(orphanPaths, [first.path, second.path]);
});

test("semantic Scene POV references Characters and Intelligences without rewriting world_context", () => {
  const character = entity("World/Pip.md", { world_entity: "character" }, { name: "Pip" });
  const intelligence = entity("World/PRIME.md", { world_entity: "intelligence" }, {
    entityType: "intelligence", name: "PRIME"
  });
  const characterFrontmatter = { type: "scene", pov: "[[Pip]]", custom: { preserved: true } };
  const intelligenceFrontmatter = { type: "scene", viewpoint: "[[PRIME]]" };
  const before = JSON.stringify([characterFrontmatter, intelligenceFrontmatter]);
  const result = semanticReview([
    { path: "Books/One/Pip.md", basename: "Pip Scene", links: [], frontmatter: characterFrontmatter },
    { path: "Books/One/Prime.md", basename: "PRIME Scene", links: [], frontmatter: intelligenceFrontmatter },
    { path: "Books/One/Broken.md", basename: "Broken", links: [], frontmatter: { type: "scene", pov: "[[Missing]]" } }
  ], [character, intelligence]);
  equal(result.observations.some((item) => item.kind === "story-world.entity.orphan"), false);
  equal(JSON.stringify([characterFrontmatter, intelligenceFrontmatter]), before);
  equal(Object.prototype.hasOwnProperty.call(characterFrontmatter, "world_context"), false);
});

test("semantic Scene location counts only indexed Location targets", () => {
  const location = entity("World/Reserve.md", { world_entity: "location" }, {
    entityType: "location", name: "Reserve"
  });
  const character = entity("World/Robin.md", { world_entity: "character" }, { name: "Robin" });
  const result = semanticReview([
    { path: "Books/One/Located.md", basename: "Located", links: [], frontmatter: { type: "scene", location: "[[Reserve]]" } },
    { path: "Books/One/Wrong.md", basename: "Wrong", links: [], frontmatter: { type: "scene", location: "[[Robin]]" } }
  ], [location, character]);
  const orphanPaths = result.observations.filter((item) => item.kind === "story-world.entity.orphan")
    .map((item) => item.primary.path);
  deepEqual(orphanPaths, [character.path]);
});

test("review invalidation fingerprints recognised semantic fields but not arbitrary hierarchy YAML", () => {
  const base = { type: "scene", parent: "[[Books/One]]", custom: "[[World/Other]]" };
  equal(storyWorldReviewEvidenceFingerprint(base), null);
  const explicit = storyWorldReviewEvidenceFingerprint({ ...base, world_context: ["[[World/Event]]"] });
  const pov = storyWorldReviewEvidenceFingerprint({ ...base, viewpoint: "[[World/Pip]]" });
  const location = storyWorldReviewEvidenceFingerprint({ ...base, location: "[[World/Reserve]]" });
  ok(explicit);
  ok(pov);
  ok(location);
  notEqual(explicit, storyWorldReviewEvidenceFingerprint({ ...base, world_context: ["[[World/Other Event]]"] }));
  notEqual(pov, storyWorldReviewEvidenceFingerprint({ ...base, viewpoint: "[[World/Robin]]" }));
  notEqual(location, storyWorldReviewEvidenceFingerprint({ ...base, location: "[[World/Station]]" }));
  equal(
    storyWorldReviewEvidenceFingerprint({ ...base, parent: "[[Books/Two]]" }),
    null
  );
});

function parseTarget(reference: string): string {
  return /^\[\[([^|\]#]+)/u.exec(reference)?.[1] ?? reference;
}
