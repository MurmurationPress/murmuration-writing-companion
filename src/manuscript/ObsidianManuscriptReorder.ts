import { App, TFile } from "obsidian";
import {
  MANUSCRIPT_PARENT_ALIASES,
  normalizeBookPropertyName
} from "../editorial/BookReview";
import { buildObsidianManuscriptLibrary } from "./ObsidianManuscript";
import { MANUSCRIPT_ORDER_PROPERTY } from "./ManuscriptOrder";
import {
  manuscriptOrderReferences,
  ManuscriptMoveProposal,
  sameManuscriptStructure
} from "./ManuscriptReorder";

interface PropertySnapshot {
  readonly values: Readonly<Record<string, unknown>>;
}

interface ParentUndoState {
  readonly file: TFile;
  readonly before: PropertySnapshot;
  readonly after: PropertySnapshot;
}

export interface ManuscriptReorderUndoToken {
  readonly book: TFile;
  readonly orderBefore: PropertySnapshot;
  readonly orderAfter: PropertySnapshot;
  readonly parent: ParentUndoState | null;
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

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizedAliasSet(aliases: readonly string[]): Set<string> {
  return new Set(aliases.map(normalizeBookPropertyName));
}

function captureProperties(
  frontmatter: Record<string, unknown>,
  aliases: readonly string[]
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
  aliases: readonly string[],
  snapshot: PropertySnapshot
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

function snapshotsEqual(left: PropertySnapshot, right: PropertySnapshot): boolean {
  const ordered = (snapshot: PropertySnapshot) => Object.fromEntries(
    Object.entries(snapshot.values).sort(([leftKey], [rightKey]) => (
      leftKey.localeCompare(rightKey)
    ))
  );
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
}

function assertSnapshot(
  frontmatter: Record<string, unknown>,
  aliases: readonly string[],
  expected: PropertySnapshot
) {
  if (!snapshotsEqual(captureProperties(frontmatter, aliases), expected)) {
    throw new StaleManuscriptUndoError();
  }
}

function manuscriptReference(path: string): string {
  return `[[${path.replace(/\.md$/i, "")}]]`;
}

function setParentReference(
  frontmatter: Record<string, unknown>,
  parentPath: string
) {
  const normalized = normalizedAliasSet(MANUSCRIPT_PARENT_ALIASES);
  const existing = Object.keys(frontmatter).find((property) => (
    property !== "position"
    && normalized.has(normalizeBookPropertyName(property))
  ));
  const property = existing ?? "parent";

  for (const candidate of Object.keys(frontmatter)) {
    if (candidate === property || candidate === "position") continue;
    if (normalized.has(normalizeBookPropertyName(candidate))) {
      delete frontmatter[candidate];
    }
  }
  frontmatter[property] = manuscriptReference(parentPath);
}

const ORDER_ALIASES = [MANUSCRIPT_ORDER_PROPERTY] as const;

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
    || !sameManuscriptStructure(currentBook.result.entries, proposal.beforeEntries)
  ) {
    throw new StaleManuscriptMoveError();
  }

  const references = manuscriptOrderReferences(proposal.entries);
  let orderBefore: PropertySnapshot | null = null;
  let orderAfter: PropertySnapshot | null = null;

  await app.fileManager.processFrontMatter(book, (frontmatter) => {
    orderBefore = captureProperties(frontmatter, ORDER_ALIASES);
    frontmatter[MANUSCRIPT_ORDER_PROPERTY] = references;
    orderAfter = captureProperties(frontmatter, ORDER_ALIASES);
  });

  if (!orderBefore || !orderAfter) {
    throw new Error("Could not capture the manuscript order transaction.");
  }

  let parentState: ParentUndoState | null = null;
  if (proposal.parentChange) {
    const movedFile = currentBook.filesByPath.get(proposal.parentChange.path)
      ?? filesByPath.get(proposal.parentChange.path);
    if (!movedFile || !proposal.parentChange.afterParentPath) {
      await app.fileManager.processFrontMatter(book, (frontmatter) => {
        replaceProperties(frontmatter, ORDER_ALIASES, orderBefore!);
      });
      throw new Error("Could not resolve the moved manuscript entry.");
    }

    try {
      let parentBefore: PropertySnapshot | null = null;
      let parentAfter: PropertySnapshot | null = null;

      await app.fileManager.processFrontMatter(movedFile, (frontmatter) => {
        parentBefore = captureProperties(frontmatter, MANUSCRIPT_PARENT_ALIASES);
        setParentReference(frontmatter, proposal.parentChange!.afterParentPath!);
        parentAfter = captureProperties(frontmatter, MANUSCRIPT_PARENT_ALIASES);
      });

      if (!parentBefore || !parentAfter) {
        throw new Error("Could not capture the manuscript parent transaction.");
      }

      parentState = {
        file: movedFile,
        before: parentBefore,
        after: parentAfter
      };
    } catch (error) {
      await app.fileManager.processFrontMatter(book, (frontmatter) => {
        const current = captureProperties(frontmatter, ORDER_ALIASES);
        if (snapshotsEqual(current, orderAfter!)) {
          replaceProperties(frontmatter, ORDER_ALIASES, orderBefore!);
        }
      });
      throw error;
    }
  }

  return {
    book,
    orderBefore,
    orderAfter,
    parent: parentState,
    message: proposal.message
  };
}

export async function undoManuscriptReorder(
  app: App,
  token: ManuscriptReorderUndoToken
): Promise<void> {
  let parentRestored = false;

  if (token.parent) {
    await app.fileManager.processFrontMatter(token.parent.file, (frontmatter) => {
      assertSnapshot(frontmatter, MANUSCRIPT_PARENT_ALIASES, token.parent!.after);
      replaceProperties(frontmatter, MANUSCRIPT_PARENT_ALIASES, token.parent!.before);
      parentRestored = true;
    });
  }

  try {
    await app.fileManager.processFrontMatter(token.book, (frontmatter) => {
      assertSnapshot(frontmatter, ORDER_ALIASES, token.orderAfter);
      replaceProperties(frontmatter, ORDER_ALIASES, token.orderBefore);
    });
  } catch (error) {
    if (parentRestored && token.parent) {
      await app.fileManager.processFrontMatter(token.parent.file, (frontmatter) => {
        const current = captureProperties(frontmatter, MANUSCRIPT_PARENT_ALIASES);
        if (snapshotsEqual(current, token.parent!.before)) {
          replaceProperties(frontmatter, MANUSCRIPT_PARENT_ALIASES, token.parent!.after);
        }
      });
    }
    throw error;
  }
}
