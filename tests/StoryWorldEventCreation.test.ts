import { equal, match } from "node:assert/strict";
import { test } from "node:test";
import {
  buildStoryWorldEventCreationProposal,
  buildStoryWorldEventMarkdown,
  findMatchingStoryWorldEvents,
  isExactStoryDate,
  shortestUnambiguousWikilink
} from "../src/companion/StoryWorldEventCreation";
import type { ProseWikilinkOccurrence } from "../src/companion/ProseWikilinkChanges";
import type { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";

function occurrence(
  linkpath: string,
  displayText: string | null = null
): ProseWikilinkOccurrence {
  const raw = displayText
    ? `[[${linkpath}|${displayText}]]`
    : `[[${linkpath}]]`;
  return { raw, linkpath, displayText, start: 0, end: raw.length };
}

function event(overrides: Partial<StoryWorldEntityRecord> = {}): StoryWorldEntityRecord {
  return {
    path: "Story World/Events/Existing Event.md",
    basename: "Existing Event",
    entityType: "event",
    name: "Existing Event",
    aliases: ["The Existing Event"],
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

const existingPaths = [
  "Books/PLURALITY.md",
  "Books/Part/Current Scene.md",
  "Story World/Events/Existing Event.md"
];

test("creates an unresolved plain link in the scoped event folder", () => {
  const proposal = buildStoryWorldEventCreationProposal(
    occurrence("The Ware Network Failure"),
    {
      entities: [event()],
      existingPaths,
      chapterPath: "Books/Part/Current Scene.md",
      bookPath: "Books/PLURALITY.md",
      scopeReferences: ["PLURALITY"],
      chapterStoryDate: "2029-06-28"
    }
  );

  equal(proposal?.path, "Story World/Events/The Ware Network Failure.md");
  equal(proposal?.name, "The Ware Network Failure");
  equal(proposal?.worldContextReference, "[[The Ware Network Failure]]");
  equal(proposal?.sources[0], "[[Current Scene]]");
  equal(proposal?.scope[0], "[[PLURALITY]]");
  equal(proposal?.chapterStoryDate, "2029-06-28");
});

test("keeps the prose target as filename while using its display text as world name", () => {
  const proposal = buildStoryWorldEventCreationProposal(
    occurrence("WNF", "Ware Network Failure"),
    {
      entities: [],
      existingPaths,
      chapterPath: "Books/Part/Current Scene.md"
    }
  );

  equal(proposal?.path, "Story World/Events/WNF.md");
  equal(proposal?.name, "Ware Network Failure");
  equal(proposal?.worldContextReference, "[[WNF|Ware Network Failure]]");
});

test("honours an explicit unresolved path", () => {
  const proposal = buildStoryWorldEventCreationProposal(
    occurrence("Story World/Incidents/WNF", "Ware Network Failure"),
    {
      entities: [],
      existingPaths,
      chapterPath: "Books/Part/Current Scene.md"
    }
  );
  equal(proposal?.path, "Story World/Incidents/WNF.md");
});

test("blocks matching events and path or basename collisions", () => {
  const existing = event();
  equal(findMatchingStoryWorldEvents(
    occurrence("The Existing Event"),
    [existing]
  ).length, 1);
  equal(buildStoryWorldEventCreationProposal(
    occurrence("The Existing Event"),
    {
      entities: [existing],
      existingPaths,
      chapterPath: "Books/Part/Current Scene.md"
    }
  ), null);

  equal(buildStoryWorldEventCreationProposal(
    occurrence("Collision"),
    {
      entities: [],
      existingPaths: [...existingPaths, "Research/Collision.md"],
      chapterPath: "Books/Part/Current Scene.md"
    }
  ), null);
});

test("path-qualifies metadata wikilinks only when the basename is ambiguous", () => {
  equal(shortestUnambiguousWikilink(
    "Story World/Events/Failure.md",
    "Failure",
    existingPaths
  ), "[[Failure]]");
  equal(shortestUnambiguousWikilink(
    "Story World/Events/Failure.md",
    "Failure",
    [...existingPaths, "Research/Failure.md"]
  ), "[[Story World/Events/Failure]]");
});

test("writes minimal dated and undated event Markdown", () => {
  const proposal = buildStoryWorldEventCreationProposal(
    occurrence("The Failure"),
    {
      entities: [],
      existingPaths,
      chapterPath: "Books/Part/Current Scene.md",
      bookPath: "Books/PLURALITY.md"
    }
  );
  if (!proposal) throw new Error("Expected proposal");

  const dated = buildStoryWorldEventMarkdown(proposal, {
    mode: "custom",
    date: "2029-06-28"
  });
  match(dated, /^---\nworld_entity: event\nworld_name: "The Failure"\n/);
  match(dated, /world_sources:\n  - "\[\[Current Scene\]\]"/);
  match(dated, /world_time:\n  at: "2029-06-28"\n  precision: day/);
  match(dated, /# The Failure\n\nEvent details to be added\.\n$/);

  const undated = buildStoryWorldEventMarkdown(proposal, {
    mode: "undated",
    date: null
  });
  equal(undated.includes("world_time"), false);
});

test("accepts only exact valid civil dates", () => {
  equal(isExactStoryDate("2028-02-29"), true);
  equal(isExactStoryDate("2029-02-29"), false);
  equal(isExactStoryDate("2029-06"), false);
  equal(isExactStoryDate("2029-06-28T10:00:00Z"), false);
});
