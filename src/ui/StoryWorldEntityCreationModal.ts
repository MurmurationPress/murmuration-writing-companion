import { Modal, Notice, Setting, TFile, normalizePath } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { storyWorldBuilderItems, StoryWorldBuilderDocument } from "../story-world/WorldBuilder";
import {
  findStoryWorldCreationCollision,
  planStoryWorldEntityCreation,
  STORY_WORLD_ENTITY_KINDS,
  StoryWorldEntityKind
} from "../story-world/StoryWorldEntityCreation";

function documents(plugin: MurmurationWritingCompanionPlugin): StoryWorldBuilderDocument[] {
  return plugin.app.vault.getMarkdownFiles().map((file) => ({
    path: file.path,
    basename: file.basename,
    frontmatter: plugin.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined
  }));
}

async function ensureFolder(plugin: MurmurationWritingCompanionPlugin, folder: string): Promise<void> {
  const parts = normalizePath(folder).split("/");
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!plugin.app.vault.getAbstractFileByPath(current)) await plugin.app.vault.createFolder(current);
  }
}

export class StoryWorldEntityCreationModal extends Modal {
  private kind: StoryWorldEntityKind = "character";
  private customKind = "";
  private name = "";
  private scope = "";
  private preview!: HTMLElement;
  private createButton!: HTMLButtonElement;

  constructor(private readonly plugin: MurmurationWritingCompanionPlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    this.titleEl.setText("Create Story World entity");
    this.contentEl.addClass("mwc-story-world-create-modal");

    new Setting(this.contentEl)
      .setName("Entity kind")
      .addDropdown((dropdown) => {
        for (const kind of STORY_WORLD_ENTITY_KINDS) dropdown.addOption(kind, kind[0].toUpperCase() + kind.slice(1));
        dropdown.onChange((value) => { this.kind = value as StoryWorldEntityKind; this.renderPreview(); });
      });

    new Setting(this.contentEl)
      .setName("Custom kind")
      .setDesc("Used only when Entity kind is Other.")
      .addText((text) => text.setPlaceholder("e.g. institution").onChange((value) => { this.customKind = value; this.renderPreview(); }));

    new Setting(this.contentEl)
      .setName("Canonical name")
      .addText((text) => text.setPlaceholder("Entity name").onChange((value) => { this.name = value; this.renderPreview(); }));

    new Setting(this.contentEl)
      .setName("Scope")
      .setDesc("Optional explicit book or series wikilink; no scope is inferred.")
      .addText((text) => text.setPlaceholder("[[PRIME Trilogy]]").onChange((value) => { this.scope = value; this.renderPreview(); }));

    this.preview = this.contentEl.createDiv("mwc-story-world-create-preview");
    const actions = this.contentEl.createDiv("modal-button-container");
    actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    this.createButton = actions.createEl("button", { text: "Create", cls: "mod-cta" });
    this.createButton.onclick = () => void this.createEntity();
    this.renderPreview();
  }

  private currentPlan() {
    try {
      return { plan: planStoryWorldEntityCreation({ kind: this.kind, customKind: this.customKind, name: this.name, scope: this.scope }), error: null };
    } catch (error) {
      return { plan: null, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private renderPreview(): void {
    if (!this.preview || !this.createButton) return;
    this.preview.empty();
    const result = this.currentPlan();
    if (!result.plan) {
      this.preview.createEl("p", { text: result.error ?? "Enter entity details." });
      this.createButton.disabled = true;
      return;
    }
    const items = storyWorldBuilderItems(documents(this.plugin));
    const collision = findStoryWorldCreationCollision(result.plan, items);
    this.preview.createEl("h4", { text: "Creation preview" });
    const list = this.preview.createEl("dl");
    for (const [label, value] of [["Name", result.plan.name], ["Kind", result.plan.entityType], ["Path", result.plan.path], ["Scope", result.plan.scope ?? "None"]]) {
      const row = list.createDiv("mwc-context-row");
      row.createEl("dt", { text: label });
      row.createEl("dd", { text: value });
    }
    if (collision) this.preview.createEl("p", { cls: "mod-warning", text: collision });
    this.createButton.disabled = Boolean(collision);
  }

  private async createEntity(): Promise<void> {
    const result = this.currentPlan();
    if (!result.plan) { new Notice(result.error ?? "Invalid entity details."); return; }
    const items = storyWorldBuilderItems(documents(this.plugin));
    const collision = findStoryWorldCreationCollision(result.plan, items);
    if (collision || this.plugin.app.vault.getAbstractFileByPath(result.plan.path)) { new Notice(collision ?? `A file already exists at ${result.plan.path}.`); return; }

    let created: TFile | null = null;
    try {
      await ensureFolder(this.plugin, result.plan.path.slice(0, result.plan.path.lastIndexOf("/")));
      created = await this.plugin.app.vault.create(result.plan.path, result.plan.markdown);
      this.close();
      const leaf = this.plugin.app.workspace.getLeaf(false);
      await leaf.openFile(created, { active: true });
      await this.plugin.app.workspace.revealLeaf(leaf);
      await this.plugin.activateView();
      this.plugin.refreshStoryWorldNavigator();
    } catch (error) {
      if (created) {
        try { await this.plugin.app.vault.delete(created); } catch { /* preserve original failure */ }
      }
      new Notice(`Could not create Story World entity: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
