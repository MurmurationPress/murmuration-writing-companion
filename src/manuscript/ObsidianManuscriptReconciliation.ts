import { App, parseYaml, TFile } from "obsidian";
import {
  buildObsidianManuscriptLibrary,
  ObsidianManuscriptBook
} from "./ObsidianManuscript";
import {
  ManuscriptReconciliationChoices,
  ManuscriptReconciliationMutation,
  ManuscriptReconciliationPlan,
  planManuscriptReconciliation,
  sameManuscriptReconciliationPlan
} from "./ManuscriptReconciliation";

interface FrontmatterSnapshot {
  readonly values: Readonly<Record<string, unknown>>;
}

interface ManuscriptReconciliationUndoState {
  readonly file: TFile;
  readonly before: FrontmatterSnapshot;
  readonly after: FrontmatterSnapshot;
}

export interface ManuscriptReconciliationUndoToken {
  readonly bookPath: string;
  readonly states: readonly ManuscriptReconciliationUndoState[];
  readonly message: string;
}

export class StaleManuscriptReconciliationError extends Error {
  constructor() {
    super("The manuscript structure changed before reconciliation could be written. Review the reconciliation again.");
    this.name = "StaleManuscriptReconciliationError";
  }
}

export class StaleManuscriptReconciliationUndoError extends Error {
  constructor() {
    super("The manuscript metadata changed after reconciliation, so Undo is no longer safe.");
    this.name = "StaleManuscriptReconciliationUndoError";
  }
}

export class ManuscriptReconciliationSyncConflictError extends Error {
  constructor(path: string) {
    super(`Resolve sync or Git conflict markers before reconciling the manuscript: ${path}`);
    this.name = "ManuscriptReconciliationSyncConflictError";
  }
}

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function captureFrontmatter(
  frontmatter: Readonly<Record<string, unknown>>
): FrontmatterSnapshot {
  const values: Record<string, unknown> = {};
  for (const [property, value] of Object.entries(frontmatter)) {
    if (property === "position") continue;
    values[property] = cloneValue(value);
  }
  return { values };
}

function orderedSnapshot(snapshot: FrontmatterSnapshot): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(snapshot.values).sort(([left], [right]) => left.localeCompare(right))
  );
}

function snapshotsEqual(
  left: FrontmatterSnapshot,
  right: FrontmatterSnapshot
): boolean {
  return JSON.stringify(orderedSnapshot(left)) === JSON.stringify(orderedSnapshot(right));
}

function replaceFrontmatter(
  frontmatter: Record<string, unknown>,
  snapshot: FrontmatterSnapshot
) {
  for (const property of Object.keys(frontmatter)) {
    if (property !== "position") delete frontmatter[property];
  }
  for (const [property, value] of Object.entries(snapshot.values)) {
    frontmatter[property] = cloneValue(value);
  }
}

function applyMutation(
  frontmatter: Record<string, unknown>,
  mutation: ManuscriptReconciliationMutation
) {
  for (const property of mutation.remove) delete frontmatter[property];
  for (const [property, value] of Object.entries(mutation.set)) {
    frontmatter[property] = cloneValue(value);
  }
}

function frontmatterFor(
  app: App,
  file: TFile
): Record<string, unknown> | undefined {
  return app.metadataCache.getFileCache(file)?.frontmatter as
    Record<string, unknown> | undefined;
}

function hasConflictMarkers(content: string): boolean {
  return /^(?:<{7}|={7}|>{7})(?:\s|$)/m.test(content);
}

