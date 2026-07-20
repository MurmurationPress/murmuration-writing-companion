import { App, Modal } from "obsidian";
import type { PovCharacterCreationProposal } from "./PovCharacterCreation";

class PovCharacterCreationModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly proposal: PovCharacterCreationProposal,
    private readonly resolve: (accepted: boolean) => void
  ) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText("Create Story World character");
    this.contentEl.createEl("p", {
      text: `Create “${this.proposal.name}” as a minimal Story World character?`
    });

    const details = this.contentEl.createEl("dl", {
      cls: "mwc-pov-character-preview"
    });
    const addDetail = (label: string, value: string) => {
      const row = details.createDiv("mwc-pov-character-preview-row");
      row.createEl("dt", { text: label });
      row.createEl("dd", { text: value });
    };

    addDetail("Name", this.proposal.name);
    addDetail("Note", this.proposal.path);
    addDetail(
      "Scope",
      this.proposal.scope.length > 0
        ? this.proposal.scope.join(" · ")
        : "Unscoped"
    );

    this.contentEl.createEl("p", {
      cls: "mwc-muted",
      text: "The note will contain only identity, scope and an editable placeholder. The existing POV remains unchanged if creation is cancelled or fails."
    });

    const actions = this.contentEl.createDiv("mwc-pov-character-modal-actions");
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.finish(false);
    const create = actions.createEl("button", {
      text: "Create character",
      cls: "mod-cta"
    });
    create.onclick = () => this.finish(true);
    window.setTimeout(() => create.focus(), 0);
  }

  onClose() {
    this.contentEl.empty();
    if (!this.settled) this.resolve(false);
  }

  private finish(accepted: boolean) {
    if (this.settled) return;
    this.settled = true;
    this.resolve(accepted);
    this.close();
  }
}

export function confirmPovCharacterCreation(
  app: App,
  proposal: PovCharacterCreationProposal
): Promise<boolean> {
  return new Promise((resolve) => {
    new PovCharacterCreationModal(app, proposal, resolve).open();
  });
}
