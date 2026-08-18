import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  buildPovSuggestions,
  collectPovSuggestionValues,
  resolvePovInput
} from "../src/companion/PovSuggestions";
import type { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";

function entity(overrides: Partial<StoryWorldEntityRecord>): StoryWorldEntityRecord {
  return {
    path: "Story World/Tobias.md",
    basename: "Tobias",
    entityType: "character",
    name: "Tobias Hale",
    aliases: ["Tobias"],
    facets: [],
    scope: [],
    status: "confirmed",
    summary: null,
    firstAppearance: null,
    sources: [],
    links: [],
    properties: {},
    ...overrides
  };
}

test("suggests backward-compatible characters and explicitly eligible entities", () => {
  const suggestions = buildPovSuggestions([
    entity({}),
    entity({ path: "Story World/PRIME.md", basename: "PRIME", entityType: "intelligence", name: "PRIME", aliases: [], properties: { pov_eligible: true } }),
    entity({ path: "Story World/JANUS.md", basename: "JANUS", entityType: "intelligence", name: "JANUS", aliases: [], properties: {} }),
    entity({ path: "Story World/Ship.md", basename: "Ship", entityType: "location", name: "Ship", aliases: [], properties: { pov_eligible: true } }),
    entity({ path: "Story World/Ware.md", basename: "Ware", entityType: "location", name: "Ware", aliases: [] })
  ]);

  deepEqual(suggestions.map((item) => item.entity.name), ["PRIME", "Ship", "Tobias Hale"]);
});

test("explicit false overrides the Character compatibility default", () => {
  deepEqual(buildPovSuggestions([entity({ properties: { pov_eligible: false } })]), []);
});

test("a linked POV profile makes a non-character entity eligible unless explicitly disabled", () => {
  const prime = entity({
    path: "Story World/PRIME.md",
    basename: "PRIME",
    entityType: "intelligence",
    name: "PRIME",
    aliases: [],
    properties: { pov_profile: "[[Story World/POV Profiles/PRIME POV]]" }
  });
  equal(buildPovSuggestions([prime])[0]?.entity.name, "PRIME");
  deepEqual(buildPovSuggestions([{ ...prime, properties: { ...prime.properties, pov_eligible: false } }]), []);
});

test("prefers characters scoped to the active book", () => {
  const suggestions = buildPovSuggestions([
    entity({ path: "Pip.md", basename: "Pip", name: "Pip", aliases: [], scope: ["[[EMERGENCE]]"] }),
    entity({ scope: ["[[PLURALITY]]"] })
  ], ["PLURALITY"]);

  equal(suggestions[0].entity.name, "Tobias Hale");
  equal(suggestions[0].scoped, true);
});

test("turns an exact canonical name or alias into a canonical wikilink", () => {
  const suggestions = buildPovSuggestions([entity({})]);
  equal(resolvePovInput("Tobias", suggestions), "[[Story World/Tobias|Tobias Hale]]");
  equal(resolvePovInput("Tobias Hale", suggestions), "[[Story World/Tobias|Tobias Hale]]");
  equal(resolvePovInput("[[Tobias]]", suggestions), "[[Tobias]]");
  equal(resolvePovInput("New Character", suggestions), "[[New Character]]");
});

test("provides canonical names and aliases for the native suggestion list", () => {
  const suggestions = buildPovSuggestions([entity({ aliases: ["Tobias", "T. Hale"] })]);
  deepEqual(collectPovSuggestionValues(suggestions), ["Tobias Hale", "Tobias", "T. Hale"]);
});
