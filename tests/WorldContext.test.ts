import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  buildWorldContext,
  buildWorldContextHierarchy,
  buildWorldContextStatus,
  buildWorldContextSummary,
  formatWorldEntityType,
  getWorldEventTime,
  groupWorldContextEntries,
  presentWorldStatus
} from "../src/story-world/WorldContext";
import { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";

function entity(
  path: string,
  name: string,
  entityType: string,
  status: string | null = "confirmed",
  summary: string | null = null,
  properties: Record<string, unknown> = {}
): StoryWorldEntityRecord {
  return {
    path,
    basename: path.split("/").pop()?.replace(/\.md$/i, "") ?? path,
    name,
    entityType,
    status,
    summary,
    aliases: [],
    facets: [],
    scope: [],
    firstAppearance: null,
    sources: [],
    links: [],
    properties
  };
}

function resolver(entries: Record<string, StoryWorldEntityRecord>) {
  return (reference: string) => entries[reference] ?? null;
}

test("uses explicit world context and omits a POV-only character", () => {
  const pip = entity("World/Pip.md", "Pip", "character");
  const robin = entity("World/Robin.md", "Robin", "character");
  const prime = entity("World/PRIME.md", "PRIME", "intelligence");

  const result = buildWorldContext(
    {
      POV: "[[Pip]]",
      world_context: ["[[Robin]]", "[[PRIME]]"]
    },
    resolver({
      "[[Pip]]": pip,
      "[[Robin]]": robin,
      "[[PRIME]]": prime
    })
  );

  deepEqual(result.entries.map((entry) => entry.entity.name), [
    "Robin",
    "PRIME"
  ]);
  deepEqual(result.entries.map((entry) => entry.reasons), [
    ["explicit"],
    ["explicit"]
  ]);
  deepEqual(result.unresolvedReferences, []);
  equal(result.invalidReferenceCount, 0);
});

test("retains POV as a secondary reason when the entity is explicitly referenced", () => {
  const tobias = entity("World/Tobias Hale.md", "Tobias Hale", "character");

  const result = buildWorldContext(
    {
      viewpoint: "[[Tobias]]",
      world_context: [
        "[[Characters/Tobias Hale|Tobias]]",
        "[[Tobias]]",
        "[[Characters/Tobias Hale|Tobias]]"
      ]
    },
    () => tobias
  );

  equal(result.entries.length, 1);
  equal(result.entries[0].entity.path, "World/Tobias Hale.md");
  deepEqual(result.entries[0].reasons, ["explicit", "pov"]);
});

test("reports malformed and unresolved explicit links without diagnosing POV", () => {
  const result = buildWorldContext(
    {
      pov: "Tobias",
      world_context: [
        "[[Missing]]",
        "[[missing]]",
        "plain text",
        42,
        null
      ]
    },
    () => null
  );

  deepEqual(result.entries, []);
  deepEqual(result.unresolvedReferences, ["[[Missing]]"]);
  equal(result.invalidReferenceCount, 1);
  equal(buildWorldContextSummary(result), "No resolved world context");
  equal(buildWorldContextStatus(result), "1 unresolved");
});

test("missing context produces a quiet empty summary", () => {
  const result = buildWorldContext(undefined, () => null);

  deepEqual(result.entries, []);
  deepEqual(result.unresolvedReferences, []);
  equal(result.invalidReferenceCount, 0);
  equal(buildWorldContextSummary(result), "No world context");
  equal(buildWorldContextStatus(result), "");
});

test("places events first while preserving supporting group order", () => {
  const pip = entity("World/Pip.md", "Pip", "character");
  const article = entity(
    "World/The Article.md",
    "The Article",
    "event",
    "confirmed",
    "Tobias publicly names PRIME.",
    { world_time: "2029-04-19" }
  );
  const northbridge = entity(
    "World/Northbridge Systems.md",
    "Northbridge Systems",
    "organisation"
  );
  const tobias = entity("World/Tobias.md", "Tobias", "character");

  const result = buildWorldContext(
    {
      world_context: [
        "[[Pip]]",
        "[[The Article]]",
        "[[Northbridge]]",
        "[[Tobias]]"
      ]
    },
    resolver({
      "[[Pip]]": pip,
      "[[The Article]]": article,
      "[[Northbridge]]": northbridge,
      "[[Tobias]]": tobias
    })
  );
  const groups = groupWorldContextEntries(result.entries);
  const hierarchy = buildWorldContextHierarchy(result.entries);

  deepEqual(groups.map((group) => group.label), [
    "Event",
    "Character",
    "Organisation"
  ]);
  deepEqual(hierarchy.events.map((entry) => entry.entity.name), ["The Article"]);
  deepEqual(hierarchy.supportingGroups.map((group) => group.label), [
    "Character",
    "Organisation"
  ]);
  deepEqual(hierarchy.supportingGroups[0].entries.map((entry) => entry.entity.name), [
    "Pip",
    "Tobias"
  ]);
  equal(formatWorldEntityType("distributed-system"), "Distributed System");
});

test("reads an event's authoritative world_time without deriving another fact", () => {
  const article = entity(
    "World/The Article.md",
    "The Article",
    "event",
    "confirmed",
    null,
    { world_time: "2029-04-19" }
  );
  const dated = entity(
    "World/Dated.md",
    "Dated event",
    "event",
    "confirmed",
    null,
    { world_time: new Date("2029-04-20T00:00:00.000Z") }
  );
  const character = entity(
    "World/Pip.md",
    "Pip",
    "character",
    "confirmed",
    null,
    { world_time: "ignored only by presentation semantics" }
  );

  equal(getWorldEventTime(article), "2029-04-19");
  equal(getWorldEventTime(dated), "2029-04-20");
  equal(getWorldEventTime(character), null);
});

test("presents canon status independently from entity relevance", () => {
  deepEqual(presentWorldStatus("confirmed"), {
    value: "confirmed",
    label: "Confirmed",
    tone: "confirmed"
  });
  deepEqual(presentWorldStatus("planned"), {
    value: "planned",
    label: "Planned",
    tone: "provisional"
  });
  deepEqual(presentWorldStatus("candidate"), {
    value: "candidate",
    label: "Candidate",
    tone: "provisional"
  });
  deepEqual(presentWorldStatus("unresolved"), {
    value: "unresolved",
    label: "Unresolved",
    tone: "unresolved"
  });
  deepEqual(presentWorldStatus("superseded"), {
    value: "superseded",
    label: "Superseded",
    tone: "superseded"
  });
  deepEqual(presentWorldStatus(null), {
    value: null,
    label: "Unclassified",
    tone: "unclassified"
  });
  deepEqual(presentWorldStatus("local-draft"), {
    value: "local-draft",
    label: "Local Draft",
    tone: "custom"
  });
});

test("builds event-first collapsed summaries and counts", () => {
  const entries = [
    entity("World/Pip.md", "Pip", "character"),
    entity("World/Robin.md", "Robin", "character"),
    entity("World/The Article.md", "The Article", "event"),
    entity("World/JANUS.md", "JANUS", "intelligence", "planned")
  ];
  const result = buildWorldContext(
    {
      world_context: entries.map((item) => `[[${item.name}]]`)
    },
    (reference) => entries.find((item) => reference === `[[${item.name}]]`) ?? null
  );

  equal(buildWorldContextSummary(result), "The Article · Pip · Robin +1");
  equal(buildWorldContextSummary(result, 2), "The Article · Pip +2");
  equal(buildWorldContextStatus(result), "4 entities");
});

test("supports scalar event context with summary and world time", () => {
  const article = entity(
    "World/The Article.md",
    "The Article",
    "event",
    "candidate",
    "Tobias's public naming of PRIME.",
    { world_time: "2029-04-19" }
  );
  const result = buildWorldContext(
    { world_context: "[[The Article]]" },
    resolver({ "[[The Article]]": article })
  );

  equal(result.entries.length, 1);
  equal(result.entries[0].entity.summary, "Tobias's public naming of PRIME.");
  equal(getWorldEventTime(result.entries[0].entity), "2029-04-19");
  equal(buildWorldContextStatus(result), "1 entity");
});
