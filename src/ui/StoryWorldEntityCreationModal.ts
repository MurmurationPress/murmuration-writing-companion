import { Modal, Notice, Setting, TFile, normalizePath } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { storyWorldBuilderItems, StoryWorldBuilderDocument } from "../story-world/WorldBuilder";
import {
  findStoryWorldCreationCollision,
  findStoryWorldPathCollision,
  planStoryWorldEntityCreation,
  STORY_WORLD_ENTITY_KINDS,
  StoryWorldEntityKind
} from "../story-world/StoryWorldEntityCreation";
import { presentWikilinkValue } from "../story-world/WikilinkPresentation";
import { buildStoryWorldScopeCandidates } from "../story-world/StoryWorldScopeCandidates";
import { EMPTY_REFERENCE_METADATA, ReferenceField, ReferenceMetadata, referenceCanonicalNameDefault, referenceFieldText, referenceMetadataFromText } from "../references/ReferenceMetadata";
import { ReferenceCitationImportModal } from "./ReferenceCitationImportModal";

export interface StoryWorldEntityCreationHost extends MurmurationWritingCompanionPlugin {
  refreshStoryWorldNavigator?(): void;
}

export interface StoryWorldEntityCreationModalOptions {
  readonly initialKind?: StoryWorldEntityKind;
  readonly initialName?: string;
  readonly initialScope?: string;
  readonly sourceReference?: string;
  readonly sourceLabel?: string;
  readonly targetPath?: string;
  readonly validateBeforeCreate?: () => Promise<void>;
  readonly onCreated?: (file: TFile, sourceIncluded: boolean) => void;
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
  private preview!: HTMLElement;
  private createButton!: HTMLButtonElement;
  private includeSource = false;
  private referenceMetadata: ReferenceMetadata = EMPTY_REFERENCE_METADATA;
  private referenceSection!: HTMLElement;
  private citationInput = "";
  private readonly referenceInputs: Partial<Record<ReferenceField, HTMLInputElement>> = {};
  private canonicalNameInput: HTMLInputElement | null = null;
  private canonicalNameExplicitlyEdited = false;

  constructor(private readonly plugin: StoryWorldEntityCreationHost, private readonly options: StoryWorldEntityCreationModalOptions = {}) {
    super(plugin.app);
    this.kind = options.initialKind ?? "character";
    this.name = options.initialName ?? "";
    this.canonicalNameExplicitlyEdited = Boolean(options.initialName?.trim());
    this.scopeInput = options.initialScope ?? "";
  }

