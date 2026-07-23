export type ManuscriptBookSelectionSource =
  | "manuscript-navigator"
  | "continuity-review"
  | "continuity-review-activation"
  | "restore";

export interface ManuscriptBookSelection {
  readonly bookPath: string | null;
  readonly contextPath: string | null;
  readonly source: ManuscriptBookSelectionSource;
  readonly revision: number;
}

export interface ManuscriptBookSelectionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type Listener = (selection: ManuscriptBookSelection) => void;

/** One explicit, vault-local manuscript-book selection shared by review surfaces. */
export class ManuscriptBookSelectionService {
  private readonly listeners = new Set<Listener>();
  private selection: ManuscriptBookSelection;

  constructor(
    private readonly storage: ManuscriptBookSelectionStorage | null,
    private readonly storageKey: string
  ) {
    let restored: string | null = null;
    try { restored = storage?.getItem(storageKey) ?? null; } catch { /* In-memory selection remains available. */ }
    this.selection = {
      bookPath: restored,
      contextPath: restored,
      source: "restore",
      revision: 0
    };
  }

  get(): ManuscriptBookSelection { return this.selection; }

  select(
    bookPath: string,
    contextPath: string | null,
    source: Exclude<ManuscriptBookSelectionSource, "restore">
  ): ManuscriptBookSelection {
    const normalizedContext = contextPath?.trim() || bookPath;
    if (
      this.selection.bookPath === bookPath
      && this.selection.contextPath === normalizedContext
      && this.selection.source === source
    ) return this.selection;
    this.selection = {
      bookPath,
      contextPath: normalizedContext,
      source,
      revision: this.selection.revision + 1
    };
    try { this.storage?.setItem(this.storageKey, bookPath); } catch { /* Selection still works in memory. */ }
    for (const listener of this.listeners) listener(this.selection);
    return this.selection;
  }

  reconcileBooks(validBookPaths: ReadonlySet<string>, fallbackPath: string | null): ManuscriptBookSelection {
    if (this.selection.bookPath && validBookPaths.has(this.selection.bookPath)) return this.selection;
    if (!fallbackPath) {
      if (this.selection.bookPath === null) return this.selection;
      this.selection = { bookPath: null, contextPath: null, source: "restore", revision: this.selection.revision + 1 };
      try { this.storage?.removeItem(this.storageKey); } catch { /* Ignore unavailable preferences. */ }
      for (const listener of this.listeners) listener(this.selection);
      return this.selection;
    }
    return this.select(fallbackPath, fallbackPath, "manuscript-navigator");
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
