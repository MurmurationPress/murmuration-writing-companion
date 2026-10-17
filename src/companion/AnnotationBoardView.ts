import { ItemView, MarkdownView, Notice, SuggestModal, TFile, WorkspaceLeaf } from "obsidian";
import type MWC from "../main";
import type { Annotation } from "../editorial/EditorialNote";
import type { ObsidianManuscriptBook } from "../manuscript/ObsidianManuscript";
import { activeNumberingBook } from "../manuscript/ManuscriptNumberingCommands";
import { renderAnnotationCard } from "../ui/AnnotationCard";
import { ReadingAnnotationComposer } from "./ReadingAnnotationComposer";
import { projectAnnotationBoard, filterAnnotationBoardCards, AnnotationBoardCard, AnnotationBoardFilters } from "./AnnotationBoardProjection";

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
  constructor(readonly host: MWC) {
    host.registerView(ANNOTATION_BOARD_VIEW, leaf => new AnnotationBoardView(leaf, this));
    host.addCommand({ id: "open-annotation-board", name: "Open Annotation Board", callback: () => this.open() });
    host.register(() => {
      this.disposed = true; this.picker?.close();
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
    const annotation = this.host.storeService.store.pages[card.path]?.annotations.find(a => a.id === card.annotation.id);
    if (!book || !book.filesByPath.has(card.path) || !(file instanceof TFile) || !annotation
      || this.host.storeService.store.pages[card.path]?.deletedAt) {
      throw new Error("This note is no longer in this Book, or the annotation is unavailable. Its stored history is retained. Refresh and try again.");
    }
    return { file, annotation };
  }
  async update(bookPath: string, card: AnnotationBoardCard, patch: Partial<Annotation>): Promise<void> {
    const { file, annotation } = this.current(bookPath, card);
    await this.host.storeService.updateAnnotation(file, annotation, patch);
  }
  async navigate(bookPath: string, card: AnnotationBoardCard): Promise<void> {
    try {
      const { file, annotation } = this.current(bookPath, card);
      if (!annotation.anchor.text && !annotation.anchor.line) throw new Error("This annotation has no usable passage anchor.");
      await this.host.navigateToAnnotation(file, annotation, this.manuscriptLeaf ?? undefined);
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
        this.filters[key] = select.value;
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
    if (this.filters[key] && !options.some(option => option.path === this.filters[key])) this.filters[key] = "";
    const signature = JSON.stringify(options);
    if (select.dataset.options !== signature) {
      select.empty(); select.createEl("option", { value: "", text: `All ${key === "category" ? "categories" : key + "s"}` });
      for (const option of options) select.createEl("option", { value: option.path, text: option.title || "Uncategorised" });
      select.dataset.options = signature;
    }
    select.value = this.filters[key] ?? "";
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
    this.options("chapter", available.chapters.filter(chapter => !this.filters.part
      || available.cards.some(card => card.path === chapter.path && card.part === this.filters.part)));
    this.options("category", available.categories.map(category => ({ path: category, title: category })));
    const projection = { ...available, cards: filterAnnotationBoardCards(available.cards, this.filters),
      total: available.cards.filter(card => this.filters.showResolved || card.annotation.status !== "resolved").length };
    this.message.setText(projection.cards.length ? `${projection.cards.length} annotations shown` :
      projection.total ? "No annotations match these filters." : this.filters.showResolved ? "No annotations in this Book." : "No open annotations in this Book.");
    const wanted = new Set(projection.cards.map(card => card.key));
    for (const [key, card] of this.cards) if (!wanted.has(key)) { card.element.remove(); this.cards.delete(key); }
    const categories = projection.categories.filter(category => !this.filters.category || category === this.filters.category);
    for (const [category, element] of this.columnElements) if (!categories.includes(category)) { element.remove(); this.columnElements.delete(category); }
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
        const key = event.dataTransfer?.getData(DRAG_TYPE);
        const card = projection.cards.find(card => card.key === key);
        if (!card) return;
        event.preventDefault(); event.stopPropagation(); void this.commit(card, { category });
      };
      const entries = projection.cards.filter(card => card.annotation.category === category);
      let previous: Element = column.firstElementChild!;
      for (const card of entries) {
        const signature = JSON.stringify([card.chapter, card.annotation, this.failures.get(card.key)?.message, this.busy.has(card.key)]);
        let rendered = this.cards.get(card.key);
        if (!rendered || rendered.signature !== signature) {
          const element = this.renderCard(card);
          const focused = rendered?.element.contains(this.contentEl.ownerDocument.activeElement);
          rendered?.element.replaceWith(element);
          rendered = { element, signature }; this.cards.set(card.key, rendered);
          if (focused) element.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
        }
        if (previous.nextElementSibling !== rendered.element) previous.after(rendered.element);
        previous = rendered.element;
      }
      let empty = column.querySelector<HTMLElement>(".mwc-board-column-empty");
      if (!entries.length && !empty) empty = column.createDiv({ cls: "mwc-board-column-empty mwc-muted", text: "No annotations" });
      if (entries.length) empty?.remove();
    }
    if (hadFocus && !activeBefore.isConnected && this.contentEl.ownerDocument.activeElement === this.contentEl.ownerDocument.body) {
      this.selects.get("part")?.focus({ preventScroll: true });
    }
  }
  private renderCard(card: AnnotationBoardCard): HTMLElement {
    const wrapper = this.contentEl.ownerDocument.createElement("article");
    wrapper.className = "mwc-board-card"; wrapper.dataset.annotationKey = card.key;
    wrapper.createEl("h4", { text: card.chapter });
    const handle = wrapper.createEl("span", { text: "Move", cls: "mwc-board-drag", attr: { title: "Drag to a category column; alternatively use Annotation category" } });
    handle.draggable = true;
    handle.ondragstart = event => { event.dataTransfer?.setData(DRAG_TYPE, card.key); if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"; };
    const element = renderAnnotationCard(wrapper, card.annotation, async (_, patch) => this.commit(card, patch),
      undefined, undefined, () => { void this.board.navigate(this.bookPath!, card); },
      async () => this.commit(card, { status: "resolved" }), card.annotation.status,
      async () => this.commit(card, { status: "open" }));
    element.querySelector<HTMLTextAreaElement>("textarea")!.readOnly = true;
    const edit = element.createEl("button", { text: "Edit annotation" });
    edit.onclick = () => this.edit(card);
    if (card.annotation.anchor.range) element.createEl("small", { cls: "mwc-muted", text: `Source offsets ${card.annotation.anchor.range.from}–${card.annotation.anchor.range.to} · checked on navigation` });
    else if (!card.annotation.anchor.line) element.createEl("small", { text: "No source position; passage checked on navigation" });
    if (this.busy.has(card.key)) for (const control of Array.from(wrapper.querySelectorAll<HTMLButtonElement | HTMLSelectElement>("button, select"))) control.disabled = true;
    return wrapper;
  }
  private async commit(card: AnnotationBoardCard, patch: Partial<Annotation>): Promise<void> {
    if (this.busy.has(card.key)) return;
    this.busy.add(card.key); this.failures.delete(card.key); this.refresh();
    try { await this.board.update(this.bookPath!, card, patch); }
    catch (error) {
      const message = `Could not complete annotation update: ${error instanceof Error ? error.message : "storage unavailable"}. Retry when ready.`;
      this.failures.set(card.key, { message, retry: () => this.commit(card, patch) }); new Notice(message);
    } finally { this.busy.delete(card.key); this.refresh(); }
  }
  private edit(card: AnnotationBoardCard): void {
    if (this.editor) return;
    const draft = structuredClone(card.annotation), originalBody = draft.body, originalCategory = draft.category;
    const bookPath = this.bookPath!;
    this.editor = new ReadingAnnotationComposer(this.app, draft, async (body, category) => {
      const current = this.board.current(bookPath, card).annotation;
      if ((current.body !== originalBody || current.category !== originalCategory)
        && (current.body !== body || current.category !== category)) {
        throw new Error("This annotation changed elsewhere. Cancel and reopen it to review the current version.");
      }
      await this.board.update(bookPath, card, { body, category });
    }, () => { this.editor = null; this.refresh(); }, "Edit annotation");
    this.editor.open();
  }
  dispose(): void { this.closed = true; this.editor?.dispose(); this.editor = null; }
  async onClose(): Promise<void> { this.dispose(); this.cards.clear(); this.columnElements.clear(); }
}
