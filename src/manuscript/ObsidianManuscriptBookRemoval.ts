import { App, TFile } from "obsidian";
import type { ManuscriptBookSelectionService } from "./ManuscriptBookSelection";
import { buildObsidianManuscriptLibrary } from "./ObsidianManuscript";
import {
  confirmManuscriptBookRemoval,
  ManuscriptBookContentKind,
  ManuscriptBookRemovalAdapter,
  ManuscriptBookRemovalPlan,
  ManuscriptBookRemovalSnapshot,
  planManuscriptBookRemoval
} from "./ManuscriptBookRemoval";

export interface ObsidianManuscriptBookRemovalHost {
  readonly app: App;
  readonly manuscriptBookSelection: ManuscriptBookSelectionService;
  refreshManuscriptNavigator(): void;
}

function contentKind(host: ObsidianManuscriptBookRemovalHost, path: string, kind: string): ManuscriptBookContentKind {
  if (kind === "part") return "part";
  const file = host.app.vault.getAbstractFileByPath(path);
  const frontmatter = file instanceof TFile
    ? host.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined
    : undefined;
  const legacyType = Object.entries(frontmatter ?? {}).find(([key]) => (
    key.toLowerCase().replace(/[\s_-]+/g, "") === "documenttype"
  ))?.[1];
  return typeof legacyType === "string" && legacyType.trim().toLowerCase() === "chapter"
    ? "chapter"
    : "scene";
}

export function snapshotManuscriptBookRemoval(
  host: ObsidianManuscriptBookRemovalHost,
  bookPath: string
): ManuscriptBookRemovalSnapshot {
  const selection = host.manuscriptBookSelection.get();
  const library = buildObsidianManuscriptLibrary(host.app);
  const book = library.books.find((candidate) => candidate.file.path === bookPath);
  const file = host.app.vault.getAbstractFileByPath(bookPath);
  return {
    selectedBookPath: selection.bookPath,
    bookPath,
    source: book?.result.source ?? "invalid",
    structuralErrors: book?.result.diagnostics.map((diagnostic) => diagnostic.message)
      ?? ["The Book is no longer available."],
    entries: book ? [book.record, ...book.result.entries]
      .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.path === entry.path) === index)
      .map((entry) => ({
        path: entry.path,
        title: entry.title,
        kind: entry.kind === "book" ? "book" : contentKind(host, entry.path, entry.kind),
        parentPath: entry.parentPath
      })) : [],
    mtime: file instanceof TFile ? file.stat.mtime : -1,
    size: file instanceof TFile ? file.stat.size : -1
  };
}

export function planObsidianManuscriptBookRemoval(
  host: ObsidianManuscriptBookRemovalHost,
  bookPath: string
): ManuscriptBookRemovalPlan {
  return planManuscriptBookRemoval(snapshotManuscriptBookRemoval(host, bookPath));
}

export async function removeObsidianManuscriptBook(
  host: ObsidianManuscriptBookRemovalHost,
  preview: ManuscriptBookRemovalPlan
): Promise<void> {
  const adapter: ManuscriptBookRemovalAdapter = {
    snapshot: async (bookPath) => snapshotManuscriptBookRemoval(host, bookPath),
    trashBook: async (path) => {
      const file = host.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) throw new Error("The Book note no longer exists.");
      await host.app.fileManager.trashFile(file);
    },
    refreshNavigator: () => host.refreshManuscriptNavigator()
  };
  await confirmManuscriptBookRemoval(true, adapter, preview);
}
