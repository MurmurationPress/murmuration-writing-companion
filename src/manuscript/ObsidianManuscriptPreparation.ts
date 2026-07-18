import { App, parseYaml, TFile } from "obsidian";
import {
  buildObsidianManuscriptLibrary,
  ObsidianManuscriptBook
} from "./ObsidianManuscript";
import {
  ManuscriptPreparationMutation,
  ManuscriptPreparationPlan,
  planManuscriptPreparation,
  sameManuscriptPreparationPlan
} from "./ManuscriptPreparation";

interface FrontmatterSnapshot {
  readonly values: Readonly<Record<string, unknown>>;
}

interface ManuscriptPreparationUndoState {
  readonly file: TFile;
  readonly before: FrontmatterSnapshot;
  readonly after: FrontmatterSnapshot;
}

export interface ManuscriptPreparationUndoToken {
  readonly bookPath: string;
  readonly states: readonly ManuscriptPreparationUndoState[];
  readonly message: string;
}

export class StaleManuscriptPreparationError extends Error {
  constructor() {
    super("The manuscript metadata changed before preparation could be written. Review the preview again.");
    this.name = "StaleManuscriptPreparationError";
  }
}

export class StaleManuscriptPreparationUndoError extends Error {
  constructor() {
    super("The manuscript metadata changed after preparation, so Undo is no longer safe.");
    this.name = "StaleManuscriptPreparationUndoError";
  }
}

export class ManuscriptPreparationSyncConflictError extends Error {
  constructor(path: string) {
    super(`Resolve sync or Git conflict markers before preparing the manuscript: ${path}`);
    this.name = "ManuscriptPreparationSyncConflictError";
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
    Object.entries(snapshot.values).sort(([left], [right]) => (
      left.localeCompare(right)
    ))
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
  mutation: ManuscriptPreparationMutation
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

export function planObsidianManuscriptPreparation(
  app: App,
  book: ObsidianManuscriptBook
): ManuscriptPreparationPlan {
  const frontmatterByPath = new Map<
    string,
    Record<string, unknown> | undefined
  >();
  const paths = new Set([
    book.file.path,
    ...book.result.entries.map((entry) => entry.path)
  ]);

  for (const path of paths) {
    const file = book.filesByPath.get(path)
      ?? (path === book.file.path ? book.file : null);
    if (file) frontmatterByPath.set(path, frontmatterFor(app, file));
  }

  return planManuscriptPreparation({
    book: book.record,
    result: book.result,
    frontmatterByPath
  });
}

function plannedWriteOrder(
  plan: ManuscriptPreparationPlan
): ManuscriptPreparationPlan["files"] {
  return [
    ...plan.files.filter((file) => file.path !== plan.bookPath),
    ...plan.files.filter((file) => file.path === plan.bookPath)
  ];
}

function hasConflictMarkers(content: string): boolean {
  return /^(?:<{7}|={7}|>{7})(?:\s|$)/m.test(content);
}

async function assertNoConflictMarkers(app: App, file: TFile): Promise<void> {
  const content = await app.vault.read(file);
  if (hasConflictMarkers(content)) {
    throw new ManuscriptPreparationSyncConflictError(file.path);
  }
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
    throw new ManuscriptPreparationSyncConflictError(file.path);
  }
  const actual = captureFrontmatter(frontmatterFromMarkdown(content));
  if (!snapshotsEqual(actual, expected)) {
    throw new Error(`Could not verify manuscript metadata after writing ${file.path}.`);
  }
}

async function rollbackAppliedStates(
  app: App,
  states: readonly ManuscriptPreparationUndoState[]
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

export async function applyManuscriptPreparation(
  app: App,
  book: ObsidianManuscriptBook,
  plan: ManuscriptPreparationPlan
): Promise<ManuscriptPreparationUndoToken> {
  if (!plan.canApply) {
    throw new Error(
      plan.diagnostics[0]?.message
      ?? "This manuscript has no preparation changes to apply."
    );
  }

  const currentBook = buildObsidianManuscriptLibrary(app).books.find((candidate) => (
    candidate.file.path === book.file.path
  ));
  if (!currentBook) throw new StaleManuscriptPreparationError();

  const currentPlan = planObsidianManuscriptPreparation(app, currentBook);
  if (!sameManuscriptPreparationPlan(currentPlan, plan)) {
    throw new StaleManuscriptPreparationError();
  }

  const states: ManuscriptPreparationUndoState[] = [];
  try {
    for (const filePlan of plannedWriteOrder(plan)) {
      const file = currentBook.filesByPath.get(filePlan.path)
        ?? (filePlan.path === currentBook.file.path ? currentBook.file : null);
      if (!file) throw new StaleManuscriptPreparationError();

      await assertNoConflictMarkers(app, file);
      const version = { mtime: file.stat.mtime, size: file.stat.size };
      const expectedBefore: FrontmatterSnapshot = {
        values: cloneValue(filePlan.beforeFrontmatter)
      };
      let before: FrontmatterSnapshot | null = null;
      let after: FrontmatterSnapshot | null = null;

      await app.fileManager.processFrontMatter(file, (frontmatter) => {
        if (file.stat.mtime !== version.mtime || file.stat.size !== version.size) {
          throw new StaleManuscriptPreparationError();
        }
        const current = captureFrontmatter(frontmatter);
        if (!snapshotsEqual(current, expectedBefore)) {
          throw new StaleManuscriptPreparationError();
        }
        before = current;
        applyMutation(frontmatter, filePlan.mutation);
        after = captureFrontmatter(frontmatter);
      });

      if (!before || !after) {
        throw new Error(`Could not capture preparation changes for ${filePlan.title}.`);
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
    message: `Prepared ${plan.bookTitle}: ${states.length} ${states.length === 1 ? "note" : "notes"} updated with distributed order keys.`
  };
}

export async function undoManuscriptPreparation(
  app: App,
  token: ManuscriptPreparationUndoToken
): Promise<void> {
  const restored: ManuscriptPreparationUndoState[] = [];

  try {
    for (const state of [...token.states].reverse()) {
      await assertNoConflictMarkers(app, state.file);
      await app.fileManager.processFrontMatter(state.file, (frontmatter) => {
        const current = captureFrontmatter(frontmatter);
        if (!snapshotsEqual(current, state.after)) {
          throw new StaleManuscriptPreparationUndoError();
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
        // Do not overwrite a later edit while rolling back an unsafe Undo.
      }
    }
    throw error;
  }
}
