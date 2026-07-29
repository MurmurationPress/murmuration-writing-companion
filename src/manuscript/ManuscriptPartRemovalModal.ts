import { Modal, Notice } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { manuscriptPartRemovalConfirmation, ManuscriptPartRemovalPlan } from "./ManuscriptPartRemoval";
import { removeObsidianManuscriptPart } from "./ObsidianManuscriptPartRemoval";

export class ManuscriptPartRemovalModal extends Modal {
  private settled = false;
  private running = false;

  constructor(
    private readonly plugin: MurmurationWritingCompanionPlugin,
    private readonly plan: ManuscriptPartRemovalPlan
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.titleEl.setText("Remove Part");
    this.contentEl.createEl("p", { text: manuscriptPartRemovalConfirmation(this.plan) });
    this.contentEl.createEl("p", {
      cls: "mwc-muted",
      text: "This is available only for an empty authoritative Part. The remaining manuscript order is not rewritten."
    });
    const actions = this.contentEl.createDiv("modal-button-container");
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.onclick = () => this.finish(false);
    const remove = actions.createEl("button", { text: "Move Part to trash", cls: "mod-warning", attr: { type: "button" } });
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
      await removeObsidianManuscriptPart(this.plugin, this.plan);
      this.settled = true;
      new Notice(`“${this.plan.title}” moved to Obsidian trash.`);
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Could not remove the Part.");
      this.running = false; remove.disabled = false; cancel.disabled = false;
    }
  }
}
