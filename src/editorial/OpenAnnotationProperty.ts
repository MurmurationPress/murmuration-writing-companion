import { App, TFile } from "obsidian";
import { EditorialStore } from "./EditorialNote";

export const OPEN_ANNOTATION_PROPERTY = "mwc_open_annotations";

export class OpenAnnotationPropertyService {
  private app: App;
  private fileQueues = new Map<string, Promise<void>>();
  private knownCounts = new Map<string, number>();

  constructor(app: App) {
    this.app = app;
  }

  async sync(file: TFile, openCount: number): Promise<void> {
    const previous = this.fileQueues.get(file.path) ?? Promise.resolve();
    const queued = previous
      .catch(() => undefined)
      .then(() => this.syncNow(file, openCount));

    this.fileQueues.set(file.path, queued);

    try {
      await queued;
    } finally {
      if (this.fileQueues.get(file.path) === queued) {
        this.fileQueues.delete(file.path);
      }
    }
  }

  async reconcile(store: EditorialStore): Promise<void> {
    const markdownFiles = this.app.vault.getMarkdownFiles();
    const filesByPath = new Map(markdownFiles.map((file) => [file.path, file]));
    const relevantPaths = new Set(Object.keys(store.pages));

    for (const file of markdownFiles) {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

      if (hasOwnProperty(frontmatter, OPEN_ANNOTATION_PROPERTY)) {
        relevantPaths.add(file.path);
      }
    }

    for (const path of relevantPaths) {
      const file = filesByPath.get(path);
      if (!file) continue;

      const page = store.pages[path];
      const openCount = page?.annotations?.filter(
        (annotation) => annotation.status === "open"
      ).length ?? 0;

      await this.sync(file, openCount);
    }
  }

  private async syncNow(file: TFile, openCount: number): Promise<void> {
    const count = Math.max(0, Math.trunc(openCount));
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const propertyExists = hasOwnProperty(frontmatter, OPEN_ANNOTATION_PROPERTY);
    const currentValue = frontmatter?.[OPEN_ANNOTATION_PROPERTY];
    const hasKnownCount = this.knownCounts.has(file.path);
    const knownCount = this.knownCounts.get(file.path);

    if (hasKnownCount && knownCount === count) return;

    if (
      !hasKnownCount
      && count > 0
      && typeof currentValue === "number"
      && currentValue === count
    ) {
      this.knownCounts.set(file.path, count);
      return;
    }

    if (!hasKnownCount && count === 0 && !propertyExists) {
      this.knownCounts.set(file.path, 0);
      return;
    }

    await this.app.fileManager.processFrontMatter(file, (properties) => {
      if (count > 0) {
        properties[OPEN_ANNOTATION_PROPERTY] = count;
      } else {
        delete properties[OPEN_ANNOTATION_PROPERTY];
      }
    });

    this.knownCounts.set(file.path, count);
  }
}

function hasOwnProperty(
  value: Record<string, unknown> | undefined,
  property: string
): boolean {
  return value !== undefined
    && Object.prototype.hasOwnProperty.call(value, property);
}
