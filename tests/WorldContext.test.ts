import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  buildWorldContext,
  buildWorldContextStatus,
  buildWorldContextSummary,
  formatWorldEntityType,
  groupWorldContextEntries,
  presentWorldStatus
} from "../src/story-world/WorldContext";
import { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";

function entity(
  path: string,
  name: string,
  entityType: string,
  status: string | null = "confirmed",
  summary: string | null = null
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
    properties: {}
  };
}

function resolver(entries: Record<string, StoryWorldEntityRecord>) {
  return (reference: string) => entries[reference] ?? null;
}

test("combines recognised POV and explicit context in author order", () => {
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
    "Pip",
    "Robin",
    "PRIME"
  ]);
  deepEqual(result.entries.map((entry) => entry.reasons), [
    ["pov"],
    ["explicit"],
    ["explicit"]
  ]);
  deepEqual(result.unresolvedReferences, []);
  equal(result.invalidReferenceCount, 0);
});

test("deduplicates entities by resolved path while retaining relevance reasons", () => {
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
  deepEqual(result.entries[0].reasons, ["pov", "explicit"]);
});

test("ignores malformed and plain-text values while reporting unique unresolved links quietly", () => {
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
  equal(result.invalidReferenceCount, 2);
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

test("groups entries by entity type without losing first-seen group order", () => {
  const pip = entity("World/Pip.md", "Pip", "character");
  const northbridge = entity(
    "World/Northbridge Systems.md",
    "Northbridge Systems",
    "organisation"
  );
  const tobias = entity("World/Tobias.md", "Tobias", "character");

  const result = buildWorldContext(
    {
      world_context: ["[[Pip]]", "[[Northbridge]]", "[[Tobias]]"]
    },
    resolver({
      "[[Pip]]": pip,
      "[[Northbridge]]": northbridge,
      "[[Tobias]]": tobias
    })
  );
  const groups = groupWorldContextEntries(result.entries);

  deepEqual(groups.map((group) => group.label), ["Character", "Organisation"]);
  deepEqual(groups[0].entries.map((entry) => entry.entity.name), ["Pip", "Tobias"]);
  deepEqual(groups[1].entries.map((entry) => entry.entity.name), [
    "Northbridge Systems"
  ]);
  equal(formatWorldEntityType("distributed-system"), "Distributed System");
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

test("builds concise collapsed summaries and counts", () => {
  const entries = [
    entity("World/Pip.md", "Pip", "character"),
    entity("World/Robin.md", "Robin", "character"),
    entity("World/PRIME.md", "PRIME", "intelligence"),
    entity("World/JANUS.md", "JANUS", "intelligence", "planned")
  ];
  const result = buildWorldContext(
    {
      world_context: entries.map((item) => `[[${item.name}]]`)
    },
    (reference) => entries.find((item) => reference === `[[${item.name}]]`) ?? null
  );

  equal(buildWorldContextSummary(result), "Pip · Robin · PRIME +1");
  equal(buildWorldContextSummary(result, 2), "Pip · Robin +2");
  equal(buildWorldContextStatus(result), "4 entities");
});

test("supports scalar world_context and optional summaries", () => {
  const article = entity(
    "World/The Article.md",
    "The Article",
    "document",
    "candidate",
    "Tobias's public naming of PRIME."
  );
  const result = buildWorldContext(
    { world_context: "[[The Article]]" },
    resolver({ "[[The Article]]": article })
  );

  equal(result.entries.length, 1);
  equal(result.entries[0].entity.summary, "Tobias's public naming of PRIME.");
  equal(buildWorldContextStatus(result), "1 entity");
});
