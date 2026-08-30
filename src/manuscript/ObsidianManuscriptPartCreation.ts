import { App, TAbstractFile, TFile, TFolder } from "obsidian";
import type { ManuscriptBookSelectionService } from "./ManuscriptBookSelection";
import {
  ManuscriptPartCreationPlan,
  ManuscriptPartCreationSnapshot,
  planManuscriptPartCreation,
  revalidateManuscriptPartPlan
} from "./ManuscriptPartCreation";
import { associatedManuscriptFolderPath, buildObsidianManuscriptLibrary } from "./ObsidianManuscript";
import { executeManuscriptNoteCreation, InvalidManuscriptNoteConfirmationError, ManuscriptNoteCreationAdapter } from "./ManuscriptNoteCreationExecution";
import { boundedManuscriptRecognition, cleanupUnchangedCreatedNote, ensurePreviewedManuscriptFolder, manuscriptVaultEntryAtPath, snapshotManuscriptVaultEntries } from "./ObsidianManuscriptNoteCreation";
import { cleanupManuscriptCompanionFolder, createManuscriptCompanionFolder, CreatedManuscriptCompanionFolder, ManuscriptCompanionFolderAdapter } from "./ManuscriptCompanionFolder";

export interface ManuscriptPartCreationAuthority {
  readonly app: App;
  readonly manuscriptBookSelection: ManuscriptBookSelectionService;
}

function directChildren(book: ReturnType<typeof buildObsidianManuscriptLibrary>["books"][number]) {
  return book.result.entries.filter((entry) => (
    entry.parentPath === book.file.path && (entry.kind === "part" || entry.kind === "scene")
  )).map((entry) => ({ path: entry.path, title: entry.title, kind: entry.kind, parentPath: entry.parentPath, orderKey: entry.orderKey ?? null }));
}

export function snapshotManuscriptPartCreation(host: ManuscriptPartCreationAuthority): ManuscriptPartCreationSnapshot {
  const selection = host.manuscriptBookSelection.get();
  const library = buildObsidianManuscriptLibrary(host.app);
  const book = library.books.find((candidate) => candidate.file.path === selection.bookPath) ?? null;
  return {
    selectedBookPath: selection.bookPath,
    selectionRevision: selection.revision,
    book: book ? { path: book.file.path, title: book.record.title, source: book.result.source, diagnostics: book.result.diagnostics } : null,
    directChildren: book ? directChildren(book) : [],
    parts: library.books.flatMap((candidate) => candidate.result.entries.filter((entry) => entry.kind === "part").map((entry) => ({ path: entry.path, title: entry.title, bookPath: candidate.file.path }))),
    entries: snapshotManuscriptVaultEntries(host.app),
    associatedBookFolder: book ? associatedManuscriptFolderPath(host.app, book.file) : null
  };
}

const adapters = new WeakMap<object, Map<string, ManuscriptNoteCreationAdapter<TFile, ManuscriptPartCreationSnapshot>>>();
const expectedPlans = new WeakMap<object, Map<string, ManuscriptPartCreationPlan>>();

function adapterFor(
  host: ManuscriptPartCreationAuthority,
  preview: ManuscriptPartCreationPlan
): ManuscriptNoteCreationAdapter<TFile, ManuscriptPartCreationSnapshot> {
  let hostAdapters = adapters.get(host);
  if (!hostAdapters) { hostAdapters = new Map(); adapters.set(host, hostAdapters); }
  const existing = hostAdapters.get(preview.path);
  if (existing) return existing;
  const mtimes = new WeakMap<TFile, number>();
  const companionFolders = new Map<string, CreatedManuscriptCompanionFolder<TAbstractFile>>();
  const folderAdapter: ManuscriptCompanionFolderAdapter<TAbstractFile> = {
    current: (path: string) => manuscriptVaultEntryAtPath(host.app, path),
    kind: (entry: ReturnType<typeof host.app.vault.getAbstractFileByPath>) => entry instanceof TFolder ? "folder" as const : "file" as const,
    create: async (path: string) => {
      await host.app.vault.createFolder(path);
      const created = host.app.vault.getAbstractFileByPath(path);
      if (!created) throw new Error(`Could not read the required Part folder at ${path}.`);
      return created;
    },
    isEmpty: (folder: TAbstractFile) => folder instanceof TFolder && folder.children.length === 0,
    remove: (folder: TAbstractFile) => host.app.vault.delete(folder)
  };
  const adapter: ManuscriptNoteCreationAdapter<TFile, ManuscriptPartCreationSnapshot> = {
    snapshot: () => snapshotManuscriptPartCreation(host),
    createFolder: (path) => ensurePreviewedManuscriptFolder(host.app, path),
    createCompanionFolder: async (path) => {
      const created = await createManuscriptCompanionFolder(folderAdapter, path);
      companionFolders.set(path, created);
    },
    cleanupCompanionFolder: async (path) => {
      await cleanupManuscriptCompanionFolder(folderAdapter, companionFolders.get(path) ?? null);
      companionFolders.delete(path);
    },
    createFile: async (path, markdown) => {
      const file = await host.app.vault.create(path, markdown);
      mtimes.set(file, file.stat.mtime);
      return file;
    },
    readFile: (file) => host.app.vault.read(file),
    cleanupReadBackMismatch: async (file) => {
      const mtime = mtimes.get(file);
      return mtime !== undefined && await cleanupUnchangedCreatedNote(host.app, file, mtime);
    },
    waitForRecognition: () => boundedManuscriptRecognition(() => {
      const expected = expectedPlans.get(host)?.get(preview.path) ?? preview;
      const library = buildObsidianManuscriptLibrary(host.app);
      const book = library.books.find((candidate) => candidate.file.path === expected.bookPath);
      if (!book) return "pending";
      const children = directChildren(book);
      const index = children.findIndex((child) => child.path === expected.path);
      if (index < 0) return "pending";
      const created = children[index];
      const previous = children[index - 1] ?? null;
      const next = children[index + 1] ?? null;
      return created.kind === "part"
        && created.parentPath === expected.bookPath
        && created.orderKey === expected.orderKey
        && previous?.path === expected.previous?.path
        && next?.path === expected.next?.path
        ? "recognised" : "structurally-invalid";
    })
  };
  hostAdapters.set(preview.path, adapter);
  return adapter;
}

export class StaleManuscriptPartCreationError extends Error {
  constructor(readonly errors: readonly string[]) { super(errors.join(" ")); this.name = "StaleManuscriptPartCreationError"; }
}

export async function createObsidianManuscriptPart(
  host: ManuscriptPartCreationAuthority,
  preview: ManuscriptPartCreationPlan
): Promise<{ status: "recognised" | "recognition-delayed" | "structurally-invalid"; file: TFile; plan: ManuscriptPartCreationPlan }> {
  try {
    let plans = expectedPlans.get(host);
    if (!plans) { plans = new Map(); expectedPlans.set(host, plans); }
    plans.set(preview.path, preview);
    const result = await executeManuscriptNoteCreation(
      adapterFor(host, preview),
      `${preview.bookPath}\0${preview.path}`,
      (snapshot) => revalidateManuscriptPartPlan(preview, snapshot)
    );
    return { status: result.status, file: result.handle, plan: result.plan };
  } catch (error) {
    if (error instanceof InvalidManuscriptNoteConfirmationError) throw new StaleManuscriptPartCreationError(error.errors);
    throw error;
  }
}
