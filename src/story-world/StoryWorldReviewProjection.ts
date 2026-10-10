import { App, TFile } from "obsidian";
import { isObsidianTrashPath } from "../ObsidianTrash";
import { collectObsidianStoryWorldReview, ReviewResolutionObserver } from "./ObsidianStoryWorldReview";
import { ObsidianStoryWorldIndex } from "./ObsidianStoryWorldIndex";
import {
  storyWorldReviewEvidenceFingerprint,
  StoryWorldReviewProjection
} from "./StoryWorldReview";
import { DisposableProjection } from "../projections/DisposableProjection";

type Collector = (app: App, index: ObsidianStoryWorldIndex, observe?: ReviewResolutionObserver) => StoryWorldReviewProjection;

function evidenceFingerprint(app: App, file: TFile): string | null {
  if (file.extension !== "md" || isObsidianTrashPath(file.path)) return null;
  const cache = app.metadataCache.getFileCache(file);
  const frontmatter = (cache?.frontmatter as Record<string, unknown> | undefined) ?? {};
  const links = (cache?.links ?? []).map((link) => [
    link.original, link.link, link.displayText ?? null,
    link.position.start.offset, link.position.end.offset
  ] as const).map(([raw, linkpath, displayText, start, end]) => ({ raw, linkpath, displayText, start, end }));
  return storyWorldReviewEvidenceFingerprint(frontmatter, links);
}

/** Lazy, disposable Story World review projection. Closed views do not warm it. */
export class StoryWorldReviewProjectionService {
  private readonly projection: DisposableProjection<StoryWorldReviewProjection>;
  private readonly resolutions = new Map<string, { reference: unknown; sourcePath: string; fingerprint: string }>();

  constructor(
    private readonly app: App,
    private readonly index: ObsidianStoryWorldIndex,
    private readonly collect: Collector = collectObsidianStoryWorldReview
  ) {
    this.projection = new DisposableProjection(() => {
      this.resolutions.clear();
      return this.collect(this.app, this.index, (reference, sourcePath, resolution) => {
        this.resolutions.set(JSON.stringify([reference, sourcePath]), { reference, sourcePath, fingerprint: JSON.stringify(resolution) });
      });
    });
  }

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

  /** Resolution can expose late evidence even without another changed event. */
  reconcileMetadata(files: readonly TFile[]): boolean {
    let changed = this.projection.retainDependencies(new Set(files.map(file => file.path)));
    for (const file of files) changed = this.invalidateMetadata(file, false) || changed;
    // A plain target (including an attachment) can appear/disappear or resolve
    // differently without changing source metadata or the entity index. Compare
    // only dependencies actually consulted by the cached review, at resolution.
    for (const dependency of this.resolutions.values()) {
      const next = JSON.stringify(this.index.resolveReference(dependency.reference, dependency.sourcePath));
      if (next !== dependency.fingerprint) {
        dependency.fingerprint = next;
        this.projection.invalidate();
        changed = true;
      }
    }
    if (changed) this.fingerprintsCaptured = false;
    return changed;
  }

  /** Drain coalesced paths; only fresh index or review evidence needs a view refresh. */
  refreshMetadata(files: Iterable<TFile>): boolean {
    let changed = false;
    for (const file of files) {
      const indexChanged = this.index.handleMetadataChanged(file);
      changed = this.invalidateMetadata(file, indexChanged) || changed;
    }
    return changed;
  }

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
