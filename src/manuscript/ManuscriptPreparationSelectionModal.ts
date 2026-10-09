import { App, Modal, SuggestModal, TFile, TFolder } from "obsidian";
import { isObsidianTrashPath } from "../ObsidianTrash";
import { isTemplateManuscriptPath } from "./LegacyManuscriptHierarchy";
import { buildSelectedManuscript, initialManuscriptPreparationSelection, manuscriptPreparationCandidates, ManuscriptPreparationSelection, preparationRootForFolder } from "./ManuscriptPreparationSelection";
import { planObsidianManuscriptPreparation } from "./ObsidianManuscriptPreparation";

class ManuscriptRootModal extends SuggestModal<TFile | TFolder> {
  private settled = false;
  constructor(app: App, private readonly resolve: (selection: ManuscriptPreparationSelection | null) => void, private readonly folder?: TFolder) {
    super(app);
    this.setPlaceholder(folder ? "Choose the existing note to use as this folder's Book root" : "Choose an existing manuscript root note or folder");
  }
  getSuggestions(query: string): Array<TFile | TFolder> {
    return this.app.vault.getAllLoadedFiles().filter((file): file is TFile | TFolder =>
      (file instanceof TFolder || file instanceof TFile && file.extension === "md") && file.path !== "/" && !file.path.startsWith(".")
      && !isObsidianTrashPath(file.path) && !isTemplateManuscriptPath(file.path)
      && (!this.folder || file instanceof TFile && file.path.startsWith(`${this.folder.path}/`))
      && file.path.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.path.localeCompare(b.path, "en", { numeric: true }));
  }
  renderSuggestion(file: TFile | TFolder, el: HTMLElement) { el.setText(`${file instanceof TFolder ? "Folder" : "Note"}: ${file.path}`); }
  selectSuggestion(file: TFile | TFolder, event: MouseEvent | KeyboardEvent) {
    // Obsidian closes the suggestion modal before invoking onChooseSuggestion.
    this.settled = true;
    super.selectSuggestion(file, event);
  }
  onChooseSuggestion(file: TFile | TFolder) {
    this.settled = true;
    if (file instanceof TFile) this.resolve(initialManuscriptPreparationSelection(this.app, file, this.folder?.path));
    else {
      const root = preparationRootForFolder(this.app, file);
      if (root) this.resolve(initialManuscriptPreparationSelection(this.app, root, file.path));
      else new ManuscriptRootModal(this.app, this.resolve, file).open();
    }
  }
  onClose() { if (!this.settled) this.resolve(null); }
}

export function chooseManuscriptPreparationRoot(app: App): Promise<ManuscriptPreparationSelection | null> {
  return new Promise(resolve => new ManuscriptRootModal(app, resolve).open());
}

class ManuscriptSelectionReviewModal extends Modal {
  private settled = false;
  constructor(app: App, private selection: ManuscriptPreparationSelection, private readonly resolve: (selection: ManuscriptPreparationSelection | null) => void) { super(app); }
  onOpen() { this.render(); }
  private render() {
    this.titleEl.setText("Review manuscript inclusion");
    this.contentEl.empty();
    this.contentEl.createEl("p", { text: `Book root: ${this.selection.rootPath}. Review roles, parents, order and inclusion. Existing authority is retained. Support notes start excluded. Approved untyped exclusions use scene-draft for Codex Press. Review every property change next.` });
    const book = buildSelectedManuscript(this.app, this.selection);
    const plan = planObsidianManuscriptPreparation(this.app, book);
    const candidates = manuscriptPreparationCandidates(this.app, this.selection);
    const byPath = new Map(candidates.map(candidate => [candidate.file.path, candidate]));
    const orderedPaths = [this.selection.rootPath, ...book.result.entries.map(entry => entry.path), ...candidates.filter(candidate => !book.filesByPath.has(candidate.file.path)).map(candidate => candidate.file.path)];
    const entries = new Map(book.result.entries.map(entry => [entry.path, entry]));
    const list = this.contentEl.createDiv();
    list.style.maxHeight = "50vh"; list.style.overflowY = "auto";
    const siblingPositions = new Map<string, number>();
    for (const path of [...new Set(orderedPaths)]) {
      const candidate = byPath.get(path);
      if (!candidate) continue;
      const entry = entries.get(path);
      const parent = entry?.parentPath ?? null;
      const position = parent ? (siblingPositions.get(parent) ?? 0) + 1 : 0;
      if (parent) siblingPositions.set(parent, position);
      const row = list.createDiv();
      const label = row.createEl("label");
      const checkbox = label.createEl("input", { attr: { type: "checkbox", "aria-label": `Include ${path}` } });
      checkbox.checked = candidate.included; checkbox.disabled = candidate.locked;
      label.createSpan({ text: ` ${!candidate.included ? "Excluded note" : candidate.kind === "book" ? "Book" : candidate.kind === "part" ? "Part" : "Scene"}: ${path}` });
      row.createDiv({ cls: "mwc-muted", text: `${candidate.reason}${parent ? ` · Parent: ${parent} · Sibling position: ${position}` : ""}` });
      checkbox.onchange = () => {
        const excluded = new Set(this.selection.excludedPaths);
        if (checkbox.checked) excluded.delete(path); else excluded.add(path);
        this.selection = { ...this.selection, excludedPaths: [...excluded].sort() };
        this.render();
      };
    }
    if (plan.diagnostics.length) {
      const warnings = this.contentEl.createEl("ul");
      for (const diagnostic of plan.diagnostics) warnings.createEl("li", { text: `${diagnostic.path ?? this.selection.rootPath}: ${diagnostic.message}` });
    }
    const actions = this.contentEl.createDiv();
    const cancel = actions.createEl("button", { text: "Cancel" }); cancel.onclick = () => this.finish(null);
    const review = actions.createEl("button", { text: "Review structural changes", cls: "mod-cta" });
    review.disabled = !plan.canApply && !plan.alreadyPrepared;
    review.onclick = () => this.finish(this.selection);
  }
  private finish(selection: ManuscriptPreparationSelection | null) { this.settled = true; this.resolve(selection); this.close(); }
  onClose() { this.contentEl.empty(); if (!this.settled) this.resolve(null); }
}

export function reviewManuscriptPreparationSelection(app: App, selection: ManuscriptPreparationSelection): Promise<ManuscriptPreparationSelection | null> {
  return new Promise(resolve => new ManuscriptSelectionReviewModal(app, selection, resolve).open());
}
