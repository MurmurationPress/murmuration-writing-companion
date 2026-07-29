export type AlignableManuscriptKind = "book" | "part" | "scene";

export interface ManuscriptNameSnapshot {
  readonly path: string;
  readonly basename: string;
  readonly title: unknown;
  readonly kind: AlignableManuscriptKind;
  readonly authoritative: boolean;
}

export interface ManuscriptNameMismatch {
  readonly path: string;
  readonly filename: string;
  readonly title: string;
  readonly kind: AlignableManuscriptKind;
}

export interface ManuscriptNameAlignmentAdapter {
  snapshot(path: string): ManuscriptNameSnapshot | null;
  targetExists(path: string): boolean;
  rename(path: string, targetPath: string): Promise<void>;
  updateTitle(path: string, title: string): Promise<void>;
  refresh(): void;
}

export interface ManuscriptRenamePlan {
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly currentFilename: string;
  readonly proposedFilename: string;
  readonly errors: readonly string[];
}

export interface ManuscriptTitleUpdatePlan {
  readonly path: string;
  readonly oldTitle: string;
  readonly proposedTitle: string;
  readonly errors: readonly string[];
}

export class StaleManuscriptNameAlignmentError extends Error {}

/**
 * Comparison is deliberately narrow: trim outside whitespace. Filename-only
 * handling (extension and the established legacy numeric prefix) is applied by
 * mismatch detection. Case, punctuation and all other text are exact.
 */
export function normalizeManuscriptDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function authoredTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function detectManuscriptNameMismatch(
  snapshot: ManuscriptNameSnapshot | null
): ManuscriptNameMismatch | null {
  if (!snapshot?.authoritative) return null;
  const filename = snapshot.basename.trim().replace(/\.md$/i, "").trim();
  const title = authoredTitle(snapshot.title);
  const normalizedFilename = normalizeManuscriptDisplayName(
    filename.replace(/^\s*\d+(?:[\s._-]+|$)/, "")
  );
  const normalizedTitle = normalizeManuscriptDisplayName(title);
  if (!filename || !title || !normalizedFilename || !normalizedTitle) return null;
  if (normalizedFilename === normalizedTitle) return null;
  return { path: snapshot.path, filename, title, kind: snapshot.kind };
}

function parentPath(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

function filenameErrors(basename: string): string[] {
  const errors: string[] = [];
  if (!basename.trim()) errors.push("The title does not provide a filename.");
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(basename)) {
    errors.push("The title contains characters that are unsafe in a filename.");
  }
  if (basename === "." || basename === ".." || /[. ]$/.test(basename)) {
    errors.push("The title would produce an unsafe filename.");
  }
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(basename)) {
    errors.push("The title is a reserved filename on some systems.");
  }
  return errors;
}

export function planRenameFileFromTitle(
  snapshot: ManuscriptNameSnapshot | null,
  targetExists: (path: string) => boolean
): ManuscriptRenamePlan {
  const mismatch = detectManuscriptNameMismatch(snapshot);
  if (!snapshot || !mismatch) {
    return {
      sourcePath: snapshot?.path ?? "",
      targetPath: "",
      currentFilename: snapshot?.basename ?? "",
      proposedFilename: "",
      errors: ["This note is no longer an eligible manuscript name mismatch."]
    };
  }
  const proposedBasename = mismatch.title;
  const folder = parentPath(snapshot.path);
  const targetPath = `${folder ? `${folder}/` : ""}${proposedBasename}.md`;
  const errors = filenameErrors(proposedBasename);
  if (targetPath !== snapshot.path && targetExists(targetPath)) {
    errors.push(`A note already exists at ${targetPath}.`);
  }
  return {
    sourcePath: snapshot.path,
    targetPath,
    currentFilename: `${snapshot.basename}.md`,
    proposedFilename: `${proposedBasename}.md`,
    errors
  };
}

export function planUpdateTitleFromFilename(
  snapshot: ManuscriptNameSnapshot | null
): ManuscriptTitleUpdatePlan {
  const mismatch = detectManuscriptNameMismatch(snapshot);
  return mismatch ? {
    path: snapshot!.path,
    oldTitle: mismatch.title,
    proposedTitle: mismatch.filename,
    errors: []
  } : {
    path: snapshot?.path ?? "",
    oldTitle: authoredTitle(snapshot?.title) ?? "",
    proposedTitle: "",
    errors: ["This note is no longer an eligible manuscript name mismatch."]
  };
}

export async function executeRenameFileFromTitle(
  adapter: ManuscriptNameAlignmentAdapter,
  expected: ManuscriptRenamePlan
): Promise<void> {
  const current = planRenameFileFromTitle(adapter.snapshot(expected.sourcePath), (path) => adapter.targetExists(path));
  if (current.errors.length || current.targetPath !== expected.targetPath || current.currentFilename !== expected.currentFilename) {
    throw new StaleManuscriptNameAlignmentError(current.errors[0] ?? "The manuscript name changed before the rename could be applied.");
  }
  await adapter.rename(current.sourcePath, current.targetPath);
  adapter.refresh();
}

export async function executeUpdateTitleFromFilename(
  adapter: ManuscriptNameAlignmentAdapter,
  expected: ManuscriptTitleUpdatePlan
): Promise<void> {
  const current = planUpdateTitleFromFilename(adapter.snapshot(expected.path));
  if (current.errors.length || current.oldTitle !== expected.oldTitle || current.proposedTitle !== expected.proposedTitle) {
    throw new StaleManuscriptNameAlignmentError(current.errors[0] ?? "The manuscript name changed before the title could be updated.");
  }
  await adapter.updateTitle(current.path, current.proposedTitle);
  adapter.refresh();
}
