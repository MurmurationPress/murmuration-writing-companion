import { annotationRevision, AnnotationCountError } from "../editorial/AnnotationRevision";
import { ItemView, MarkdownView, Notice, SuggestModal, TFile, WorkspaceLeaf } from "obsidian";
import type MWC from "../main";
import type { Annotation } from "../editorial/EditorialNote";
import type { ObsidianManuscriptBook } from "../manuscript/ObsidianManuscript";
import { activeNumberingBook } from "../manuscript/ManuscriptNumberingCommands";
import { renderAnnotationCard } from "../ui/AnnotationCard";
import { ReadingAnnotationComposer } from "./ReadingAnnotationComposer";
import { projectAnnotationBoard, annotationBoardDragCard, filterAnnotationBoardCards, AnnotationBoardCard, AnnotationBoardFilters } from "./AnnotationBoardProjection";

export const ANNOTATION_BOARD_VIEW = "mwc-annotation-board";
const DRAG_TYPE = "application/x-mwc-annotation-board";

class BoardBookPicker extends SuggestModal<ObsidianManuscriptBook> {
  constructor(private readonly host: MWC, private readonly choose: (book: ObsidianManuscriptBook) => void) {
    super(host.app); this.setPlaceholder("Choose a Book for Annotation Board");
  }
  getSuggestions(query: string): ObsidianManuscriptBook[] {
    return this.host.manuscriptProjection.get().books.filter(book =>
      `${book.record.title} ${book.file.path}`.toLowerCase().includes(query.toLowerCase()));
  }
  renderSuggestion(book: ObsidianManuscriptBook, el: HTMLElement): void {
    el.createDiv({ text: book.record.title }); el.createEl("small", { text: book.file.path });
  }
  onChooseSuggestion(book: ObsidianManuscriptBook): void { this.choose(book); }
}

