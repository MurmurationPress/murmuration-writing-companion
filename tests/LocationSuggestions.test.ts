import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  buildLocationSuggestions,
  locationSuggestionInputValues,
  locationNavigationTarget,
  resolveLocationInput
} from "../src/companion/LocationSuggestions";
import type { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";

function entity(patch: Partial<StoryWorldEntityRecord> = {}): StoryWorldEntityRecord {
  return {
    path: "Story World/Locations/Reserve.md", basename: "Reserve", entityType: "location",
    name: "Coastal Nature Reserve", aliases: ["The Reserve"], facets: [], scope: [], status: null,
    summary: null, firstAppearance: null, sources: [], links: [], properties: {}, ...patch
  };
}

test("offers only explicitly indexed Location entities case-insensitively", () => {
  const suggestions = buildLocationSuggestions([
    entity(),
    entity({ path: "World/Upper.md", basename: "Upper", name: "Upper", entityType: "Location" }),
    entity({ path: "World/Character.md", basename: "Character", name: "Character", entityType: "character" }),
    entity({ path: "Story World/Locations/Folder Only.md", basename: "Folder Only", name: "Folder Only", entityType: "technology" })
  ]);
  deepEqual(suggestions.map((item) => item.entity.name), ["Coastal Nature Reserve", "Upper"]);
});

test("aliases select Locations and persistence uses a canonical wikilink", () => {
  const suggestions = buildLocationSuggestions([entity()]);
  equal(resolveLocationInput("The Reserve", suggestions), "[[Story World/Locations/Reserve|Coastal Nature Reserve]]");
  equal(resolveLocationInput("Selsey seafront", suggestions), "Selsey seafront");
  equal(resolveLocationInput("[[Missing Place]]", suggestions), "[[Missing Place]]");
  equal(resolveLocationInput("[[Story World/Characters/Mara Venn]]", suggestions), "[[Story World/Characters/Mara Venn]]");
  equal(resolveLocationInput(suggestions[0].storedValue, suggestions), suggestions[0].storedValue);
});

test("duplicate names receive path context and ambiguous bare names remain authored text", () => {
  const suggestions = buildLocationSuggestions([
    entity({ path: "World/Book One/Reserve.md" }),
    entity({ path: "World/Book Two/Reserve.md", aliases: ["Second Reserve"] })
  ]);
  deepEqual(suggestions.map((item) => item.secondary), ["World/Book One", "World/Book Two"]);
  equal(resolveLocationInput("Coastal Nature Reserve", suggestions), "Coastal Nature Reserve");
  equal(resolveLocationInput("Coastal Nature Reserve — World/Book Two", suggestions),
    "[[World/Book Two/Reserve|Coastal Nature Reserve]]");
  equal(locationSuggestionInputValues(suggestions).some((item) => item.value.includes("World/Book One")), true);
  deepEqual(suggestions.map((item) => item.navigationTarget), ["World/Book One/Reserve", "World/Book Two/Reserve"]);
  deepEqual(suggestions.map((item) => locationNavigationTarget(item.entity)), ["World/Book One/Reserve", "World/Book Two/Reserve"]);
});

test("navigation requires a resolved Location and never uses stored brackets or free text", () => {
  const home = entity({
    path: "Story World/Locations/Tobias' Home.md", basename: "Tobias' Home",
    name: "Tobias' Home", aliases: ["Home"]
  });
  const [suggestion] = buildLocationSuggestions([home]);
  equal(suggestion.storedValue, "[[Story World/Locations/Tobias' Home]]");
  equal(suggestion.label, "Tobias' Home");
  equal(suggestion.navigationTarget, "Story World/Locations/Tobias' Home");
  equal(locationNavigationTarget(home), "Story World/Locations/Tobias' Home");
  equal(locationNavigationTarget(null), null);
  equal(locationNavigationTarget(entity({ entityType: "character" })), null);
  equal(resolveLocationInput("Home", [suggestion]), suggestion.storedValue);
});
