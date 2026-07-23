import { Modal, Notice, Setting, TFile } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { formatNavigatorStoryDate } from "./ManuscriptMetadata";
import {
  defaultManuscriptSceneParent,
  manuscriptSceneDefaultPath,
  manuscriptScenePlacements,
  ManuscriptSceneCreationPlan,
  planManuscriptSceneCreation
} from "./ManuscriptSceneCreation";
import { createObsidianManuscriptScene, snapshotManuscriptSceneCreation, StaleManuscriptSceneCreationError } from "./ObsidianManuscriptSceneCreation";

export interface ManuscriptSceneCreationHost extends MurmurationWritingCompanionPlugin {
  refreshManuscriptNavigator(): void;
  revealManuscriptPath(path: string): void;
}

export class ManuscriptSceneCreationModal extends Modal {
  private title = "";
  private path = "";
  private pathEdited = false;
  private parentPath = "";
  private placementId = "start";
  private acceptDate = false;
  private preview!: HTMLElement;
  private createButton!: HTMLButtonElement;
  private pathInput: HTMLInputElement | null = null;
  private positionSetting: Setting | null = null;
  private dateSetting: Setting | null = null;
  private creating = false;

  constructor(private readonly plugin: ManuscriptSceneCreationHost) { super(plugin.app); }

