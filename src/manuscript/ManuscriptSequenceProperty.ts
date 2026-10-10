import { App, parseYaml, TFile } from "obsidian";
import { isObsidianTrashPath } from "../ObsidianTrash";
import type { ObsidianManuscriptBook } from "./ObsidianManuscript";
import type { ManuscriptOrderNode } from "./ManuscriptOrder";
import { deriveManuscriptSequenceProjection } from "./ManuscriptSequenceProjection";
import {
  beginExactContentRestoration, cancelExactContentRestoration,
  completeExactContentRestoration, exactContentIsProtected, hasExactContentProtection
} from "./ExactContentProtection";

/** Prevents derived reporting writes from racing an exact raw-content restoration. */
export function beginExactManuscriptContentRestoration(
  app: App,
  contentsByPath: ReadonlyMap<string, string>
): void {
  beginExactContentRestoration(app, contentsByPath);
}

/** Keeps successfully restored bytes protected until a later author edit changes them. */
export function completeExactManuscriptContentRestoration(
  app: App,
  paths: readonly string[]
): void {
  completeExactContentRestoration(app, paths);
}

export function cancelExactManuscriptContentRestoration(
  app: App,
  paths: readonly string[]
): void {
  cancelExactContentRestoration(app, paths);
}

export async function exactManuscriptContentIsProtected(
  app: App,
  path: string,
  read: () => Promise<string>
): Promise<boolean> {
  return exactContentIsProtected(app, path, read);
}

// Disposable identities belong only to reporting snapshots, never manuscript authority.
// They survive neutral renames, including when automatic link updates are disabled.
export const NUMBERING_TOKEN = "mwc_scene_numbering_token";
export const NUMBERING_SNAPSHOT = "mwc_scene_numbering_snapshot";
const REPORTING = ["manuscript_sequence", "book_scene_number", "series_scene_number"];
type Properties = Record<string, unknown>;

export class ManuscriptSequenceCancelledError extends Error {
  constructor() { super("Scene renumbering was cancelled. Numbers may still be out of date."); }
}

export interface RenumberBookOptions {
  /** Returns the already-settled index, without rebuilding the library. */
  readonly currentBook: () => ObsidianManuscriptBook | undefined;
  readonly whenSettled: (signal?: AbortSignal) => Promise<void>;
  readonly progress?: (completed: number, total: number) => void;
  readonly signal?: AbortSignal;
}

function nodes(book: ObsidianManuscriptBook): ManuscriptOrderNode[] {
  const all: ManuscriptOrderNode[] = [];
  const visit = (node: ManuscriptOrderNode) => { all.push(node); node.children.forEach(visit); };
  book.result.roots.forEach(visit);
  return all;
}

function assertProjectable(book: ObsidianManuscriptBook): void {
  if (book.result.source !== "distributed" || book.result.diagnostics.some(d => d.kind !== "obsolete_order_array")) {
    throw new Error("Prepare or repair this Book's unresolved manuscript structure before renumbering.");
  }
  const all = nodes(book);
  const projection = deriveManuscriptSequenceProjection({ bookPath: book.file.path, roots: book.result.roots });
  if (isObsidianTrashPath(book.file.path) || all.some(n => isObsidianTrashPath(n.entry.path))
    || all.some(n => n.entry.kind === "scene" && n.children.length > 0)
    || projection.omitted.length || all.length + 1 !== book.filesByPath.size
    || new Set(all.map(n => n.entry.path)).size !== all.length) {
    throw new Error("This Book has excluded or unresolved structure. Scene numbers were not refreshed.");
  }
}

/** Includes identity/order/parentage for concurrency checks, but no prose or reporting. */
function structure(book: ObsidianManuscriptBook): string {
  assertProjectable(book);
  return JSON.stringify([book.file.path, nodes(book).map(n => [n.entry.path, n.entry.kind,
    n.entry.parentPath, n.entry.orderKey, n.children.map(c => c.entry.path)])]);
}

