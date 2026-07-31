import { App, parseYaml, TFile } from "obsidian";
import {
  buildObsidianManuscriptLibrary,
  ObsidianManuscriptBook
} from "./ObsidianManuscript";
import {
  ManuscriptPreparationMutation,
  ManuscriptPreparationPlan,
  manuscriptPreparationExecutionSteps,
  planManuscriptPreparation,
  sameManuscriptPreparationPlan
} from "./ManuscriptPreparation";

interface FrontmatterSnapshot {
  readonly values: Readonly<Record<string, unknown>>;
}

interface ManuscriptPreparationUndoState {
  readonly file: TFile;
  readonly before: FrontmatterSnapshot;
  after: FrontmatterSnapshot;
  readonly beforeContent: string;
  afterContent: string;
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
  constructor(readonly paths: readonly string[] = []) {
    super(paths.length
      ? `Undo is not safe because these prepared notes changed, moved or disappeared: ${paths.join(", ")}.`
      : "The manuscript metadata changed after preparation, so Undo is no longer safe.");
    this.name = "StaleManuscriptPreparationUndoError";
  }
}

export class ManuscriptPreparationSyncConflictError extends Error {
  constructor(path: string) {
    super(`Resolve sync or Git conflict markers before preparing the manuscript: ${path}`);
    this.name = "ManuscriptPreparationSyncConflictError";
  }
}

export class ManuscriptPreparationRollbackError extends Error {
  constructor(readonly originalError: unknown, readonly failedPaths: readonly string[]) {
    super(`Preparation failed and exact rollback could not be verified for: ${failedPaths.join(", ")}. Restore these notes from version control or backup before continuing.`);
    this.name = "ManuscriptPreparationRollbackError";
  }
}

/** Integration boundary for compiler-side acceptance without duplicating compiler rules. */
export interface ManuscriptPreparationAcceptance {
  validate(bookPath: string): Promise<void>;
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
  const fileVersionByPath = new Map<string, { mtime: number; size: number }>();
  const paths = new Set([
    book.file.path,
    ...book.result.entries.map((entry) => entry.path)
  ]);

  for (const path of paths) {
    const file = book.filesByPath.get(path)
      ?? (path === book.file.path ? book.file : null);
    if (file) {
      frontmatterByPath.set(path, frontmatterFor(app, file));
      fileVersionByPath.set(path, { mtime: file.stat.mtime, size: file.stat.size });
    }
  }

  return planManuscriptPreparation({
    book: book.record,
    result: book.result,
    frontmatterByPath,
    fileVersionByPath
  });
}

/** Adds content-level blockers that are not represented by the metadata cache. */
export async function validateManuscriptPreparationPreview(
  app: App,
  book: ObsidianManuscriptBook,
  plan: ManuscriptPreparationPlan
): Promise<ManuscriptPreparationPlan> {
  const diagnostics = [...plan.diagnostics];
  let malformed = false;
  let conflict = false;
  for (const path of new Set([book.file.path, ...book.result.entries.map((entry) => entry.path)])) {
    const file = book.filesByPath.get(path) ?? (path === book.file.path ? book.file : null);
    if (!file) {
      diagnostics.push({ path, message: "This recognised manuscript note is no longer available at its previewed path." });
      continue;
    }
    const content = await app.vault.read(file);
    if (hasConflictMarkers(content)) { conflict = true; diagnostics.push({ path, message: "Resolve sync or Git conflict markers before preparation." }); }
    const match = content.match(/^---\s*\r?\n([\s\S]*?)(?:\r?\n---(?:\s*\r?\n|$))/);
    if (!match && content.startsWith("---")) {
      malformed = true;
      diagnostics.push({ path, message: "Frontmatter is not closed correctly; repair it before preparation." });
    } else if (match) {
      try {
        const parsed = parseYaml(match[1]);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not a mapping");
      } catch {
        malformed = true;
        diagnostics.push({ path, message: "Frontmatter is malformed; repair its YAML before preparation." });
      }
    }
  }
  if (diagnostics.length === plan.diagnostics.length) return plan;
  return {
    ...plan, diagnostics, canApply: false, alreadyPrepared: false,
    state: malformed ? "malformed_or_incomplete_legacy_metadata"
      : conflict ? "conflicting_distributed_metadata" : "ambiguous_hierarchy"
  };
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
): Promise<string[]> {
  const failures: string[] = [];
  for (const state of [...states].reverse()) {
    try {
      const current = await app.vault.read(state.file);
      if (current !== state.afterContent) throw new Error("The note changed during rollback.");
      await app.vault.modify(state.file, state.beforeContent);
      if (await app.vault.read(state.file) !== state.beforeContent) throw new Error("Exact rollback verification failed.");
    } catch {
      failures.push(state.file.path);
    }
  }
  return failures;
}

