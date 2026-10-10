import { App, TFile } from "obsidian";
import { isObsidianTrashPath } from "../ObsidianTrash";
import { observeTimelineAssertionContradictions } from "./StoryWorldEventSceneGraph";
import { ObsidianStoryWorldIndex } from "./ObsidianStoryWorldIndex";
import { buildStoryWorldReview, StoryWorldReviewProjection } from "./StoryWorldReview";

function frontmatter(app: App, file: TFile): Record<string, unknown> {
  return (app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined) ?? {};
}

export type ReviewResolutionObserver = (reference: unknown, sourcePath: string, resolution: ReturnType<ObsidianStoryWorldIndex["resolveReference"]>) => void;

export function collectObsidianStoryWorldReview(
  app: App,
  storyWorldIndex: ObsidianStoryWorldIndex,
  observeResolution?: ReviewResolutionObserver
): StoryWorldReviewProjection {
  const files = app.vault.getMarkdownFiles().filter((file) => !isObsidianTrashPath(file.path));
  const documents = files.map((file) => ({
    path: file.path,
    basename: file.basename,
    frontmatter: frontmatter(app, file),
    links: (app.metadataCache.getFileCache(file)?.links ?? []).map((link) => ({
      raw: link.original,
      linkpath: link.link,
      displayText: link.displayText ?? null,
      start: link.position.start.offset,
      end: link.position.end.offset
    }))
  }));
  const entities = storyWorldIndex.index.getAll();
  const resolve = (reference: unknown, sourcePath: string) => {
    const resolved = storyWorldIndex.resolveReference(reference, sourcePath);
    observeResolution?.(reference, sourcePath, resolved);
    return resolved;
  };
  const resolvePath = (reference: string, sourcePath: string) => resolve(reference, sourcePath)?.path ?? null;
  const timeline = observeTimelineAssertionContradictions(
    documents.map((document) => ({ path: document.path, name: document.basename, frontmatter: document.frontmatter })),
    entities,
    resolvePath
  );
  return buildStoryWorldReview(documents, entities, resolve, timeline);
}