function snapshot(book: ObsidianManuscriptBook, properties: ReadonlyMap<string, Properties>): string | null {
  const seen = new Set<string>();
  let valid = true;
  const visit = (node: ManuscriptOrderNode): unknown => {
    const token = properties.get(node.entry.path)?.[NUMBERING_TOKEN];
    if (typeof token !== "string" || !token || seen.has(token)) valid = false;
    else seen.add(token);
    return [node.entry.kind, token, node.children.map(visit)];
  };
  const value = JSON.stringify([1, book.result.roots.map(visit)]);
  return valid ? value : null;
}

function desiredValues(book: ObsidianManuscriptBook): Map<string, Properties> {
  const projection = deriveManuscriptSequenceProjection({ bookPath: book.file.path, roots: book.result.roots });
  return new Map([...book.filesByPath.keys()].map(path => {
    const desired = projection.valuesByPath.get(path);
    return [path, desired ? { manuscript_sequence: desired.manuscriptSequence, book_scene_number: desired.bookSceneNumber } : {}];
  }));
}

function reportingMatches(properties: Properties, desired: Properties): boolean {
  return REPORTING.every(key => properties[key] === desired[key]);
}

function snapshotMatches(book: ObsidianManuscriptBook, properties: ReadonlyMap<string, Properties>): boolean {
  const expected = snapshot(book, properties);
  return expected !== null && properties.get(book.file.path)?.[NUMBERING_SNAPSHOT] === expected
    && [...desiredValues(book)].every(([path, desired]) => reportingMatches(properties.get(path) ?? {}, desired));
}

function frontmatter(content: string): Properties {
  const match = content.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) throw new Error("Missing or malformed frontmatter. Prepare this manuscript before renumbering.");
  const parsed: unknown = parseYaml(match[1]);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid manuscript frontmatter.");
  return parsed as Properties;
}

function authority(properties: Properties): string {
  // Compare all non-reporting metadata at the mutation boundary. This also
  // covers supported aliases without maintaining a second hierarchy parser.
  return JSON.stringify(Object.keys(properties).filter(k => !REPORTING.includes(k)
    && k !== NUMBERING_TOKEN && k !== NUMBERING_SNAPSHOT && k !== "position")
    .sort().map(k => [k, properties[k]]));
}

/** The sole reporting writer. Only an explicit selected-Book command calls renumber. */
export class ManuscriptSequencePropertyService {
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private readonly incomplete = new Set<TFile>();
  constructor(private readonly app: App) {}
  dispose(): void { this.disposed = true; }

  /** Read-only and book-local; called at settled index boundaries/context changes. */
  isCurrent(book: ObsidianManuscriptBook): boolean {
    if (this.incomplete.has(book.file)) return false;
    try {
      assertProjectable(book);
      const properties = new Map([...book.filesByPath].map(([path, file]) => [path,
        this.app.metadataCache.getFileCache(file)?.frontmatter as Properties ?? {}]));
      return snapshotMatches(book, properties);
    } catch { return false; }
  }

  renumber(bookPath: string, options: RenumberBookOptions): Promise<number> {
    const requested = this.queue.catch(() => undefined).then(() => this.renumberNow(bookPath, options));
    this.queue = requested;
    return requested;
  }

