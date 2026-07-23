import { App, TFile } from "obsidian";
import { isBookFrontmatter } from "../editorial/BookReview";
import { evaluateChapterContextContinuity } from "../observations/ChapterContextContinuity";
import { ContinuityObservation, ObservationNoteReference } from "../observations/ContinuityObservation";
import { observationSourceNotes } from "../observations/ContinuityObservation";
import {
  ContinuityReviewLocation,
  ContinuityReviewManuscriptScope
} from "../observations/ContinuityReview";
import { observeIncompleteEntityRelationships } from "../story-world/StoryWorldObservations";
import { observeTimelineAssertionContradictions } from "../story-world/StoryWorldEventSceneGraph";
import { parseWikilink, StoryWorldEntityRecord } from "../story-world/StoryWorldIndex";
import { ObsidianStoryWorldIndex } from "../story-world/ObsidianStoryWorldIndex";
import { resolveExplicitOwningBookWithSource } from "../companion/ManuscriptHierarchy";
import { manuscriptDisplayTitle } from "./ManuscriptMetadata";
import {
  buildObsidianManuscriptLibrary,
  ObsidianManuscriptBook
} from "./ObsidianManuscript";
import { buildObsidianManuscriptChronologyForBook } from "./ObsidianManuscriptChronology";

export interface ObsidianContinuityReviewCollection {
  readonly book: ObsidianManuscriptBook;
  readonly scope: ContinuityReviewManuscriptScope;
  readonly observations: readonly ContinuityObservation[];
  readonly dependencies: ReadonlySet<string>;
}

function frontmatter(app: App, file: TFile): Record<string, unknown> | undefined {
  return app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
}

function manuscriptNote(app: App, file: TFile): ObservationNoteReference {
  return {
    role: "manuscript",
    path: file.path,
    label: manuscriptDisplayTitle({ path: file.path, basename: file.basename, frontmatter: frontmatter(app, file) })
  };
}

function resolveReference(app: App, reference: string, sourcePath: string): TFile | null {
  const parsed = parseWikilink(reference);
  if (!parsed) return null;
  return app.metadataCache.getFirstLinkpathDest(parsed.linkpath, sourcePath);
}

function directStoryWorldReferences(
  app: App,
  storyWorldIndex: ObsidianStoryWorldIndex,
  scenes: readonly TFile[]
): Map<string, StoryWorldEntityRecord> {
  const result = new Map<string, StoryWorldEntityRecord>();
  for (const scene of scenes) {
    const value = frontmatter(app, scene)?.world_context;
    const references = Array.isArray(value) ? value : [value];
    for (const reference of references) {
      if (typeof reference !== "string" || !parseWikilink(reference)) continue;
      const target = resolveReference(app, reference, scene.path);
      // Recollection runs after the metadata coalescing delay. Refresh the
      // dependency from that settled cache rather than reusing the snapshot
      // captured by an earlier metadata event.
      if (target) storyWorldIndex.handleMetadataChanged(target);
      const entity = target ? storyWorldIndex.index.getByPath(target.path) : null;
      if (entity) result.set(entity.path, entity);
    }
  }
  return result;
}

function scopeFor(
  app: App,
  book: ObsidianManuscriptBook,
  directEntities: ReadonlyMap<string, StoryWorldEntityRecord>
): ContinuityReviewManuscriptScope {
  const locations = new Map<string, ContinuityReviewLocation>();
  const partLabels = new Map<string, string>();
  for (const part of book.result.entries.filter((entry) => entry.kind === "part")) {
    const file = book.filesByPath.get(part.path);
    if (file) partLabels.set(file.path, manuscriptNote(app, file).label ?? file.basename);
  }
  book.result.scenes.forEach((scene, order) => {
    const file = book.filesByPath.get(scene.path);
    if (!file) return;
    const partPath = scene.parentPath && scene.parentPath !== book.file.path ? scene.parentPath : null;
    locations.set(scene.path, {
      path: scene.path,
      label: manuscriptNote(app, file).label ?? file.basename,
      kind: "chapter",
      order,
      partPath,
      partLabel: partPath ? partLabels.get(partPath) ?? null : null
    });
  });
  for (const [path, label] of partLabels) {
    const firstChild = [...locations.values()].find((location) => location.partPath === path);
    locations.set(path, {
      path,
      label,
      kind: "part",
      order: firstChild?.order ?? Number.MAX_SAFE_INTEGER,
      partPath: null,
      partLabel: null
    });
  }
  return {
    book: manuscriptNote(app, book.file),
    manuscriptPaths: new Set(book.filesByPath.keys()),
    locations,
    explicitlyReferencedStoryWorldPaths: new Set(directEntities.keys())
  };
}

function chapterObservations(
  app: App,
  storyWorldIndex: ObsidianStoryWorldIndex,
  book: ObsidianManuscriptBook,
  scene: TFile
): ContinuityObservation[] {
  const ownership = resolveExplicitOwningBookWithSource(app, scene);
  return evaluateChapterContextContinuity({
    chapter: manuscriptNote(app, scene),
    frontmatter: frontmatter(app, scene),
    owningBook: ownership?.book.path === book.file.path ? {
      note: manuscriptNote(app, ownership.book),
      source: { note: manuscriptNote(app, ownership.source), property: ownership.property }
    } : null,
    resolveEntity: (reference, sourcePath) => storyWorldIndex.resolveWikilink(reference, sourcePath),
    resolveScope: (reference, sourcePath) => {
      const target = resolveReference(app, reference, sourcePath);
      if (!target) return null;
      return { note: manuscriptNote(app, target), book: isBookFrontmatter(frontmatter(app, target)) };
    }
  });
}

/** Explicit collection boundary for the producers currently available to #132. */
export function collectObsidianContinuityReview(
  app: App,
  storyWorldIndex: ObsidianStoryWorldIndex,
  bookPath: string
): ObsidianContinuityReviewCollection | null {
  const library = buildObsidianManuscriptLibrary(app);
  const book = library.books.find((candidate) => candidate.file.path === bookPath);
  if (!book) return null;
  const scenes = book.result.scenes
    .map((scene) => book.filesByPath.get(scene.path))
    .filter((file): file is TFile => Boolean(file));
  const directEntities = directStoryWorldReferences(app, storyWorldIndex, scenes);
  const scope = scopeFor(app, book, directEntities);
  const chronology = buildObsidianManuscriptChronologyForBook(app, book);
  const observations: ContinuityObservation[] = [...chronology.observations];
  for (const scene of scenes) observations.push(...chapterObservations(app, storyWorldIndex, book, scene));
  for (const entity of directEntities.values()) {
    observations.push(...observeIncompleteEntityRelationships(entity));
  }

  const documents = app.vault.getMarkdownFiles().map((file) => ({
    path: file.path,
    name: file.basename,
    frontmatter: frontmatter(app, file) ?? {}
  }));
  const timeline = observeTimelineAssertionContradictions(
    documents,
    storyWorldIndex.index.getAll(),
    (reference, sourcePath) => resolveReference(app, reference, sourcePath)?.path ?? null
  ).filter((observation) => scope.explicitlyReferencedStoryWorldPaths.has(observation.primary.path));
  observations.push(...timeline);

  const dependencies = new Set<string>(chronology.dependencies);
  for (const path of directEntities.keys()) dependencies.add(path);
  for (const observation of observations) {
    dependencies.add(observation.primary.path);
    for (const note of observationSourceNotes(observation)) dependencies.add(note.path);
  }
  return { book, scope, observations, dependencies };
}
