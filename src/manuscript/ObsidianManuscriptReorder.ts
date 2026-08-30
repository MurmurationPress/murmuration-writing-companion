import { App, parseYaml, TAbstractFile, TFile, TFolder } from "obsidian";
import {
  MANUSCRIPT_PARENT_ALIASES,
  normalizeBookPropertyName
} from "../editorial/BookReview";
import {
  associatedManuscriptFolderPath,
  buildObsidianManuscriptLibrary,
  expectedAssociatedManuscriptFolderPath
} from "./ObsidianManuscript";
import { MANUSCRIPT_ORDER_KEY_PROPERTY, manuscriptOrderKey } from "./ManuscriptOrderKey";
import {
  manuscriptFileDestination,
  ManuscriptFileMoveCollisionError,
  moveManuscriptFile
} from "./ManuscriptFileMove";
import {
  cleanupManuscriptCompanionFolder,
  createManuscriptCompanionFolder,
  CreatedManuscriptCompanionFolder,
  ManuscriptCompanionFolderAdapter
} from "./ManuscriptCompanionFolder";
import { manuscriptVaultEntryAtPath } from "./ObsidianManuscriptNoteCreation";
import {
  ManuscriptMoveProposal,
  planDistributedManuscriptMoveWrites,
  sameManuscriptStructure
} from "./ManuscriptReorder";

interface PropertySnapshot {
  readonly values: Readonly<Record<string, unknown>>;
}

interface FileUndoState {
  readonly beforePath: string;
  readonly afterPath: string;
  readonly before: PropertySnapshot;
  readonly after: PropertySnapshot;
}

export interface ManuscriptReorderUndoToken {
  readonly states: readonly FileUndoState[];
  readonly createdFolder: CreatedManuscriptCompanionFolder<TAbstractFile> | null;
  readonly message: string;
}

export class StaleManuscriptMoveError extends Error {
  constructor() {
    super("The manuscript structure changed before this move could be written. Try the move again.");
    this.name = "StaleManuscriptMoveError";
  }
}

export class StaleManuscriptUndoError extends Error {
  constructor() {
    super("The manuscript structure changed after this move, so Undo is no longer safe.");
    this.name = "StaleManuscriptUndoError";
  }
}

export class ManuscriptSyncConflictError extends Error {
  constructor(path: string) {
    super(`Resolve sync or Git conflict markers before changing manuscript structure: ${path}`);
    this.name = "ManuscriptSyncConflictError";
  }
}

export class ManuscriptMoveDestinationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManuscriptMoveDestinationError";
  }
}

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizedAliasSet(aliases: readonly string[]): Set<string> {
  return new Set(aliases.map(normalizeBookPropertyName));
}

const STRUCTURE_ALIASES = [
  ...MANUSCRIPT_PARENT_ALIASES,
  MANUSCRIPT_ORDER_KEY_PROPERTY
] as const;

function captureProperties(
  frontmatter: Record<string, unknown>,
  aliases: readonly string[] = STRUCTURE_ALIASES
): PropertySnapshot {
  const normalized = normalizedAliasSet(aliases);
  const values: Record<string, unknown> = {};

  for (const [property, value] of Object.entries(frontmatter)) {
    if (property === "position") continue;
    if (normalized.has(normalizeBookPropertyName(property))) {
      values[property] = cloneValue(value);
    }
  }
  return { values };
}

function replaceProperties(
  frontmatter: Record<string, unknown>,
  snapshot: PropertySnapshot,
  aliases: readonly string[] = STRUCTURE_ALIASES
) {
  const normalized = normalizedAliasSet(aliases);
  for (const property of Object.keys(frontmatter)) {
    if (property === "position") continue;
    if (normalized.has(normalizeBookPropertyName(property))) {
      delete frontmatter[property];
    }
  }
  for (const [property, value] of Object.entries(snapshot.values)) {
    frontmatter[property] = cloneValue(value);
  }
}

function orderedSnapshot(snapshot: PropertySnapshot): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(snapshot.values).sort(([left], [right]) => left.localeCompare(right))
  );
}

