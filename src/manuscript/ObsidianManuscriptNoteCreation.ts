import { App, TFile, TFolder } from "obsidian";
import type { ManuscriptVaultEntry } from "./ManuscriptNoteCreation";

export function snapshotManuscriptVaultEntries(app: App): ManuscriptVaultEntry[] {
  return app.vault.getAllLoadedFiles().filter((entry) => entry.path.length > 0).map((entry) => ({
    path: entry.path,
    kind: entry instanceof TFolder ? "folder" as const : "file" as const
  }));
}

export async function ensurePreviewedManuscriptFolder(app: App, path: string): Promise<void> {
  const current = app.vault.getAbstractFileByPath(path);
  if (current instanceof TFolder) return;
  if (current) throw new Error(`The parent path “${current.path}” is no longer available as a folder.`);
  await app.vault.createFolder(path);
}

export async function cleanupUnchangedCreatedNote(app: App, file: TFile, createdMtime: number): Promise<void> {
  const current = app.vault.getAbstractFileByPath(file.path);
  if (current instanceof TFile && current === file && current.stat.mtime === createdMtime) await app.vault.delete(file);
}

export async function boundedManuscriptRecognition(
  predicate: () => "recognised" | "pending" | "structurally-invalid",
  attempts = 12
): Promise<"recognised" | "recognition-delayed" | "structurally-invalid"> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = predicate();
    if (result !== "pending") return result;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
  }
  return "recognition-delayed";
}
