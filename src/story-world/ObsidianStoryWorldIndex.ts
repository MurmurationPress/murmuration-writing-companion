import { App, TFile } from "obsidian";
import {
  parseWikilink,
  StoryWorldDocument,
  StoryWorldEntityRecord,
  StoryWorldIndex
} from "./StoryWorldIndex";
import { isObsidianTrashPath } from "../ObsidianTrash";

export class ObsidianStoryWorldIndex {
  readonly index = new StoryWorldIndex();

  constructor(private readonly app: App) {}

  rebuild(): boolean {
    return this.index.rebuild(
      this.app.vault.getMarkdownFiles()
        .filter((file) => !isObsidianTrashPath(file.path))
        .map((file) => this.documentFor(file))
    );
  }

  handleMetadataChanged(file: TFile): boolean {
    if (file.extension !== "md") return false;
    if (isObsidianTrashPath(file.path)) return this.index.remove(file.path);
    return this.index.upsert(this.documentFor(file));
  }

  handleCreate(file: TFile): boolean {
    if (file.extension !== "md") return false;
    if (isObsidianTrashPath(file.path)) return false;
    return this.index.upsert(this.documentFor(file));
  }

  handleDelete(file: TFile): boolean {
    if (file.extension !== "md") return false;
    return this.index.remove(file.path);
  }

  handleDeletePath(path: string): boolean {
    return this.index.remove(path);
  }

  handleRename(file: TFile, oldPath: string): boolean {
    if (file.extension !== "md" && !oldPath.toLowerCase().endsWith(".md")) {
      return false;
    }

    return this.index.rename(oldPath, this.documentFor(file));
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
}