function snapshotsEqual(left: PropertySnapshot, right: PropertySnapshot): boolean {
  return JSON.stringify(orderedSnapshot(left)) === JSON.stringify(orderedSnapshot(right));
}

function manuscriptReference(path: string): string {
  return `[[${path.replace(/\.md$/i, "")}]]`;
}

function setCanonicalParent(
  frontmatter: Record<string, unknown>,
  parentPath: string
) {
  const normalized = normalizedAliasSet(MANUSCRIPT_PARENT_ALIASES);
  for (const property of Object.keys(frontmatter)) {
    if (property === "position") continue;
    if (normalized.has(normalizeBookPropertyName(property))) delete frontmatter[property];
  }
  frontmatter.parent = manuscriptReference(parentPath);
}

function setOrderKey(frontmatter: Record<string, unknown>, orderKey: string) {
  for (const property of Object.keys(frontmatter)) {
    if (
      property !== "position"
      && normalizeBookPropertyName(property)
        === normalizeBookPropertyName(MANUSCRIPT_ORDER_KEY_PROPERTY)
    ) {
      delete frontmatter[property];
    }
  }
  frontmatter[MANUSCRIPT_ORDER_KEY_PROPERTY] = orderKey;
}

function hasConflictMarkers(content: string): boolean {
  return /^(?:<{7}|={7}|>{7})(?:\s|$)/m.test(content);
}

async function assertNoConflictMarkers(app: App, file: TFile): Promise<void> {
  const content = await app.vault.read(file);
  if (hasConflictMarkers(content)) throw new ManuscriptSyncConflictError(file.path);
}

function frontmatterFromMarkdown(content: string): Record<string, unknown> {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/);
  if (!match) return {};
  const parsed = parseYaml(match[1]);
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

async function verifyWrittenSnapshot(
  app: App,
  file: TFile,
  expected: PropertySnapshot
): Promise<void> {
  const content = await app.vault.read(file);
  if (hasConflictMarkers(content)) throw new ManuscriptSyncConflictError(file.path);
  const actual = captureProperties(frontmatterFromMarkdown(content));
  if (!snapshotsEqual(actual, expected)) {
    throw new Error(`Could not verify manuscript structure after writing ${file.path}.`);
  }
}

function fileAtPath(app: App, path: string): TFile | null {
  const file = app.vault.getAbstractFileByPath(path);
  return file instanceof TFile ? file : null;
}

function requireFileAtPath(app: App, path: string): TFile {
  const file = fileAtPath(app, path);
  if (!file) throw new StaleManuscriptMoveError();
  return file;
}

interface PlannedPathMove {
  readonly beforePath: string;
  readonly afterPath: string;
  readonly folderToCreate: string | null;
}

function planPathMove(
  app: App,
  book: TFile,
  currentBook: ReturnType<typeof buildObsidianManuscriptLibrary>["books"][number],
  writePlan: ReturnType<typeof planDistributedManuscriptMoveWrites>
): PlannedPathMove | null {
  const parentChange = writePlan.changes.find((change) => (
    change.beforeParentPath !== change.afterParentPath
  ));
  if (!parentChange) return null;

  const file = currentBook.filesByPath.get(parentChange.path);
  const parent = parentChange.afterParentPath === book.path
    ? book
    : currentBook.filesByPath.get(parentChange.afterParentPath);
  if (!file || !parent) throw new StaleManuscriptMoveError();

  let folder = associatedManuscriptFolderPath(app, parent);
  let folderToCreate: string | null = null;
  if (!folder) {
    const parentEntry = currentBook.result.entries.find((entry) => entry.path === parent.path);
    const expected = expectedAssociatedManuscriptFolderPath(parent);
    if (parentEntry?.kind !== "part" || !expected) {
      throw new ManuscriptMoveDestinationError(
        `The target ${parent.basename} does not have an associated manuscript folder.`
      );
    }
    const collision = manuscriptVaultEntryAtPath(app, expected);
    if (collision) {
      throw new ManuscriptMoveDestinationError(
        `A ${collision instanceof TFolder ? "folder" : "file"} already exists at the required Part folder path ${expected}.`
      );
    }
    folder = expected;
    folderToCreate = expected;
  }

  const afterPath = manuscriptFileDestination(folder, file.name);
  if (afterPath === file.path) return null;
  if (app.vault.getAbstractFileByPath(afterPath)) {
    throw new ManuscriptMoveDestinationError(
      `A file already exists at ${afterPath}; the manuscript move was not applied.`
    );
  }
  return { beforePath: file.path, afterPath, folderToCreate };
}

