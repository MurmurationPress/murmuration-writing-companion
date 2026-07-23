import { App, TFile, TFolder } from "obsidian";
import {
  ManuscriptBookCreationPlan,
  ManuscriptBookIdentity,
  ManuscriptVaultEntry
} from "./ManuscriptBookCreation";
import { buildObsidianManuscriptLibrary } from "./ObsidianManuscript";
import {
  executeManuscriptBookCreation,
  InvalidManuscriptBookConfirmationError,
  ManuscriptBookCreationAdapter
} from "./ManuscriptBookCreationExecution";

export class StaleManuscriptBookCreationError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(errors.join(" "));
    this.name = "StaleManuscriptBookCreationError";
  }
}

export type ManuscriptBookCreationResult =
  | { readonly status: "recognised"; readonly file: TFile; readonly plan: ManuscriptBookCreationPlan }
  | { readonly status: "recognition-delayed"; readonly file: TFile; readonly plan: ManuscriptBookCreationPlan };

export function snapshotManuscriptBookCreation(app: App): {
  books: ManuscriptBookIdentity[];
  entries: ManuscriptVaultEntry[];
} {
  const library = buildObsidianManuscriptLibrary(app);
  return {
    books: library.books.map((book) => ({ path: book.file.path, title: book.record.title })),
    entries: app.vault.getAllLoadedFiles()
      .filter((entry) => entry.path.length > 0)
      .map((entry) => ({
        path: entry.path,
        kind: entry instanceof TFolder ? "folder" as const : "file" as const
      }))
  };
}

const recognitionRequests = new WeakMap<App, Map<string, Promise<boolean>>>();

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function waitForBookRecognition(app: App, path: string): Promise<boolean> {
  let appRequests = recognitionRequests.get(app);
  if (!appRequests) {
    appRequests = new Map();
    recognitionRequests.set(app, appRequests);
  }
  const existing = appRequests.get(path);
  if (existing) return existing;
  const request = (async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (buildObsidianManuscriptLibrary(app).books.some((book) => book.file.path === path)) return true;
      await wait(100);
    }
    return false;
  })();
  appRequests.set(path, request);
  void request.then(
    () => appRequests?.delete(path),
    () => appRequests?.delete(path)
  );
  return request;
}

async function cleanupReadBackMismatch(
  app: App,
  created: TFile,
  createdMtime: number
): Promise<void> {
  const current = app.vault.getAbstractFileByPath(created.path);
  if (!(current instanceof TFile) || current !== created || current.stat.mtime !== createdMtime) return;
  await app.vault.delete(created);
}

const adapters = new WeakMap<App, ManuscriptBookCreationAdapter<TFile>>();

function creationAdapter(app: App): ManuscriptBookCreationAdapter<TFile> {
  const existing = adapters.get(app);
  if (existing) return existing;
  const createdMtimes = new WeakMap<TFile, number>();
  const adapter: ManuscriptBookCreationAdapter<TFile> = {
    snapshot: () => snapshotManuscriptBookCreation(app),
    createFolder: async (folderPath) => {
      const current = app.vault.getAbstractFileByPath(folderPath);
      if (current instanceof TFolder) return;
      if (current) throw new StaleManuscriptBookCreationError([`The parent path “${current.path}” is no longer available as a folder.`]);
      await app.vault.createFolder(folderPath);
    },
    createFile: async (path, markdown) => {
      const created = await app.vault.create(path, markdown);
      createdMtimes.set(created, created.stat.mtime);
      return created;
    },
    readFile: (file) => app.vault.cachedRead(file),
    cleanupReadBackMismatch: async (file) => {
      const mtime = createdMtimes.get(file);
      if (mtime !== undefined) await cleanupReadBackMismatch(app, file, mtime);
    },
    waitForRecognition: (path) => waitForBookRecognition(app, path)
  };
  adapters.set(app, adapter);
  return adapter;
}

export async function createObsidianManuscriptBook(
  app: App,
  preview: Pick<ManuscriptBookCreationPlan, "title" | "path">
): Promise<ManuscriptBookCreationResult> {
  try {
    const result = await executeManuscriptBookCreation(creationAdapter(app), preview);
    return { status: result.status, file: result.handle, plan: result.plan };
  } catch (error) {
    if (error instanceof InvalidManuscriptBookConfirmationError) {
      throw new StaleManuscriptBookCreationError(error.errors);
    }
    throw error;
  }
}
