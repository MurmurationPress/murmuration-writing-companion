import { App, TFile } from "obsidian";
import { isObsidianTrashPath } from "../ObsidianTrash";
import type { ObsidianManuscriptLibrary } from "./ObsidianManuscript";
import {
  BOOK_SCENE_NUMBER_PROPERTY,
  deriveManuscriptSequenceProjection,
  MANUSCRIPT_SEQUENCE_PROPERTY,
  ManuscriptSequenceValues,
  SERIES_SCENE_NUMBER_PROPERTY
} from "./ManuscriptSequenceProjection";
import {
  beginExactContentRestoration,
  cancelExactContentRestoration,
  completeExactContentRestoration,
  exactContentIsProtected,
  hasExactContentProtection
} from "./ExactContentProtection";
import { manuscriptSequenceReconciliationScope } from "./ManuscriptSequenceReconciliation";

const MANAGED_PROPERTIES = [
  MANUSCRIPT_SEQUENCE_PROPERTY,
  BOOK_SCENE_NUMBER_PROPERTY,
  SERIES_SCENE_NUMBER_PROPERTY
] as const;

/** Prevents derived reporting writes from racing an exact raw-content restoration. */
export function beginExactManuscriptContentRestoration(
  app: App,
  contentsByPath: ReadonlyMap<string, string>
): void {
  beginExactContentRestoration(app, contentsByPath);
}

/** Keeps successfully restored bytes protected until a later author edit changes them. */
export function completeExactManuscriptContentRestoration(
  app: App,
  paths: readonly string[]
): void {
  completeExactContentRestoration(app, paths);
}

export function cancelExactManuscriptContentRestoration(
  app: App,
  paths: readonly string[]
): void {
  cancelExactContentRestoration(app, paths);
}

export async function exactManuscriptContentIsProtected(
  app: App,
  path: string,
  read: () => Promise<string>
): Promise<boolean> {
  return exactContentIsProtected(app, path, read);
}

/** Terminal lifecycle cancellation, distinct from a failed host write. */
export class ManuscriptSequenceCancelledError extends Error {
  constructor() { super("Manuscript reporting reconciliation was cancelled."); }
}

/** Maintains disposable Navigator-derived frontmatter for native Bases reports. */
export class ManuscriptSequencePropertyService {
  private queue: Promise<void> = Promise.resolve();
  private pending: { library: ObsidianManuscriptLibrary } | null = null;
  private disposed = false;

  constructor(private readonly app: App) {}

  /** Cannot revoke a host write already committed; prevents any later mutation. */
  dispose(): void { this.disposed = true; }

  private assertActive(): void {
    if (this.disposed) throw new ManuscriptSequenceCancelledError();
  }

  reconcile(library: ObsidianManuscriptLibrary): Promise<void> {
    if (this.disposed) return Promise.reject(new ManuscriptSequenceCancelledError());
    // Keep the active write pass serial, but replace obsolete work that has not
    // started. Every caller in the pending batch awaits its latest snapshot.
    if (this.pending) {
      this.pending.library = library;
      return this.queue;
    }
    const pending = { library };
    this.pending = pending;
    const requested = this.queue
      .catch(() => undefined)
      .then(() => {
        this.pending = null;
        return this.reconcileNow(pending.library);
      });
    this.queue = requested;
    return requested;
  }

  private async reconcileNow(library: ObsidianManuscriptLibrary): Promise<void> {
    this.assertActive();
    const scope = manuscriptSequenceReconciliationScope(
      library.books.map((book) => ({
        source: book.result.source,
        paths: [...book.filesByPath.keys()],
        value: {
        bookPath: book.file.path,
        roots: book.result.roots
        }
      }))
    );
    const projection = deriveManuscriptSequenceProjection(scope.projectable);

    for (const file of this.app.vault.getMarkdownFiles()) {
      this.assertActive();
      if (isObsidianTrashPath(file.path)) continue;
      // Legacy and otherwise unprepared structure is not authoritative yet.
      // Preserve any authored/pre-existing reporting fields, but do not create
      // or reconcile derived reporting values until preparation succeeds.
      if (scope.deferredPaths.has(file.path)) continue;
      if (await exactManuscriptContentIsProtected(
        this.app,
        file.path,
        () => this.app.vault.read(file)
      )) continue;
      const desired = projection.valuesByPath.get(file.path);
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as
        Record<string, unknown> | undefined;
      if (!desired && !hasManagedProperty(frontmatter)) continue;
      if (desired && valuesMatch(frontmatter, desired)) continue;
      await this.sync(file, desired);
    }
    this.assertActive();
  }

  private async sync(
    file: TFile,
    desired: ManuscriptSequenceValues | undefined
  ): Promise<void> {
    this.assertActive();
    if (hasExactContentProtection(this.app, file.path)) return;
    await this.app.fileManager.processFrontMatter(file, (properties) => {
      this.assertActive();
      // A queued reconciliation may have passed its first check before Undo
      // began. Recheck at the synchronous mutation boundary.
      if (hasExactContentProtection(this.app, file.path)) return;
      if (!desired) {
        for (const property of MANAGED_PROPERTIES) delete properties[property];
        return;
      }

      properties[MANUSCRIPT_SEQUENCE_PROPERTY] = desired.manuscriptSequence;
      properties[BOOK_SCENE_NUMBER_PROPERTY] = desired.bookSceneNumber;
      properties[SERIES_SCENE_NUMBER_PROPERTY] = desired.seriesSceneNumber;
    });
  }
}

function hasManagedProperty(frontmatter: Record<string, unknown> | undefined): boolean {
  return MANAGED_PROPERTIES.some((property) => (
    frontmatter !== undefined
    && Object.prototype.hasOwnProperty.call(frontmatter, property)
  ));
}

function valuesMatch(
  frontmatter: Record<string, unknown> | undefined,
  desired: ManuscriptSequenceValues
): boolean {
  return frontmatter?.[MANUSCRIPT_SEQUENCE_PROPERTY] === desired.manuscriptSequence
    && frontmatter?.[BOOK_SCENE_NUMBER_PROPERTY] === desired.bookSceneNumber
    && frontmatter?.[SERIES_SCENE_NUMBER_PROPERTY] === desired.seriesSceneNumber;
}