  onOpen(): void {
    const initial = snapshotManuscriptSceneCreation(this.plugin);
    this.parentPath = defaultManuscriptSceneParent(initial);
    this.titleEl.setText(`Create Scene in ${initial.parents.find((parent) => parent.path === this.parentPath)?.title ?? "selected manuscript"}`);
    new Setting(this.contentEl).setName("Scene title").addText((text) => {
      text.setPlaceholder("Scene title").onChange((value) => {
        this.title = value;
        if (!this.pathEdited) this.path = manuscriptSceneDefaultPath(snapshotManuscriptSceneCreation(this.plugin), this.parentPath, value).path;
        if (this.pathInput) this.pathInput.value = this.path;
        this.renderPreview();
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    new Setting(this.contentEl).setName("Target parent").setDesc("parent establishes manuscript containment; changing this does not change Book scope.").addDropdown((dropdown) => {
      for (const parent of initial.parents) dropdown.addOption(parent.path, `${parent.title} — ${parent.kind === "book" ? "Book" : "Part"}`);
      dropdown.setValue(this.parentPath).onChange((value) => {
        this.parentPath = value; this.placementId = "start"; this.acceptDate = false;
        if (!this.pathEdited) this.path = manuscriptSceneDefaultPath(snapshotManuscriptSceneCreation(this.plugin), value, this.title).path;
        if (this.pathInput) this.pathInput.value = this.path;
        this.rebuildPosition(); this.renderPreview();
      });
    });
    new Setting(this.contentEl).setName("Note location").setDesc("Filesystem organisation only; it does not establish containment or order.").addText((text) => {
      this.pathInput = text.inputEl; text.setValue(this.path).setPlaceholder("Scene title.md").onChange((value) => { this.pathEdited = true; this.path = value; this.renderPreview(); });
    });
    this.positionSetting = new Setting(this.contentEl);
    this.rebuildPosition();
    this.dateSetting = new Setting(this.contentEl);
    this.preview = this.contentEl.createDiv("mwc-manuscript-book-create-preview");
    const actions = this.contentEl.createDiv("modal-button-container");
    actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).onclick = () => { if (!this.creating) this.close(); };
    this.createButton = actions.createEl("button", { text: "Create scene", cls: "mod-cta", attr: { type: "button" } });
    this.createButton.onclick = () => void this.createScene();
    this.renderPreview();
  }

  private rebuildPosition(): void {
    if (!this.positionSetting) return;
    this.positionSetting.clear().setName("Position").setDesc("Authoritative position among the parent's direct children.").addDropdown((dropdown) => {
      for (const placement of manuscriptScenePlacements(snapshotManuscriptSceneCreation(this.plugin), this.parentPath)) dropdown.addOption(placement.id, placement.label);
      dropdown.setValue(this.placementId).onChange((value) => { this.placementId = value; this.acceptDate = false; this.renderPreview(); });
    });
  }

  private currentPlan(): ManuscriptSceneCreationPlan {
    return planManuscriptSceneCreation(snapshotManuscriptSceneCreation(this.plugin), { title: this.title, path: this.path, parentPath: this.parentPath, placementId: this.placementId, acceptDate: this.acceptDate });
  }

  private renderPreview(): void {
    if (!this.preview || !this.createButton) return;
    let plan = this.currentPlan();
    if (this.dateSetting) {
      this.dateSetting.clear();
      if (plan.dateProposal) {
        const readable = formatNavigatorStoryDate(plan.dateProposal.value) ?? plan.dateProposal.value;
        this.dateSetting.setName(`Use preceding story date: ${readable}`).setDesc(`From: ${plan.dateProposal.sourceTitle}`).addToggle((toggle) => toggle.setValue(this.acceptDate).setTooltip(`Use preceding story date: ${readable}`).onChange((value) => { this.acceptDate = value; this.renderPreview(); }));
      } else this.dateSetting.setName("Preceding story date").setDesc("No supported preceding explicit story date is available.");
      plan = this.currentPlan();
    }
    this.preview.empty(); this.preview.createEl("h3", { text: "Creation preview" });
    const details = this.preview.createEl("dl");
    const row = (label: string, value: string) => { const item = details.createDiv("mwc-manuscript-book-create-preview-row"); item.createEl("dt", { text: label }); item.createEl("dd", { text: value }); };
    row("Book scope", plan.bookTitle); row("Target parent", `${plan.parentTitle} — ${plan.parentKind === "book" ? "Book" : "Part"}`);
    row("Filesystem location", plan.path || "—"); row("Parent authority", plan.parentReference || "—"); row("Manuscript position", plan.placementLabel);
    row("Previous", plan.previous ? `${plan.previous.title} — ${plan.previous.kind === "part" ? "Part" : "Scene"}` : "None");
    row("Next", plan.next ? `${plan.next.title} — ${plan.next.kind === "part" ? "Part" : "Scene"}` : "None");
    row("Order key", plan.orderKey || "—"); row("Folders to create", plan.missingFolders.length ? plan.missingFolders.join(" · ") : "None");
    if (plan.dateProposal) row("Story date", plan.acceptDate ? `${plan.dateProposal.value} — accepted from ${plan.dateProposal.sourceTitle}` : `${plan.dateProposal.value} — not accepted`);
    row("Structural effect", "One Scene note; existing notes remain unchanged");
    this.preview.createEl("p", { cls: "mwc-muted", text: "Location organises the file. parent establishes containment. manuscript_order_key establishes reading order." });
    this.preview.createEl("h4", { text: "Exact Markdown" }); this.preview.createEl("pre").createEl("code", { text: plan.markdown || "—" });
    if (plan.errors.length) { const list = this.preview.createEl("ul", { cls: "mwc-manuscript-book-create-errors", attr: { role: "alert" } }); for (const error of plan.errors) list.createEl("li", { text: error }); }
    this.createButton.disabled = this.creating || plan.errors.length > 0;
  }

  private async openNote(file: TFile): Promise<void> { const leaf = this.app.workspace.getLeaf(false); await leaf.openFile(file, { active: true }); await this.app.workspace.revealLeaf(leaf); }
  private async showPreserved(file: TFile, message: string): Promise<void> {
    this.preview.empty(); this.preview.createEl("p", { text: message });
    this.preview.createEl("button", { text: "Open note", attr: { type: "button" } }).onclick = () => void this.openNote(file).catch(() => new Notice(`The Scene was created at ${file.path}, but it could not be opened.`));
    this.createButton.textContent = "Close"; this.createButton.disabled = false; this.createButton.onclick = () => this.close();
  }

  private async createScene(): Promise<void> {
    if (this.creating) return;
    const preview = this.currentPlan(); if (preview.errors.length) return;
    this.creating = true; this.renderPreview();
    try {
      const result = await createObsidianManuscriptScene(this.plugin, preview);
      if (result.status !== "recognised") {
        await this.showPreserved(result.file, result.status === "recognition-delayed"
          ? "The Scene note was created and verified, but manuscript recognition is still updating. The note has been preserved."
          : "The Scene note was created and verified, but its projected parent, position or date did not match the preview. The note has been preserved for inspection.");
        return;
      }
      this.plugin.manuscriptBookSelection.select(result.plan.bookPath, result.file.path, "manuscript-navigator");
      this.plugin.revealManuscriptPath(result.file.path); this.plugin.refreshManuscriptNavigator(); this.close();
      try { await this.openNote(result.file); } catch { new Notice(`The Scene was created and selected at ${result.file.path}, but it could not be opened. Writing Companion will follow when the note is opened.`); }
    } catch (error) {
      new Notice(error instanceof StaleManuscriptSceneCreationError ? error.message : `Could not create the Scene: ${error instanceof Error ? error.message : String(error)}`);
      this.creating = false; this.renderPreview();
    }
  }
}
