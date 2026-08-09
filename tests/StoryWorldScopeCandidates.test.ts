import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { buildStoryWorldScopeCandidates, ScopeCandidateDocument } from "../src/story-world/StoryWorldScopeCandidates";

const documents: ScopeCandidateDocument[] = [
  { path: "Manuscript/Prime.md", basename: "Prime", frontmatter: { type: "book", title: "PRIME", series: "[[Series/Prime Trilogy]]", aliases: ["Book One"] } },
  { path: "Series/Prime Trilogy.md", basename: "Prime Trilogy", frontmatter: { title: "PRIME Trilogy", aliases: ["The Trilogy"] } },
  { path: "Templates/Book.md", basename: "Book", frontmatter: { type: "book", title: "Template" } },
  { path: "World/Robin.md", basename: "Robin", frontmatter: { world_entity: "character", world_name: "Robin" } },
  { path: "Notes/Ordinary.md", basename: "Ordinary", frontmatter: { title: "Ordinary" } }
];

function resolve(linkpath: string): string | null {
  return documents.find((document) => document.path.replace(/\.md$/i, "") === linkpath)?.path ?? null;
}

test("scope candidates use recognised Books and their schema-declared Series only", () => {
  const candidates = buildStoryWorldScopeCandidates(documents, resolve);
  deepEqual(candidates.map((candidate) => candidate.label), ["PRIME", "PRIME Trilogy"]);
  equal(candidates.some((candidate) => candidate.resolvedPath === "World/Robin.md"), false);
  equal(candidates.some((candidate) => candidate.resolvedPath === "Notes/Ordinary.md"), false);
});

test("scope choices keep canonical wikilinks and aliases as search terms", () => {
  const candidates = buildStoryWorldScopeCandidates(documents.slice(0, 2), resolve);
  const book = candidates.find((candidate) => candidate.label === "PRIME")!;
  const series = candidates.find((candidate) => candidate.label === "PRIME Trilogy")!;
  equal(book.storedValue, "[[Manuscript/Prime]]");
  equal(series.storedValue, "[[Series/Prime Trilogy]]");
  equal(series.searchTerms.includes("The Trilogy"), true);
});