  private async renumberNow(bookPath: string, options: RenumberBookOptions): Promise<number> {
    const active = () => {
      if (this.disposed || options.signal?.aborted) throw new ManuscriptSequenceCancelledError();
    };
    active();
    await options.whenSettled(options.signal);
    active();
    const book = options.currentBook();
    if (!book || book.file.path !== bookPath) throw new Error("The selected Book is no longer available.");
    this.incomplete.add(book.file);
    const initialStructure = structure(book);
    let checkedBook = book;
    const guard = () => {
      active();
      const current = options.currentBook();
      if (!current || (current !== checkedBook && structure(current) !== initialStructure)) throw new Error("The Book changed while renumbering. Run Renumber book scenes again.");
      checkedBook = current;
    };
    const properties = new Map<string, Properties>();
    const baseline = new Map<string, string>();
    // Read only this Book, and use actual bytes rather than a possibly lagging cache.
    for (const [path, file] of book.filesByPath) {
      guard();
      if (file.path !== path || this.app.vault.getAbstractFileByPath(path) !== file) throw new Error("A manuscript file moved or disappeared.");
      const content = await this.app.vault.read(file);
      if (await exactManuscriptContentIsProtected(this.app, path, async () => content)) {
        throw new Error(`Cannot renumber protected file: ${path}. Exact preparation Undo content is preserved.`);
      }
      const fm = frontmatter(content);
      // A changed authority not yet incorporated by the index must never be numbered.
      const cached = this.app.metadataCache.getFileCache(file)?.frontmatter as Properties | undefined;
      if (!cached || authority(fm) !== authority(cached)) throw new Error("Manuscript metadata is still settling. Try renumbering again.");
      properties.set(path, fm); baseline.set(path, authority(fm));
    }
    const desired = desiredValues(book);
    const used = new Set<string>();
    for (const node of nodes(book)) {
      const path = node.entry.path;
      let token = properties.get(path)![NUMBERING_TOKEN];
      if (typeof token !== "string" || !token || used.has(token)) token = crypto.randomUUID();
      used.add(token as string);
      desired.get(path)![NUMBERING_TOKEN] = token;
      properties.set(path, { ...properties.get(path), [NUMBERING_TOKEN]: token });
    }
    desired.get(bookPath)![NUMBERING_SNAPSHOT] = snapshot(book, properties)!;
    let writes = 0, completed = 0;
    const files = [...book.filesByPath].filter(([path]) => path !== bookPath);
    // The Book's completion snapshot is always committed last.
    files.push([bookPath, book.file]);
    for (const [path, file] of files) {
      guard();
      if (file.path !== path || this.app.vault.getAbstractFileByPath(path) !== file) throw new Error("A manuscript file moved or disappeared.");
      const raw = frontmatter(await this.app.vault.read(file));
      const target = desired.get(path)!;
      const keys = [...REPORTING, ...(path === bookPath ? [NUMBERING_SNAPSHOT] : [NUMBERING_TOKEN])];
      if (authority(raw) !== baseline.get(path)) throw new Error(`Manuscript properties changed: ${path}. Run renumbering again.`);
      if (keys.some(key => raw[key] !== target[key])) {
        guard();
        if (hasExactContentProtection(this.app, path)) throw new Error(`Cannot renumber protected file: ${path}.`);
        await this.app.fileManager.processFrontMatter(file, fm => {
          guard();
          if (file.path !== path || this.app.vault.getAbstractFileByPath(path) !== file || hasExactContentProtection(this.app, path)) throw new Error(`Cannot renumber moved or protected file: ${path}.`);
          if (authority(fm) !== baseline.get(path)) throw new Error(`Manuscript properties changed: ${path}.`);
          for (const key of keys) {
            if (target[key] === undefined) delete fm[key];
            else fm[key] = target[key];
          }
        });
        writes++;
      }
      options.progress?.(++completed, files.length);
    }
    await options.whenSettled(options.signal); guard();
    const verified = new Map<string, Properties>();
    const revisions = new Map<TFile, string>();
    for (const [path, file] of book.filesByPath) {
      guard();
      if (file.path !== path || this.app.vault.getAbstractFileByPath(path) !== file || hasExactContentProtection(this.app, path)) {
        throw new Error("A manuscript file moved, disappeared or became protected during verification.");
      }
      revisions.set(file, `${file.stat.mtime}:${file.stat.size}`);
      const fm = frontmatter(await this.app.vault.read(file));
      if (authority(fm) !== baseline.get(path)) throw new Error("The manuscript changed during verification. Run renumbering again.");
      verified.set(path, fm);
    }
    await options.whenSettled(options.signal); guard();
    if ([...revisions].some(([file, revision]) => revision !== `${file.stat.mtime}:${file.stat.size}`)) {
      throw new Error("A manuscript file changed during verification. Run renumbering again.");
    }
    if (!snapshotMatches(book, verified)) throw new Error("Scene numbers could not be verified. Run renumbering again.");
    active();
    this.incomplete.delete(book.file);
    return writes;
  }
}
