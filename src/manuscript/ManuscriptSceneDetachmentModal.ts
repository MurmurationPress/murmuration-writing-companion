import { Modal, Notice, TFile } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import {
  detachObsidianManuscriptScene,
  planObsidianManuscriptSceneDetachment
} from "./ObsidianManuscriptSceneDetachment";
import type { ManuscriptSceneDetachmentPlan } from "./ManuscriptSceneDetachment";

export class ManuscriptSceneDetachmentModal extends Modal {
  private running = false;
  private plan: ManuscriptSceneDetachmentPlan | null = null;
  private confirmButton: HTMLButtonElement | null = null;

  constructor(
    private readonly plugin: MurmurationWritingCompanionPlugin,
    private readonly scenePath: string,
    private readonly bookPath: string,
    private readonly onComplete: (fallbackPath: string) => void
  ) { super(plugin.app); }

  onOpen(): void {
    this.titleEl.setText("Remove from manuscript");
    this.titleEl.tabIndex = -1;
    this.contentEl.createEl("p", { text: "Preparing the exact metadata preview…" });
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.plan = await planObsidianManuscriptSceneDetachment(this.plugin, this.scenePath, this.bookPath);
      this.render();
    } catch (error) {
      this.contentEl.empty();
      this.contentEl.createEl("p", { attr: { role: "alert" }, text: error instanceof Error ? error.message : String(error) });
    }
  }

  private render(): void {
    const plan = this.plan;
    if (!plan) return;
    this.contentEl.empty();
    this.contentEl.addClass("mwc-manuscript-detachment-modal");
    this.contentEl.createEl("p", { text: `Remove “${plan.title}” from ${plan.bookTitle}?` });
    this.contentEl.createEl("p", { text: "The Markdown file and prose will remain in the vault." });
    const details = this.contentEl.createEl("dl", { cls: "mwc-manuscript-book-create-preview" });
    const row = (label: string, value: string) => {
      const item = details.createDiv("mwc-manuscript-book-create-preview-row");
      item.createEl("dt", { text: label }); item.createEl("dd", { text: value });
    };
    row("Scene", plan.title);
    row("Owning Book", plan.bookTitle);
    row("Current parent", `${plan.parentTitle} — ${plan.parentKind === "part" ? "Part" : "Book"}`);
    row("Book-wide position", `${plan.bookPosition}`);
    row("Sibling position", `${plan.siblingPosition} of ${plan.siblingCount}`);
    row("Preserved note path", plan.path);

    this.contentEl.createEl("h3", { text: "Changed" });
    const changed = this.contentEl.createEl("ul");
    for (const change of plan.changes) {
      const before = JSON.stringify(change.before) ?? "missing";
      const after = change.action === "replace" ? JSON.stringify(change.after) : "removed";
      changed.createEl("li", { text: `${change.property}: ${before} → ${after}` });
    }

    this.contentEl.createEl("h3", { text: "Preserved" });
    const preserved = this.contentEl.createEl("ul");
    for (const value of ["title", "story date", "POV", "status", "world_context", "unknown YAML", "prose", "annotations", "editorial notes"]) {
      preserved.createEl("li", { text: value });
    }
    this.contentEl.createEl("p", {
      cls: "mwc-muted",
      text: "Obsidian may reserialize YAML layout, property ordering or comments. Unrelated values and the Markdown body are preserved. No file is deleted, moved, trashed or archived."
    });
    if (plan.errors.length > 0) {
      const errors = this.contentEl.createEl("ul", { attr: { role: "alert" } });
      for (const error of plan.errors) errors.createEl("li", { text: error });
    }

    const actions = this.contentEl.createDiv("modal-button-container");
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.onclick = () => { if (!this.running) this.close(); };
    this.confirmButton = actions.createEl("button", {
      text: "Remove from manuscript",
      cls: "mod-warning",
      attr: { type: "button" }
    });
    this.confirmButton.disabled = plan.errors.length > 0;
    this.confirmButton.onclick = () => void this.detach();
    window.setTimeout(() => this.titleEl.focus(), 0);
  }

  private async detach(): Promise<void> {
    if (this.running || !this.plan || this.plan.errors.length > 0) return;
    this.running = true;
    if (this.confirmButton) this.confirmButton.disabled = true;
    try {
      const result = await detachObsidianManuscriptScene(this.plugin, this.plan);
      this.plugin.manuscriptBookSelection.select(this.plan.bookPath, result.fallbackPath, "manuscript-navigator");
      this.plugin.refreshManuscriptBookAfterStructuralChange(this.plan.bookPath);
      this.onComplete(result.fallbackPath);
      if (result.status === "detached") {
        new Notice(`“${this.plan.title}” was removed from the manuscript. The note remains at ${result.file.path}.`);
        this.close();
        return;
      }
      this.contentEl.empty();
      this.contentEl.createEl("p", { attr: { role: "status" }, text: result.status === "recognition-delayed"
        ? "The note was detached and preserved, but manuscript structure is still updating."
        : "The note was detached and preserved, but manuscript projection could not verify the change." });
      this.contentEl.createEl("button", { text: "Open note", attr: { type: "button" } }).onclick = () => void this.openNote(result.file);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : `Could not remove the Scene: ${String(error)}`);
      this.running = false;
      if (this.confirmButton) this.confirmButton.disabled = false;
    }
  }

  private async openNote(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, { active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
}
