import { App, TFile } from "obsidian";
import { ManuscriptBookSelectionService } from "./ManuscriptBookSelection";
import { buildObsidianManuscriptLibrary, ObsidianManuscriptLibrary } from "./ObsidianManuscript";
import {
  captureLastKnownManuscriptSnapshot,
  deletionContextFor,
  LastKnownManuscriptSnapshot,
  ManuscriptEventGeneration,
  ManuscriptDeletionContext,
  reconcileManuscriptSelection
} from "./ManuscriptIntegrity";
import { ManuscriptSequencePropertyService } from "./ManuscriptSequenceProperty";
import { ManuscriptProjectionService } from "./ManuscriptProjection";

export interface ManuscriptIntegrityRefresh {
  readonly library: ObsidianManuscriptLibrary;
  readonly affectedPaths: ReadonlySet<string>;
  readonly affectedBookPaths: ReadonlySet<string>;
  readonly revealPath: string | null;
  readonly clearReveal: boolean;
  readonly missingSelectedBook: boolean;
}

export interface ManuscriptIntegrityCoordinatorOptions {
  readonly debounceMs?: number;
  readonly retryMs?: number;
  readonly maxMetadataRetries?: number;
  readonly activePath: () => string | null;
  readonly onSettled: (refresh: ManuscriptIntegrityRefresh) => void;
}

/** Coalesces manuscript-facing vault truth into one settled, read-only projection. */
export class ManuscriptIntegrityCoordinator {
  private readonly generations = new ManuscriptEventGeneration();
  private readonly pendingPaths = new Set<string>();
  private readonly pendingRenamePaths = new Set<string>();
  private readonly manuscriptSequenceProperties: ManuscriptSequencePropertyService;
  private pendingSelectionRevision = 0;
  private timer: number | null = null;
  private snapshot: LastKnownManuscriptSnapshot | null = null;
  private disposed = false;

  constructor(
    private readonly app: App,
    private readonly selection: ManuscriptBookSelectionService,
    private readonly options: ManuscriptIntegrityCoordinatorOptions,
    private readonly projection = new ManuscriptProjectionService(app)
  ) {
    this.manuscriptSequenceProperties = new ManuscriptSequencePropertyService(app);
  }

  initialise(): void {
    const library = this.projection.rebuild();
    this.reconcileAndPublish(
      library,
      new Set(library.books.map((book) => book.file.path)),
      null,
      true,
      new Set()
    );
    void this.reconcileSequenceProperties(library);
  }

  queue(path: string): void {
    const normalized = normalizePath(path);
    const generation = this.generations.touch(normalized);
    this.pendingPaths.add(normalized);
    this.pendingSelectionRevision = this.selection.get().revision;
    this.schedule(generation.batchGeneration, 0);
  }

  queueRename(oldPath: string, newPath: string): void {
    this.pendingRenamePaths.add(normalizePath(oldPath));
    this.pendingRenamePaths.add(normalizePath(newPath));
    this.queue(oldPath);
    this.queue(newPath);
  }

  queueUnmanagedMove(oldPath: string, newPath: string): void {
    this.queue(oldPath);
    this.queue(newPath);
  }

  metadataResolved(): void {
    if (this.pendingPaths.size > 0) this.schedule(this.generations.currentBatch(), 0);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  getLastSettledSnapshot(): LastKnownManuscriptSnapshot | null { return this.snapshot; }

  rebuildReportingSequence(): Promise<void> {
    return this.manuscriptSequenceProperties.reconcile(
      buildObsidianManuscriptLibrary(this.app)
    );
  }

  private schedule(generation: number, retry: number): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    const delay = retry === 0 ? this.options.debounceMs ?? 100 : this.options.retryMs ?? 75;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.settle(generation, retry);
    }, delay);
  }

  private async settle(generation: number, retry: number): Promise<void> {
    if (this.disposed || generation !== this.generations.currentBatch()) return;
    const paths = [...this.pendingPaths];
    const pathGenerations = new Map(paths.map((path) => [path, this.generations.currentPath(path)]));
    const metadataPending = paths.some((path) => {
      const file = this.app.vault.getAbstractFileByPath(path);
      return file instanceof TFile && file.extension === "md" && !this.app.metadataCache.getFileCache(file);
    });
    if (metadataPending && retry < (this.options.maxMetadataRetries ?? 4)) {
      this.schedule(generation, retry + 1);
      return;
    }
    await Promise.resolve();
    if (this.disposed || generation !== this.generations.currentBatch()) return;
    if (paths.some((path) => this.generations.currentPath(path) !== pathGenerations.get(path))) return;

    const library = this.projection.rebuild();
    const survivingPaths = manuscriptPaths(library);
    const contexts = paths
      .filter((path) => !this.pendingRenamePaths.has(path) && !this.app.vault.getAbstractFileByPath(path))
      .map((path) => deletionContextFor(this.snapshot, path, survivingPaths))
      .filter((context): context is ManuscriptDeletionContext => context !== null);
    const context = contexts.find((candidate) => candidate.deletedPath === this.selection.get().contextPath)
      ?? contexts.find((candidate) => candidate.bookPath === this.selection.get().bookPath)
      ?? contexts[0] ?? null;
    const affectedBooks = new Set<string>();
    for (const path of paths) {
      const oldEntry = this.snapshot?.entriesByPath.get(path);
      if (oldEntry) affectedBooks.add(oldEntry.bookPath);
      const currentBook = library.owningBookPathByFile.get(path);
      if (currentBook) affectedBooks.add(currentBook);
    }
    const authorSelectionUnchanged = this.selection.get().revision === this.pendingSelectionRevision;
    this.reconcileAndPublish(library, affectedBooks, context, authorSelectionUnchanged, new Set(paths));
    this.pendingPaths.clear();
    this.pendingRenamePaths.clear();
    void this.reconcileSequenceProperties(library);
  }

  private reconcileAndPublish(
    library: ObsidianManuscriptLibrary,
    affectedBookPaths: ReadonlySet<string>,
    context: ManuscriptDeletionContext | null,
    allowSelectionChange: boolean,
    affectedPaths: ReadonlySet<string>
  ): void {
    const paths = manuscriptPaths(library);
    const current = this.selection.get();
    const decision = reconcileManuscriptSelection(
      current,
      new Set(library.books.map((book) => book.file.path)),
      paths,
      library.books[0]?.file.path ?? null,
      context
    );
    if (allowSelectionChange && decision.changed) {
      this.selection.replace(decision.bookPath, decision.contextPath, "integrity-reconciliation");
    }
    const settledSelection = this.selection.get();
    this.snapshot = captureLastKnownManuscriptSnapshot(
      library,
      settledSelection,
      this.options.activePath(),
      this.generations.currentBatch()
    );
    this.projection.publish(library);
    this.options.onSettled({
      library,
      affectedPaths,
      affectedBookPaths,
      revealPath: allowSelectionChange ? decision.contextPath : null,
      clearReveal: Boolean(context),
      missingSelectedBook: allowSelectionChange && decision.missingBook
    });
  }

  private async reconcileSequenceProperties(
    library: ObsidianManuscriptLibrary
  ): Promise<void> {
    try {
      await this.manuscriptSequenceProperties.reconcile(library);
    } catch (error) {
      console.error("Writing Companion could not reconcile manuscript reporting sequence", error);
    }
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function manuscriptPaths(library: ObsidianManuscriptLibrary): Set<string> {
  const paths = new Set<string>(library.unresolved.map((note) => note.file.path));
  for (const book of library.books) for (const path of book.filesByPath.keys()) paths.add(path);
  return paths;
}
