import { ItemView, MarkdownView, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { StoryWorldEntityCreationHost, StoryWorldEntityCreationModal } from "../ui/StoryWorldEntityCreationModal";
import {
  filterStoryWorldBuilderItems,
  builderItemFromEntity,
  compareStoryWorldBuilderItems,
  projectStoryWorldBuilderGroups,
  storyWorldTimeSortValue,
  StoryWorldBuilderItem
} from "./WorldBuilder";
import { storyWorldNavigatorStatus } from "./StoryWorldNavigatorPresentation";
import { STORY_WORLD_NAVIGATOR_LABEL, STORY_WORLD_TIMELINE_LABEL } from "../ui/PanelLabels";

export const STORY_WORLD_NAVIGATOR_VIEW_TYPE = "murmuration-story-world-navigator";
interface StoryWorldNavigatorHost extends StoryWorldEntityCreationHost { activateStoryWorldTimeline(): Promise<void>; activateStoryWorldReview(): Promise<void>; activateStoryWorldGraph(path?: string): Promise<void>; }

function compactDate(value: unknown): string | null {
  return storyWorldTimeSortValue(value);
}

export class StoryWorldNavigatorView extends ItemView {
  private query = "";
  private manuallySelectedPath: string | null = null;
  private allItems: StoryWorldBuilderItem[] = [];
  private treeRegion: HTMLElement | null = null;

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

    this.allItems = [
      ...this.plugin.storyWorldIndex.index.getAll().map(builderItemFromEntity),
      ...this.plugin.storyWorldIndex.getSupportingModels()
    ].sort(compareStoryWorldBuilderItems);
    const heading = container.createDiv("mwc-story-world-navigator-heading");
    heading.createEl("h2", { text: STORY_WORLD_NAVIGATOR_LABEL });
    const headingActions = heading.createDiv("mwc-story-world-navigator-actions");
    headingActions.createSpan({ cls: "mwc-story-world-navigator-count", text: `· ${this.allItems.length}` });
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
    const reviewButton = headingActions.createEl("button", {
      cls: "clickable-icon", attr: { type: "button", "aria-label": "Open Story World Review", title: "Open Story World Review" }
    });
    reviewButton.setText("✓");
    reviewButton.onclick = () => void this.plugin.activateStoryWorldReview();
    const graphButton = headingActions.createEl("button", {
      cls: "clickable-icon", attr: { type: "button", "aria-label": "Open Story World Graph", title: "Open Story World Graph" }
    });
    graphButton.setText("◇");
    graphButton.onclick = () => void this.plugin.activateStoryWorldGraph(this.activeStoryWorldPath(this.allItems) ?? undefined);

    const search = container.createEl("input", {
      cls: "mwc-story-world-search",
      type: "search",
      attr: { placeholder: "Search names, aliases or files", "aria-label": "Search Story World Navigator" }
    });
    search.value = this.query;
    this.treeRegion = container.createDiv("mwc-story-world-tree-region");
    const renderTreeRegion = () => {
      if (!this.treeRegion) return;
      this.treeRegion.empty();
      this.renderTreeProjection(this.treeRegion);
    };
    search.oninput = () => {
      this.query = search.value;
      renderTreeRegion();
    };
    search.onkeydown = (event) => {
      if (event.key !== "Escape" || this.query.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      this.query = "";
      search.value = "";
      renderTreeRegion();
    };
    renderTreeRegion();
  }

  private renderTreeProjection(container: HTMLElement): void {
    const items = filterStoryWorldBuilderItems(this.allItems, this.query);
    if (!items.length) {
      container.createEl("p", {
        cls: "mwc-story-world-empty",
        text: this.query ? "No Story World entities match this search." : "No explicit Story World entities or supporting models were found."
      });
      return;
    }

    const activePath = this.activeStoryWorldPath(items);
    const groups = projectStoryWorldBuilderGroups(
      this.allItems,
      this.query,
      this.plugin.storyWorldCategoryPreferences.snapshot()
    );
    const searchActive = this.query.trim().length > 0;
    for (const group of groups) {
      const section = container.createEl("section", {
        cls: `mwc-story-world-group mwc-story-world-group--${group.key.replace(/[^a-z0-9-]/gu, "-")}`
      });
      const title = section.createEl("h3", { cls: "mwc-story-world-group-title" });
      const toggle = title.createEl("button", {
        cls: "mwc-story-world-group-toggle",
        attr: {
          type: "button",
          "aria-expanded": String(!group.collapsed),
          "aria-label": searchActive
            ? `${group.label} expanded for search results`
            : `${group.collapsed ? "Expand" : "Collapse"} ${group.label}`
        }
      });
      toggle.disabled = searchActive;
      toggle.createSpan({
        cls: "mwc-story-world-group-disclosure",
        text: group.collapsed ? "›" : "⌄",
        attr: { "aria-hidden": "true" }
      });
      const icon = toggle.createSpan({ cls: "mwc-story-world-group-icon", attr: { "aria-hidden": "true" } });
      setIcon(icon, group.icon);
      toggle.createSpan({ cls: "mwc-story-world-group-label", text: group.label });
      toggle.createSpan({ cls: "mwc-story-world-group-count", text: `· ${group.items.length}` });
      toggle.onclick = () => {
        if (searchActive) return;
        this.plugin.storyWorldCategoryPreferences.setCollapsed(group.key, !group.collapsed);
        this.renderTreeRegion();
      };
      const list = section.createEl("ul", { cls: "mwc-story-world-list" });
      list.hidden = group.collapsed;

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

  private renderTreeRegion(): void {
    if (!this.treeRegion?.isConnected) return;
    this.treeRegion.empty();
    this.renderTreeProjection(this.treeRegion);
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
    this.renderTreeRegion();
  }
}
