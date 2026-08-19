import { App, Modal, Setting } from "obsidian";
import { StoryWorldEntityRecord } from "../story-world/StoryWorldIndex";
import { formatWorldEntityType } from "../story-world/WorldContext";
import { searchWorldContextCandidates } from "../story-world/WorldContextAuthoring";

export interface WorldContextEntityPickerOptions {
  readonly entities: readonly StoryWorldEntityRecord[];
  readonly explicitlyLinkedPaths: ReadonlySet<string>;
  readonly onSelect: (entity: StoryWorldEntityRecord) => void | Promise<void>;
}

function typeOptions(entities: readonly StoryWorldEntityRecord[]): string[] {
  return [...new Set(entities.map((entity) => entity.entityType.trim()).filter(Boolean))]
    .sort((left, right) => {
      const leftEvent = left.toLocaleLowerCase() === "event";
      const rightEvent = right.toLocaleLowerCase() === "event";
      if (leftEvent !== rightEvent) return leftEvent ? -1 : 1;
      return formatWorldEntityType(left).localeCompare(formatWorldEntityType(right));
    });
}

export class WorldContextEntityPickerModal extends Modal {
  private query = "";
  private entityType = "";
  private results!: HTMLElement;

  constructor(
    app: App,
    private readonly options: WorldContextEntityPickerOptions
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Add World Context");
    this.contentEl.addClass("mwc-world-context-picker");
    this.contentEl.createEl("p", {
      cls: "mwc-muted",
      text: "Choose an indexed Story World entity to attach explicitly to this Scene."
    });

    new Setting(this.contentEl)
      .setName("Search")
      .setDesc("Matches canonical names and aliases.")
      .addText((text) => {
        text.inputEl.type = "search";
        text.setPlaceholder("Search Story World…");
        text.onChange((value) => {
          this.query = value;
          this.renderResults();
        });
        text.inputEl.focus();
      });

    new Setting(this.contentEl)
      .setName("Entity type")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "All types");
        for (const type of typeOptions(this.options.entities)) {
          dropdown.addOption(type, formatWorldEntityType(type));
        }
        dropdown.onChange((value) => {
          this.entityType = value;
          this.renderResults();
        });
      });

    this.results = this.contentEl.createDiv({
      cls: "mwc-world-context-picker-results",
      attr: { role: "list", "aria-label": "Story World entities" }
    });
    this.renderResults();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderResults(): void {
    if (!this.results) return;
    this.results.empty();
    const candidates = searchWorldContextCandidates(
      this.options.entities,
      this.query,
      this.entityType
    );

    if (candidates.length === 0) {
      this.results.createEl("p", {
        cls: "mwc-muted",
        text: "No indexed Story World entities match."
      });
      return;
    }

    for (const entity of candidates) {
      const attached = this.options.explicitlyLinkedPaths.has(entity.path);
      const row = this.results.createEl("button", {
        cls: "mwc-world-context-picker-row",
        attr: {
          type: "button",
          role: "listitem",
          "aria-label": attached
            ? `${entity.name}, ${formatWorldEntityType(entity.entityType)}, already in World Context`
            : `Add ${entity.name}, ${formatWorldEntityType(entity.entityType)}`
        }
      });
      row.disabled = attached;
      const primary = row.createSpan({
        cls: "mwc-world-context-picker-primary"
      });
      primary.createSpan({
        cls: "mwc-world-context-picker-name",
        text: entity.name
      });
      const metadata = row.createSpan({
        cls: "mwc-world-context-picker-metadata"
      });
      metadata.createSpan({
        cls: "mwc-world-context-picker-type",
        text: formatWorldEntityType(entity.entityType)
      });
      metadata.createSpan({
        cls: "mwc-world-context-picker-separator",
        text: "·",
        attr: { "aria-hidden": "true" }
      });
      metadata.createSpan({
        cls: "mwc-world-context-picker-path",
        text: attached ? "Already in World Context" : entity.path
      });
      row.onclick = () => {
        if (attached) return;
        this.close();
        void this.options.onSelect(entity);
      };
    }
  }
}
