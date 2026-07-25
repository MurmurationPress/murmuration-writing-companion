import type { ManuscriptBookSelection } from "./ManuscriptBookSelection";
import type { ObsidianManuscriptLibrary } from "./ObsidianManuscript";

export class ManuscriptEventGeneration {
  private readonly paths = new Map<string, number>();
  private batch = 0;

  touch(path: string): { pathGeneration: number; batchGeneration: number } {
    const pathGeneration = (this.paths.get(path) ?? 0) + 1;
    this.paths.set(path, pathGeneration);
    this.batch += 1;
    return { pathGeneration, batchGeneration: this.batch };
  }

  currentPath(path: string): number { return this.paths.get(path) ?? 0; }
  currentBatch(): number { return this.batch; }
  isCurrent(path: string, pathGeneration: number, batchGeneration: number): boolean {
    return this.currentPath(path) === pathGeneration && this.batch === batchGeneration;
  }
}

export function authoritativeManuscriptPaths(input: {
  readonly parentReferences: readonly string[];
  readonly resolvedParentPath: string | null;
  readonly bookReferences: readonly string[];
  readonly resolvedBookPath: string | null;
  readonly legacyParentPath: string | null;
  readonly legacyBookPath: string | null;
}): { parentPath: string | null; bookPath: string | null } {
  const explicitAuthority = input.parentReferences.length > 0 || input.bookReferences.length > 0;
  return {
    parentPath: input.parentReferences.length > 0 ? input.resolvedParentPath : input.legacyParentPath,
    bookPath: explicitAuthority ? input.resolvedBookPath : input.resolvedBookPath ?? input.legacyBookPath
  };
}

export interface LastKnownManuscriptEntry {
  readonly path: string;
  readonly kind: "book" | "part" | "scene";
  readonly bookPath: string;
  readonly parentPath: string | null;
  readonly orderKey: string | null;
  readonly previousPath: string | null;
  readonly nextPath: string | null;
  readonly globalPosition: number;
  readonly selectedBookPath: string | null;
  readonly selectedContextPath: string | null;
  readonly active: boolean;
}

export interface LastKnownManuscriptSnapshot {
  readonly generation: number;
  readonly entriesByPath: ReadonlyMap<string, LastKnownManuscriptEntry>;
  readonly bookPaths: readonly string[];
}

export interface ManuscriptDeletionContext {
  readonly deletedPath: string;
  readonly bookPath: string;
  readonly fallbackPath: string | null;
  readonly restoreBookPath?: string | null;
}

export interface ManuscriptSelectionReconciliation {
  readonly bookPath: string | null;
  readonly contextPath: string | null;
  readonly changed: boolean;
  readonly missingBook: boolean;
}

export function captureLastKnownManuscriptSnapshot(
  library: ObsidianManuscriptLibrary,
  selection: ManuscriptBookSelection,
  activePath: string | null,
  generation: number
): LastKnownManuscriptSnapshot {
  const entries = new Map<string, LastKnownManuscriptEntry>();
  let globalPosition = 0;
  for (const book of library.books) {
    const bookPosition = globalPosition++;
    entries.set(book.file.path, {
      path: book.file.path,
      kind: "book",
      bookPath: book.file.path,
      parentPath: null,
      orderKey: null,
      previousPath: null,
      nextPath: null,
      globalPosition: bookPosition,
      selectedBookPath: selection.bookPath,
      selectedContextPath: selection.contextPath,
      active: activePath === book.file.path
    });
    const byParent = new Map<string, typeof book.result.entries>();
    for (const entry of book.result.entries) {
      if (entry.kind !== "part" && entry.kind !== "scene") continue;
      const parent = entry.parentPath ?? book.file.path;
      byParent.set(parent, [...(byParent.get(parent) ?? []), entry]);
    }
    const sequencePosition = new Map(book.result.entries.map((entry, index) => [entry.path, globalPosition + index]));
    for (const siblings of byParent.values()) {
      siblings.forEach((entry, index) => {
        if (entry.kind !== "part" && entry.kind !== "scene") return;
        entries.set(entry.path, {
        path: entry.path,
        kind: entry.kind,
        bookPath: book.file.path,
        parentPath: entry.parentPath ?? book.file.path,
        orderKey: entry.orderKey ?? null,
        previousPath: siblings[index - 1]?.path ?? null,
        nextPath: siblings[index + 1]?.path ?? null,
        globalPosition: sequencePosition.get(entry.path) ?? globalPosition,
        selectedBookPath: selection.bookPath,
        selectedContextPath: selection.contextPath,
        active: activePath === entry.path
        });
      });
    }
    globalPosition += book.result.entries.length;
  }
  return { generation, entriesByPath: entries, bookPaths: library.books.map((book) => book.file.path) };
}

export function deletionContextFor(
  snapshot: LastKnownManuscriptSnapshot | null,
  path: string,
  survivingPaths: ReadonlySet<string>
): ManuscriptDeletionContext | null {
  const entry = snapshot?.entriesByPath.get(path);
  if (!entry) return null;
  const fallback = [entry.nextPath, entry.previousPath, entry.parentPath, entry.bookPath]
    .find((candidate): candidate is string => Boolean(candidate && survivingPaths.has(candidate))) ?? null;
  return { deletedPath: path, bookPath: entry.bookPath, fallbackPath: fallback };
}

export function reconcileManuscriptSelection(
  current: ManuscriptBookSelection,
  validBookPaths: ReadonlySet<string>,
  validContextPaths: ReadonlySet<string>,
  fallbackBookPath: string | null,
  context?: ManuscriptDeletionContext | null
): ManuscriptSelectionReconciliation {
  const bookValid = Boolean(current.bookPath && validBookPaths.has(current.bookPath));
  let bookPath = bookValid ? current.bookPath : null;
  if (!bookPath) {
    const contextualBook = context?.bookPath && validBookPaths.has(context.bookPath) ? context.bookPath : null;
    bookPath = contextualBook ?? (fallbackBookPath && validBookPaths.has(fallbackBookPath) ? fallbackBookPath : null);
  }
  let contextPath = bookPath && current.contextPath && validContextPaths.has(current.contextPath)
    ? current.contextPath
    : null;
  if (bookPath && !contextPath && context?.fallbackPath && validContextPaths.has(context.fallbackPath)) {
    contextPath = context.fallbackPath;
  }
  if (bookPath && !contextPath) contextPath = bookPath;
  return {
    bookPath,
    contextPath,
    changed: current.bookPath !== bookPath || current.contextPath !== contextPath,
    missingBook: Boolean(current.bookPath && !bookValid)
  };
}
