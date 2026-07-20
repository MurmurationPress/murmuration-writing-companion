import { deepEqual, equal, match } from "node:assert/strict";
import { test } from "node:test";
import {
  buildPovCharacterCreationProposal,
  buildPovCharacterMarkdown,
  extractPovCharacterName,
  findMatchingPovSuggestions
} from "../src/companion/PovCharacterCreation";
import { buildPovSuggestions } from "../src/companion/PovSuggestions";
import type { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";

function entity(overrides: Partial<StoryWorldEntityRecord> = {}): StoryWorldEntityRecord {
  return {
    path: "Story World/Characters/Tobias.md",
    basename: "Tobias",
    entityType: "character",
    name: "Tobias Hale",
    aliases: ["Tobias"],
    facets: [],
    scope: ["[[PLURALITY]]"],
    status: "confirmed",
    summary: null,
    firstAppearance: null,
    sources: [],
    links: [],
    properties: {},
    ...overrides
  };
}

test("extracts a character name from free text and unresolved wikilinks", () => {
  equal(extractPovCharacterName(" Robin  Vale "), "Robin Vale");
  equal(extractPovCharacterName("[[People/Robin Vale]]"), "Robin Vale");
  equal(extractPovCharacterName("[[People/RV|Robin Vale]]"), "Robin Vale");
  equal(extractPovCharacterName(""), null);
});

test("uses the scoped character folder and book scope for a new free-text POV", () => {
  const suggestions = buildPovSuggestions([entity()], ["PLURALITY"]);
  const proposal = buildPovCharacterCreationProposal("Robin", {
    suggestions,
    existingPaths: suggestions.map((item) => item.entity.path),
    scope: ["[[Books/PLURALITY]]"]
  });

  equal(proposal?.name, "Robin");
  equal(proposal?.path, "Story World/Characters/Robin.md");
  equal(proposal?.povValue, "[[Story World/Characters/Robin]]");
  deepEqual(proposal?.scope, ["[[Books/PLURALITY]]"]);
});

test("honours an explicit unresolved path and keeps the display name", () => {
  const proposal = buildPovCharacterCreationProposal(
    "[[Story World/People/RV|Robin Vale]]",
    { suggestions: [], existingPaths: [] }
  );

  equal(proposal?.path, "Story World/People/RV.md");
  equal(proposal?.povValue, "[[Story World/People/RV|Robin Vale]]");
});

test("does not offer creation when a canonical name, alias or target already matches", () => {
  const suggestions = buildPovSuggestions([entity()]);
  equal(findMatchingPovSuggestions("Tobias", suggestions).length, 1);
  equal(findMatchingPovSuggestions("[[Story World/Characters/Tobias]]", suggestions).length, 1);
  equal(buildPovCharacterCreationProposal("Tobias", {
    suggestions,
    existingPaths: []
  }), null);
});

test("never overwrites a case-insensitive path collision", () => {
  const proposal = buildPovCharacterCreationProposal("Robin", {
    suggestions: [],
    existingPaths: ["story world/characters/ROBIN.md"]
  });

  equal(proposal?.path, "Story World/Characters/Robin (character).md");
  equal(
    proposal?.povValue,
    "[[Story World/Characters/Robin (character)|Robin]]"
  );
});

test("sanitises only the filename while preserving the canonical name", () => {
  const proposal = buildPovCharacterCreationProposal("Robin: First/Prime", {
    suggestions: [],
    existingPaths: []
  });

  equal(proposal?.name, "Robin: First/Prime");
  equal(proposal?.path, "Story World/Characters/Robin- First-Prime.md");
  equal(
    proposal?.povValue,
    "[[Story World/Characters/Robin- First-Prime|Robin: First/Prime]]"
  );
});

test("creates minimal ordinary Story World Markdown", () => {
  const proposal = buildPovCharacterCreationProposal("Robin", {
    suggestions: [],
    existingPaths: [],
    scope: ["[[Books/PLURALITY]]", "[[Books/PLURALITY]]"]
  });
  if (!proposal) throw new Error("Expected a creation proposal");

  const markdown = buildPovCharacterMarkdown(proposal);
  match(markdown, /^---\nworld_entity: character\nworld_name: "Robin"\n/);
  match(markdown, /world_scope:\n  - "\[\[Books\/PLURALITY\]\]"/);
  match(markdown, /# Robin\n\nCharacter details to be added\.\n$/);
});