function companionFolderAdapter(app: App): ManuscriptCompanionFolderAdapter<TAbstractFile> {
  return {
    current: (path: string) => manuscriptVaultEntryAtPath(app, path),
    kind: (entry: ReturnType<typeof app.vault.getAbstractFileByPath>) => entry instanceof TFolder ? "folder" as const : "file" as const,
    create: async (path: string) => {
      await app.vault.createFolder(path);
      const created = app.vault.getAbstractFileByPath(path);
      if (!created) throw new Error(`Could not read the required Part folder at ${path}.`);
      return created;
    },
    isEmpty: (folder: TAbstractFile) => folder instanceof TFolder && folder.children.length === 0,
    remove: (folder: TAbstractFile) => app.vault.delete(folder)
  };
}

async function renameAndVerify(
  app: App,
  beforePath: string,
  afterPath: string
): Promise<void> {
  await moveManuscriptFile({
    exists: (path) => Boolean(app.vault.getAbstractFileByPath(path)),
    move: async (source, destination) => {
      await app.vault.rename(requireFileAtPath(app, source), destination);
    }
  }, beforePath, afterPath).catch((error) => {
    if (error instanceof ManuscriptFileMoveCollisionError) {
      throw new ManuscriptMoveDestinationError(error.message);
    }
    throw error;
  });
}

async function rollbackStates(app: App, states: readonly FileUndoState[]): Promise<void> {
  for (const state of [...states].reverse()) {
    try {
      const file = fileAtPath(app, state.afterPath) ?? requireFileAtPath(app, state.beforePath);
      await app.fileManager.processFrontMatter(file, (frontmatter) => {
        const current = captureProperties(frontmatter);
        if (snapshotsEqual(current, state.after)) {
          replaceProperties(frontmatter, state.before);
        }
      });
      await verifyWrittenSnapshot(app, file, state.before);
    } catch {
      // A later edit is never overwritten while recovering from a failed transaction.
    }
  }
}

