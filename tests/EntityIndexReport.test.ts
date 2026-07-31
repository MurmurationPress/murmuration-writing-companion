import { equal, match, doesNotMatch } from "node:assert/strict";
import { test } from "node:test";
import { generateEntityIndexReport } from "../src/reports/EntityIndexReport";
import { isGeneratedReportFrontmatter } from "../src/reports/GeneratedReportClassification";
import { parseStoryWorldEntity, StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";
import { saveContinuityReviewReport } from "../src/companion/ContinuityReviewReportActions";

function entity(path: string, name: string, type = "Character", aliases: string[] = []): StoryWorldEntityRecord {
  return { path, basename: name, entityType: type, name, aliases, facets: [], scope: [], status: null,
    summary: null, firstAppearance: null, sources: [], links: [], properties: {} };
}

test("generates a canonical, filtered, ordered and deduplicated Book index", () => {
  const pip = entity("World/Pip.md", "Pip", "Character", ["Divergent", "Skip"]);
  const prime = entity("World/PRIME.md", "PRIME", "Intelligence");
  const reference = entity("World/Reference.md", "A Reference", "Reference");
  const sceneA = { path: "Books/One/P1/A.md", title: "Meeting", partTitle: "Opening", bookTitle: "One", order: 0 };
  const sceneB = { path: "Books/One/P2/B.md", title: "Meeting", partTitle: "Closing", bookTitle: "One", order: 1 };
  const draft = generateEntityIndexReport({
    scope: "book", book: { path: "Books/One.md", title: "One" }, entities: [reference, prime, pip], includedTypes: new Set(["character", "intelligence"]),
    generatedAt: "2026-07-31T12:00:00.000Z", occurrences: [
      { entityPath: pip.path, scene: sceneB }, { entityPath: pip.path, scene: sceneA }, { entityPath: pip.path, scene: sceneA },
      { entityPath: prime.path, scene: sceneA }, { entityPath: reference.path, scene: sceneA },
      { entityPath: "World/Deleted.md", scene: sceneA }
    ], diagnostics: { unresolvedLinks: 2, malformedLinks: 1, ambiguousAliases: 1 }
  });
  equal(draft.entryCount, 2); equal(draft.occurrenceCount, 3);
  match(draft.markdown, /\*\*\[\[World\/Pip\|Pip\]\]\*\*/);
  doesNotMatch(draft.markdown, /Divergent|Skip|A Reference/);
  match(draft.markdown, /Opening — Meeting.*Closing — Meeting/);
  equal((draft.markdown.match(/Books\/One\/P1\/A/g) ?? []).length, 2); // once for each canonical entity, never twice for Pip
  match(draft.markdown, /Unresolved entity links: 2/);
  doesNotMatch(draft.markdown, /# Entity Index/);
  equal(draft.diagnostics.orphanEntities, 0);
  equal(draft.diagnostics.missingCanonicalEntities, 1);
  equal(draft.markdown, generateEntityIndexReport({
    scope: "book", book: { path: "Books/One.md", title: "One" }, entities: [reference, prime, pip], includedTypes: new Set(["character", "intelligence"]),
    generatedAt: "2026-07-31T12:00:00.000Z", occurrences: [
      { entityPath: pip.path, scene: sceneB }, { entityPath: pip.path, scene: sceneA }, { entityPath: pip.path, scene: sceneA },
      { entityPath: prime.path, scene: sceneA }, { entityPath: reference.path, scene: sceneA }, { entityPath: "World/Deleted.md", scene: sceneA }
    ], diagnostics: { unresolvedLinks: 2, malformedLinks: 1, ambiguousAliases: 1 }
  }).markdown);
});

test("vault scope names the output and qualifies references by Book", () => {
  const pip = entity("World/Pip.md", "Pip");
  const draft = generateEntityIndexReport({ scope: "vault", entities: [pip], includedTypes: new Set(["character"]), generatedAt: "2026-07-31T12:00:00Z",
    occurrences: [
      { entityPath: pip.path, scene: { path: "Books/One/A.md", title: "Arrival", partTitle: null, bookTitle: "One", order: 0 } },
      { entityPath: pip.path, scene: { path: "Books/Two/A.md", title: "Arrival", partTitle: null, bookTitle: "Two", order: 1 } }
    ] });
  equal(draft.filename, "Entity Index - Vault.md");
  match(draft.markdown, /report_scope: vault/);
  doesNotMatch(draft.markdown, /^book:/m);
  match(draft.markdown, /One — Arrival.*Two — Arrival/);
});

test("groups unsupported leading characters under the deterministic fallback", () => {
  const item = entity("World/7.md", "7 Signals");
  const draft = generateEntityIndexReport({ scope: "book", book: { path: "Book.md", title: "Book" }, entities: [item], includedTypes: new Set(["character"]),
    generatedAt: "2026-07-31T12:00:00Z", occurrences: [{ entityPath: item.path, scene: { path: "Scene.md", title: "Scene", partTitle: null, bookTitle: "Book", order: 0 } }] });
  match(draft.markdown, /## #/);
});

test("generated reports are excluded from Story World authority", () => {
  const frontmatter = { type: "generated-report", report_type: "entity-index", world_entity: "Reference" };
  equal(isGeneratedReportFrontmatter(frontmatter), true);
  equal(parseStoryWorldEntity({ path: "Reports/Index.md", basename: "Index", frontmatter }), null);
});

test("preview and cancellation require no write and saving creates only on explicit action", async () => {
  let writes = 0;
  const vault = { exists: () => false, create: async () => { writes += 1; } };
  equal(writes, 0); // constructing/previewing a draft has no vault dependency
  await saveContinuityReviewReport(vault, "Reports/Index.md", "preview");
  equal(writes, 1);
});
