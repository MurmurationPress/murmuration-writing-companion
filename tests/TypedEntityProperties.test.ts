import { deepEqual, equal, notStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { REFERENCE_PROPERTY_NAMES, readReferenceMetadata } from "../src/references/ReferenceMetadata";
import { parseStoryWorldEntity, type StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";
import {
  buildStoryWorldTypedEntityReferenceCandidates,
  LOCATION_TYPED_PROPERTY_NAMES,
  readContextUsefulStoryWorldTypedProperties,
  readStoryWorldTypedProperties,
  REFERENCE_TYPED_PROPERTY_NAMES,
  storyWorldTypedPropertyDefinition,
  storyWorldTypedPropertyDefinitions,
  storyWorldTypedPropertyTextValues,
  validateStoryWorldTypedPropertyValue
} from "../src/story-world/TypedEntityProperties";

function entity(path: string, entityType: string, name: string): StoryWorldEntityRecord {
  return {
    path, basename: name, entityType, name, aliases: [], facets: [], scope: [], status: null,
    summary: null, firstAppearance: null, sources: [], links: [], properties: { world_entity: entityType }
  };
}

test("central lookup recognises Reference properties with existing canonical names", () => {
  strictEqual(REFERENCE_PROPERTY_NAMES, REFERENCE_TYPED_PROPERTY_NAMES);
  const definitions = storyWorldTypedPropertyDefinitions(" Reference ");
  deepEqual(definitions.map((definition) => definition.property), Object.values(REFERENCE_PROPERTY_NAMES));
  equal(storyWorldTypedPropertyDefinition("reference", "reference_authors")?.cardinality, "multiple");
  equal(storyWorldTypedPropertyDefinition("reference", "reference_link")?.valueType, "url");
  deepEqual(readReferenceMetadata({
    reference_authors: ["Vale, A.", "Fenwick, P."], reference_title: "A Study",
    reference_date: 2024, reference_publication: "Journal", reference_doi: "10.1000/study",
    reference_link: "https://doi.org/10.1000/study"
  }), {
    authors: ["Vale, A.", "Fenwick, P."], title: "A Study", date: "2024", publication: "Journal",
    publisher: null, volume: null, issue: null, pages: null, doi: "10.1000/study",
    link: "https://doi.org/10.1000/study"
  });
});

test("Location definitions are deliberately small and carry semantic constraints", () => {
  const definitions = storyWorldTypedPropertyDefinitions("LOCATION");
  deepEqual(definitions.map((definition) => definition.property), [
    "address", "latitude", "longitude", "timezone", "parent_location"
  ]);
  equal(storyWorldTypedPropertyDefinition("location", LOCATION_TYPED_PROPERTY_NAMES.parent)?.valueType, "entity-reference");
  deepEqual(storyWorldTypedPropertyDefinition("location", LOCATION_TYPED_PROPERTY_NAMES.parent)?.targetEntityTypes, ["location"]);
  equal(storyWorldTypedPropertyDefinition("location", "timezone")?.contextUseful, true);
  equal(validateStoryWorldTypedPropertyValue(definitions[1], 51.5074), null);
  equal(validateStoryWorldTypedPropertyValue(definitions[1], 91)?.includes("between"), true);
  equal(validateStoryWorldTypedPropertyValue(definitions[3], "Europe/London"), null);
  equal(validateStoryWorldTypedPropertyValue(definitions[3], "GMT plus-ish")?.includes("IANA"), true);
});

test("typed entity-reference candidates include only allowed entity types", () => {
  const definition = storyWorldTypedPropertyDefinition("location", "parent_location");
  if (!definition) throw new Error("Expected Location parent definition");
  const candidates = buildStoryWorldTypedEntityReferenceCandidates(definition, [
    entity("Story World/Locations/London.md", "location", "London"),
    entity("Story World/Characters/Robin.md", "character", "Robin"),
    entity("Story World/References/Map.md", "reference", "Map")
  ]);
  deepEqual(candidates.map((candidate) => candidate.label), ["London"]);
  equal(candidates[0].storedValue, "[[Story World/Locations/London]]");
});

test("recognised reads remain additive and preserve custom YAML exactly", () => {
  const custom = { nested: { author: true }, list: ["one", { two: 2 }] };
  const frontmatter = {
    world_entity: "location", world_name: "Observatory", address: "Greywater Point",
    timezone: "Europe/London", parent_location: "[[Coast]]", custom_author_fact: custom
  };
  const parsed = parseStoryWorldEntity({ path: "World/Observatory.md", basename: "Observatory", frontmatter });
  if (!parsed) throw new Error("Expected entity");
  notStrictEqual(parsed.properties, frontmatter);
  deepEqual(parsed.properties, frontmatter);
  deepEqual(parsed.properties.custom_author_fact, custom);
  const recognised = readStoryWorldTypedProperties(parsed.entityType, parsed.properties);
  deepEqual(recognised.map((property) => property.definition.property), ["address", "timezone", "parent_location"]);
  deepEqual(recognised.map(storyWorldTypedPropertyTextValues), [["Greywater Point"], ["Europe/London"], ["[[Coast]]"]]);
  deepEqual(readContextUsefulStoryWorldTypedProperties(parsed.entityType, parsed.properties).map((property) => property.definition.property), [
    "address", "timezone", "parent_location"
  ]);
  deepEqual(frontmatter.custom_author_fact, custom);
});

test("entities without a typed definition remain valid and expose no irrelevant fields", () => {
  const properties = { world_entity: "weather-system", pressure_model: "custom", address: "Author-defined meaning" };
  const parsed = parseStoryWorldEntity({ path: "World/Storm.md", basename: "Storm", frontmatter: properties });
  if (!parsed) throw new Error("Expected custom entity");
  deepEqual(storyWorldTypedPropertyDefinitions(parsed.entityType), []);
  deepEqual(readStoryWorldTypedProperties(parsed.entityType, parsed.properties), []);
  deepEqual(parsed.properties, properties);
});

test("single and multiple values retain their declared presentation semantics", () => {
  const values = readStoryWorldTypedProperties("reference", {
    reference_authors: ["One", "Two"], reference_title: "Title"
  });
  deepEqual(values.map((value) => [value.definition.cardinality, storyWorldTypedPropertyTextValues(value)]), [
    ["multiple", ["One", "Two"]],
    ["single", ["Title"]]
  ]);
});
