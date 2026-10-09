import { App, SuggestModal, TFile, TFolder } from "obsidian";
import { isObsidianTrashPath } from "../ObsidianTrash";
import { isTemplateManuscriptPath } from "./LegacyManuscriptHierarchy";
import { buildSelectedManuscript, initialManuscriptPreparationSelection, manuscriptPreparationCandidates, ManuscriptPreparationSelection, preparationRootForFolder } from "./ManuscriptPreparationSelection";
import { ManuscriptPreparationModal } from "./ManuscriptPreparationModal";
import { planObsidianManuscriptPreparation } from "./ObsidianManuscriptPreparation";

class ManuscriptRootModal extends SuggestModal<TFile | TFolder> {
  private settled = false;
  constructor(app: App, private readonly resolve: (selection: ManuscriptPreparationSelection | null) => void, private readonly folder?: TFolder) {
    super(app);
    this.setPlaceholder(folder ? "Choose this folder's existing Book root note" : "Choose a manuscript root note or folder");
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

export function reviewManuscriptPreparationSelection(app: App, selection: ManuscriptPreparationSelection): Promise<ManuscriptPreparationSelection | null> {
  return new Promise(resolve => {
    let book = buildSelectedManuscript(app, selection);
    const modal = new ManuscriptPreparationModal(app, planObsidianManuscriptPreparation(app, book),
      accepted => resolve(accepted ? selection : null), container => {
        container.createEl("p", { text: "Assets belong in vault-root Assets, outside the manuscript. A nested Assets folder and its resolved Markdown links will be reviewed for relocation. Support and unclassified notes start excluded. Exclusions use scene-draft for Codex Press; locked notes keep existing metadata." });
        const candidates = manuscriptPreparationCandidates(app, selection);
        const byPath = new Map(candidates.map(candidate => [candidate.file.path, candidate]));
        const orderedPaths = [selection.rootPath, ...book.result.entries.map(entry => entry.path), ...candidates.filter(candidate => !book.filesByPath.has(candidate.file.path)).map(candidate => candidate.file.path)];
        const entries = new Map(book.result.entries.map(entry => [entry.path, entry]));
        const list = container.createDiv();
        list.style.cssText = "max-height:50vh;overflow-y:auto";
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
          if (parent) row.createDiv({ cls: "mwc-muted", text: `Parent: ${parent} · Sibling position: ${position}` });
          checkbox.onchange = () => {
            const excluded = new Set(selection.excludedPaths);
            if (checkbox.checked) excluded.delete(path); else excluded.add(path);
            selection = { ...selection, excludedPaths: [...excluded].sort() };
            book = buildSelectedManuscript(app, selection);
            modal.updatePlan(planObsidianManuscriptPreparation(app, book));
          };
        }
      }, "Review structural changes");
    modal.open();
  });
}
