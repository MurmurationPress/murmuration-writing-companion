import { App, TFile } from "obsidian";
import { isObsidianTrashPath } from "../ObsidianTrash";
import { collectObsidianStoryWorldReview } from "./ObsidianStoryWorldReview";
import { ObsidianStoryWorldIndex } from "./ObsidianStoryWorldIndex";
import {
  storyWorldReviewEvidenceFingerprint,
  StoryWorldReviewProjection
} from "./StoryWorldReview";
import { DisposableProjection } from "../projections/DisposableProjection";

type Collector = (app: App, index: ObsidianStoryWorldIndex) => StoryWorldReviewProjection;

function evidenceFingerprint(app: App, file: TFile): string | null {
  if (file.extension !== "md" || isObsidianTrashPath(file.path)) return null;
  const frontmatter = (app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined) ?? {};
  const links = (app.metadataCache.getFileCache(file)?.links ?? []).map((link) => [
    link.original, link.link, link.displayText ?? null,
    link.position.start.offset, link.position.end.offset
  ] as const).map(([raw, linkpath, displayText, start, end]) => ({ raw, linkpath, displayText, start, end }));
  return storyWorldReviewEvidenceFingerprint(frontmatter, links);
}

/** Lazy, disposable Story World review projection. Closed views do not warm it. */
export class StoryWorldReviewProjectionService {
  private readonly projection: DisposableProjection<StoryWorldReviewProjection>;

  constructor(
    private readonly app: App,
    private readonly index: ObsidianStoryWorldIndex,
    private readonly collect: Collector = collectObsidianStoryWorldReview
  ) { this.projection = new DisposableProjection(() => this.collect(this.app, this.index)); }

  get(): StoryWorldReviewProjection {
    const value = this.projection.get();
    if (!this.fingerprintsCaptured) {
      this.captureFingerprints();
      this.fingerprintsCaptured = true;
    }
    return value;
  }

  private fingerprintsCaptured = false;
  invalidate(): void { this.projection.invalidate(); this.fingerprintsCaptured = false; }

  invalidateMetadata(file: TFile, indexChanged: boolean): boolean {
    const next = evidenceFingerprint(this.app, file);
    return this.updateEvidence(file.path, next, indexChanged);
  }

  /** Deterministic invalidation seam used by event adapters and structural tests. */
  updateEvidence(path: string, next: string | null, indexChanged: boolean): boolean {
    const changed = this.projection.updateDependency(path, next, indexChanged);
    if (changed) this.fingerprintsCaptured = false;
    return changed;
  }

  invalidatePath(path: string): void {
    if (this.projection.hasDependency(path) || this.index.index.getByPath(path)) this.invalidate();
    this.projection.updateDependency(path, null);
  }

  private captureFingerprints(): void {
    const entries: Array<readonly [string, string]> = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fingerprint = evidenceFingerprint(this.app, file);
      if (fingerprint !== null) entries.push([file.path, fingerprint]);
    }
    this.projection.replaceDependencies(entries);
  }
}
