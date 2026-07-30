import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { projectStoryWorldReference, referenceNavigatorDetail, safeReferenceExternalUrl } from "../src/story-world/StoryWorldReference";
import { filterStoryWorldBuilderItems, groupStoryWorldBuilderItems, storyWorldBuilderItems } from "../src/story-world/WorldBuilder";

const properties = {
  world_entity: "reference",
  world_name: "Companion cognition",
  aliases: ["Companion AI source"],
  world_scope: "[[Research Book]]",
  reference_authors: ["Hawkins, Edward", "Vale, Ada"],
  reference_title: "Companion cognition and personal AI",
  reference_journal: "Journal of Example Studies",
  reference_container: "Murmuration Press research notes",
  reference_date: 2026,
  reference_key: "hawkins-2026-companion",
  link: "https://example.org/source",
  unconventional_reference_detail: { preserved: true }
};

test("projects optional reference metadata without losing authored author order or precision", () => {
  const projection = projectStoryWorldReference(properties);
  deepEqual(projection.authors, ["Hawkins, Edward", "Vale, Ada"]);
  equal(projection.date, "2026");
  equal(projection.title, "Companion cognition and personal AI");
  equal(projection.journal, "Journal of Example Studies");
  equal(projection.link, "https://example.org/source");
  equal(referenceNavigatorDetail(properties), "Hawkins · 2026");
  deepEqual((properties.unconventional_reference_detail), { preserved: true });
});

test("reads legacy reference_url while canonical link wins when both are authored", () => {
  equal(projectStoryWorldReference({ reference_url: "https://legacy.example/source" }).link, "https://legacy.example/source");
  const both = projectStoryWorldReference({
    link: "https://canonical.example/source",
    reference_url: "https://legacy.example/source",
    unknown_reference_property: { preserved: true }
  });
  equal(both.link, "https://canonical.example/source");
  equal(both.legacyUrl, "https://legacy.example/source");
});

test("allows explicit HTTP links and rejects unsafe external-link schemes", () => {
  equal(safeReferenceExternalUrl("https://example.org/source"), "https://example.org/source");
  equal(safeReferenceExternalUrl("javascript:alert(1)"), null);
  equal(safeReferenceExternalUrl("not a URL"), null);
});

test("Reference projection, navigator detail and URL safety perform no network access", () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => { requests += 1; throw new Error("unexpected network request"); }) as typeof fetch;
  try {
    projectStoryWorldReference(properties);
    referenceNavigatorDetail(properties);
    safeReferenceExternalUrl("https://example.org/source");
    equal(requests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing optional fields and malformed author scalars project safely", () => {
  deepEqual(projectStoryWorldReference({}).authors, []);
  equal(projectStoryWorldReference({ reference_authors: "Hawkins, Edward" }).authors.length, 0);
  deepEqual(projectStoryWorldReference({ reference_authors: ["Hawkins, Edward", 42] }).authors, ["Hawkins, Edward"]);
  equal(projectStoryWorldReference({ reference_title: { unexpected: true } }).title, null);
});

test("groups references and searches name, alias, title, author and key", () => {
  const items = storyWorldBuilderItems([{ path: "Story World/References/Companion.md", basename: "Companion", frontmatter: properties }]);
  equal(groupStoryWorldBuilderItems(items)[0].label, "References");
  for (const query of ["cognition", "companion ai source", "personal ai", "hawkins", "2026-companion", "example studies", "example.org/source"]) {
    equal(filterStoryWorldBuilderItems(items, query).length, 1, query);
  }
});
