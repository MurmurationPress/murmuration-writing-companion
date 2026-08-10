import { App, TFile } from "obsidian";
import { buildObsidianManuscriptLibrary } from "../manuscript/ObsidianManuscript";
import { manuscriptDisplayTitle } from "../manuscript/ManuscriptMetadata";
import { isObsidianTrashPath } from "../ObsidianTrash";
import { buildObsidianStoryWorldManuscriptImpact } from "./ObsidianStoryWorldManuscriptImpact";
import { collectObsidianStoryWorldReview } from "./ObsidianStoryWorldReview";
import { ObsidianStoryWorldIndex } from "./ObsidianStoryWorldIndex";
import { buildStoryWorldGraph, StoryWorldGraphOptions, StoryWorldGraphProjection } from "./StoryWorldGraph";
import { extractTemporalGraphEvidence, TemporalEvidenceDocument } from "./TemporalGraphEvidence";
import { buildTemporalGraphModel, TemporalGraphModel } from "./TemporalStoryWorldGraph";
import type { ObsidianManuscriptLibrary } from "../manuscript/ObsidianManuscript";
import type { StoryWorldReviewProjection } from "./StoryWorldReview";
import { buildWorldContext } from "./WorldContext";

export interface ObsidianStoryWorldGraphOptions extends Omit<StoryWorldGraphOptions, "entities" | "documents" | "observations" | "resolve" | "scene" | "impactCount" | "allowedPaths"> {
  readonly currentBookOnly?: boolean;
  readonly unscopedOnly?: boolean;
}

function frontmatter(app: App, file: TFile): Record<string, unknown> {
  return (app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined) ?? {};
}

function currentBookPaths(app: App, index: ObsidianStoryWorldIndex, bookPath: string | null, selectedPath: string, library: ObsidianManuscriptLibrary): ReadonlySet<string> | null {
  if (!bookPath) return null;
  const paths = new Set<string>([selectedPath]);
  const book = library.books.find((candidate) => candidate.file.path === bookPath);
  for (const scene of book?.result.scenes ?? []) {
    const file = book?.filesByPath.get(scene.path); if (!file) continue;
    paths.add(file.path);
    const context = buildWorldContext(frontmatter(app, file), (reference) =>
      index.resolveWikilink(reference, file.path));
    for (const entry of context.entries) paths.add(entry.entity.path);
  }
  for (const entity of index.index.getAll()) {
    if (entity.scope.some((reference) => index.resolveReference(reference, entity.path)?.path === bookPath)) paths.add(entity.path);
  }
  return paths;
}

export function buildObsidianStoryWorldGraph(
  app: App,
  index: ObsidianStoryWorldIndex,
  selectedBookPath: string | null,
  options: ObsidianStoryWorldGraphOptions,
  settledLibrary = buildObsidianManuscriptLibrary(app),
  settledReview = collectObsidianStoryWorldReview(app, index)
): StoryWorldGraphProjection {
  const entities = index.index.getAll();
  const selected = index.index.getByPath(options.selectedPath);
  const files = app.vault.getMarkdownFiles().filter((file) => !isObsidianTrashPath(file.path));
  const documents = files.map((file) => ({ path: file.path, basename: file.basename, frontmatter: frontmatter(app, file) }));
  const review: StoryWorldReviewProjection = settledReview;
  const library: ObsidianManuscriptLibrary = settledLibrary;
  const scenes = new Map<string, string>();
  for (const book of library.books) for (const scene of book.result.scenes) {
    const file = book.filesByPath.get(scene.path); if (!file) continue;
    scenes.set(file.path, manuscriptDisplayTitle({ path: file.path, basename: file.basename, frontmatter: frontmatter(app, file) }));
  }
  const impactCount = selected ? buildObsidianStoryWorldManuscriptImpact(app, index, selected, library, review).results.length : 0;
  return buildStoryWorldGraph({
    ...options,
    entities,
    documents,
    observations: review.observations,
    impactCount,
    allowedPaths: options.currentBookOnly
      ? currentBookPaths(app, index, selectedBookPath, options.selectedPath, library)
      : options.unscopedOnly
        ? new Set([options.selectedPath, ...entities.filter((entity) => entity.scope.length === 0).map((entity) => entity.path)])
        : null,
    resolve: (reference, sourcePath) => {
      const resolved = index.resolveReference(reference, sourcePath);
      return resolved && !resolved.excluded ? resolved.path : null;
    },
    scene: (path) => scenes.has(path) ? { label: scenes.get(path)! } : null
  });
}

export interface ObsidianTemporalStoryWorldGraph {
  readonly graph: StoryWorldGraphProjection;
  readonly temporal: TemporalGraphModel;
}

/** Builds the read-only temporal layer from the same index, graph, source notes and distributed manuscript order. */
export function buildObsidianTemporalStoryWorldGraph(
  app: App,
  index: ObsidianStoryWorldIndex,
  selectedBookPath: string | null,
  options: ObsidianStoryWorldGraphOptions,
  settledLibrary = buildObsidianManuscriptLibrary(app),
  settledReview = collectObsidianStoryWorldReview(app, index)
): ObsidianTemporalStoryWorldGraph {
  const graph = buildObsidianStoryWorldGraph(app, index, selectedBookPath, options, settledLibrary, settledReview);
  const library = settledLibrary;
  const sequence = new Map<string, number>();
  let cursor = 0;
  for (const book of library.books) for (const scene of book.result.scenes) sequence.set(scene.path, cursor++);
  const documents: TemporalEvidenceDocument[] = app.vault.getMarkdownFiles().filter((file) => !isObsidianTrashPath(file.path)).map((file) => ({
    path: file.path,
    label: manuscriptDisplayTitle({ path: file.path, basename: file.basename, frontmatter: frontmatter(app, file) }),
    frontmatter: frontmatter(app, file),
    manuscriptSequence: sequence.get(file.path) ?? null
  }));
  const evidence = extractTemporalGraphEvidence({
    graph,
    entities: index.index.getAll(),
    documents,
    resolve: (reference, sourcePath) => {
      const resolved = index.resolveReference(reference, sourcePath);
      return resolved && !resolved.excluded ? resolved.path : null;
    }
  });
  return { graph, temporal: buildTemporalGraphModel(evidence) };
}
