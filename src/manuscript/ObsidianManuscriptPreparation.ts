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
import {
  beginExactManuscriptContentRestoration,
  cancelExactManuscriptContentRestoration,
  completeExactManuscriptContentRestoration
} from "./ManuscriptSequenceProperty";
import { manuscriptPreparationContentMatchesUndoState } from "./ManuscriptPreparationUndoComparison";
import { buildSelectedManuscript, manuscriptPreparationCandidates } from "./ManuscriptPreparationSelection";
import { DETACHED_SCENE_TYPE, isExplicitlyDetachedScene } from "./ManuscriptMetadata";

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
    super("The manuscript changed before preparation; review again.");
    this.name = "StaleManuscriptPreparationError";
  }
}

export class StaleManuscriptPreparationUndoError extends Error {
  constructor(readonly paths: readonly string[] = []) {
    super(paths.length
      ? `Undo is not safe: notes changed, moved or disappeared: ${paths.join(", ")}.`
      : "Notes changed after preparation; Undo is no longer safe.");
    this.name = "StaleManuscriptPreparationUndoError";
  }
}

export class ManuscriptPreparationSyncConflictError extends Error {
  constructor(path: string) {
    super(`Resolve conflict markers before preparation: ${path}`);
    this.name = "ManuscriptPreparationSyncConflictError";
  }
}

