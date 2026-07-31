import { Modal, Notice, Setting, TFile, normalizePath } from "obsidian";
import type MurmurationWritingCompanionEntry from "../entry";
import { saveContinuityReviewReport, ContinuityReviewReportDestinationExistsError } from "../companion/ContinuityReviewReportActions";
import { buildObsidianEntityIndexReport, entityIndexChoices } from "./ObsidianEntityIndexReport";

export class EntityIndexReportModal extends Modal {
  private bookPath: string;
  private reportScope: "book" | "vault" = "book";
  private readonly types = new Set<string>();
  private preview!: HTMLTextAreaElement;
  private summary!: HTMLElement;
  private pathInput!: HTMLInputElement;
  private pathEdited = false;
  private saving = false;
  private readonly generatedAt = new Date().toISOString();

  constructor(private readonly plugin: MurmurationWritingCompanionEntry) {
    super(plugin.app);
    const choices = entityIndexChoices(plugin.app, plugin.storyWorldIndex);
    this.bookPath = plugin.manuscriptBookSelection.get().bookPath ?? choices.books[0]?.file.path ?? "";
    for (const type of choices.entityTypes) this.types.add(type.toLowerCase());
  }

  onOpen(): void {
    this.titleEl.setText("Generate entity index");
    const choices = entityIndexChoices(this.app, this.plugin.storyWorldIndex);
    new Setting(this.contentEl).setName("Scope").setDesc("Index the selected Book or every recognised Book in the vault.").addDropdown((dropdown) => {
      dropdown.addOption("book", "Book"); dropdown.addOption("vault", "Vault");
      dropdown.onChange((value) => { this.reportScope = value === "vault" ? "vault" : "book"; this.pathEdited = false; this.render(); });
    });
    new Setting(this.contentEl).setName("Book").setDesc("Used when scope is Book.").addDropdown((dropdown) => {
      for (const book of choices.books) dropdown.addOption(book.file.path, book.record.title);
      dropdown.setValue(this.bookPath).onChange((value) => { this.bookPath = value; this.pathEdited = false; this.render(); });
    });
    const categories = this.contentEl.createDiv();
    categories.createEl("h3", { text: "Entity categories" });
    for (const type of choices.entityTypes) new Setting(categories).setName(type).addToggle((toggle) => toggle.setValue(true).onChange((included) => {
      if (included) this.types.add(type.toLowerCase()); else this.types.delete(type.toLowerCase()); this.render();
    }));
    new Setting(this.contentEl).setName("Destination note").setDesc("Existing notes are never overwritten.").addText((text) => {
      this.pathInput = text.inputEl; text.onChange(() => { this.pathEdited = true; });
    });
    this.summary = this.contentEl.createEl("p", { cls: "mwc-muted" });
    this.preview = this.contentEl.createEl("textarea", { cls: "mwc-continuity-report-preview", attr: { readonly: "", "aria-label": "Entity index Markdown preview", spellcheck: "false" } });
    const actions = this.contentEl.createDiv("modal-button-container");
    actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).onclick = () => this.close();
    actions.createEl("button", { text: "Save new note", cls: "mod-cta", attr: { type: "button" } }).onclick = () => void this.save();
    this.render();
  }

  private draft() {
    const choices = entityIndexChoices(this.app, this.plugin.storyWorldIndex);
    const book = choices.books.find((candidate) => candidate.file.path === this.bookPath);
    return this.reportScope === "vault" || book ? buildObsidianEntityIndexReport({ app: this.app, index: this.plugin.storyWorldIndex, scope: this.reportScope, book, includedTypes: this.types, generatedAt: this.generatedAt }) : null;
  }

  private render(): void {
    if (!this.preview) return;
    const draft = this.draft();
    this.preview.value = draft?.markdown ?? "No recognised Book is available.";
    this.summary.setText(draft ? `${draft.entryCount} entries · ${draft.occurrenceCount} Scene occurrences · ${draft.diagnostics.orphanEntities} entities omitted without an occurrence` : "0 entries");
    if (draft && !this.pathEdited) this.pathInput.value = draft.filename;
  }

  private async save(): Promise<void> {
    if (this.saving) return;
    const draft = this.draft();
    const raw = this.pathInput.value.trim();
    if (!draft || !raw) return;
    const path = normalizePath(raw.toLowerCase().endsWith(".md") ? raw : `${raw}.md`);
    this.saving = true;
    try {
      const created = await saveContinuityReviewReport({ exists: (candidate) => Boolean(this.app.vault.getAbstractFileByPath(candidate)), create: (candidate, markdown) => this.app.vault.create(candidate, markdown) }, path, draft.markdown);
      if (!(created instanceof TFile)) throw new Error("The vault did not return the created note.");
      this.close(); await this.app.workspace.getLeaf(false).openFile(created, { active: true }); new Notice(`Entity index saved to ${path}.`);
    } catch (error) {
      new Notice(error instanceof ContinuityReviewReportDestinationExistsError ? error.message : `Could not save the entity index: ${error instanceof Error ? error.message : String(error)}`);
      this.saving = false;
    }
  }
}
