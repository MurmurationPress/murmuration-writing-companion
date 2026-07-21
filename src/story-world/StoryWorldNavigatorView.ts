import { ItemView, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { StoryWorldEntityCreationHost, StoryWorldEntityCreationModal } from "../ui/StoryWorldEntityCreationModal";
import {
  filterStoryWorldBuilderItems,
  groupStoryWorldBuilderItems,
  storyWorldBuilderItems,
  storyWorldTimeSortValue,
  StoryWorldBuilderDocument,
  StoryWorldBuilderItem
} from "./WorldBuilder";
import { storyWorldNavigatorStatus } from "./StoryWorldNavigatorPresentation";
import { STORY_WORLD_NAVIGATOR_LABEL, STORY_WORLD_TIMELINE_LABEL } from "../ui/PanelLabels";

export const STORY_WORLD_NAVIGATOR_VIEW_TYPE = "murmuration-story-world-navigator";
interface StoryWorldNavigatorHost extends StoryWorldEntityCreationHost { activateStoryWorldTimeline(): Promise<void>; }

function documents(plugin: MurmurationWritingCompanionPlugin): StoryWorldBuilderDocument[] {
  return plugin.app.vault.getMarkdownFiles().map((file) => ({
    path: file.path,
    basename: file.basename,
    frontmatter: plugin.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined
  }));
}

function compactDate(value: unknown): string | null {
  return storyWorldTimeSortValue(value);
}

export class StoryWorldNavigatorView extends ItemView {
  private query = "";
  private manuallySelectedPath: string | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: StoryWorldNavigatorHost) {
    super(leaf);
  }

  getViewType() { return STORY_WORLD_NAVIGATOR_VIEW_TYPE; }
  getDisplayText() { return STORY_WORLD_NAVIGATOR_LABEL; }
  getIcon() { return "map"; }
  async onOpen() { this.render(); }

  render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("mwc-story-world-navigator");

    const allItems = storyWorldBuilderItems(documents(this.plugin));
    const heading = container.createDiv("mwc-story-world-navigator-heading");
    heading.createEl("h2", { text: STORY_WORLD_NAVIGATOR_LABEL });
    const headingActions = heading.createDiv("mwc-story-world-navigator-actions");
    headingActions.createSpan({ cls: "mwc-story-world-navigator-count", text: `· ${allItems.length}` });
    const createButton = headingActions.createEl("button", {
      cls: "clickable-icon",
      attr: { type: "button", "aria-label": "Create Story World entity", title: "Create Story World entity" }
    });
    createButton.setText("+");
    createButton.onclick = () => new StoryWorldEntityCreationModal(this.plugin).open();
    const timelineButton = headingActions.createEl("button", {
      cls: "clickable-icon", attr: { type: "button", "aria-label": `Open ${STORY_WORLD_TIMELINE_LABEL}`, title: `Open ${STORY_WORLD_TIMELINE_LABEL}` }
    });
    timelineButton.setText("↕");
    timelineButton.onclick = () => void this.plugin.activateStoryWorldTimeline();

    const search = container.createEl("input", {
      cls: "mwc-story-world-search",
      type: "search",
      attr: { placeholder: "Search names, aliases or files", "aria-label": "Search Story World Navigator" }
    });
    search.value = this.query;
    search.oninput = () => {
      this.query = search.value;
      this.render();
      const next = this.containerEl.querySelector<HTMLInputElement>(".mwc-story-world-search");
      next?.focus();
      next?.setSelectionRange(this.query.length, this.query.length);
    };

    const items = filterStoryWorldBuilderItems(allItems, this.query);
    if (!items.length) {
      container.createEl("p", {
        cls: "mwc-story-world-empty",
        text: this.query ? "No Story World entities match this search." : "No explicit Story World entities or supporting models were found."
      });
      return;
    }

    const activePath = this.activeStoryWorldPath(items);
    for (const group of groupStoryWorldBuilderItems(items)) {
      const section = container.createEl("section", { cls: "mwc-story-world-group" });
      const title = section.createEl("h3", { cls: "mwc-story-world-group-title" });
      title.createSpan({ text: group.label });
      title.createSpan({ cls: "mwc-story-world-group-count", text: `· ${group.items.length}` });
      const list = section.createEl("ul", { cls: "mwc-story-world-list" });

      for (const item of group.items) {
        const status = storyWorldNavigatorStatus(item.status);
        const row = list.createEl("li", { cls: "mwc-story-world-item" });
        if (item.path === activePath) row.addClass("mwc-story-world-item--active");
        const button = row.createEl("button", {
          cls: "mwc-story-world-item-button",
          attr: { type: "button", "aria-label": `Open ${item.name}. Status: ${status.accessibleLabel}` }
        });
        const primary = button.createDiv("mwc-story-world-item-primary");
        primary.createSpan({ cls: "mwc-story-world-item-name", text: item.name });
        const statusElement = primary.createSpan({
          cls: `mwc-story-world-item-status mwc-story-world-item-status--${status.kind}${status.visibleLabel ? "" : " is-default"}`,
          attr: { title: `Status: ${status.accessibleLabel}` }
        });
        statusElement.createSpan({ cls: "mwc-story-world-item-status-dot", attr: { "aria-hidden": "true" } });
        if (status.visibleLabel) statusElement.createSpan({ cls: "mwc-story-world-item-status-label", text: status.visibleLabel });
        const modelType = item.kind === "model" ? item.type : null;
        const eventTime = compactDate(item.worldTime);
        if (modelType || eventTime) {
          const details = button.createDiv("mwc-story-world-item-details");
          if (modelType) details.createSpan({ cls: "mwc-story-world-item-type", text: modelType });
          if (eventTime) details.createSpan({ cls: "mwc-story-world-item-time", text: eventTime });
        }
        button.onclick = () => {
          this.manuallySelectedPath = item.path;
          void this.openItem(item);
        };
      }
    }
  }

  private activeStoryWorldPath(items: readonly StoryWorldBuilderItem[]): string | null {
    if (this.manuallySelectedPath && items.some((item) => item.path === this.manuallySelectedPath)) return this.manuallySelectedPath;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.file && items.some((item) => item.path === view.file?.path) ? view.file.path : null;
  }

  private async openItem(item: StoryWorldBuilderItem): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(item.path);
    if (!(file instanceof TFile)) return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, { active: true });
    await this.app.workspace.revealLeaf(leaf);
    await this.plugin.activateView();
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    if (leaf.view instanceof MarkdownView) leaf.view.editor.focus();
    this.render();
  }
}
