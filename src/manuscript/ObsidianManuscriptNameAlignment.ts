import { App, TFile } from "obsidian";
import { findAliasedProperty, getChapterContextField, updateEditableChapterContextFrontmatter } from "../companion/ChapterContext";
import { isObsidianTrashPath } from "../ObsidianTrash";
import { buildObsidianManuscriptLibrary } from "./ObsidianManuscript";
import {
  ManuscriptNameAlignmentAdapter,
  ManuscriptNameSnapshot
} from "./ManuscriptNameAlignment";

export interface ObsidianManuscriptNameAlignmentHost {
  readonly app: App;
  refreshManuscriptNavigator(): void;
}

function authoritativeEntry(app: App, path: string) {
  const library = buildObsidianManuscriptLibrary(app);
  for (const book of library.books) {
    if (book.record.path === path) return book.record;
    const entry = book.result.entries.find((candidate) => candidate.path === path);
    if (entry) return entry;
  }
  return null;
}

export class ObsidianManuscriptNameAlignmentAdapter implements ManuscriptNameAlignmentAdapter {
  constructor(private readonly host: ObsidianManuscriptNameAlignmentHost) {}

  snapshot(path: string): ManuscriptNameSnapshot | null {
    if (isObsidianTrashPath(path)) return null;
    const file = this.host.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file.extension !== "md") return null;
    const entry = authoritativeEntry(this.host.app, path);
    if (!entry || (entry.kind !== "book" && entry.kind !== "part" && entry.kind !== "scene")) return null;
    const frontmatter = this.host.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
    if (!frontmatter) return null;
    const titleField = getChapterContextField("title");
    const authoredTitle = findAliasedProperty(frontmatter, titleField.aliases)?.value;
    return { path: file.path, basename: file.basename, title: authoredTitle, kind: entry.kind, authoritative: true };
  }

  targetExists(path: string): boolean {
    return this.host.app.vault.getAbstractFileByPath(path) !== null;
  }

  async rename(path: string, targetPath: string): Promise<void> {
    const file = this.host.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error("The manuscript note is no longer available.");
    await this.host.app.fileManager.renameFile(file, targetPath);
  }

  async updateTitle(path: string, title: string): Promise<void> {
    const file = this.host.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error("The manuscript note is no longer available.");
    await this.host.app.fileManager.processFrontMatter(file, (frontmatter) => {
      updateEditableChapterContextFrontmatter(frontmatter, getChapterContextField("title"), title);
    });
  }

  refresh(): void {
    this.host.refreshManuscriptNavigator();
  }
}
