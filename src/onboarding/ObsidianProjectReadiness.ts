import { App } from "obsidian";
import type { EditorialStore } from "../editorial/EditorialNote";
import { buildObsidianManuscriptLibrary } from "../manuscript/ObsidianManuscript";
import {
  planObsidianManuscriptPreparation,
  validateManuscriptPreparationPreview
} from "../manuscript/ObsidianManuscriptPreparation";
import type { ObsidianStoryWorldIndex } from "../story-world/ObsidianStoryWorldIndex";
import { collectObsidianStoryWorldReview } from "../story-world/ObsidianStoryWorldReview";
import { projectReadiness, ProjectReadinessPresentation } from "./ProjectReadiness";
import type { ObsidianManuscriptLibrary } from "../manuscript/ObsidianManuscript";
import type { StoryWorldReviewProjection } from "../story-world/StoryWorldReview";

function editorialStoragePresent(store: EditorialStore): boolean {
  return Object.keys(store.pages).length > 0
    || Object.keys(store.continuityDispositions ?? {}).length > 0
    || Object.keys(store.orphanedPages ?? {}).length > 0;
}

export async function collectObsidianProjectReadiness(
  app: App,
  storyWorldIndex: ObsidianStoryWorldIndex,
  editorialStore: EditorialStore,
  settledLibrary = buildObsidianManuscriptLibrary(app),
  settledReview?: StoryWorldReviewProjection
): Promise<ProjectReadinessPresentation> {
  const library: ObsidianManuscriptLibrary = settledLibrary;
  const manuscripts = await Promise.all(library.books.map(async (book) => {
    const plan = await validateManuscriptPreparationPreview(app, book, planObsidianManuscriptPreparation(app, book));
    return {
      plan,
      partCount: book.result.entries.filter((entry) => entry.kind === "part").length,
      sceneCount: book.result.scenes.length
    };
  }));
  const entities = storyWorldIndex.index.getAll();
  const review = entities.length ? settledReview ?? collectObsidianStoryWorldReview(app, storyWorldIndex) : null;
  const significantObservationCount = review
    ? review.counts.review + review.counts.conflict
    : 0;
  return projectReadiness({
    markdownFileCount: app.vault.getMarkdownFiles().length,
    unresolvedManuscriptNotes: library.unresolved.map((note) => note.message),
    manuscripts,
    storyWorld: {
      entityCount: entities.length,
      eventCount: entities.filter((entity) => entity.entityType.trim().toLowerCase() === "event").length,
      significantObservationCount
    },
    editorialStorageState: editorialStoragePresent(editorialStore) ? "present" : "absent"
  });
}