export async function applyManuscriptPreparation(
  app: App,
  book: ObsidianManuscriptBook,
  plan: ManuscriptPreparationPlan,
  acceptance?: ManuscriptPreparationAcceptance
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
  const writePlan = async (filePlan: ManuscriptPreparationPlan["files"][number], mutation: ManuscriptPreparationMutation) => {
    const file = currentBook.filesByPath.get(filePlan.path)
      ?? (filePlan.path === currentBook.file.path ? currentBook.file : null);
    if (!file) throw new StaleManuscriptPreparationError();
    await assertNoConflictMarkers(app, file);
    const beforeContent = await app.vault.read(file);
    const existingState = states.find((state) => state.file.path === file.path);
    const version = existingState
      ? { mtime: file.stat.mtime, size: file.stat.size }
      : filePlan.expectedFileVersion ?? { mtime: file.stat.mtime, size: file.stat.size };
    if (file.stat.mtime !== version.mtime || file.stat.size !== version.size) throw new StaleManuscriptPreparationError();
    const expectedBefore: FrontmatterSnapshot = existingState?.after ?? { values: cloneValue(filePlan.beforeFrontmatter) };
    let before: FrontmatterSnapshot | null = null;
    let after: FrontmatterSnapshot | null = null;
    await app.fileManager.processFrontMatter(file, (frontmatter) => {
      if (file.stat.mtime !== version.mtime || file.stat.size !== version.size) throw new StaleManuscriptPreparationError();
      const current = captureFrontmatter(frontmatter);
      if (!snapshotsEqual(current, expectedBefore)) throw new StaleManuscriptPreparationError();
      before = current; applyMutation(frontmatter, mutation); after = captureFrontmatter(frontmatter);
    });
    if (!before || !after) throw new Error(`Could not capture preparation changes for ${filePlan.title}.`);
    const afterContent = await app.vault.read(file);
    if (existingState) {
      existingState.after = after;
      existingState.afterContent = afterContent;
    } else {
      states.push({ file, before, after, beforeContent, afterContent });
    }
    await verifyWrittenSnapshot(app, file, after);
  };
  try {
    for (const step of manuscriptPreparationExecutionSteps(plan)) await writePlan(step.file, step.mutation);
    await acceptance?.validate(plan.bookPath);
  } catch (error) {
    const failedPaths = await rollbackAppliedStates(app, states);
    if (failedPaths.length) throw new ManuscriptPreparationRollbackError(error, failedPaths);
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

  const stalePaths: string[] = [];
  for (const state of token.states) {
    const currentFile = app.vault.getAbstractFileByPath(state.file.path);
    if (currentFile !== state.file) { stalePaths.push(state.file.path); continue; }
    const content = await app.vault.read(state.file);
    if (content !== state.afterContent || hasConflictMarkers(content)) stalePaths.push(state.file.path);
  }
  if (stalePaths.length) throw new StaleManuscriptPreparationUndoError(stalePaths);

  try {
    for (const state of [...token.states].reverse()) {
      await assertNoConflictMarkers(app, state.file);
      if (await app.vault.read(state.file) !== state.afterContent) throw new StaleManuscriptPreparationUndoError();
      await app.vault.modify(state.file, state.beforeContent);
      restored.push(state);
      if (await app.vault.read(state.file) !== state.beforeContent) throw new Error(`Could not verify exact Undo for ${state.file.path}.`);
    }
  } catch (error) {
    for (const state of [...restored].reverse()) {
      try {
        if (await app.vault.read(state.file) !== state.beforeContent) throw new Error("The note changed during Undo rollback.");
        await app.vault.modify(state.file, state.afterContent);
        if (await app.vault.read(state.file) !== state.afterContent) throw new Error("Undo rollback verification failed.");
      } catch {
        // Do not overwrite a later edit while rolling back an unsafe Undo.
      }
    }
    throw error;
  }
}