export async function applyManuscriptReorder(
  app: App,
  book: TFile,
  filesByPath: ReadonlyMap<string, TFile>,
  proposal: ManuscriptMoveProposal
): Promise<ManuscriptReorderUndoToken> {
  if (!proposal.valid) throw new Error(proposal.message);

  const currentBook = buildObsidianManuscriptLibrary(app).books.find((candidate) => (
    candidate.file.path === book.path
  ));
  if (
    !currentBook
    || currentBook.result.source !== "distributed"
    || !sameManuscriptStructure(currentBook.result.entries, proposal.beforeEntries)
  ) {
    throw new StaleManuscriptMoveError();
  }

  const writePlan = planDistributedManuscriptMoveWrites(book.path, proposal);
  if (!writePlan.valid) throw new Error(writePlan.message);

  const currentByPath = new Map(
    currentBook.result.entries.map((entry) => [entry.path, entry])
  );
  const pathMove = planPathMove(app, book, currentBook, writePlan);
  const states: FileUndoState[] = [];
  let createdFolder: CreatedManuscriptCompanionFolder<TAbstractFile> | null = null;

  try {
    if (pathMove?.folderToCreate) {
      createdFolder = await createManuscriptCompanionFolder(companionFolderAdapter(app), pathMove.folderToCreate);
    }
    for (const change of writePlan.changes) {
      const file = currentBook.filesByPath.get(change.path) ?? filesByPath.get(change.path);
      const currentEntry = currentByPath.get(change.path);
      if (!file || !currentEntry) throw new StaleManuscriptMoveError();

      await assertNoConflictMarkers(app, file);
      const version = { mtime: file.stat.mtime, size: file.stat.size };
      let before: PropertySnapshot | null = null;
      let after: PropertySnapshot | null = null;

      await app.fileManager.processFrontMatter(file, (frontmatter) => {
        if (file.stat.mtime !== version.mtime || file.stat.size !== version.size) {
          throw new StaleManuscriptMoveError();
        }
        const currentKey = manuscriptOrderKey(frontmatter[MANUSCRIPT_ORDER_KEY_PROPERTY]);
        if (currentKey !== change.beforeOrderKey) {
          throw new StaleManuscriptMoveError();
        }

        before = captureProperties(frontmatter);
        setOrderKey(frontmatter, change.afterOrderKey);
        if (change.beforeParentPath !== change.afterParentPath) {
          setCanonicalParent(frontmatter, change.afterParentPath);
        }
        after = captureProperties(frontmatter);
      });

      if (!before || !after) {
        throw new Error(`Could not capture manuscript changes for ${file.path}.`);
      }
      states.push({
        beforePath: file.path,
        afterPath: pathMove?.beforePath === file.path ? pathMove.afterPath : file.path,
        before,
        after
      });
      await verifyWrittenSnapshot(app, file, after);
    }
    if (pathMove) await renameAndVerify(app, pathMove.beforePath, pathMove.afterPath);
  } catch (error) {
    if (
      pathMove
      && fileAtPath(app, pathMove.afterPath)
      && !app.vault.getAbstractFileByPath(pathMove.beforePath)
    ) {
      try {
        await renameAndVerify(app, pathMove.afterPath, pathMove.beforePath);
      } catch {
        // Metadata rollback below remains conservative if Obsidian cannot restore the path.
      }
    }
    await rollbackStates(app, states);
    try { await cleanupManuscriptCompanionFolder(companionFolderAdapter(app), createdFolder); } catch { /* Preserve the transaction failure. */ }
    throw error;
  }

  return {
    states,
    createdFolder,
    message: writePlan.message
  };
}

export async function undoManuscriptReorder(
  app: App,
  token: ManuscriptReorderUndoToken
): Promise<void> {
  const restored: FileUndoState[] = [];

  try {
    const movedState = token.states.find((state) => state.beforePath !== state.afterPath);
    if (movedState) {
      await renameAndVerify(app, movedState.afterPath, movedState.beforePath);
    }

    for (const state of [...token.states].reverse()) {
      const currentPath = state.beforePath !== state.afterPath
        ? state.beforePath
        : state.afterPath;
      const file = requireFileAtPath(app, currentPath);
      await assertNoConflictMarkers(app, file);
      await app.fileManager.processFrontMatter(file, (frontmatter) => {
        const current = captureProperties(frontmatter);
        if (!snapshotsEqual(current, state.after)) throw new StaleManuscriptUndoError();
        replaceProperties(frontmatter, state.before);
      });
      await verifyWrittenSnapshot(app, file, state.before);
      restored.push(state);
    }
    try { await cleanupManuscriptCompanionFolder(companionFolderAdapter(app), token.createdFolder); } catch { /* An empty repaired folder is safe to retain. */ }
  } catch (error) {
    for (const state of [...restored].reverse()) {
      try {
        const file = requireFileAtPath(app, state.beforePath);
        await app.fileManager.processFrontMatter(file, (frontmatter) => {
          const current = captureProperties(frontmatter);
          if (snapshotsEqual(current, state.before)) {
            replaceProperties(frontmatter, state.after);
          }
        });
        await verifyWrittenSnapshot(app, file, state.after);
      } catch {
        // Do not overwrite a later edit while rolling back an unsafe Undo.
      }
    }
    const movedState = token.states.find((state) => state.beforePath !== state.afterPath);
    if (
      movedState
      && fileAtPath(app, movedState.beforePath)
      && !app.vault.getAbstractFileByPath(movedState.afterPath)
    ) {
      try {
        await renameAndVerify(app, movedState.beforePath, movedState.afterPath);
      } catch {
        // Preserve the original error; the attempted transaction rollback is best effort.
      }
    }
    throw error;
  }
}
