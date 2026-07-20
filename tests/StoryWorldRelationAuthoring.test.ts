import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  buildStoredStoryWorldRelationship,
  buildStoryWorldRelationDecision,
  buildStoryWorldRelationProposal,
  formatStoryWorldRelationSentence,
  predicateOptionsForTargetType,
  resolvePovRelationSource
} from "../src/companion/StoryWorldRelationAuthoring";
import { buildPovSuggestions } from "../src/companion/PovSuggestions";
import type { ProseWikilinkOccurrence } from "../src/companion/ProseWikilinkChanges";
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

const occurrence: ProseWikilinkOccurrence = {
  raw: "[[Crap Bot goes Viral|Crap Bot]]",
  linkpath: "Crap Bot goes Viral",
  displayText: "Crap Bot",
  start: 80,
  end: 119
};

test("offers event-specific relationship phrases without selecting one", () => {
  deepEqual(
    predicateOptionsForTargetType("event").map((option) => option.value),
    ["unaware_of", "becomes_aware_of", "responds_to", "investigates", "affected_by"]
  );
  equal(
    buildStoryWorldRelationDecision(
      "",
      "",
      "confirmed",
      predicateOptionsForTargetType("event")
    ),
    null
  );
});

test("resolves a unique recognised POV from a canonical name, alias or wikilink", () => {
  const suggestions = buildPovSuggestions([entity()]);
  equal(resolvePovRelationSource("Tobias", suggestions)?.path, "Story World/Characters/Tobias.md");
  equal(resolvePovRelationSource("Tobias Hale", suggestions)?.path, "Story World/Characters/Tobias.md");
  equal(resolvePovRelationSource("[[Story World/Characters/Tobias|Tobias Hale]]", suggestions)?.path, "Story World/Characters/Tobias.md");
});

test("builds a proposal from explicit chapter, POV and linked entity context", () => {
  const target = entity({
    path: "Story World/Events/Crap Bot goes Viral.md",
    basename: "Crap Bot goes Viral",
    entityType: "event",
    name: "Crap Bot goes Viral",
    aliases: ["Crap Bot"]
  });
  const proposal = buildStoryWorldRelationProposal({
    sourceEntity: entity(),
    targetEntity: target,
    occurrence,
    chapterPath: "Books/PLURALITY/Quiet Contact.md",
    sourceLine: 12,
    existingPaths: [
      "Story World/Characters/Tobias.md",
      "Story World/Events/Crap Bot goes Viral.md",
      "Books/PLURALITY/Quiet Contact.md",
      "Books/PLURALITY.md"
    ],
    bookPath: "Books/PLURALITY.md",
    chapterStoryDate: "2029-06-28"
  });
  if (!proposal) throw new Error("Expected a relation proposal");

  equal(proposal.sourceEntityName, "Tobias Hale");
  equal(proposal.targetEntityName, "Crap Bot goes Viral");
  equal(proposal.targetReference, "[[Crap Bot goes Viral]]");
  equal(proposal.chapterReference, "[[Quiet Contact]]");
  equal(proposal.scopeReference, "[[PLURALITY]]");
  equal(proposal.storyDate, "2029-06-28");
  equal(proposal.sourceLine, 12);
});

test("creates readable preset and custom decisions only after explicit selection", () => {
  const options = predicateOptionsForTargetType("event");
  deepEqual(
    buildStoryWorldRelationDecision("unaware_of", "", "confirmed", options),
    { predicate: "unaware_of", predicateLabel: null, status: "confirmed" }
  );
  deepEqual(
    buildStoryWorldRelationDecision("other", "conceals the event from", "unresolved", options),
    {
      predicate: "conceals_the_event_from",
      predicateLabel: "conceals the event from",
      status: "unresolved"
    }
  );
  equal(buildStoryWorldRelationDecision("other", "", "confirmed", options), null);
});

test("stores an approved entity-owned relationship with date and passage provenance", () => {
  const proposal = buildStoryWorldRelationProposal({
    sourceEntity: entity(),
    targetEntity: entity({
      path: "Story World/Events/Crap Bot goes Viral.md",
      basename: "Crap Bot goes Viral",
      entityType: "event",
      name: "Crap Bot goes Viral",
      aliases: []
    }),
    occurrence,
    chapterPath: "Books/PLURALITY/Quiet Contact.md",
    sourceLine: 12,
    existingPaths: [],
    bookPath: "Books/PLURALITY.md",
    chapterStoryDate: "2029-06-28"
  });
  if (!proposal) throw new Error("Expected a relation proposal");
  const decision = buildStoryWorldRelationDecision(
    "unaware_of",
    "",
    "confirmed",
    proposal.predicateOptions
  );
  if (!decision) throw new Error("Expected a decision");

  equal(
    formatStoryWorldRelationSentence(proposal, decision),
    "Tobias Hale remains unaware of Crap Bot goes Viral."
  );
  deepEqual(buildStoredStoryWorldRelationship(proposal, decision), {
    predicate: "unaware_of",
    target: "[[Crap Bot goes Viral]]",
    status: "confirmed",
    source: "[[Quiet Contact]]",
    as_of: "2029-06-28",
    scope: "[[PLURALITY]]",
    source_line: 12,
    source_link: "[[Crap Bot goes Viral|Crap Bot]]"
  });
});

test("keeps path-qualified links when a target basename is ambiguous", () => {
  const proposal = buildStoryWorldRelationProposal({
    sourceEntity: entity(),
    targetEntity: entity({
      path: "Story World/Events/Contact.md",
      basename: "Contact",
      entityType: "event",
      name: "Contact",
      aliases: []
    }),
    occurrence: {
      raw: "[[Story World/Events/Contact]]",
      linkpath: "Story World/Events/Contact",
      displayText: null,
      start: 0,
      end: 30
    },
    chapterPath: "Books/Contact.md",
    sourceLine: 1,
    existingPaths: [
      "Story World/Events/Contact.md",
      "Research/Contact.md",
      "Books/Contact.md"
    ]
  });
  equal(proposal?.targetReference, "[[Story World/Events/Contact]]");
});
