import { App, TFile } from "obsidian";
import type { ManuscriptBookSelectionService } from "./ManuscriptBookSelection";
import { buildObsidianManuscriptLibrary } from "./ObsidianManuscript";
import {
  confirmManuscriptPartRemoval,
  ManuscriptPartRemovalAdapter,
  ManuscriptPartRemovalPlan,
  ManuscriptPartRemovalSnapshot,
  planManuscriptPartRemoval
} from "./ManuscriptPartRemoval";

export interface ObsidianManuscriptPartRemovalHost {
  readonly app: App;
  readonly manuscriptBookSelection: ManuscriptBookSelectionService;
  refreshManuscriptNavigator(): void;
}

export function snapshotManuscriptPartRemoval(
  host: ObsidianManuscriptPartRemovalHost,
  partPath: string,
  expectedBookPath?: string
): ManuscriptPartRemovalSnapshot {
  const selection = host.manuscriptBookSelection.get();
  const library = buildObsidianManuscriptLibrary(host.app);
  const bookPath = expectedBookPath ?? selection.bookPath ?? "";
  const book = library.books.find((candidate) => candidate.file.path === bookPath);
  const file = host.app.vault.getAbstractFileByPath(partPath);
  return {
    selectedBookPath: selection.bookPath,
    bookPath,
    source: book?.result.source ?? "invalid",
    structuralErrors: book?.result.diagnostics.map((diagnostic) => diagnostic.message) ?? ["The owning Book is no longer available."],
    entries: book ? [book.record, ...book.result.entries].map((entry) => ({
      path: entry.path,
      title: entry.title,
      kind: entry.kind as "book" | "part" | "scene",
      parentPath: entry.parentPath,
      orderKey: entry.orderKey ?? null
    })) : [],
    partPath,
    mtime: file instanceof TFile ? file.stat.mtime : -1,
    size: file instanceof TFile ? file.stat.size : -1
  };
}

export function planObsidianManuscriptPartRemoval(
  host: ObsidianManuscriptPartRemovalHost,
  partPath: string,
  bookPath: string
): ManuscriptPartRemovalPlan {
  return planManuscriptPartRemoval(snapshotManuscriptPartRemoval(host, partPath, bookPath));
}

export async function removeObsidianManuscriptPart(
  host: ObsidianManuscriptPartRemovalHost,
  preview: ManuscriptPartRemovalPlan
): Promise<void> {
  const adapter: ManuscriptPartRemovalAdapter = {
    snapshot: async (partPath, bookPath) => snapshotManuscriptPartRemoval(host, partPath, bookPath),
    trashPart: async (path) => {
      const file = host.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) throw new Error("The Part note no longer exists.");
      await host.app.fileManager.trashFile(file);
    },
    refreshNavigator: () => host.refreshManuscriptNavigator()
  };
  await confirmManuscriptPartRemoval(true, adapter, preview);
}