export class ManuscriptPreparationRollbackError extends Error {
  constructor(readonly originalError: unknown, readonly failedPaths: readonly string[]) {
    super(`Rollback could not be verified: ${failedPaths.join(", ")}. Restore from backup before continuing.`);
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

function frontmatterMatch(content: string): RegExpMatchArray | null {
  if (!/^---[ \t]*\r?\n/.test(content)) return null;
  return content.match(/^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m);
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

  const plan = planManuscriptPreparation({
    book: book.record,
    result: book.result,
    frontmatterByPath,
    fileVersionByPath
  });
  const diagnostics = [...plan.diagnostics, ...(book.preparationDiagnostics ?? [])];
  const files = [...plan.files];
  if (book.preparationSelection) {
    for (const candidate of manuscriptPreparationCandidates(app, book.preparationSelection)) {
      if (candidate.included || candidate.locked) continue;
      const fm = captureFrontmatter(frontmatterFor(app, candidate.file) ?? {}).values;
      if (isExplicitlyDetachedScene(fm)) continue;
      files.push({ path: candidate.file.path, title: candidate.file.basename, kind: "excluded", beforeFrontmatter: fm,
        expectedFileVersion: { mtime: candidate.file.stat.mtime, size: candidate.file.stat.size },
        changes: [{ property: "type", before: fm.type, after: DETACHED_SCENE_TYPE }],
        mutation: { set: { type: DETACHED_SCENE_TYPE }, remove: [] } });
    }
  }
  return {
    ...plan, files, selection: book.preparationSelection,
    inputSnapshots: book.preparationFiles?.map(file => ({ path: file.path, mtime: file.stat.mtime, size: file.stat.size, frontmatter: captureFrontmatter(frontmatterFor(app, file) ?? {}).values })),
    diagnostics, canApply: files.length > 0 && diagnostics.length === 0,
    alreadyPrepared: files.length === 0 && diagnostics.length === 0,
    state: book.preparationDiagnostics?.length ? "ambiguous_hierarchy" : plan.state
  };
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
  for (const path of new Set([book.file.path, ...book.result.entries.map((entry) => entry.path), ...(plan.inputSnapshots?.map(input => input.path) ?? [])])) {
    const file = book.filesByPath.get(path) ?? (path === book.file.path ? book.file : app.vault.getAbstractFileByPath(path));
    if (!(file instanceof TFile)) {
      diagnostics.push({ path, message: "Note moved or missing; reopen preparation." });
      continue;
    }
    const content = await app.vault.read(file);
    const cached = app.metadataCache.getFileCache(file);
    if (!cached) {
      diagnostics.push({ path, message: "Note not indexed; wait for indexing and reopen preparation." });
    }
    if (hasConflictMarkers(content)) { conflict = true; diagnostics.push({ path, message: "Resolve conflict markers before preparation." }); }
    const match = frontmatterMatch(content);
    if (!match && content.startsWith("---")) {
      malformed = true;
      diagnostics.push({ path, message: "Close frontmatter before preparation." });
    } else if (match) {
      try {
        const parsed = match[1].trim() ? parseYaml(match[1]) : {};
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not a mapping");
        if (!snapshotsEqual(captureFrontmatter(parsed), captureFrontmatter(cached?.frontmatter ?? {}))) {
          diagnostics.push({ path, message: "Frontmatter differs from Obsidian's index; wait and review again." });
        }
      } catch {
        malformed = true;
        diagnostics.push({ path, message: "Repair malformed YAML." });
      }
    }
    if (!match && !content.startsWith("---") && Object.keys(captureFrontmatter(cached?.frontmatter ?? {}).values).length) {
      diagnostics.push({ path, message: "Stale index; wait for indexing and review again." });
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
  const match = frontmatterMatch(content);
  if (!match) return {};
  const parsed = match[1].trim() ? parseYaml(match[1]) : {};
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
    throw new Error(`Metadata verification failed: ${file.path}.`);
  }
}

async function rollbackAppliedStates(
  app: App,
  states: readonly ManuscriptPreparationUndoState[]
): Promise<string[]> {
  const failures: string[] = [];
  beginExactManuscriptContentRestoration(app, new Map(
    states.map((state) => [state.file.path, state.beforeContent])
  ));
  for (const state of [...states].reverse()) {
    try {
      const current = await app.vault.read(state.file);
      if (current !== state.afterContent) throw new Error("Note changed during rollback.");
      await app.vault.modify(state.file, state.beforeContent);
      if (await app.vault.read(state.file) !== state.beforeContent) throw new Error("Rollback verification failed.");
    } catch {
      failures.push(state.file.path);
    }
  }
  const failed = new Set(failures);
  completeExactManuscriptContentRestoration(
    app,
    states.filter((state) => !failed.has(state.file.path)).map((state) => state.file.path)
  );
  cancelExactManuscriptContentRestoration(app, failures);
  return failures;
}

const DERIVED_REPORTING_PROPERTIES = new Set([
  "manuscript_sequence",
  "book_scene_number",
  "series_scene_number"
]);

function withoutDerivedReporting(snapshot: FrontmatterSnapshot): FrontmatterSnapshot {
  return {
    values: Object.fromEntries(Object.entries(snapshot.values).filter(
      ([property]) => !DERIVED_REPORTING_PROPERTIES.has(property)
    ))
  };
}

function markdownBody(content: string): string | null {
  const match = frontmatterMatch(content);
  return match ? content.slice(match[0].length) : null;
}

function contentMatchesPreparationUndoState(
  content: string,
  state: ManuscriptPreparationUndoState
): boolean {
  if (manuscriptPreparationContentMatchesUndoState(content, state.afterContent)) return true;
  const currentBody = markdownBody(content);
  const preparedBody = markdownBody(state.afterContent);
  if (currentBody === null || preparedBody === null || currentBody !== preparedBody) return false;
  return snapshotsEqual(
    withoutDerivedReporting({ values: frontmatterFromMarkdown(content) }),
    withoutDerivedReporting({ values: frontmatterFromMarkdown(state.afterContent) })
  );
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
      ?? "No changes to apply."
    );
  }

  const currentBook = plan.selection ? buildSelectedManuscript(app, plan.selection) : buildObsidianManuscriptLibrary(app).books.find((candidate) => (
    candidate.file.path === book.file.path
  ));
  if (!currentBook) throw new StaleManuscriptPreparationError();

  const currentPlan = await validateManuscriptPreparationPreview(app, currentBook, planObsidianManuscriptPreparation(app, currentBook));
  if (!sameManuscriptPreparationPlan(currentPlan, plan)) {
    throw new StaleManuscriptPreparationError();
  }

  const states: ManuscriptPreparationUndoState[] = [];
  const writePlan = async (filePlan: ManuscriptPreparationPlan["files"][number], mutation: ManuscriptPreparationMutation) => {
    const file = currentBook.filesByPath.get(filePlan.path)
      ?? (filePlan.path === currentBook.file.path ? currentBook.file : filePlan.kind === "excluded" ? app.vault.getAbstractFileByPath(filePlan.path) : null);
    if (!(file instanceof TFile)) throw new StaleManuscriptPreparationError();
    await assertNoConflictMarkers(app, file);
    const beforeContent = await app.vault.read(file);
    const existingState = states.find((state) => state.file.path === file.path);
    const version = existingState
      ? { mtime: file.stat.mtime, size: file.stat.size }
      : filePlan.expectedFileVersion ?? { mtime: file.stat.mtime, size: file.stat.size };
    if (file.stat.mtime !== version.mtime || file.stat.size !== version.size) throw new StaleManuscriptPreparationError();
    const expectedBefore: FrontmatterSnapshot = existingState?.after ?? captureFrontmatter(filePlan.beforeFrontmatter);
    let before: FrontmatterSnapshot | null = null;
    let after: FrontmatterSnapshot | null = null;
    await app.fileManager.processFrontMatter(file, (frontmatter) => {
      if (file.stat.mtime !== version.mtime || file.stat.size !== version.size) throw new StaleManuscriptPreparationError();
      const current = captureFrontmatter(frontmatter);
      if (!snapshotsEqual(current, expectedBefore)) throw new StaleManuscriptPreparationError();
      before = current; applyMutation(frontmatter, mutation); after = captureFrontmatter(frontmatter);
    });
    if (!before || !after) throw new Error(`Could not capture changes: ${filePlan.title}.`);
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
    message: `Prepared ${plan.bookTitle}: ${states.length} ${states.length === 1 ? "note" : "notes"} updated.`
  };
}

export async function undoManuscriptPreparation(
  app: App,
  token: ManuscriptPreparationUndoToken
): Promise<void> {
  const restored: ManuscriptPreparationUndoState[] = [];
  const paths = token.states.map((state) => state.file.path);
  const preparedContentByPath = new Map<string, string>();
  const filesByPath = new Map<string, TFile>();

  const stalePaths: string[] = [];
  for (const state of token.states) {
    const currentFile = app.vault.getAbstractFileByPath(state.file.path);
    if (!(currentFile instanceof TFile)) { stalePaths.push(state.file.path); continue; }
    filesByPath.set(state.file.path, currentFile);
    const content = await app.vault.read(currentFile);
    preparedContentByPath.set(state.file.path, content);
    if (!contentMatchesPreparationUndoState(content, state) || hasConflictMarkers(content)) {
      stalePaths.push(state.file.path);
    }
  }
  if (stalePaths.length) throw new StaleManuscriptPreparationUndoError(stalePaths);

  beginExactManuscriptContentRestoration(app, new Map(
    token.states.map((state) => [state.file.path, state.beforeContent])
  ));
  try {
    for (const state of [...token.states].reverse()) {
      const file = filesByPath.get(state.file.path) ?? state.file;
      await assertNoConflictMarkers(app, file);
      const preparedContent = preparedContentByPath.get(state.file.path) ?? state.afterContent;
      if (await app.vault.read(file) !== preparedContent) throw new StaleManuscriptPreparationUndoError();
      await app.vault.modify(file, state.beforeContent);
      restored.push(state);
      if (await app.vault.read(file) !== state.beforeContent) throw new Error(`Could not verify Undo: ${state.file.path}.`);
    }
    completeExactManuscriptContentRestoration(app, paths);
  } catch (error) {
    for (const state of [...restored].reverse()) {
      try {
        const file = filesByPath.get(state.file.path) ?? state.file;
        if (await app.vault.read(file) !== state.beforeContent) throw new Error("Note changed during Undo rollback.");
        const preparedContent = preparedContentByPath.get(state.file.path) ?? state.afterContent;
        await app.vault.modify(file, preparedContent);
        if (await app.vault.read(file) !== preparedContent) throw new Error("Undo rollback verification failed.");
      } catch {
        // Do not overwrite a later edit while rolling back an unsafe Undo.
      }
    }
    cancelExactManuscriptContentRestoration(app, paths);
    throw error;
  }
}
