import { App, Modal } from "obsidian";

class StoryWorldSourceOfferModal extends Modal {
  private settled = false;
  constructor(app: App, private readonly label: string, private readonly reference: string, private readonly resolve: (accepted: boolean | null) => void) { super(app); }
  onOpen(): void {
    this.titleEl.setText("Add Story World source");
    this.contentEl.createEl("p", { text: this.label });
    this.contentEl.createEl("p", { text: `Write exactly ${this.reference}` });
    const actions = this.contentEl.createDiv("modal-button-container");
    actions.createEl("button", { text: "Cancel" }).onclick = () => this.finish(null);
    actions.createEl("button", { text: "Decline" }).onclick = () => this.finish(false);
    actions.createEl("button", { text: "Add source", cls: "mod-cta" }).onclick = () => this.finish(true);
  }
  onClose(): void { this.contentEl.empty(); if (!this.settled) this.resolve(null); }
  private finish(value: boolean | null): void { if (this.settled) return; this.settled = true; this.resolve(value); this.close(); }
}

export function confirmStoryWorldSource(app: App, label: string, reference: string): Promise<boolean | null> {
  return new Promise((resolve) => new StoryWorldSourceOfferModal(app, label, reference, resolve).open());
}
