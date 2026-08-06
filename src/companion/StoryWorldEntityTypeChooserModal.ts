import { App, Modal, Setting } from "obsidian";
import { STORY_WORLD_ENTITY_KINDS, StoryWorldEntityKind } from "../story-world/StoryWorldEntityCreation";

export type UnresolvedLinkDecision =
  | { readonly action: "create"; readonly kind: StoryWorldEntityKind }
  | { readonly action: "existing" }
  | { readonly action: "unresolved" };

class StoryWorldEntityTypeChooserModal extends Modal {
  private settled = false;
  private kind: StoryWorldEntityKind | null = null;

  constructor(
    app: App,
    private readonly name: string,
    private readonly existingName: string | null,
    private readonly resolve: (decision: UnresolvedLinkDecision | null) => void
  ) { super(app); }

  onOpen(): void {
    this.titleEl.setText("Story World reference");
    this.contentEl.createEl("p", { text: `“${this.name}” is unresolved in the vault.` });
    if (this.existingName) {
      this.contentEl.createEl("p", { text: `It matches the indexed entity “${this.existingName}” by canonical name or alias.` });
      new Setting(this.contentEl).setName("Use matching entity").addButton((button) => button
        .setButtonText("Use existing entity")
        .onClick(() => this.finish({ action: "existing" })));
    }
    new Setting(this.contentEl).setName("Create Story World entity").addDropdown((dropdown) => {
      dropdown.addOption("", "Choose entity type…");
      for (const kind of STORY_WORLD_ENTITY_KINDS) dropdown.addOption(kind, kind[0].toUpperCase() + kind.slice(1));
      dropdown.setValue("");
      dropdown.onChange((value) => { this.kind = value ? value as StoryWorldEntityKind : null; create.disabled = !this.kind; });
    });
    const actions = this.contentEl.createDiv("modal-button-container");
    actions.createEl("button", { text: "Cancel" }).onclick = () => this.finish(null);
    actions.createEl("button", { text: "Keep unresolved" }).onclick = () => this.finish({ action: "unresolved" });
    const create = actions.createEl("button", { text: "Continue", cls: "mod-cta" });
    create.disabled = true;
    create.onclick = () => { if (this.kind) this.finish({ action: "create", kind: this.kind }); };
  }

  onClose(): void { this.contentEl.empty(); if (!this.settled) this.resolve(null); }
  private finish(decision: UnresolvedLinkDecision | null): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(decision);
    this.close();
  }
}

export function chooseStoryWorldEntityType(app: App, name: string, existingName: string | null): Promise<UnresolvedLinkDecision | null> {
  return new Promise((resolve) => new StoryWorldEntityTypeChooserModal(app, name, existingName, resolve).open());
}
