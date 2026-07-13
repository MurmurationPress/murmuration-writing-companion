import { App, TFile } from "obsidian";
import {
  parseWikilink,
  StoryWorldDocument,
  StoryWorldEntityRecord,
  StoryWorldIndex
} from "./StoryWorldIndex";

export class ObsidianStoryWorldIndex {
  readonly index = new StoryWorldIndex();

  constructor(private readonly app: App) {}

  rebuild(): boolean {
    return this.index.rebuild(
      this.app.vault.getMarkdownFiles().map((file) => this.documentFor(file))
    );
  }

  handleMetadataChanged(file: TFile): boolean {
    if (file.extension !== "md") return false;
    return this.index.upsert(this.documentFor(file));
  }

  handleCreate(file: TFile): boolean {
    if (file.extension !== "md") return false;
    return this.index.upsert(this.documentFor(file));
  }

  handleDelete(file: TFile): boolean {
    if (file.extension !== "md") return false;
    return this.index.remove(file.path);
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
