import { ItemView, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import {
  filterStoryWorldBuilderItems,
  groupStoryWorldBuilderItems,
  storyWorldBuilderItems,
  StoryWorldBuilderDocument,
  StoryWorldBuilderItem
} from "./WorldBuilder";

export const STORY_WORLD_NAVIGATOR_VIEW_TYPE = "murmuration-story-world-navigator";

function documents(plugin: MurmurationWritingCompanionPlugin): StoryWorldBuilderDocument[] {
  return plugin.app.vault.getMarkdownFiles().map((file) => ({
    path: file.path,
    basename: file.basename,
    frontmatter: plugin.app.metadataCache.getFileCache(file)?.frontmatter as
      Record<string, unknown> | undefined
  }));
}

function compactDate(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ["at", "from", "start"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return null;
}

export class StoryWorldNavigatorView extends ItemView {
  private query = "";
  private manuallySelectedPath: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: MurmurationWritingCompanionPlugin
  ) {
    super(leaf);
  }

  getViewType() {
    return STORY_WORLD_NAVIGATOR_VIEW_TYPE;
  }

  getDisplayText() {
    return "Story World";
  }

  getIcon() {
    return "map";
  }

  async onOpen() {
    this.render();
  }

  render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("mwc-story-world-navigator");

    const heading = container.createDiv("mwc-story-world-navigator-heading");
    heading.createEl("h2", { text: "Story World" });
    heading.createSpan({
      cls: "mwc-story-world-navigator-count",
      text: String(storyWorldBuilderItems(documents(this.plugin)).length)
    });

    const search = container.createEl("input", {
      cls: "mwc-story-world-search",
      type: "search",
      attr: { placeholder: "Search names, aliases or files", "aria-label": "Search Story World" }
    });
    search.value = this.query;
    search.oninput = () => {
      this.query = search.value;
      this.render();
      const next = this.containerEl.querySelector<HTMLInputElement>(".mwc-story-world-search");
      next?.focus();
      next?.setSelectionRange(this.query.length, this.query.length);
    };

    const items = filterStoryWorldBuilderItems(
      storyWorldBuilderItems(documents(this.plugin)),
      this.query
    );
    if (!items.length) {
      container.createEl("p", {
        cls: "mwc-story-world-empty",
        text: this.query
          ? "No Story World entities match this search."
          : "No explicit Story World entities or supporting models were found."
      });
      return;
    }

    const activePath = this.activeStoryWorldPath(items);
    for (const group of groupStoryWorldBuilderItems(items)) {
      const section = container.createEl("section", { cls: "mwc-story-world-group" });
      const title = section.createEl("h3", { cls: "mwc-story-world-group-title" });
      title.createSpan({ text: group.label });
      title.createSpan({ cls: "mwc-story-world-group-count", text: String(group.items.length) });
      const list = section.createEl("ul", { cls: "mwc-story-world-list" });

      for (const item of group.items) {
        const row = list.createEl("li", { cls: "mwc-story-world-item" });
        if (item.path === activePath) row.addClass("mwc-story-world-item--active");
        const button = row.createEl("button", {
          cls: "mwc-story-world-item-button",
          attr: { type: "button", "aria-label": `Open ${item.name}` }
        });
        const primary = button.createDiv("mwc-story-world-item-primary");
        primary.createSpan({ cls: "mwc-story-world-item-name", text: item.name });
        primary.createSpan({ cls: "mwc-story-world-item-type", text: item.kind === "model" ? item.type : "" });
        const details = [item.status, compactDate(item.worldTime)].filter(Boolean).join(" · ");
        if (details) button.createDiv({ cls: "mwc-story-world-item-details", text: details });
        button.onclick = () => {
          this.manuallySelectedPath = item.path;
          void this.openItem(item);
        };
      }
    }
  }

  private activeStoryWorldPath(items: readonly StoryWorldBuilderItem[]): string | null {
    if (this.manuallySelectedPath && items.some((item) => item.path === this.manuallySelectedPath)) {
      return this.manuallySelectedPath;
    }
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.file && items.some((item) => item.path === view.file?.path)
      ? view.file.path
      : null;
  }

  private async openItem(item: StoryWorldBuilderItem): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(item.path);
    if (!(file instanceof TFile)) return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, { active: true });
    await this.app.workspace.revealLeaf(leaf);
    this.render();
  }
}
