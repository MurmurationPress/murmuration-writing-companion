import { App, Notice, Plugin, SuggestModal } from "obsidian";
import type { ObsidianManuscriptBook, ObsidianManuscriptLibrary } from "./ObsidianManuscript";
import { ManuscriptSequencePropertyService, NUMBERING_SNAPSHOT, NUMBERING_TOKEN } from "./ManuscriptSequenceProperty";

function snapshotContainsToken(saved: unknown, token: string): boolean {
  if (typeof saved !== "string") return false;
  try {
    const [version, roots] = JSON.parse(saved);
    const contains = (nodes: unknown): boolean => Array.isArray(nodes) && nodes.some(node =>
      Array.isArray(node) && (node[0] === "part" || node[0] === "scene")
      && (node[1] === token || contains(node[2])));
    return version === 1 && contains(roots);
  } catch { return false; }
}

class BookPicker extends SuggestModal<ObsidianManuscriptBook> {
  private chosen = false;
  constructor(app: App, private readonly books: readonly ObsidianManuscriptBook[],
    private readonly done: (book: ObsidianManuscriptBook | null) => void) {
    super(app); this.setPlaceholder("Choose a Book to renumber");
  }
  getSuggestions(query: string): ObsidianManuscriptBook[] {
    return this.books.filter(book => `${book.record.title} ${book.file.path}`.toLowerCase().includes(query.toLowerCase()));
  }
  renderSuggestion(book: ObsidianManuscriptBook, el: HTMLElement): void {
    el.createDiv({ text: book.record.title }); el.createEl("small", { text: book.file.path });
  }
  onChooseSuggestion(book: ObsidianManuscriptBook): void { this.chosen = true; this.done(book); }
  onClose(): void {
    // SuggestModal closes before invoking onChooseSuggestion.
    queueMicrotask(() => { if (!this.chosen) this.done(null); });
  }
}

export function activeNumberingBook(library: ObsidianManuscriptLibrary, path: string | null): ObsidianManuscriptBook | undefined {
  if (!path) return undefined;
  const owner = library.owningBookPathByFile.get(path);
  return library.books.find(book => book.file.path === (owner ?? path));
}

/** Shared command/status owner; no editor-change listeners or automatic writer. */
export class ManuscriptNumberingCommands {
  readonly service: ManuscriptSequencePropertyService;
  private readonly status: HTMLElement;
  private disposed = false;
  private running = false;
  private cancellation: AbortController | null = null;
  private picker: BookPicker | null = null;
  constructor(private readonly host: Plugin,
    private readonly library: () => ObsidianManuscriptLibrary,
    private readonly whenSettled: (signal?: AbortSignal) => Promise<void>,
    private readonly activePath: () => string | null) {
    this.service = new ManuscriptSequencePropertyService(host.app);
    this.status = host.addStatusBarItem();
    this.status.setText("Scene numbers out of date");
    this.status.setAttribute("role", "button");
    this.status.setAttribute("tabindex", "0");
    this.status.style.cursor = "pointer";
    this.status.style.display = "none";
    host.registerDomEvent(this.status, "click", () => void this.run());
    host.registerDomEvent(this.status, "keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void this.run(); }
    });
    host.addCommand({ id: "renumber-book-scenes", name: "Renumber book scenes", callback: () => this.run() });
    host.registerEvent(host.app.workspace.on("file-open", () => this.refresh()));
    host.registerEvent(host.app.workspace.on("active-leaf-change", () => this.refresh()));
    host.register(() => { this.disposed = true; this.cancellation?.abort(); this.picker?.close(); this.service.dispose(); this.status.remove(); });
  }

  refresh(): void {
    if (this.disposed) return;
    const library = this.library();
    const book = activeNumberingBook(library, this.activePath());
    const stale = book && (this.hasUnresolvedStructure(book) || !this.service.isCurrent(book));
    this.status.style.display = stale ? "" : "none";
    if (book) {
      const label = `Scene numbers out of date — ${book.record.title} (${book.file.path}). Click to renumber this Book.`;
      this.status.setAttribute("aria-label", label);
      this.status.setAttribute("title", label);
    }
  }

  private hasUnresolvedStructure(book: ObsidianManuscriptBook): boolean {
    const saved = this.host.app.metadataCache.getFileCache(book.file)?.frontmatter?.[NUMBERING_SNAPSHOT];
    return this.library().unresolved.some(note => {
      const token = this.host.app.metadataCache.getFileCache(note.file)?.frontmatter?.[NUMBERING_TOKEN];
      // Existing snapshot tokens attribute orphaned notes without reading other
      // Books. Previously unnumbered orphans have no provable Book scope.
      if (typeof token !== "string" || !token || typeof saved !== "string" || snapshotContainsToken(saved, token)) return true;
      // An externally replaced token is not proof of another Book's ownership.
      // Consult only cached Book snapshots, never project or scan their scenes.
      return !this.library().books.some(other => {
        if (other.file === book.file) return false;
        const snapshot = this.host.app.metadataCache.getFileCache(other.file)?.frontmatter?.[NUMBERING_SNAPSHOT];
        return snapshotContainsToken(snapshot, token);
      });
    });
  }

  async run(): Promise<void> {
    if (this.disposed) return;
    if (this.running) { new Notice("Book scene renumbering is already running."); return; }
    this.running = true;
    let progress: Notice | undefined;
    try {
      await this.whenSettled();
      if (this.disposed) return;
      const library = this.library();
      if (!library.books.length) { new Notice("No manuscript Books are available to renumber."); return; }
      const book = activeNumberingBook(library, this.activePath())
        ?? await new Promise<ObsidianManuscriptBook | null>(resolve => {
          this.picker = new BookPicker(this.host.app, library.books, resolve);
          this.picker.open();
        });
      this.picker = null;
      if (!book || this.disposed) return;
      // Unassigned notes cannot safely be presumed to belong to a different Book.
      if (this.hasUnresolvedStructure(book)) throw new Error("Resolve the Navigator's unassigned manuscript notes before renumbering; their Book membership is uncertain.");
      const path = book.file.path;
      this.cancellation = new AbortController();
      const fragment = document.createDocumentFragment();
      const text = fragment.createSpan({ text: `Renumbering ${book.record.title}… ` });
      const cancel = fragment.createEl("button", { text: "Cancel" });
      cancel.onclick = () => this.cancellation?.abort();
      progress = new Notice(fragment, 0);
      const writes = await this.service.renumber(path, {
        currentBook: () => {
          const current = this.library().books.find(b => b.file.path === path);
          return current && !this.hasUnresolvedStructure(current) ? current : undefined;
        },
        whenSettled: this.whenSettled,
        signal: this.cancellation.signal,
        progress: (completed, total) => text.setText(`Renumbering ${book.record.title}: ${completed}/${total} files checked. `)
      });
      if (!this.disposed) new Notice(`${book.record.title}: scene numbers verified current. ${writes} file${writes === 1 ? "" : "s"} updated.`);
    } catch (error) {
      if (!this.disposed) new Notice(`Renumbering incomplete: ${error instanceof Error ? error.message : "Scene numbers could not be verified."}`, 10000);
    } finally {
      progress?.hide(); this.cancellation = null; this.running = false; this.refresh();
    }
  }
}
