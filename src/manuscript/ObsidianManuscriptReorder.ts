import { App, parseYaml, TFile } from "obsidian";
import {
  MANUSCRIPT_PARENT_ALIASES,
  normalizeBookPropertyName
} from "../editorial/BookReview";
import { buildObsidianManuscriptLibrary } from "./ObsidianManuscript";
import { MANUSCRIPT_ORDER_KEY_PROPERTY, manuscriptOrderKey } from "./ManuscriptOrderKey";
import {
  ManuscriptMoveProposal,
  planDistributedManuscriptMoveWrites,
  sameManuscriptStructure
} from "./ManuscriptReorder";

interface PropertySnapshot {
  readonly values: Readonly<Record<string, unknown>>;
}

interface FileUndoState {
  readonly file: TFile;
  readonly before: PropertySnapshot;
  readonly after: PropertySnapshot;
}

export interface ManuscriptReorderUndoToken {
  readonly states: readonly FileUndoState[];
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

async function rollbackStates(app: App, states: readonly FileUndoState[]): Promise<void> {
  for (const state of [...states].reverse()) {
    try {
      await app.fileManager.processFrontMatter(state.file, (frontmatter) => {
        const current = captureProperties(frontmatter);
        if (snapshotsEqual(current, state.after)) {
          replaceProperties(frontmatter, state.before);
        }
      });
      await verifyWrittenSnapshot(app, state.file, state.before);
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
  const states: FileUndoState[] = [];

  try {
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
      await verifyWrittenSnapshot(app, file, after);
      states.push({ file, before, after });
    }
  } catch (error) {
    await rollbackStates(app, states);
    throw error;
  }

  return {
    states,
    message: writePlan.message
  };
}

export async function undoManuscriptReorder(
  app: App,
  token: ManuscriptReorderUndoToken
): Promise<void> {
  const restored: FileUndoState[] = [];

  try {
    for (const state of [...token.states].reverse()) {
      await assertNoConflictMarkers(app, state.file);
      await app.fileManager.processFrontMatter(state.file, (frontmatter) => {
        const current = captureProperties(frontmatter);
        if (!snapshotsEqual(current, state.after)) throw new StaleManuscriptUndoError();
        replaceProperties(frontmatter, state.before);
      });
      await verifyWrittenSnapshot(app, state.file, state.before);
      restored.push(state);
    }
  } catch (error) {
    for (const state of [...restored].reverse()) {
      try {
        await app.fileManager.processFrontMatter(state.file, (frontmatter) => {
          const current = captureProperties(frontmatter);
          if (snapshotsEqual(current, state.before)) {
            replaceProperties(frontmatter, state.after);
          }
        });
        await verifyWrittenSnapshot(app, state.file, state.after);
      } catch {
        // Do not overwrite a later edit while rolling back an unsafe Undo.
      }
    }
    throw error;
  }
}
