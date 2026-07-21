import { ItemView, MarkdownView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { projectStoryWorldTimeline, StoryWorldTimelineEvent, StoryWorldTimelineGroup, timelineFilterLabel } from "./StoryWorldTimeline";

export const STORY_WORLD_TIMELINE_VIEW_TYPE = "murmuration-story-world-timeline";
export interface StoryWorldTimelineHost extends MurmurationWritingCompanionPlugin { editStoryWorldEventTime(file: TFile): Promise<void>; }

export class StoryWorldTimelineView extends ItemView {
  private scopeFilter = ""; private statusFilter = ""; private precisionFilter = "";
  constructor(leaf: WorkspaceLeaf, private readonly plugin: StoryWorldTimelineHost) { super(leaf); }
  getViewType() { return STORY_WORLD_TIMELINE_VIEW_TYPE; }
  getDisplayText() { return "Story World timeline"; }
  getIcon() { return "milestone"; }
  async onOpen() { this.render(); }

  render(): void {
    const container = this.containerEl.children[1]; container.empty(); container.addClass("mwc-story-world-timeline");
    const heading = container.createDiv("mwc-timeline-heading"); heading.createEl("h2", { text: "Story World timeline" });
    heading.createEl("p", { text: "Derived from explicit event Markdown" });
    const resolve = (linkpath: string, sourcePath: string) => this.app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath)?.path ?? null;
    const projection = projectStoryWorldTimeline(this.plugin.storyWorldIndex.index.getAll(), resolve, { scope: this.scopeFilter || null, status: this.statusFilter || null, precision: this.precisionFilter || null });
    const filters = container.createDiv("mwc-timeline-filters");
    this.addFilter(filters, "Scope", projection.scopes, this.scopeFilter, (value) => { this.scopeFilter = value; this.render(); });
    this.addFilter(filters, "Status", projection.statuses, this.statusFilter, (value) => { this.statusFilter = value; this.render(); });
    this.addFilter(filters, "Precision", projection.precisions, this.precisionFilter, (value) => { this.precisionFilter = value; this.render(); });
    this.renderGroup(container, "Chronology", "points", projection.points);
    this.renderGroup(container, "Ranges", "ranges", projection.ranges);
    this.renderGroup(container, "Approximate or unsupported times", "unsupported", projection.unsupported);
    this.renderGroup(container, "Undated events", "undated", projection.undated);
  }

  private addFilter(container: Element, label: string, values: readonly string[], selected: string, change: (value: string) => void): void {
    const row = container.createEl("label"); row.createSpan({ text: label }); const select = row.createEl("select");
    select.createEl("option", { value: "", text: `All ${label.toLowerCase()}s` });
    for (const value of values) select.createEl("option", { value, text: timelineFilterLabel(value) });
    select.value = selected; select.onchange = () => change(select.value);
  }

  private renderGroup(container: Element, title: string, group: StoryWorldTimelineGroup, events: readonly StoryWorldTimelineEvent[]): void {
    const section = container.createEl("section", { cls: `mwc-timeline-section mwc-timeline-${group}` });
    section.createEl("h3", { text: `${title} · ${events.length}` });
    if (!events.length) { section.createEl("p", { cls: "mwc-timeline-empty", text: "No events match the current filters." }); return; }
    const axis = section.createDiv("mwc-timeline-axis");
    for (const event of events) {
      const card = axis.createEl("article", { cls: "mwc-timeline-event" }); card.dataset.precision = event.precision;
      const marker = card.createDiv("mwc-timeline-marker"); marker.setAttr("aria-hidden", "true");
      const content = card.createDiv("mwc-timeline-event-content");
      content.createEl("button", { cls: "mwc-timeline-event-name", text: event.name }).onclick = () => void this.openPath(event.path, true);
      content.createEl("p", { cls: "mwc-timeline-time", text: event.displayTime });
      content.createEl("p", { cls: "mwc-timeline-meta", text: `${timelineFilterLabel(event.precision)} · ${timelineFilterLabel(event.status)} · ${event.scopes.length ? event.scopes.join(", ") : "Unscoped"}` });
      if (event.relativeToPrevious) content.createEl("p", { cls: "mwc-timeline-interval", text: event.relativeToPrevious });
      if (event.sources.length) {
        const sources = content.createDiv("mwc-timeline-sources"); sources.createSpan({ text: "Sources: " });
        for (const source of event.sources) {
          if (source.resolvedPath) sources.createEl("button", { text: source.label }).onclick = () => void this.openPath(source.resolvedPath!, false);
          else sources.createSpan({ cls: "mwc-timeline-source-unresolved", text: `${source.label} (unresolved)` });
        }
      }
      content.createEl("button", { cls: "mwc-timeline-edit", text: "Edit event time" }).onclick = () => {
        const file = this.app.vault.getAbstractFileByPath(event.path);
        if (file instanceof TFile) void this.plugin.editStoryWorldEventTime(file);
      };
    }
  }

  private async openPath(path: string, showCompanion: boolean): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) { new Notice("That authoritative note could not be opened."); return; }
    const leaf = this.app.workspace.getLeaf("tab"); await leaf.openFile(file, { active: true }); await this.app.workspace.revealLeaf(leaf);
    if (showCompanion) await this.plugin.activateView();
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    if (leaf.view instanceof MarkdownView) leaf.view.editor.focus();
  }
}
