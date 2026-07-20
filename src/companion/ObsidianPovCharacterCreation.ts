import { App, TFile, TFolder } from "obsidian";
import {
  getChapterContextField,
  getEditableChapterContextValue,
  updateEditableChapterContextFrontmatter
} from "./ChapterContext";
import {
  buildPovCharacterMarkdown,
  PovCharacterCreationProposal
} from "./PovCharacterCreation";

export interface PovCharacterCreationResult {
  readonly file: TFile;
  readonly povValue: string;
}

export class StalePovCharacterCreationError extends Error {
  constructor() {
    super("The chapter POV changed before the character could be created. Try again.");
    this.name = "StalePovCharacterCreationError";
  }
}

export class PovCharacterPathConflictError extends Error {
  constructor(path: string) {
    super(`A vault item already exists at ${path}. Reopen the creation preview.`);
    this.name = "PovCharacterPathConflictError";
  }
}

function currentPovValue(
  app: App,
  chapter: TFile
): string {
  const frontmatter = app.metadataCache.getFileCache(chapter)?.frontmatter as
    Record<string, unknown> | undefined;
  return getEditableChapterContextValue(
    frontmatter,
    getChapterContextField("pov")
  ).value.trim();
}

function findCaseInsensitivePath(app: App, path: string) {
  const key = path.toLowerCase();
  return app.vault.getAllLoadedFiles().find((file) => (
    file.path.toLowerCase() === key
  )) ?? null;
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) return;

  let current = "";
  for (const segment of normalized.split("/")) {
    current = current ? `${current}/${segment}` : segment;
    const existing = findCaseInsensitivePath(app, current);
    if (existing) {
      if (!(existing instanceof TFolder)) {
        throw new PovCharacterPathConflictError(current);
      }
      continue;
    }
    await app.vault.createFolder(current);
  }
}

async function restorePovIfUnchanged(
  app: App,
  chapter: TFile,
  proposal: PovCharacterCreationProposal
): Promise<void> {
  try {
    await app.fileManager.processFrontMatter(chapter, (frontmatter) => {
      const field = getChapterContextField("pov");
      const current = getEditableChapterContextValue(frontmatter, field).value.trim();
      if (current === proposal.povValue.trim()) {
        updateEditableChapterContextFrontmatter(
          frontmatter,
          field,
          proposal.sourceValue
        );
      }
    });
  } catch {
    // A later author edit is never overwritten during rollback.
  }
}

export async function createPovCharacterFromProposal(
  app: App,
  chapter: TFile,
  proposal: PovCharacterCreationProposal
): Promise<PovCharacterCreationResult> {
  if (currentPovValue(app, chapter) !== proposal.sourceValue.trim()) {
    throw new StalePovCharacterCreationError();
  }
  if (findCaseInsensitivePath(app, proposal.path)) {
    throw new PovCharacterPathConflictError(proposal.path);
  }

  const slash = proposal.path.lastIndexOf("/");
  if (slash >= 0) await ensureFolder(app, proposal.path.slice(0, slash));

  let created: TFile | null = null;
  let povUpdated = false;

  try {
    created = await app.vault.create(
      proposal.path,
      buildPovCharacterMarkdown(proposal)
    );

    await app.fileManager.processFrontMatter(chapter, (frontmatter) => {
      const field = getChapterContextField("pov");
      const current = getEditableChapterContextValue(frontmatter, field).value.trim();
      if (current !== proposal.sourceValue.trim()) {
        throw new StalePovCharacterCreationError();
      }
      updateEditableChapterContextFrontmatter(
        frontmatter,
        field,
        proposal.povValue
      );
      povUpdated = true;
    });

    return { file: created, povValue: proposal.povValue };
  } catch (error) {
    if (povUpdated) await restorePovIfUnchanged(app, chapter, proposal);
    if (created) {
      try {
        await app.vault.delete(created);
      } catch {
        // The newly-created note is left visible rather than hiding a rollback failure.
      }
    }
    throw error;
  }
}
