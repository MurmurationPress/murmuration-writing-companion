import { Modal, Notice, Setting, TFile, normalizePath } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { storyWorldBuilderItems, StoryWorldBuilderDocument } from "../story-world/WorldBuilder";
import {
  findStoryWorldCreationCollision,
  findStoryWorldPathCollision,
  executeStoryWorldEntityCreation,
  planStoryWorldEntityCreation,
  STORY_WORLD_ENTITY_KINDS,
  StoryWorldEntityKind
} from "../story-world/StoryWorldEntityCreation";
import { canonicalWikilink, presentWikilinkValue } from "../story-world/WikilinkPresentation";

export interface StoryWorldEntityCreationHost extends MurmurationWritingCompanionPlugin {
  refreshStoryWorldNavigator(): void;
}

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
  private scopeInput = "";
  private referenceCategory = "";
  private referenceTitle = "";
  private referenceJournal = "";
  private referenceAuthors = "";
  private referenceDate = "";
  private referenceKey = "";
  private referenceLink = "";
  private referenceSettings!: HTMLElement;
  private preview!: HTMLElement;
  private createButton!: HTMLButtonElement;

  constructor(private readonly plugin: StoryWorldEntityCreationHost) {
    super(plugin.app);
  }

  onOpen(): void {
    this.titleEl.setText("Create Story World entity");
    this.contentEl.addClass("mwc-story-world-create-modal");

    new Setting(this.contentEl)
      .setName("Entity kind")
      .addDropdown((dropdown) => {
        for (const kind of STORY_WORLD_ENTITY_KINDS) dropdown.addOption(kind, kind[0].toUpperCase() + kind.slice(1));
        dropdown.onChange((value) => { this.kind = value as StoryWorldEntityKind; this.updateReferenceVisibility(); this.renderPreview(); });
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
      .addText((text) => {
        const listId = "mwc-story-world-scope-suggestions";
        text.setPlaceholder("[[PRIME Trilogy]]").onChange((value) => { this.scopeInput = value; this.renderPreview(); });
        text.inputEl.setAttr("list", listId);
        const list = this.contentEl.createEl("datalist", { attr: { id: listId } });
        for (const file of this.plugin.app.vault.getMarkdownFiles()) {
          const option = list.createEl("option"); option.value = canonicalWikilink(file.path); option.label = file.basename;
        }
      });

    this.referenceSettings = this.contentEl.createDiv("mwc-story-world-reference-create-fields");
    new Setting(this.referenceSettings).setName("Reference category").setDesc("Optional, author-defined category.")
      .addText((text) => text.setPlaceholder("research-note").onChange((value) => { this.referenceCategory = value; this.renderPreview(); }));
    new Setting(this.referenceSettings).setName("Reference title").setDesc("Optional bibliographic title.")
      .addText((text) => text.onChange((value) => { this.referenceTitle = value; this.renderPreview(); }));
    new Setting(this.referenceSettings).setName("Journal").setDesc("Optional journal or periodical title.")
      .addText((text) => text.onChange((value) => { this.referenceJournal = value; this.renderPreview(); }));
    new Setting(this.referenceSettings).setName("Authors").setDesc("Optional; one author per line, preserved in this order.")
      .addTextArea((text) => text.setPlaceholder("Family name, Given name").onChange((value) => { this.referenceAuthors = value; this.renderPreview(); }));
    new Setting(this.referenceSettings).setName("Publication date").setDesc("Optional authored precision, for example 2026 or 2026-07.")
      .addText((text) => text.onChange((value) => { this.referenceDate = value; this.renderPreview(); }));
    new Setting(this.referenceSettings).setName("Reference key").setDesc("Optional stable author-chosen identifier.")
      .addText((text) => text.setPlaceholder("hawkins-2026-example").onChange((value) => { this.referenceKey = value; this.renderPreview(); }));
    new Setting(this.referenceSettings).setName("Link").setDesc("Optional external HTTP/HTTPS source URL.")
      .addText((text) => text.setPlaceholder("https://example.org/source").onChange((value) => { this.referenceLink = value; this.renderPreview(); }));

    this.preview = this.contentEl.createDiv("mwc-story-world-create-preview");
    const actions = this.contentEl.createDiv("modal-button-container");
    actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    this.createButton = actions.createEl("button", { text: "Create", cls: "mod-cta" });
    this.createButton.onclick = () => void this.createEntity();
    this.updateReferenceVisibility();
    this.renderPreview();
  }

  private updateReferenceVisibility(): void {
    if (this.referenceSettings) this.referenceSettings.toggle(this.kind === "reference");
  }

  private currentPlan() {
    try {
      return { plan: planStoryWorldEntityCreation({
        kind: this.kind, customKind: this.customKind, name: this.name, scope: this.scopeInput,
        reference: this.kind === "reference" ? {
          category: this.referenceCategory, title: this.referenceTitle, journal: this.referenceJournal,
          authors: this.referenceAuthors.split(/\r?\n/), date: this.referenceDate, key: this.referenceKey, link: this.referenceLink
        } : undefined
      }), error: null };
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
    const collision = findStoryWorldPathCollision(result.plan, this.plugin.app.vault.getMarkdownFiles().map((file) => file.path))
      ?? findStoryWorldCreationCollision(result.plan, items);
    this.preview.createEl("h4", { text: "Creation preview" });
    const list = this.preview.createEl("dl");
    const scopeLabel = result.plan.scope ? presentWikilinkValue(result.plan.scope)?.label ?? result.plan.scope : "None";
    for (const [label, value] of [["Name", result.plan.name], ["Kind", result.plan.entityType], ["Path", result.plan.path], ["Scope", scopeLabel]]) {
      const row = list.createDiv("mwc-context-row");
      row.createEl("dt", { text: label });
      row.createEl("dd", { text: value });
    }
    this.preview.createEl("h4", { text: "Markdown to write" });
    this.preview.createEl("pre").createEl("code", { text: result.plan.markdown });
    if (collision) this.preview.createEl("p", { cls: "mod-warning", text: collision });
    this.createButton.disabled = Boolean(collision);
  }

  private async createEntity(): Promise<void> {
    const result = this.currentPlan();
    if (!result.plan) { new Notice(result.error ?? "Invalid entity details."); return; }
    const items = storyWorldBuilderItems(documents(this.plugin));
    const collision = findStoryWorldPathCollision(result.plan, this.plugin.app.vault.getMarkdownFiles().map((file) => file.path))
      ?? findStoryWorldCreationCollision(result.plan, items);
    if (collision || this.plugin.app.vault.getAbstractFileByPath(result.plan.path)) { new Notice(collision ?? `A file already exists at ${result.plan.path}.`); return; }

    let created: TFile | null = null;
    try {
      await ensureFolder(this.plugin, result.plan.path.slice(0, result.plan.path.lastIndexOf("/")));
      created = await executeStoryWorldEntityCreation(result.plan, {
        revalidate: () => findStoryWorldPathCollision(result.plan!, this.plugin.app.vault.getMarkdownFiles().map((file) => file.path))
          ?? findStoryWorldCreationCollision(result.plan!, storyWorldBuilderItems(documents(this.plugin)))
          ?? (this.plugin.app.vault.getAbstractFileByPath(result.plan!.path) ? `A file already exists at ${result.plan!.path}.` : null),
        create: (path, markdown) => this.plugin.app.vault.create(path, markdown),
        read: (file) => this.plugin.app.vault.read(file),
        rollback: (file) => this.plugin.app.vault.delete(file)
      });
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
