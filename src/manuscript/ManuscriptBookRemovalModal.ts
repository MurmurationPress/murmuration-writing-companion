import { Modal, Notice } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { manuscriptBookRemovalConfirmation, ManuscriptBookRemovalPlan } from "./ManuscriptBookRemoval";
import { removeObsidianManuscriptBook } from "./ObsidianManuscriptBookRemoval";

export class ManuscriptBookRemovalModal extends Modal {
  private settled = false;
  private running = false;

  constructor(
    private readonly plugin: MurmurationWritingCompanionPlugin,
    private readonly plan: ManuscriptBookRemovalPlan
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.titleEl.setText("Remove Book");
    this.contentEl.createEl("p", { text: manuscriptBookRemovalConfirmation(this.plan) });
    this.contentEl.createEl("p", {
      cls: "mwc-muted",
      text: "This is available only for an empty authoritative Book. Manuscript structure and ordering are not rewritten."
    });
    const actions = this.contentEl.createDiv("modal-button-container");
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.onclick = () => this.finish(false);
    const remove = actions.createEl("button", { text: "Move Book to trash", cls: "mod-warning", attr: { type: "button" } });
    remove.onclick = () => void this.remove(remove, cancel);
    window.setTimeout(() => remove.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private finish(accepted: boolean): void {
    if (this.settled || this.running) return;
    this.settled = true;
    if (!accepted) this.close();
  }

  private async remove(remove: HTMLButtonElement, cancel: HTMLButtonElement): Promise<void> {
    if (this.running || this.settled) return;
    this.running = true; remove.disabled = true; cancel.disabled = true;
    try {
      await removeObsidianManuscriptBook(this.plugin, this.plan);
      this.settled = true;
      new Notice(`“${this.plan.title}” moved to Obsidian trash.`);
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Could not remove the Book.");
      this.running = false; remove.disabled = false; cancel.disabled = false;
    }
  }
}
