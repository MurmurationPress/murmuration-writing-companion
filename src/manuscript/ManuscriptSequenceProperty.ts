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

const MANAGED_PROPERTIES = [
  MANUSCRIPT_SEQUENCE_PROPERTY,
  BOOK_SCENE_NUMBER_PROPERTY,
  SERIES_SCENE_NUMBER_PROPERTY
] as const;

/** Maintains disposable Navigator-derived frontmatter for native Bases reports. */
export class ManuscriptSequencePropertyService {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly app: App) {}

  reconcile(library: ObsidianManuscriptLibrary): Promise<void> {
    const requested = this.queue
      .catch(() => undefined)
      .then(() => this.reconcileNow(library));
    this.queue = requested;
    return requested;
  }

  private async reconcileNow(library: ObsidianManuscriptLibrary): Promise<void> {
    const projection = deriveManuscriptSequenceProjection(
      library.books.map((book) => ({
        bookPath: book.file.path,
        roots: book.result.roots
      }))
    );

    for (const file of this.app.vault.getMarkdownFiles()) {
      if (isObsidianTrashPath(file.path)) continue;
      const desired = projection.valuesByPath.get(file.path);
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as
        Record<string, unknown> | undefined;
      if (!desired && !hasManagedProperty(frontmatter)) continue;
      if (desired && valuesMatch(frontmatter, desired)) continue;
      await this.sync(file, desired);
    }
  }

  private async sync(
    file: TFile,
    desired: ManuscriptSequenceValues | undefined
  ): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (properties) => {
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
