import { App, TFile } from "obsidian";
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

export function planObsidianManuscriptPreparation(
  book: ObsidianManuscriptBook
): ManuscriptPreparationPlan {
  return planManuscriptPreparation({
    book: book.record,
    result: book.result,
    frontmatterByPath: book.frontmatterByPath,
    explicitKindByPath: book.explicitKindByPath,
    explicitParentPathByPath: book.explicitParentPathByPath,
    explicitBookPathByPath: book.explicitBookPathByPath,
    parentReferencesByPath: book.parentReferencesByPath,
    bookReferencesByPath: book.bookReferencesByPath
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
    } catch {
      // The original failure remains primary. Any unsafe rollback is left visible
      // through the files' current frontmatter rather than overwritten blindly.
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

  const currentPlan = planObsidianManuscriptPreparation(currentBook);
  if (!sameManuscriptPreparationPlan(currentPlan, plan)) {
    throw new StaleManuscriptPreparationError();
  }

  const states: ManuscriptPreparationUndoState[] = [];

  try {
    for (const filePlan of plannedWriteOrder(plan)) {
      const file = currentBook.filesByPath.get(filePlan.path)
        ?? (filePlan.path === currentBook.file.path ? currentBook.file : null);
      if (!file) throw new StaleManuscriptPreparationError();

      const expectedBefore: FrontmatterSnapshot = {
        values: cloneValue(filePlan.beforeFrontmatter)
      };
      let before: FrontmatterSnapshot | null = null;
      let after: FrontmatterSnapshot | null = null;

      await app.fileManager.processFrontMatter(file, (frontmatter) => {
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
      states.push({ file, before, after });
    }
  } catch (error) {
    await rollbackAppliedStates(app, states);
    throw error;
  }

  return {
    bookPath: plan.bookPath,
    states,
    message: `Prepared ${plan.bookTitle}: ${states.length} ${states.length === 1 ? "note" : "notes"} updated.`
  };
}

export async function undoManuscriptPreparation(
  app: App,
  token: ManuscriptPreparationUndoToken
): Promise<void> {
  const restored: ManuscriptPreparationUndoState[] = [];

  try {
    for (const state of [...token.states].reverse()) {
      await app.fileManager.processFrontMatter(state.file, (frontmatter) => {
        const current = captureFrontmatter(frontmatter);
        if (!snapshotsEqual(current, state.after)) {
          throw new StaleManuscriptPreparationUndoError();
        }
        replaceFrontmatter(frontmatter, state.before);
      });
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
      } catch {
        // Do not overwrite a later edit while attempting to roll back Undo.
      }
    }
    throw error;
  }
}