  onOpen(): void {
    this.titleEl.setText("Create Story World entity");
    this.contentEl.addClass("mwc-story-world-create-modal");

    new Setting(this.contentEl)
      .setName("Entity kind")
      .addDropdown((dropdown) => {
        for (const kind of STORY_WORLD_ENTITY_KINDS) dropdown.addOption(kind, kind[0].toUpperCase() + kind.slice(1));
        dropdown.setValue(this.kind);
        dropdown.onChange((value) => { this.kind = value as StoryWorldEntityKind; this.renderReferenceSection(); this.renderPreview(); });
      });

    this.referenceSection = this.contentEl.createDiv("mwc-reference-creation-fields");
    this.renderReferenceSection();

    new Setting(this.contentEl)
      .setName("Custom kind")
      .setDesc("Used only when Entity kind is Other.")
      .addText((text) => text.setPlaceholder("e.g. institution").onChange((value) => { this.customKind = value; this.renderPreview(); }));

    new Setting(this.contentEl)
      .setName("Canonical name")
      .addText((text) => {
        const input = text.inputEl;
        this.canonicalNameInput = input;
        text.setPlaceholder("Entity name").setValue(this.name).onChange((value) => {
          this.canonicalNameExplicitlyEdited = Boolean(value.trim());
          this.name = referenceCanonicalNameDefault(value, this.kind === "reference" ? this.referenceMetadata.title : null, this.canonicalNameExplicitlyEdited);
          if (input.value !== this.name) input.value = this.name;
          this.renderPreview();
        });
      });

    new Setting(this.contentEl)
      .setName("Scope")
      .setDesc("Optional explicit Book or Series scope; leave unset to retain normal scope inference.")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "None (infer scope)");
        const candidates = buildStoryWorldScopeCandidates(documents(this.plugin), (linkpath, sourcePath) => (
          this.plugin.app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath)?.path ?? null
        ));
        const known = new Set(candidates.map((candidate) => candidate.storedValue));
        if (this.scopeInput && !known.has(this.scopeInput)) {
          const label = presentWikilinkValue(this.scopeInput)?.label ?? this.scopeInput;
          dropdown.addOption(this.scopeInput, `${label} (existing value)`);
        }
        for (const candidate of candidates) {
          dropdown.addOption(candidate.storedValue, candidate.secondary ? `${candidate.label} — ${candidate.secondary}` : candidate.label);
        }
        dropdown.setValue(this.scopeInput).onChange((value) => { this.scopeInput = value; this.renderPreview(); });
      });

    if (this.options.sourceReference) new Setting(this.contentEl)
      .setName(this.options.sourceLabel ?? "Add this manuscript note as a source")
      .setDesc(`Store ${presentWikilinkValue(this.options.sourceReference)?.label ?? "the manuscript note"} as provenance`)
      .addToggle((toggle) => toggle.setValue(false).onChange((value) => { this.includeSource = value; this.renderPreview(); }));

    this.preview = this.contentEl.createDiv("mwc-story-world-create-preview");
    const actions = this.contentEl.createDiv("modal-button-container");
    actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    this.createButton = actions.createEl("button", { text: "Create", cls: "mod-cta" });
    this.createButton.onclick = () => void this.createEntity();
    this.renderPreview();
  }

  private currentPlan() {
    try {
      return { plan: planStoryWorldEntityCreation({ kind: this.kind, customKind: this.customKind, name: this.name, scope: this.scopeInput, sources: this.includeSource && this.options.sourceReference ? [this.options.sourceReference] : [], targetPath: this.options.targetPath, reference: this.kind === "reference" ? this.referenceMetadata : undefined }), error: null };
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
    if (this.kind === "reference") {
      const citation = Object.entries(this.referenceMetadata).flatMap(([field, value]) => {
        const display = Array.isArray(value) ? value.join("; ") : value;
        return display ? [[field.replace(/(^|_)(.)/g, (_match, _prefix, letter) => ` ${String(letter).toUpperCase()}`).trim(), String(display)]] : [];
      });
      for (const [label, value] of citation) {
        const row = list.createDiv("mwc-context-row"); row.createEl("dt", { text: label }); row.createEl("dd", { text: value });
      }
    }
    if (collision) this.preview.createEl("p", { cls: "mod-warning", text: collision });
    this.createButton.disabled = Boolean(collision);
  }

  private renderReferenceSection(): void {
    if (!this.referenceSection) return;
    this.referenceSection.empty();
    for (const key of Object.keys(this.referenceInputs) as ReferenceField[]) delete this.referenceInputs[key];
    if (this.kind !== "reference") return;
    this.referenceSection.createEl("h3", { text: "Reference details" });
    const labels: Record<ReferenceField, string> = {
      authors: "Authors", title: "Title", date: "Publication year or date", publication: "Journal / publication",
      publisher: "Publisher", volume: "Volume", issue: "Issue", pages: "Pages", doi: "DOI", link: "Canonical link"
    };
    for (const field of Object.keys(EMPTY_REFERENCE_METADATA) as ReferenceField[]) {
      new Setting(this.referenceSection).setName(labels[field]).setDesc(field === "authors" ? "Separate multiple authors with semicolons." : "").addText((text) => {
        text.setValue(referenceFieldText(this.referenceMetadata, field)).onChange((value) => {
          const values = {} as Record<ReferenceField, string>;
          for (const key of Object.keys(EMPTY_REFERENCE_METADATA) as ReferenceField[]) values[key] = key === field ? value : this.referenceInputs[key]?.value ?? referenceFieldText(this.referenceMetadata, key);
          this.referenceMetadata = referenceMetadataFromText(values);
          if (field === "title") this.applyReferenceTitleDefault();
          this.renderPreview();
        });
        this.referenceInputs[field] = text.inputEl;
      });
    }
    this.referenceSection.createEl("h3", { text: "Import citation" });
    new Setting(this.referenceSection)
      .setName("Formatted citation or DOI")
      .setDesc("Parsing is local and changes only this form after explicit confirmation.")
      .addTextArea((area) => area.setPlaceholder("Paste a citation, DOI or DOI URL").setValue(this.citationInput).onChange((value) => { this.citationInput = value; }))
      .addButton((button) => button.setButtonText("Parse citation").onClick(() => {
        new ReferenceCitationImportModal(this.app, this.citationInput, this.referenceMetadata, (metadata) => {
          this.referenceMetadata = metadata;
          for (const field of Object.keys(EMPTY_REFERENCE_METADATA) as ReferenceField[]) {
            const input = this.referenceInputs[field]; if (input) input.value = referenceFieldText(metadata, field);
          }
          this.applyReferenceTitleDefault();
          this.renderPreview();
        }).open();
      }));
  }

  private applyReferenceTitleDefault(): void {
    this.name = referenceCanonicalNameDefault(this.name, this.referenceMetadata.title, this.canonicalNameExplicitlyEdited);
    if (this.canonicalNameInput && this.canonicalNameInput.value !== this.name) this.canonicalNameInput.value = this.name;
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
      await this.options.validateBeforeCreate?.();
      await ensureFolder(this.plugin, result.plan.path.slice(0, result.plan.path.lastIndexOf("/")));
      created = await this.plugin.app.vault.create(result.plan.path, result.plan.markdown);
      this.close();
      const leaf = this.plugin.app.workspace.getLeaf(false);
      await leaf.openFile(created, { active: true });
      await this.plugin.app.workspace.revealLeaf(leaf);
      await this.plugin.activateView();
      this.plugin.refreshStoryWorldNavigator?.();
      this.options.onCreated?.(created, this.includeSource);
    } catch (error) {
      if (created) {
        try { await this.plugin.app.vault.delete(created); } catch { /* preserve original failure */ }
      }
      new Notice(`Could not create Story World entity: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
