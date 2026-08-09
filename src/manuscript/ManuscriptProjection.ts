import { App } from "obsidian";
import { buildObsidianManuscriptLibrary, ObsidianManuscriptLibrary } from "./ObsidianManuscript";
import { DisposableProjection } from "../projections/DisposableProjection";
import { explicitManuscriptKind, hasSceneMetadataSignal } from "./ManuscriptMetadata";
import type { TFile } from "obsidian";

/** Owns the disposable manuscript projection for the latest settled metadata state. */
export class ManuscriptProjectionService {
  private readonly projection: DisposableProjection<ObsidianManuscriptLibrary>;

  constructor(
    private readonly app: App,
    private readonly build: (app: App) => ObsidianManuscriptLibrary = buildObsidianManuscriptLibrary
  ) { this.projection = new DisposableProjection(() => this.build(this.app)); }

  /** Safe during bootstrap: lazily establishes the first authoritative projection. */
  get(): ObsidianManuscriptLibrary {
    return this.projection.get();
  }

  /** Called only at startup or a settled manuscript reconciliation boundary. */
  rebuild(): ObsidianManuscriptLibrary {
    return this.projection.rebuild();
  }

  /** Publishes the coordinator's already-built settled projection without rescanning. */
  publish(library: ObsidianManuscriptLibrary): void {
    this.projection.publish(library);
  }

  /** Narrows metadata events while preserving explicit and legacy recognised notes. */
  affectsMetadata(file: TFile): boolean {
    if (!this.projection.hasValue()) return true;
    const library = this.get();
    if (library.owningBookPathByFile.has(file.path) || library.books.some((book) => book.file.path === file.path)) return true;
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
    return explicitManuscriptKind(frontmatter) !== null || hasSceneMetadataSignal(frontmatter);
  }
}
