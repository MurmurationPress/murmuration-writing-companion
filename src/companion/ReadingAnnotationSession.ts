import { ReadingAnnotationCapture, ReadingSelection } from "./ReadingAnnotationCapture";

export interface ReadingSurface<File> { file: File; root: HTMLElement }
export interface CapturedReadingSelection<File> { file: File; selection: ReadingSelection | null }

/** Selection changes belong to their document, never the first leaf with a selection. */
export class ReadingAnnotationSession<File extends { path: string }> {
  private current: (CapturedReadingSelection<File> & { document: Document; root: HTMLElement }) | null = null;
  private readonly documents = new Map<Document, () => void>();
  constructor(private readonly capture: ReadingAnnotationCapture,
    private readonly surfaces: (document: Document) => ReadingSurface<File>[],
    private readonly contextMenu: (event: MouseEvent, captured: CapturedReadingSelection<File>) => void) {}

  get(): CapturedReadingSelection<File> | null {
    if (this.current && !this.current.root.isConnected) this.clear();
    return this.current;
  }
  clear(): void { this.current = null; }

  observe(document: Document): void {
    if (this.documents.has(document)) return;
    const removers: (() => void)[] = [];
    const listen = (name: string, callback: (event: any) => void) => {
      document.addEventListener(name, callback, true);
      removers.push(() => document.removeEventListener(name, callback, true));
    };
    listen("selectionchange", () => this.update(document));
    for (const name of ["pointerdown", "pointerup", "keydown"]) listen(name, (event: Event) => {
      const surface = this.surfaces(document).find(surface => surface.root.contains(event.target as Node));
      if (surface) this.update(document, true);
    });
    listen("contextmenu", (event: MouseEvent) => {
      const selection = document.getSelection();
      const surface = this.surfaces(document).find(surface => surface.root.contains(event.target as Node));
      if (!surface || !selection?.toString().trim() || !selection.rangeCount || !surface.root.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
      this.update(document);
      if (this.current?.document === document) this.contextMenu(event, this.current);
    });
    const win = document.defaultView;
    if (win) {
      const close = () => this.forget(document);
      win.addEventListener("pagehide", close);
      removers.push(() => win.removeEventListener("pagehide", close));
    }
    this.documents.set(document, () => removers.forEach(remove => remove()));
  }

  private update(document: Document, explicit = false): void {
    const selection = document.getSelection();
    const surfaces = this.surfaces(document);
    if (selection && !selection.isCollapsed && selection.rangeCount) {
      const surface = surfaces.find(surface => surface.root.contains(selection.getRangeAt(0).commonAncestorContainer));
      if (surface) {
        this.current = { file: surface.file, selection: this.capture.capture(surface.root, surface.file.path, selection), document, root: surface.root };
        return;
      }
    }
    // A palette or Companion taking focus may clear the DOM selection. An
    // explicit manuscript click/caret movement must instead discard the cache.
    const focus = document.activeElement;
    const inReading = !focus || focus === document.body || surfaces.some(surface => surface.root.contains(focus));
    if ((explicit || inReading) && this.current?.document === document && (!selection || selection.isCollapsed || !selection.rangeCount)) this.clear();
  }

  forget(document: Document): void {
    this.documents.get(document)?.(); this.documents.delete(document);
    if (this.current?.document === document) this.clear();
  }
  dispose(): void { for (const document of this.documents.keys()) this.forget(document); this.clear(); }
}
