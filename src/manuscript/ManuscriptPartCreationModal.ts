import { Modal, Notice, Setting, TFile } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { manuscriptDefaultPath } from "./ManuscriptNoteCreation";
import { manuscriptPartDefaultFolder, manuscriptPartPlacements, ManuscriptPartCreationPlan, planManuscriptPartCreation } from "./ManuscriptPartCreation";
import { createObsidianManuscriptPart, snapshotManuscriptPartCreation, StaleManuscriptPartCreationError } from "./ObsidianManuscriptPartCreation";

export interface ManuscriptPartCreationHost extends MurmurationWritingCompanionPlugin {
  refreshManuscriptNavigator(): void;
  revealManuscriptPath(path: string): void;
}

export class ManuscriptPartCreationModal extends Modal {
  private title = "";
  private path = "";
  private pathEdited = false;
  private placementId = "start";
  private preview!: HTMLElement;
  private createButton!: HTMLButtonElement;
  private pathInput: HTMLInputElement | null = null;
  private creating = false;

  constructor(private readonly plugin: ManuscriptPartCreationHost) { super(plugin.app); }

  onOpen(): void {
    const initial = snapshotManuscriptPartCreation(this.plugin);
    this.titleEl.setText(`Create Part in ${initial.book?.title ?? "selected Book"}`);
    const folder = manuscriptPartDefaultFolder(initial);
    new Setting(this.contentEl).setName("Part title").addText((text) => {
      text.setPlaceholder("Part title").onChange((value) => {
        this.title = value;
        if (!this.pathEdited) this.path = manuscriptDefaultPath(folder, value).path;
        if (this.pathInput) this.pathInput.value = this.path;
        this.renderPreview();
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    new Setting(this.contentEl).setName("Note location").setDesc("Filesystem organisation only; it does not establish manuscript containment or order.").addText((text) => {
      this.pathInput = text.inputEl;
      text.setPlaceholder(folder ? `${folder}/Part title.md` : "Part title.md").onChange((value) => {
        this.pathEdited = true; this.path = value; this.renderPreview();
      });
    });
    new Setting(this.contentEl).setName("Position").setDesc("Authoritative position among the selected Book's direct children.").addDropdown((dropdown) => {
      for (const placement of manuscriptPartPlacements(initial.directChildren)) dropdown.addOption(placement.id, placement.label);
      dropdown.setValue(this.placementId).onChange((value) => { this.placementId = value; this.renderPreview(); });
    });
    this.preview = this.contentEl.createDiv("mwc-manuscript-book-create-preview");
    const actions = this.contentEl.createDiv("modal-button-container");
    actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).onclick = () => { if (!this.creating) this.close(); };
    this.createButton = actions.createEl("button", { text: "Create part", cls: "mod-cta", attr: { type: "button" } });
    this.createButton.onclick = () => void this.createPart();
    this.renderPreview();
  }

  private currentPlan(): ManuscriptPartCreationPlan {
    return planManuscriptPartCreation(snapshotManuscriptPartCreation(this.plugin), { title: this.title, path: this.path, placementId: this.placementId });
  }

  private renderPreview(): void {
    if (!this.preview || !this.createButton) return;
    const plan = this.currentPlan();
    this.preview.empty();
    this.preview.createEl("h3", { text: "Creation preview" });
    const details = this.preview.createEl("dl");
    const row = (label: string, value: string) => { const item = details.createDiv("mwc-manuscript-book-create-preview-row"); item.createEl("dt", { text: label }); item.createEl("dd", { text: value }); };
    row("Target Book", plan.bookTitle);
    row("Filesystem location", plan.path || "—");
    row("Parent authority", plan.parentReference || "—");
    row("Manuscript position", plan.placementLabel);
    row("Previous", plan.previous ? `${plan.previous.title} — ${plan.previous.kind === "part" ? "Part" : "Scene"}` : "None");
    row("Next", plan.next ? `${plan.next.title} — ${plan.next.kind === "part" ? "Part" : "Scene"}` : "None");
    row("Order key", plan.orderKey || "—");
    row("Folders to create", plan.missingFolders.length ? plan.missingFolders.join(" · ") : "None");
    const suggestion = manuscriptDefaultPath("", this.title);
    const filenameTitle = (plan.path.split("/").pop() ?? "").replace(/\.md$/i, "");
    if (plan.title && filenameTitle !== plan.title) {
      this.preview.createEl("p", {
        cls: "mwc-muted",
        text: suggestion.explanation
          ? `The filename differs from the Part title because ${suggestion.explanation}. The title itself is unchanged.`
          : "The filename differs from the author-visible Part title. The title itself is unchanged."
      });
    }
    this.preview.createEl("p", { cls: "mwc-muted", text: "Location organises the file. parent establishes containment. manuscript_order_key establishes reading order. No existing child will be moved or changed." });
    this.preview.createEl("h4", { text: "Exact Markdown" });
    this.preview.createEl("pre").createEl("code", { text: plan.markdown || "—" });
    if (plan.errors.length) { const list = this.preview.createEl("ul", { cls: "mwc-manuscript-book-create-errors", attr: { role: "alert" } }); for (const error of plan.errors) list.createEl("li", { text: error }); }
    this.createButton.disabled = this.creating || plan.errors.length > 0;
  }

  private async openNote(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false); await leaf.openFile(file, { active: true }); await this.app.workspace.revealLeaf(leaf);
  }

  private async showPreserved(file: TFile, message: string): Promise<void> {
    this.preview.empty(); this.preview.createEl("p", { text: message });
    this.preview.createEl("button", { text: "Open note", attr: { type: "button" } }).onclick = () => void this.openNote(file).catch(() => new Notice(`The Part was created at ${file.path}, but it could not be opened.`));
    this.createButton.textContent = "Close"; this.createButton.disabled = false; this.createButton.onclick = () => this.close();
  }

  private async createPart(): Promise<void> {
    if (this.creating) return;
    const preview = this.currentPlan(); if (preview.errors.length) return;
    this.creating = true; this.renderPreview();
    try {
      const result = await createObsidianManuscriptPart(this.plugin, preview);
      if (result.status !== "recognised") {
        await this.showPreserved(result.file, result.status === "recognition-delayed"
          ? "The Part note was created and verified, but manuscript recognition is still updating. The note has been preserved."
          : "The Part note was created and verified, but its projected parent or position did not match the preview. The note has been preserved for inspection.");
        return;
      }
      this.plugin.manuscriptBookSelection.select(result.plan.bookPath, result.file.path, "manuscript-navigator");
      this.plugin.revealManuscriptPath(result.file.path);
      this.plugin.refreshManuscriptNavigator();
      this.close();
      try { await this.openNote(result.file); } catch { new Notice(`The Part was created and selected at ${result.file.path}, but it could not be opened.`); }
    } catch (error) {
      new Notice(error instanceof StaleManuscriptPartCreationError ? error.message : `Could not create the Part: ${error instanceof Error ? error.message : String(error)}`);
      this.creating = false; this.renderPreview();
    }
  }
}