/** Owns activation and uses the same update and navigation paths as chapter cards. */
export class AnnotationBoard {
  private pending: Promise<void> | null = null;
  private picker: BoardBookPicker | null = null;
  private disposed = false;
  private manuscriptLeaf: WorkspaceLeaf | null = null;
  constructor(readonly host: MWC, private readonly settled: () => Promise<void> = async () => {}) {
    host.registerView(ANNOTATION_BOARD_VIEW, leaf => new AnnotationBoardView(leaf, this));
    host.addCommand({ id: "open-annotation-board", name: "Open Annotation Board", callback: () => this.open() });
    host.registerEvent(host.app.workspace.on("window-close", (_workspaceWindow, win) => {
      if (this.manuscriptLeaf?.view.containerEl.ownerDocument === win.document) this.manuscriptLeaf = null;
    }));
    host.register(() => {
      this.disposed = true; this.picker?.close(); this.manuscriptLeaf = null;
      for (const leaf of host.app.workspace.getLeavesOfType(ANNOTATION_BOARD_VIEW)) {
        if (leaf.view instanceof AnnotationBoardView) leaf.view.dispose();
      }
    });
  }
  open(path?: string): Promise<void> {
    if (this.pending) return this.pending;
    const operation = this.openOnce(path);
    this.pending = operation;
    void operation.finally(() => { if (this.pending === operation) this.pending = null; }).catch(() => {});
    return operation;
  }
  private async openOnce(path?: string): Promise<void> {
    if (this.disposed) return;
    const recent = this.host.app.workspace.getMostRecentLeaf();
    if (recent?.view.getViewType() === "markdown") this.manuscriptLeaf = recent;
    const active = this.host.app.workspace.activeLeaf?.view;
    const context = path ?? (active?.getViewType() === "murmuration-manuscript-navigator-view"
      ? this.host.manuscriptBookSelection.get().contextPath : active instanceof MarkdownView ? active.file?.path : null);
    const book = activeNumberingBook(this.host.manuscriptProjection.get(), context ?? null);
    if (!book) { this.pick(); return; }
    const workspace = this.host.app.workspace;
    const leaf = workspace.getLeavesOfType(ANNOTATION_BOARD_VIEW)[0] ?? workspace.getLeaf("tab");
    await leaf.setViewState({ type: ANNOTATION_BOARD_VIEW, active: true, state: { bookPath: book.file.path } });
    if (!this.disposed) await workspace.revealLeaf(leaf);
  }
  pick(): void {
    if (this.picker || this.disposed) return;
    if (!this.host.manuscriptProjection.get().books.length) { new Notice("No manuscript Books are available."); return; }
    this.picker = new BoardBookPicker(this.host, book => { void this.open(book.file.path); });
    const picker = this.picker;
    const onClose = picker.onClose.bind(picker);
    picker.onClose = () => { onClose(); if (this.picker === picker) this.picker = null; };
    picker.open();
  }
  refresh(): void {
    if (this.disposed) return;
    for (const leaf of this.host.app.workspace.getLeavesOfType(ANNOTATION_BOARD_VIEW)) {
      if (leaf.view instanceof AnnotationBoardView) leaf.view.refresh();
    }
  }
  current(bookPath: string, card: AnnotationBoardCard): { file: TFile; annotation: Annotation } {
    const book = this.host.manuscriptProjection.get().books.find(book => book.file.path === bookPath);
    const file = this.host.app.vault.getAbstractFileByPath(card.path);
    const page = this.host.storeService.store.pages[card.path];
    const annotation = page?.annotations.includes(card.annotation) ? card.annotation : undefined;
    if (!book || !book.filesByPath.has(card.path) || !(file instanceof TFile) || !annotation
      || this.host.storeService.store.pages[card.path]?.deletedAt) {
      throw new Error("This note is no longer in this Book, or the annotation is unavailable. Its stored history is retained. Refresh and try again.");
    }
    return { file, annotation };
  }
  async update(bookPath: string, card: AnnotationBoardCard, patch: Partial<Annotation>, available?: () => void): Promise<void> {
    await this.settled();
    const { file, annotation } = this.current(bookPath, card);
    await this.host.storeService.updateAnnotation(file, annotation, patch, () => {
      if (this.disposed) throw new Error("Annotation Board was unloaded before the update could be saved.");
      available?.();
      this.current(bookPath, card);
      if (card.identityProblem) throw new Error(card.identityProblem);
      if (annotationRevision(annotation) !== card.revision) throw new Error("This annotation changed elsewhere. Review its current version before trying again.");
    });
  }
  async retryCount(bookPath: string, card: AnnotationBoardCard): Promise<void> {
    await this.settled();
    await this.host.storeService.retryAnnotationCount(this.current(bookPath, card).file);
  }
  async navigate(bookPath: string, card: AnnotationBoardCard, document?: Document): Promise<void> {
    try {
      const { file, annotation } = this.current(bookPath, card);
      if (!annotation.anchor.text && !annotation.anchor.line) throw new Error("This annotation has no usable passage anchor.");
      const hint = this.manuscriptLeaf;
      const leaf = document && hint?.view.containerEl.ownerDocument !== document
        ? this.host.app.workspace.getLeavesOfType("markdown").find(leaf => leaf.view.containerEl.ownerDocument === document)
        : hint;
      await this.host.navigateToAnnotation(file, annotation, leaf ?? undefined);
    } catch (error) { new Notice(error instanceof Error ? error.message : "Could not navigate to the annotation."); }
  }
}

