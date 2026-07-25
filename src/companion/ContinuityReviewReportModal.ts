import { Modal, Notice, Setting, TFile, normalizePath } from "obsidian";
import type MurmurationWritingCompanionEntry from "../entry";
import type { ContinuityReviewReportChoices, ContinuityReviewReportDraft } from "./ContinuityReviewReport";
import {
  ContinuityReviewReportDestinationExistsError,
  copyContinuityReviewReport,
  saveContinuityReviewReport
} from "./ContinuityReviewReportActions";

export class ContinuityReviewReportModal extends Modal {
  private reportScope: "book" | "filtered" = "book";
  private path = "";
  private pathEdited = false;
  private preview!: HTMLTextAreaElement;
  private pathInput!: HTMLInputElement;
  private destination!: HTMLElement;
  private saveButton!: HTMLButtonElement;
  private saving = false;

  constructor(
    private readonly plugin: MurmurationWritingCompanionEntry,
    private readonly choices: ContinuityReviewReportChoices
  ) { super(plugin.app); }

  onOpen(): void {
    this.titleEl.setText("Generate Continuity Review report");
    this.modalEl.addClass("mwc-continuity-report-modal");
    this.path = this.choices.book.filename;
    new Setting(this.contentEl).setName("Report scope").setDesc("Preview the whole selected Book or exactly the currently visible review set.").addDropdown((dropdown) => {
      dropdown.addOption("book", "Entire selected Book");
      dropdown.addOption("filtered", "Current filtered result set");
      dropdown.onChange((value) => {
        this.reportScope = value === "filtered" ? "filtered" : "book";
        if (!this.pathEdited) this.path = this.currentDraft().filename;
        if (this.pathInput) this.pathInput.value = this.path;
        this.render();
      });
    });
    const destinationSetting = new Setting(this.contentEl).setName("Destination note").setDesc("Choose a new Markdown path. Existing notes are never overwritten.").addText((text) => {
      this.pathInput = text.inputEl;
      text.setValue(this.path).setPlaceholder("Continuity Review.md").onChange((value) => {
        this.pathEdited = true; this.path = value; this.renderDestination();
      });
    });
    this.destination = destinationSetting.settingEl;
    this.contentEl.createEl("p", { cls: "mwc-muted", text: "The preview below is the exact Markdown that will be copied or saved." });
    this.preview = this.contentEl.createEl("textarea", {
      cls: "mwc-continuity-report-preview",
      attr: { readonly: "", "aria-label": "Continuity Review report Markdown preview", spellcheck: "false" }
    });
    const actions = this.contentEl.createDiv("modal-button-container");
    actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).onclick = () => { if (!this.saving) this.close(); };
    const copy = actions.createEl("button", { text: "Copy Markdown", attr: { type: "button" } });
    copy.onclick = () => void this.copy();
    this.saveButton = actions.createEl("button", { text: "Save new note", cls: "mod-cta", attr: { type: "button" } });
    this.saveButton.onclick = () => void this.save();
    this.render();
  }

  private currentDraft(): ContinuityReviewReportDraft { return this.choices[this.reportScope]; }

  private normalizedPath(): string {
    const raw = this.path.trim();
    if (!raw) return "";
    return normalizePath(raw.toLowerCase().endsWith(".md") ? raw : `${raw}.md`);
  }

  private render(): void {
    if (!this.preview) return;
    this.preview.value = this.currentDraft().markdown;
    this.renderDestination();
  }

  private renderDestination(): void {
    if (!this.destination || !this.saveButton) return;
    this.destination.querySelector(".mwc-continuity-report-destination-status")?.remove();
    const path = this.normalizedPath();
    const existing = path ? this.app.vault.getAbstractFileByPath(path) : null;
    const status = this.destination.createDiv("mwc-continuity-report-destination-status");
    status.setText(!path ? "Enter a destination path." : existing ? "A note already exists at this path. Choose another filename." : `New note: ${path}`);
    if (existing) status.addClass("mod-warning");
    this.saveButton.disabled = this.saving || !path || Boolean(existing);
  }

  private async copy(): Promise<void> {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await copyContinuityReviewReport(navigator.clipboard, this.currentDraft().markdown);
      new Notice("Continuity Review report copied.");
    } catch {
      new Notice("Could not copy the report to the clipboard.");
    }
  }

  private async save(): Promise<void> {
    const path = this.normalizedPath();
    if (!path || this.saving) return;
    this.saving = true; this.renderDestination();
    try {
      const created = await saveContinuityReviewReport({
        exists: (candidate) => Boolean(this.app.vault.getAbstractFileByPath(candidate)),
        create: (candidate, markdown) => this.app.vault.create(candidate, markdown)
      }, path, this.currentDraft().markdown);
      if (!(created instanceof TFile)) throw new Error("The vault did not return the created note.");
      this.close();
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(created, { active: true });
      await this.app.workspace.revealLeaf(leaf);
      new Notice(`Continuity Review report saved to ${path}.`);
    } catch (error) {
      const message = error instanceof ContinuityReviewReportDestinationExistsError
        ? error.message
        : `Could not save the Continuity Review report: ${error instanceof Error ? error.message : String(error)}`;
      new Notice(message);
      this.saving = false; this.renderDestination();
    }
  }
}
