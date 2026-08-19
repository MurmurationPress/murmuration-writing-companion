import { App, TFile } from "obsidian";
import {
  parseWikilink,
  StoryWorldDocument,
  StoryWorldEntityRecord,
  StoryWorldIndex
} from "./StoryWorldIndex";
import { isObsidianTrashPath } from "../ObsidianTrash";
import {
  compareStoryWorldBuilderItems,
  parseStoryWorldBuilderItem,
  StoryWorldBuilderItem
} from "./WorldBuilder";

export class ObsidianStoryWorldIndex {
  readonly index = new StoryWorldIndex();
  private readonly supportingModelsByPath = new Map<string, StoryWorldBuilderItem>();

  constructor(private readonly app: App) {}

  rebuild(): boolean {
    const documents = this.app.vault.getMarkdownFiles()
      .filter((file) => !isObsidianTrashPath(file.path))
      .map((file) => this.documentFor(file));
    const beforeModels = JSON.stringify(this.getSupportingModels());
    this.supportingModelsByPath.clear();
    for (const document of documents) this.upsertSupportingModel(document);
    return this.index.rebuild(documents) || beforeModels !== JSON.stringify(this.getSupportingModels());
  }

  handleMetadataChanged(file: TFile): boolean {
    if (file.extension !== "md") return false;
    if (isObsidianTrashPath(file.path)) return this.handleDeletePath(file.path);
    const document = this.documentFor(file);
    const entityChanged = this.index.upsert(document);
    const modelChanged = this.upsertSupportingModel(document);
    return entityChanged || modelChanged;
  }

  handleCreate(file: TFile): boolean {
    if (file.extension !== "md") return false;
    if (isObsidianTrashPath(file.path)) return false;
    const document = this.documentFor(file);
    const entityChanged = this.index.upsert(document);
    const modelChanged = this.upsertSupportingModel(document);
    return entityChanged || modelChanged;
  }

  handleDelete(file: TFile): boolean {
    if (file.extension !== "md") return false;
    const entityChanged = this.index.remove(file.path);
    const modelChanged = this.supportingModelsByPath.delete(file.path);
    return entityChanged || modelChanged;
  }

  handleDeletePath(path: string): boolean {
    const entityChanged = this.index.remove(path);
    const modelChanged = this.supportingModelsByPath.delete(path);
    return entityChanged || modelChanged;
  }

  handleRename(file: TFile, oldPath: string): boolean {
    if (file.extension !== "md" && !oldPath.toLowerCase().endsWith(".md")) {
      return false;
    }

    const document = this.documentFor(file);
    const entityChanged = this.index.rename(oldPath, document);
    const removedModel = oldPath === file.path ? false : this.supportingModelsByPath.delete(oldPath);
    const modelChanged = this.upsertSupportingModel(document);
    return entityChanged || removedModel || modelChanged;
  }

  getSupportingModels(): StoryWorldBuilderItem[] {
    return [...this.supportingModelsByPath.values()].sort(compareStoryWorldBuilderItems);
  }

  resolveWikilink(
    reference: unknown,
    sourcePath: string
  ): StoryWorldEntityRecord | null {
    const parsed = parseWikilink(reference);
    if (!parsed) return null;

    const destination = this.app.metadataCache.getFirstLinkpathDest(
      parsed.linkpath,
      sourcePath
    );

    if (destination) {
      return this.index.getByPath(destination.path);
    }

    const aliasMatches = this.index.findByNameOrAlias(parsed.linkpath);
    return aliasMatches.length === 1 ? aliasMatches[0] : null;
  }

  /** Resolves explicit links while retaining whether the target belongs to Story World authority. */
  resolveReference(reference: unknown, sourcePath: string): { path: string; indexed: boolean; excluded: boolean } | null {
    const parsed = parseWikilink(reference);
    if (!parsed) return null;
    const destination = this.app.metadataCache.getFirstLinkpathDest(parsed.linkpath, sourcePath);
    if (destination) return { path: destination.path, indexed: this.index.getByPath(destination.path) !== null, excluded: isObsidianTrashPath(destination.path) };
    const aliasMatches = this.index.findByNameOrAlias(parsed.linkpath);
    return aliasMatches.length === 1 ? { path: aliasMatches[0].path, indexed: true, excluded: false } : null;
  }

  private documentFor(file: TFile): StoryWorldDocument {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter as Record<string, unknown> | undefined;

    return {
      path: file.path,
      basename: file.basename,
      frontmatter
    };
  }

  private upsertSupportingModel(document: StoryWorldDocument): boolean {
    const parsed = parseStoryWorldBuilderItem(document);
    const next = parsed?.kind === "model" ? parsed : null;
    const existing = this.supportingModelsByPath.get(document.path);
    if (!next) return existing ? this.supportingModelsByPath.delete(document.path) : false;
    if (existing && JSON.stringify(existing) === JSON.stringify(next)) return false;
    this.supportingModelsByPath.set(document.path, next);
    return true;
  }
}
