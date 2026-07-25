import { App, TFile } from "obsidian";
import { isObsidianTrashPath } from "../ObsidianTrash";
import { observeTimelineAssertionContradictions } from "./StoryWorldEventSceneGraph";
import { ObsidianStoryWorldIndex } from "./ObsidianStoryWorldIndex";
import { buildStoryWorldReview, StoryWorldReviewProjection } from "./StoryWorldReview";

function frontmatter(app: App, file: TFile): Record<string, unknown> {
  return (app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined) ?? {};
}

export function collectObsidianStoryWorldReview(
  app: App,
  storyWorldIndex: ObsidianStoryWorldIndex
): StoryWorldReviewProjection {
  const files = app.vault.getMarkdownFiles().filter((file) => !isObsidianTrashPath(file.path));
  const documents = files.map((file) => ({ path: file.path, basename: file.basename, frontmatter: frontmatter(app, file) }));
  const entities = storyWorldIndex.index.getAll();
  const resolvePath = (reference: string, sourcePath: string): string | null => {
    const resolved = storyWorldIndex.resolveReference(reference, sourcePath);
    return resolved?.path ?? null;
  };
  const timeline = observeTimelineAssertionContradictions(
    documents.map((document) => ({ path: document.path, name: document.basename, frontmatter: document.frontmatter })),
    entities,
    resolvePath
  );
  return buildStoryWorldReview(documents, entities, (reference, sourcePath) => {
    const resolved = storyWorldIndex.resolveReference(reference, sourcePath);
    return resolved ? { path: resolved.path, indexed: resolved.indexed } : null;
  }, timeline);
}