function frontmatterFromMarkdown(content: string): Record<string, unknown> {
  const match = content.match(
    /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/
  );
  if (!match) return {};
  const parsed = parseYaml(match[1]);
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

async function verifyWrittenSnapshot(
  app: App,
  file: TFile,
  expected: FrontmatterSnapshot
): Promise<void> {
  const content = await app.vault.read(file);
  if (hasConflictMarkers(content)) {
    throw new ManuscriptReconciliationSyncConflictError(file.path);
  }
  const actual = captureFrontmatter(frontmatterFromMarkdown(content));
  if (!snapshotsEqual(actual, expected)) {
    throw new Error(`Could not verify manuscript metadata after writing ${file.path}.`);
  }
}

function fileForPath(
  book: ObsidianManuscriptBook,
  path: string
): TFile | null {
  return book.filesByPath.get(path)
    ?? (path === book.file.path ? book.file : null);
}

async function conflictPathsFor(
  app: App,
  book: ObsidianManuscriptBook
): Promise<ReadonlySet<string>> {
  const conflicts = new Set<string>();
  const paths = new Set([
    book.file.path,
    ...book.result.entries.map((entry) => entry.path)
  ]);
  for (const path of paths) {
    const file = fileForPath(book, path);
    if (!file) continue;
    const content = await app.vault.read(file);
    if (hasConflictMarkers(content)) conflicts.add(path);
  }
  return conflicts;
}

export async function planObsidianManuscriptReconciliation(
  app: App,
  book: ObsidianManuscriptBook,
  choices: ManuscriptReconciliationChoices = {
    placements: {},
    rebalanceParents: []
  }
): Promise<ManuscriptReconciliationPlan> {
  const frontmatterByPath = new Map<
    string,
    Record<string, unknown> | undefined
  >();
  const paths = new Set([
    book.file.path,
    ...book.result.entries.map((entry) => entry.path)
  ]);
  for (const path of paths) {
    const file = fileForPath(book, path);
    if (file) frontmatterByPath.set(path, frontmatterFor(app, file));
  }

  return planManuscriptReconciliation({
    book: book.record,
    result: book.result,
    frontmatterByPath,
    conflictPaths: await conflictPathsFor(app, book)
  }, choices);
}

async function rollbackAppliedStates(
  app: App,
  states: readonly ManuscriptReconciliationUndoState[]
) {
  for (const state of [...states].reverse()) {
    try {
      await app.fileManager.processFrontMatter(state.file, (frontmatter) => {
        const current = captureFrontmatter(frontmatter);
        if (snapshotsEqual(current, state.after)) {
          replaceFrontmatter(frontmatter, state.before);
        }
      });
      await verifyWrittenSnapshot(app, state.file, state.before);
    } catch {
      // Never overwrite a later edit while recovering from a failed transaction.
    }
  }
}

export async function applyManuscriptReconciliation(
  app: App,
  book: ObsidianManuscriptBook,
  plan: ManuscriptReconciliationPlan
): Promise<ManuscriptReconciliationUndoToken> {
  if (!plan.canApply) {
    throw new Error(
      plan.unresolved[0]
      ?? "This manuscript has no reconciliation changes to apply."
    );
  }

  const currentBook = buildObsidianManuscriptLibrary(app).books.find((candidate) => (
    candidate.file.path === book.file.path
  ));
  if (!currentBook) throw new StaleManuscriptReconciliationError();

  const currentPlan = await planObsidianManuscriptReconciliation(
    app,
    currentBook,
    plan.choices
  );
  if (!sameManuscriptReconciliationPlan(currentPlan, plan)) {
    throw new StaleManuscriptReconciliationError();
  }

  const states: ManuscriptReconciliationUndoState[] = [];
  try {
    for (const filePlan of plan.files) {
      const file = fileForPath(currentBook, filePlan.path);
      if (!file) throw new StaleManuscriptReconciliationError();

      const content = await app.vault.read(file);
      if (hasConflictMarkers(content)) {
        throw new ManuscriptReconciliationSyncConflictError(file.path);
      }
      const version = { mtime: file.stat.mtime, size: file.stat.size };
      const expectedBefore: FrontmatterSnapshot = {
        values: cloneValue(filePlan.beforeFrontmatter)
      };
      let before: FrontmatterSnapshot | null = null;
      let after: FrontmatterSnapshot | null = null;

      await app.fileManager.processFrontMatter(file, (frontmatter) => {
        if (file.stat.mtime !== version.mtime || file.stat.size !== version.size) {
          throw new StaleManuscriptReconciliationError();
        }
        const current = captureFrontmatter(frontmatter);
        if (!snapshotsEqual(current, expectedBefore)) {
          throw new StaleManuscriptReconciliationError();
        }
        before = current;
        applyMutation(frontmatter, filePlan.mutation);
        after = captureFrontmatter(frontmatter);
      });

      if (!before || !after) {
        throw new Error(`Could not capture reconciliation changes for ${filePlan.title}.`);
      }
      await verifyWrittenSnapshot(app, file, after);
      states.push({ file, before, after });
    }
  } catch (error) {
    await rollbackAppliedStates(app, states);
    throw error;
  }

  return {
    bookPath: plan.bookPath,
    states,
    message: `Reconciled ${plan.bookTitle}: ${states.length} ${states.length === 1 ? "note" : "notes"} updated.`
  };
}

export async function undoManuscriptReconciliation(
  app: App,
  token: ManuscriptReconciliationUndoToken
): Promise<void> {
  const restored: ManuscriptReconciliationUndoState[] = [];
  try {
    for (const state of [...token.states].reverse()) {
      const content = await app.vault.read(state.file);
      if (hasConflictMarkers(content)) {
        throw new ManuscriptReconciliationSyncConflictError(state.file.path);
      }
      await app.fileManager.processFrontMatter(state.file, (frontmatter) => {
        const current = captureFrontmatter(frontmatter);
        if (!snapshotsEqual(current, state.after)) {
          throw new StaleManuscriptReconciliationUndoError();
        }
        replaceFrontmatter(frontmatter, state.before);
      });
      await verifyWrittenSnapshot(app, state.file, state.before);
      restored.push(state);
    }
  } catch (error) {
    for (const state of [...restored].reverse()) {
      try {
        await app.fileManager.processFrontMatter(state.file, (frontmatter) => {
          const current = captureFrontmatter(frontmatter);
          if (snapshotsEqual(current, state.before)) {
            replaceFrontmatter(frontmatter, state.after);
          }
        });
        await verifyWrittenSnapshot(app, state.file, state.after);
      } catch {
        // Do not overwrite later edits while rolling back an unsafe Undo.
      }
    }
    throw error;
  }
}
