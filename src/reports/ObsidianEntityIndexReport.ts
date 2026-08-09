import { App } from "obsidian";
import { buildObsidianManuscriptLibrary, ObsidianManuscriptBook } from "../manuscript/ObsidianManuscript";
import { buildObsidianStoryWorldManuscriptImpact } from "../story-world/ObsidianStoryWorldManuscriptImpact";
import { ObsidianStoryWorldIndex } from "../story-world/ObsidianStoryWorldIndex";
import { generateEntityIndexReport, EntityIndexOccurrence, EntityIndexReportDraft, normalizeEntityType } from "./EntityIndexReport";

export interface ObsidianEntityIndexChoices {
  readonly books: readonly ObsidianManuscriptBook[];
  readonly entityTypes: readonly string[];
}

export function entityIndexChoices(app: App, index: ObsidianStoryWorldIndex, library = buildObsidianManuscriptLibrary(app)): ObsidianEntityIndexChoices {
  return {
    books: library.books,
    entityTypes: [...new Set(index.index.getAll().map((entity) => entity.entityType.trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
  };
}

export function buildObsidianEntityIndexReport(options: {
  readonly app: App;
  readonly index: ObsidianStoryWorldIndex;
  readonly scope: "book" | "vault";
  readonly book?: ObsidianManuscriptBook;
  readonly includedTypes: ReadonlySet<string>;
  readonly generatedAt: string;
  readonly library?: ReturnType<typeof buildObsidianManuscriptLibrary>;
  readonly storyWorldReview?: import("../story-world/StoryWorldReview").StoryWorldReviewProjection;
}): EntityIndexReportDraft {
  const { app, index } = options;
  const library = options.library ?? buildObsidianManuscriptLibrary(app);
  const books = options.scope === "vault" ? library.books : options.book ? [options.book] : [];
  const occurrences: EntityIndexOccurrence[] = [];
  let unresolvedLinks = 0;
  let malformedLinks = 0;
  let ambiguousAliases = 0;
  const scenes = new Map<string, EntityIndexOccurrence["scene"]>();
  let globalOrder = 0;
  for (const book of books) for (const scene of book.result.scenes) {
    const part = scene.parentPath && scene.parentPath !== book.file.path
      ? book.result.entries.find((entry) => entry.kind === "part" && entry.path === scene.parentPath) ?? null : null;
    scenes.set(scene.path, { path: scene.path, title: scene.title, partTitle: part?.title ?? null, bookTitle: book.record.title, order: globalOrder++ });
  }

  // Every cached link is explicit authored evidence. Obsidian path resolution is
  // authoritative first; the shared Story World alias index is the unique fallback.
  for (const [path, scene] of scenes) {
    const file = books.map((book) => book.filesByPath.get(path)).find(Boolean);
    if (!file) continue;
    const cache = app.metadataCache.getFileCache(file);
    for (const cached of cache?.links ?? []) {
      const raw = `[[${cached.link}]]`;
      const resolved = index.resolveWikilink(raw, path);
      if (resolved) { occurrences.push({ entityPath: resolved.path, scene }); continue; }
      const destination = app.metadataCache.getFirstLinkpathDest(cached.link, path);
      if (destination) continue; // A valid link to a non-Story-World note is not an entity diagnostic.
      const aliases = index.index.findByNameOrAlias(cached.link);
      if (aliases.length > 1) ambiguousAliases += 1;
      else unresolvedLinks += 1;
    }
    const frontmatter = cache?.frontmatter as Record<string, unknown> | undefined;
    if (frontmatter && Object.prototype.hasOwnProperty.call(frontmatter, "world_context")) {
      const values = Array.isArray(frontmatter.world_context) ? frontmatter.world_context : [frontmatter.world_context];
      malformedLinks += values.filter((value) => typeof value !== "string" || !/^\[\[[^\]\n]+\]\]$/.test(value.trim())).length;
    }
  }

  // Structured source/support evidence remains defined by the existing impact
  // projection. Temporal and continuity inferences are deliberately not occurrences.
  for (const entity of index.index.getAll()) {
    const impact = buildObsidianStoryWorldManuscriptImpact(app, index, entity, library, options.storyWorldReview);
    for (const result of impact.results) {
      if (!books.some((book) => book.file.path === result.scene.bookPath) || !result.evidence.some((evidence) => evidence.kind === "direct" || evidence.kind === "structured")) continue;
      const scene = scenes.get(result.scene.path);
      if (scene) occurrences.push({ entityPath: entity.path, scene });
    }
  }
  return generateEntityIndexReport({
    scope: options.scope, book: options.book ? { path: options.book.file.path, title: options.book.record.title } : undefined,
    entities: index.index.getAll(), occurrences,
    includedTypes: new Set([...options.includedTypes].map(normalizeEntityType)), generatedAt: options.generatedAt,
    diagnostics: { unresolvedLinks, malformedLinks, ambiguousAliases }
  });
}
