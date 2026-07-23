import { App, TFile } from "obsidian";
import { formatPropertyValue } from "../companion/ChapterContext";
import type { ManuscriptBookSelectionService } from "./ManuscriptBookSelection";
import {
  ManuscriptSceneCreationPlan,
  ManuscriptSceneCreationSnapshot,
  planManuscriptSceneCreation,
  revalidateManuscriptScenePlan
} from "./ManuscriptSceneCreation";
import { associatedManuscriptFolderPath, buildObsidianManuscriptLibrary } from "./ObsidianManuscript";
import { executeManuscriptNoteCreation, InvalidManuscriptNoteConfirmationError, ManuscriptNoteCreationAdapter } from "./ManuscriptNoteCreationExecution";
import { boundedManuscriptRecognition, cleanupUnchangedCreatedNote, ensurePreviewedManuscriptFolder, snapshotManuscriptVaultEntries } from "./ObsidianManuscriptNoteCreation";

export interface ManuscriptSceneCreationAuthority {
  readonly app: App;
  readonly manuscriptBookSelection: ManuscriptBookSelectionService;
}

function frontmatter(host: ManuscriptSceneCreationAuthority, file: TFile): Record<string, unknown> | undefined {
  return host.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
}

export function snapshotManuscriptSceneCreation(host: ManuscriptSceneCreationAuthority): ManuscriptSceneCreationSnapshot {
  const selection = host.manuscriptBookSelection.get();
  const library = buildObsidianManuscriptLibrary(host.app);
  const book = library.books.find((candidate) => candidate.file.path === selection.bookPath) ?? null;
  const parents = book ? [
    { path: book.file.path, title: book.record.title, kind: "book" as const, associatedFolder: associatedManuscriptFolderPath(host.app, book.file) },
    ...book.result.entries.filter((entry) => entry.kind === "part").map((entry) => {
      const file = book.filesByPath.get(entry.path)!;
      return { path: entry.path, title: entry.title, kind: "part" as const, associatedFolder: file ? associatedManuscriptFolderPath(host.app, file) : null };
    })
  ] : [];
  return {
    selectedBookPath: selection.bookPath,
    selectionRevision: selection.revision,
    contextPath: selection.contextPath,
    book: book ? { path: book.file.path, title: book.record.title, source: book.result.source, diagnostics: book.result.diagnostics, associatedFolder: associatedManuscriptFolderPath(host.app, book.file) } : null,
    parents,
    orderedEntries: book ? book.result.entries.filter((entry): entry is typeof entry & { kind: "part" | "scene" } => entry.kind === "part" || entry.kind === "scene").map((entry) => ({ path: entry.path, title: entry.title, kind: entry.kind, parentPath: entry.parentPath, orderKey: entry.orderKey ?? null })) : [],
    orderedScenes: book ? book.result.scenes.map((entry) => {
      const file = book.filesByPath.get(entry.path)!;
      return { path: entry.path, title: entry.title, frontmatter: file ? frontmatter(host, file) : undefined };
    }) : [],
    entries: snapshotManuscriptVaultEntries(host.app)
  };
}

const adapters = new WeakMap<object, Map<string, ManuscriptNoteCreationAdapter<TFile, ManuscriptSceneCreationSnapshot>>>();
const expectedPlans = new WeakMap<object, Map<string, ManuscriptSceneCreationPlan>>();

function adapterFor(host: ManuscriptSceneCreationAuthority, preview: ManuscriptSceneCreationPlan): ManuscriptNoteCreationAdapter<TFile, ManuscriptSceneCreationSnapshot> {
  let hostAdapters = adapters.get(host);
  if (!hostAdapters) { hostAdapters = new Map(); adapters.set(host, hostAdapters); }
  const existing = hostAdapters.get(preview.path);
  if (existing) return existing;
  const mtimes = new WeakMap<TFile, number>();
  const adapter: ManuscriptNoteCreationAdapter<TFile, ManuscriptSceneCreationSnapshot> = {
    snapshot: () => snapshotManuscriptSceneCreation(host),
    createFolder: (path) => ensurePreviewedManuscriptFolder(host.app, path),
    createFile: async (path, markdown) => {
      const file = await host.app.vault.create(path, markdown);
      mtimes.set(file, file.stat.mtime);
      return file;
    },
    readFile: (file) => host.app.vault.read(file),
    cleanupReadBackMismatch: async (file) => {
      const mtime = mtimes.get(file);
      if (mtime !== undefined) await cleanupUnchangedCreatedNote(host.app, file, mtime);
    },
    waitForRecognition: () => boundedManuscriptRecognition(() => {
      const expected = expectedPlans.get(host)?.get(preview.path) ?? preview;
      const snapshot = snapshotManuscriptSceneCreation(host);
      const created = snapshot.orderedEntries.find((entry) => entry.path === expected.path);
      if (!created) return "pending";
      const siblings = snapshot.orderedEntries.filter((entry) => entry.parentPath === expected.parentPath);
      const index = siblings.findIndex((entry) => entry.path === expected.path);
      const sceneIndex = snapshot.orderedScenes.findIndex((entry) => entry.path === expected.path);
      const file = host.app.vault.getAbstractFileByPath(expected.path);
      const metadata = file instanceof TFile ? frontmatter(host, file) : undefined;
      const dateCorrect = expected.acceptDate
        ? formatPropertyValue(metadata?.story_date) === expected.dateProposal?.value
        : !Object.prototype.hasOwnProperty.call(metadata ?? {}, "story_date");
      return created.kind === "scene"
        && created.parentPath === expected.parentPath
        && created.orderKey === expected.orderKey
        && siblings[index - 1]?.path === expected.previous?.path
        && siblings[index + 1]?.path === expected.next?.path
        && sceneIndex === expected.globalPosition
        && dateCorrect
        ? "recognised" : "structurally-invalid";
    })
  };
  hostAdapters.set(preview.path, adapter);
  return adapter;
}

export class StaleManuscriptSceneCreationError extends Error {
  constructor(readonly errors: readonly string[]) { super(errors.join(" ")); this.name = "StaleManuscriptSceneCreationError"; }
}

export async function createObsidianManuscriptScene(
  host: ManuscriptSceneCreationAuthority,
  preview: ManuscriptSceneCreationPlan
): Promise<{ status: "recognised" | "recognition-delayed" | "structurally-invalid"; file: TFile; plan: ManuscriptSceneCreationPlan }> {
  try {
    let plans = expectedPlans.get(host);
    if (!plans) { plans = new Map(); expectedPlans.set(host, plans); }
    plans.set(preview.path, preview);
    const result = await executeManuscriptNoteCreation(adapterFor(host, preview), `${preview.bookPath}\0${preview.parentPath}\0${preview.path}`, (snapshot) => revalidateManuscriptScenePlan(preview, snapshot));
    return { status: result.status, file: result.handle, plan: result.plan };
  } catch (error) {
    if (error instanceof InvalidManuscriptNoteConfirmationError) throw new StaleManuscriptSceneCreationError(error.errors);
    throw error;
  }
}