export class AnnotationBoardView extends ItemView {
  private bookPath: string | null = null;
  private bookFile: TFile | null = null;
  private filters: AnnotationBoardFilters = {};
  private toolbar!: HTMLElement;
  private columns!: HTMLElement;
  private message!: HTMLElement;
  private heading!: HTMLElement;
  private errors!: HTMLElement;
  private readonly selects = new Map<string, HTMLSelectElement>();
  private readonly cards = new Map<string, { element: HTMLElement; signature: string }>();
  private readonly columnElements = new Map<string, HTMLElement>();
  private readonly failures = new Map<string, { message: string; retry: () => Promise<void> }>();
  private readonly busy = new Set<string>();
  private editor: ReadingAnnotationComposer | null = null;
  private closed = false;
  private readonly dragScope = crypto.randomUUID();
  constructor(leaf: WorkspaceLeaf, private readonly board: AnnotationBoard) { super(leaf); }
  getViewType(): string { return ANNOTATION_BOARD_VIEW; }
  getDisplayText(): string { return "Annotation Board"; }
  getIcon(): string { return "columns-3"; }
  getState(): Record<string, unknown> { return { bookPath: this.bookFile?.path ?? this.bookPath }; }
  async setState(state: Record<string, unknown>, result: import("obsidian").ViewStateResult): Promise<void> {
    const path = typeof state.bookPath === "string" ? state.bookPath : null;
    if (path !== this.bookPath) { this.filters = {}; this.bookFile = null; this.failures.clear(); }
    this.bookPath = path;
    await super.setState(state, result); this.refresh();
  }
  async onOpen(): Promise<void> {
    this.closed = false;
    this.contentEl.empty(); this.cards.clear(); this.columnElements.clear(); this.selects.clear();
    this.contentEl.addClass("mwc-annotation-board");
    this.heading = this.contentEl.createEl("h2");
    const change = this.contentEl.createEl("button", { text: "Choose Book", attr: { "aria-label": "Choose Annotation Board Book" } });
    change.onclick = () => this.board.pick();
    this.toolbar = this.contentEl.createDiv("mwc-board-filters");
    for (const [key, label] of [["part", "Part"], ["chapter", "Chapter"], ["category", "Category"]] as const) {
      const wrapper = this.toolbar.createEl("label", { text: label });
      const select = wrapper.createEl("select", { attr: { "aria-label": `Filter by ${label.toLowerCase()}` } });
      this.selects.set(key, select);
      select.onchange = () => {
        this.filters[key] = key === "category" ? (select.value ? JSON.parse(select.value) : undefined) : select.value;
        if (key === "part") this.filters.chapter = "";
        this.refresh();
      };
    }
    const label = this.toolbar.createEl("label", { text: "Show resolved" });
    const resolved = label.createEl("input", { type: "checkbox" });
    resolved.checked = Boolean(this.filters.showResolved);
    resolved.onchange = () => { this.filters.showResolved = resolved.checked; this.refresh(); };
    this.message = this.contentEl.createDiv({ attr: { role: "status", "aria-live": "polite" } });
    this.errors = this.contentEl.createDiv({ attr: { role: "alert" } });
    this.columns = this.contentEl.createDiv("mwc-board-columns");
    this.contentEl.createEl("p", { cls: "mwc-muted", text: "Only current Book members are shown. Detached or deleted notes retain their editorial history in the portable store. Use a card’s category control or drag its move handle to change category." });
    this.refresh();
  }
  refresh(): void {
    if (this.closed || !this.toolbar) return;
    this.board.host.refreshContextControl(this.contentEl, () => { if (!this.closed) this.render(); });
  }
  private options(key: "part" | "chapter" | "category", options: readonly { path: string; title: string }[]): void {
    const select = this.selects.get(key)!;
    const value = key === "category" && this.filters.category !== undefined ? JSON.stringify(this.filters.category) : this.filters[key] ?? "";
    if (value && !options.some(option => option.path === value)) this.filters[key] = undefined;
    const signature = JSON.stringify(options);
    if (select.dataset.options !== signature) {
      select.empty(); select.createEl("option", { value: "", text: `All ${key === "category" ? "categories" : key + "s"}` });
      for (const option of options) select.createEl("option", { value: option.path, text: option.title || "Uncategorised" });
      select.dataset.options = signature;
    }
    select.value = key === "category" && this.filters.category !== undefined ? JSON.stringify(this.filters.category) : this.filters[key] ?? "";
  }
  private render(): void {
    const activeBefore = this.contentEl.ownerDocument.activeElement;
    const hadFocus = activeBefore && this.contentEl.contains(activeBefore);
    this.errors.empty();
    for (const failure of this.failures.values()) {
      this.errors.createEl("p", { text: failure.message });
      const retry = this.errors.createEl("button", { text: "Retry update" });
      retry.onclick = () => { void failure.retry(); };
    }
    const host = this.board.host;
    this.toolbar.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked = Boolean(this.filters.showResolved);
    // Retain the Book's file identity through a rename, without changing scope
    // when another pane's active scene changes.
    if (this.bookFile) this.bookPath = this.bookFile.path;
    const book = host.manuscriptProjection.get().books.find(book => book.file.path === this.bookPath);
    this.bookFile = book?.file ?? this.bookFile;
    this.heading.setText(book ? `Annotation Board — ${book.record.title}` : "Annotation Board — choose a Book");
    if (!book) {
      this.columns.empty(); this.cards.clear(); this.columnElements.clear();
      this.message.setText("The selected Book is unavailable. Choose a Book to review annotations."); return;
    }
    const available = projectAnnotationBoard(book, host.storeService.store, { showResolved: true });
    this.options("part", available.parts);
    const partMembers = new Set(available.cards.filter(card => card.part === this.filters.part).map(card => card.path));
    this.options("chapter", available.chapters.filter(chapter => !this.filters.part || partMembers.has(chapter.path)));
    this.options("category", available.categories.map(category => ({ path: JSON.stringify(category), title: category })));
    const projection = { ...available, cards: filterAnnotationBoardCards(available.cards, this.filters),
      total: available.cards.filter(card => this.filters.showResolved || card.annotation.status !== "resolved").length };
    this.message.setText(projection.cards.length ? `${projection.cards.length} annotations shown` :
      projection.total ? "No annotations match these filters." : this.filters.showResolved ? "No annotations in this Book." : "No open annotations in this Book.");
    const wanted = new Set(projection.cards.map(card => card.key));
    for (const [key, card] of this.cards) if (!wanted.has(key)) { card.element.remove(); this.cards.delete(key); }
    const categories = projection.categories.filter(category => this.filters.category === undefined || category === this.filters.category);
    for (const [category, element] of this.columnElements) if (!categories.includes(category)) { element.remove(); this.columnElements.delete(category); }
    const grouped = new Map<string, AnnotationBoardCard[]>();
    for (const card of projection.cards) {
      if (!grouped.has(card.annotation.category)) grouped.set(card.annotation.category, []);
      grouped.get(card.annotation.category)!.push(card);
    }
    let focusTarget: HTMLElement | null = null;
    let previousColumn: Element | null = null;
    for (const category of categories) {
      let column = this.columnElements.get(category);
      if (!column) {
        column = this.columns.createDiv({ cls: "mwc-board-column", attr: { "aria-label": `${category || "Uncategorised"} annotations` } });
        column.createEl("h3", { text: category || "Uncategorised" });
        column.ondragover = event => { if (event.dataTransfer?.types.includes(DRAG_TYPE)) event.preventDefault(); };
        this.columnElements.set(category, column);
      }
      if (previousColumn ? previousColumn.nextElementSibling !== column : this.columns.firstElementChild !== column) {
        if (previousColumn) previousColumn.after(column); else this.columns.prepend(column);
      }
      previousColumn = column;
      // Drop must resolve against the latest projection, never a stale closure.
      column.ondrop = event => {
        let card: AnnotationBoardCard | null;
        try { card = annotationBoardDragCard(event.dataTransfer?.getData(DRAG_TYPE) ?? "", this.dragScope, projection.cards); }
        catch (error) { event.preventDefault(); new Notice((error as Error).message); return; }
        if (!card) return;
        event.preventDefault(); event.stopPropagation(); void this.commit(card, { category });
      };
      const entries = grouped.get(category) ?? [];
      let previous: Element = column.firstElementChild!;
      for (const card of entries) {
        const signature = JSON.stringify([card.chapter, card.revision, card.identityProblem]);
        let rendered = this.cards.get(card.key);
        if (!rendered || rendered.signature !== signature) {
          const element = this.renderCard(card);
          const active = this.contentEl.ownerDocument.activeElement;
          const focusIndex = rendered ? Array.from(rendered.element.querySelectorAll("button,select,textarea,[role=button]")).indexOf(active!) : -1;
          rendered?.element.replaceWith(element);
          rendered = { element, signature }; this.cards.set(card.key, rendered);
          if (focusIndex >= 0) focusTarget = element.querySelectorAll<HTMLElement>("button,select,textarea,[role=button]")[focusIndex] ?? null;
        }
        if (previous.nextElementSibling !== rendered.element) previous.after(rendered.element);
        previous = rendered.element;
      }
      let empty = column.querySelector<HTMLElement>(".mwc-board-column-empty");
      if (!entries.length && !empty) empty = column.createDiv({ cls: "mwc-board-column-empty mwc-muted", text: "No annotations" });
      if (entries.length) empty?.remove();
    }
    if (hadFocus && !activeBefore.isConnected && this.contentEl.ownerDocument.activeElement === this.contentEl.ownerDocument.body) {
      // Moving the new node between columns also blurs it. Restore only after
      // every move, so keyboard users stay with the same annotation control.
      const target = focusTarget ?? this.selects.get("part");
      target?.focus({ preventScroll: true });
      focusTarget?.closest(".mwc-board-card")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }
  private renderCard(card: AnnotationBoardCard): HTMLElement {
    const wrapper = this.contentEl.ownerDocument.createElement("article");
    wrapper.className = "mwc-board-card"; wrapper.dataset.annotationKey = card.key;
    wrapper.createEl("h4", { text: card.chapter });
    const handle = wrapper.createEl("span", { text: "Move", cls: "mwc-board-drag", attr: { title: "Drag to a category column; alternatively use Annotation category" } });
    handle.draggable = true;
    handle.ondragstart = event => {
      if (this.busy.has(card.key) || card.identityProblem) { event.preventDefault(); return; }
      event.dataTransfer?.setData(DRAG_TYPE, JSON.stringify({ scope: this.dragScope, key: card.key, revision: card.revision }));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    };
    const element = renderAnnotationCard(wrapper, card.annotation, async (_, patch) => this.commit(card, patch),
      undefined, undefined, () => { void this.board.navigate(this.bookPath!, card, this.contentEl.ownerDocument); },
      async () => this.commit(card, { status: "resolved" }), card.annotation.status,
      async () => this.commit(card, { status: "open" }));
    element.querySelector<HTMLTextAreaElement>("textarea")!.readOnly = true;
    const edit = element.createEl("button", { text: "Edit annotation" });
    edit.onclick = () => this.edit(card);
    if (card.annotation.anchor.range) element.createEl("small", { cls: "mwc-muted", text: `Source offsets ${card.annotation.anchor.range.from}–${card.annotation.anchor.range.to} · checked on navigation` });
    else if (!card.annotation.anchor.line) element.createEl("small", { text: "No source position; passage checked on navigation" });
    if (card.identityProblem) wrapper.createEl("p", { text: card.identityProblem, attr: { role: "alert" } });
    if (card.identityProblem) for (const control of Array.from(wrapper.querySelectorAll<HTMLButtonElement | HTMLSelectElement>("button, select"))) control.disabled = true;
    return wrapper;
  }
  private async commit(card: AnnotationBoardCard, patch: Partial<Annotation>, countOnly = false): Promise<void> {
    if (this.busy.has(card.key) || this.closed) return;
    const bookPath = this.bookPath!;
    this.busy.add(card.key); this.failures.delete(card.key);
    this.cards.get(card.key)?.element.setAttribute("aria-busy", "true");
    this.refresh();
    try {
      if (countOnly) await this.board.retryCount(bookPath, card);
      else await this.board.update(bookPath, card, patch, () => { if (this.closed) throw new Error("Annotation Board closed before the update could be saved."); });
    } catch (error) {
      const message = `Could not complete annotation update: ${error instanceof Error ? error.message : "storage unavailable"}`;
      if (!this.closed && this.bookPath === bookPath) this.failures.set(card.key, {
        message, retry: () => this.commit(card, patch, countOnly || error instanceof AnnotationCountError)
      });
      new Notice(message);
    } finally {
      this.busy.delete(card.key); this.cards.get(card.key)?.element.removeAttribute("aria-busy"); this.refresh();
    }
  }
  private edit(card: AnnotationBoardCard): void {
    if (this.editor || this.busy.has(card.key) || card.identityProblem) return;
    const draft = structuredClone(card.annotation);
    const bookPath = this.bookPath!;
    let expected = card, countPending = false;
    this.editor = new ReadingAnnotationComposer(this.app, draft, async (body, category) => {
      const current = this.board.current(bookPath, expected).annotation;
      if (countPending && current.body === body && current.category === category) {
        await this.board.retryCount(bookPath, expected); return;
      }
      try { await this.board.update(bookPath, expected, { body, category }, () => { if (this.closed) throw new Error("Annotation Board closed before the update could be saved."); }); }
      catch (error) {
        if (error instanceof AnnotationCountError) {
          expected = { ...expected, revision: annotationRevision(current) }; countPending = true;
        }
        throw error;
      }
    }, () => { this.editor = null; this.refresh(); }, "Edit annotation");
    this.editor.open();
  }

  dispose(): void { this.closed = true; this.editor?.dispose(); this.editor = null; }
  async onClose(): Promise<void> { this.dispose(); this.cards.clear(); this.columnElements.clear(); }
}
