import { ItemView, MarkdownView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { projectStoryWorldTimeline, StoryWorldTimelineEvent, StoryWorldTimelineGroup, timelineAllFilterLabel, timelineFilterLabel, timelineReferenceLabel } from "./StoryWorldTimeline";
import { parseWikilink } from "./StoryWorldIndex";
import { EventSceneGraphNode, EventSceneGraphProjection, graphSelectionProjection, projectEventSceneGraph, projectTimelineAssertions, TimelineAssertionProjection } from "./StoryWorldEventSceneGraph";
import { manuscriptDisplayTitle, manuscriptHierarchyReferences } from "../manuscript/ManuscriptMetadata";
import { resolveOwningBook } from "../companion/ManuscriptHierarchy";
import { navigateTimelineSelection, TimelineSelectionQueue, timelineSelectionLeaf } from "./TimelineSelectionNavigation";
import { STORY_WORLD_TIMELINE_LABEL } from "../ui/PanelLabels";

export const STORY_WORLD_TIMELINE_VIEW_TYPE = "murmuration-story-world-timeline";
export interface StoryWorldTimelineHost extends MurmurationWritingCompanionPlugin { editStoryWorldEventTime(file: TFile): Promise<void>; }

export class StoryWorldTimelineView extends ItemView {
  private readonly selectionQueue = new TimelineSelectionQueue();
  private scopeFilter = ""; private statusFilter = ""; private precisionFilter = "";
  private presentation: "chronology" | "map" = "chronology";
  private selectedGraphNode: string | null = null;
  constructor(leaf: WorkspaceLeaf, private readonly plugin: StoryWorldTimelineHost) { super(leaf); }
  getViewType() { return STORY_WORLD_TIMELINE_VIEW_TYPE; }
  getDisplayText() { return STORY_WORLD_TIMELINE_LABEL; }
  getIcon() { return "milestone"; }
  async onOpen() { this.presentation = this.readPresentation(); this.render(); }

  render(): void {
    const container = this.containerEl.children[1]; container.empty(); container.addClass("mwc-story-world-timeline");
    const heading = container.createDiv("mwc-timeline-heading"); heading.createEl("h2", { text: STORY_WORLD_TIMELINE_LABEL });
    heading.createEl("p", { text: "Derived from explicit event Markdown" });
    const resolve = (linkpath: string, sourcePath: string) => this.app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath)?.path ?? null;
    const projection = projectStoryWorldTimeline(this.plugin.storyWorldIndex.index.getAll(), resolve, { scope: this.scopeFilter || null, status: this.statusFilter || null, precision: this.precisionFilter || null });
    const filters = container.createDiv("mwc-timeline-filters");
    this.addPresentation(filters);
    this.addFilter(filters, "Scope", projection.scopes, this.scopeFilter, (value) => { this.scopeFilter = value; this.render(); });
    this.addFilter(filters, "Status", projection.statuses, this.statusFilter, (value) => { this.statusFilter = value; this.render(); });
    this.addFilter(filters, "Precision", projection.precisions, this.precisionFilter, (value) => { this.precisionFilter = value; this.render(); });
    if (this.presentation === "chronology") {
      this.renderGroup(container, "Chronology", "points", projection.points);
      this.renderGroup(container, "Ranges", "ranges", projection.ranges);
      this.renderGroup(container, "Approximate or unsupported times", "unsupported", projection.unsupported);
      this.renderGroup(container, "Undated events", "undated", projection.undated);
    } else this.renderEventSceneMap(container, projection);
    this.renderAssertions(container, projection);
  }

  private presentationKey(): string {
    let resource = this.app.vault.getName();
    try { resource = this.app.vault.adapter.getResourcePath(""); } catch { /* Vault name is a stable fallback. */ }
    return `${this.plugin.manifest.id}:${this.app.vault.getName()}:${resource}:story-world-timeline-presentation`;
  }
  private readPresentation(): "chronology" | "map" { try { return window.localStorage.getItem(this.presentationKey()) === "map" ? "map" : "chronology"; } catch { return "chronology"; } }
  private writePresentation(): void { try { window.localStorage.setItem(this.presentationKey(), this.presentation); } catch { /* Presentation still works in memory. */ } }
  private addPresentation(container: Element): void {
    const row = container.createEl("label"); row.createSpan({ text: "Presentation" }); const select = row.createEl("select");
    select.createEl("option", { value: "chronology", text: "Chronology" }); select.createEl("option", { value: "map", text: "Event–scene map" });
    select.value = this.presentation; select.onchange = () => { this.presentation = select.value === "map" ? "map" : "chronology"; this.writePresentation(); this.render(); };
  }

  private addFilter(container: Element, label: "Scope" | "Status" | "Precision", values: readonly string[], selected: string, change: (value: string) => void): void {
    const row = container.createEl("label"); row.createSpan({ text: label }); const select = row.createEl("select");
    select.createEl("option", { value: "", text: timelineAllFilterLabel(label) });
    for (const value of values) select.createEl("option", { value, text: label === "Scope" ? timelineReferenceLabel(value) : timelineFilterLabel(value) });
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
      content.createEl("button", { cls: "mwc-timeline-event-name", text: event.name }).onclick = () => void this.openPath(event.path);
      content.createEl("p", { cls: "mwc-timeline-time", text: event.displayTime });
      const meta = content.createDiv("mwc-timeline-meta");
      meta.createSpan({ cls: "mwc-timeline-meta-field", text: timelineFilterLabel(event.precision) });
      meta.createSpan({ cls: "mwc-timeline-meta-field", text: timelineFilterLabel(event.status) });
      const scopes = meta.createSpan({ cls: "mwc-timeline-meta-field mwc-timeline-scopes" });
      if (!event.scopes.length) scopes.createSpan({ text: "Unscoped" });
      for (const scope of event.scopes) {
        const parsed = parseWikilink(scope);
        const path = parsed ? this.app.metadataCache.getFirstLinkpathDest(parsed.linkpath, event.path)?.path ?? null : null;
        const label = timelineReferenceLabel(scope);
        if (path) scopes.createEl("button", { cls: "mwc-timeline-scope-link", text: label }).onclick = () => void this.openPath(path);
        else scopes.createSpan({ cls: parsed ? "mwc-timeline-scope-unresolved" : "mwc-timeline-scope-value", text: parsed ? `${label} (unresolved)` : label });
      }
      if (event.relativeToPrevious) content.createEl("p", { cls: "mwc-timeline-interval", text: event.relativeToPrevious });
      if (event.sources.length) {
        const sources = content.createDiv("mwc-timeline-sources"); sources.createSpan({ text: "Sources: " });
        for (const source of event.sources) {
          if (source.resolvedPath) sources.createEl("button", { text: source.label }).onclick = () => void this.openPath(source.resolvedPath!);
          else sources.createSpan({ cls: "mwc-timeline-source-unresolved", text: `${source.label} (unresolved)` });
        }
      }
      content.createEl("button", { cls: "mwc-timeline-edit", text: "Edit event time" }).onclick = () => {
        const file = this.app.vault.getAbstractFileByPath(event.path);
        if (file instanceof TFile) void this.plugin.editStoryWorldEventTime(file);
      };
    }
  }

  private sceneDescription(path: string) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
    const parentReference = manuscriptHierarchyReferences(frontmatter).parentReferences[0];
    const parent = parentReference ? this.app.metadataCache.getFirstLinkpathDest(parseWikilink(parentReference)?.linkpath ?? parentReference, file.path) : null;
    const book = resolveOwningBook(this.app, file);
    const contextFiles = [parent, book].filter((item, index, values): item is TFile => item instanceof TFile && values.findIndex((value) => value?.path === item.path) === index);
    const context = contextFiles.map((item) => manuscriptDisplayTitle({ path: item.path, basename: item.basename, frontmatter: this.app.metadataCache.getFileCache(item)?.frontmatter as Record<string, unknown> | undefined })).join(" · ") || null;
    return { path, title: manuscriptDisplayTitle({ path, basename: file.basename, frontmatter }), context };
  }

  private renderEventSceneMap(container: Element, projection: ReturnType<typeof projectStoryWorldTimeline>): void {
    const graph = projectEventSceneGraph(projection, (path) => this.sceneDescription(path));
    const region = container.createDiv("mwc-event-scene-map");
    region.createEl("p", { cls: "mwc-event-scene-legend", text: "Derived world_time placement · Explicit world_sources connections" });
    const groups: Array<[string, (node: EventSceneGraphNode) => boolean]> = [
      ["Dated chronology", (node) => node.placement?.startsWith("point-") ?? false], ["Explicit ranges", (node) => node.placement === "range"],
      ["Approximate or unsupported", (node) => node.placement === "unsupported"], ["Undated", (node) => node.placement === "undated"]
    ];
    for (const [title, accepts] of groups) {
      const events = graph.events.filter(accepts); if (!events.length) continue;
      const section = region.createEl("section", { cls: "mwc-event-scene-region" }); section.createEl("h3", { text: `${title} · ${events.length}` });
      const axis = section.createDiv("mwc-event-scene-axis");
      for (const event of events) this.renderGraphEvent(axis, event, graph);
    }
    this.applyGraphEmphasis(region, graph, this.selectedGraphNode);
  }

  private renderGraphEvent(container: Element, event: EventSceneGraphNode, graph: EventSceneGraphProjection): void {
    const block = container.createEl("article", { cls: "mwc-event-scene-row" }); block.dataset.placement = event.placement ?? "";
    const eventNode = block.createDiv("mwc-event-scene-event-node"); eventNode.dataset.graphNode = event.id;
    const eventButton = eventNode.createEl("button", { cls: "mwc-event-scene-event-title", text: event.label });
    eventButton.onclick = () => event.path && void this.openPath(event.path);
    eventNode.onclick = (mouseEvent) => { if (mouseEvent.target === eventNode && event.path) void this.openPath(event.path); };
    eventNode.createEl("p", { cls: "mwc-event-scene-event-time", text: event.context ?? "" });
    if (event.event) eventNode.createEl("span", { cls: "mwc-event-scene-event-meta", text: `${timelineFilterLabel(event.event.precision)} · ${timelineFilterLabel(event.event.status)}` });
    eventNode.createEl("button", { cls: "mwc-timeline-edit", text: "Edit event time" }).onclick = () => {
      const file = event.path ? this.app.vault.getAbstractFileByPath(event.path) : null; if (file instanceof TFile) void this.plugin.editStoryWorldEventTime(file);
    };
    const eventEdges = graph.edges.filter((edge) => edge.eventId === event.id);
    if (!eventEdges.length) block.createDiv({ cls: "mwc-event-scene-no-sources", text: "No explicit world_sources" });
    else {
      const host = eventEdges.length > 6 ? block.createEl("details", { cls: "mwc-event-scene-source-host" }) : block.createDiv("mwc-event-scene-source-host");
      if (host instanceof HTMLDetailsElement) host.createEl("summary", { text: `${eventEdges.length} explicit source scenes` });
      const lane = host.createDiv("mwc-event-scene-source-lane");
      for (const edge of eventEdges) {
        const scene = graph.scenes.find((item) => item.id === edge.sceneId)!;
        const connection = lane.createDiv("mwc-event-scene-connection"); connection.dataset.graphEdge = edge.id;
        const sceneNode = connection.createDiv(`mwc-event-scene-scene-node ${scene.kind === "unresolved" ? "is-unresolved" : ""}`); sceneNode.dataset.graphNode = scene.id;
        if (scene.path) {
          sceneNode.createEl("button", { cls: "mwc-event-scene-scene-title", text: scene.label }).onclick = () => void this.openPath(scene.path!);
          sceneNode.onclick = (mouseEvent) => { if (mouseEvent.target === sceneNode) void this.openPath(scene.path!); };
        }
        else sceneNode.createEl("span", { cls: "mwc-event-scene-scene-title", text: scene.label });
        if (scene.context) sceneNode.createEl("span", { cls: "mwc-event-scene-scene-context", text: scene.context });
      }
    }
    block.querySelectorAll<HTMLElement>("[data-graph-node]").forEach((node) => {
      const nodeId = () => node.dataset.graphNode ?? null;
      const select = () => { this.selectedGraphNode = nodeId(); this.applyGraphEmphasis(this.containerEl, graph, this.selectedGraphNode); };
      node.addEventListener("mouseenter", () => this.applyGraphEmphasis(this.containerEl, graph, nodeId()));
      node.addEventListener("focusin", select); node.addEventListener("click", select);
      node.addEventListener("mouseleave", () => this.applyGraphEmphasis(this.containerEl, graph, this.selectedGraphNode));
    });
  }

  private applyGraphEmphasis(root: Element, graph: EventSceneGraphProjection, nodeId: string | null): void {
    const selected = graphSelectionProjection(graph, nodeId); const nodes = new Set(selected.nodes); const edges = new Set(selected.edges);
    root.querySelectorAll<HTMLElement>("[data-graph-node]").forEach((node) => node.toggleClass("is-emphasised", nodes.has(node.dataset.graphNode ?? "")));
    root.querySelectorAll<HTMLElement>("[data-graph-edge]").forEach((edge) => edge.toggleClass("is-emphasised", edges.has(edge.dataset.graphEdge ?? "")));
    const map = root.matches(".mwc-event-scene-map") ? root : root.querySelector(".mwc-event-scene-map");
    map?.toggleClass("has-graph-emphasis", nodes.size > 0);
  }

  private renderAssertions(container: Element, projection: ReturnType<typeof projectStoryWorldTimeline>): void {
    const documents = this.app.vault.getMarkdownFiles().map((file) => ({ path: file.path, name: file.basename,
      frontmatter: (this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined) ?? {} }));
    const resolve = (reference: string, sourcePath: string) => { const parsed = parseWikilink(reference); return parsed ? this.app.metadataCache.getFirstLinkpathDest(parsed.linkpath, sourcePath)?.path ?? null : null; };
    const visible = new Set([...projection.points, ...projection.ranges, ...projection.unsupported, ...projection.undated].map((event) => event.path));
    const assertions = projectTimelineAssertions(documents, this.plugin.storyWorldIndex.index.getAll(), resolve, visible);
    if (!assertions.length) return;
    const section = container.createEl("section", { cls: "mwc-timeline-assertions" }); section.createEl("h3", { text: "Author-maintained sequence assertions" });
    section.createEl("p", { cls: "mwc-timeline-assertions-note", text: "Explicit assertions are shown separately; chronological placement remains derived only from world_time." });
    for (const assertion of assertions) this.renderAssertion(section, assertion);
  }

  private renderAssertion(container: Element, assertion: TimelineAssertionProjection): void {
    const card = container.createEl("article", { cls: `mwc-timeline-assertion ${assertion.conflict ? "has-conflict" : ""}` });
    card.createEl("p", { text: `${assertion.subject} ${assertion.predicateLabel} ${assertion.target}.` });
    card.createEl("span", { cls: "mwc-timeline-assertion-status", text: assertion.statusLabel });
    if (!assertion.valid) card.createEl("p", { cls: "mwc-timeline-assertion-warning", text: "One or more assertion links are unresolved." });
    if (assertion.conflict) card.createEl("p", { cls: "mwc-timeline-assertion-warning", text: assertion.conflict });
    if (Object.keys(assertion.qualifiers).length) {
      const details = card.createEl("details"); details.createEl("summary", { text: "Preserved qualifiers" });
      for (const [key, value] of Object.entries(assertion.qualifiers)) details.createEl("p", { text: `${timelineFilterLabel(key)}: ${typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "Preserved structured value"}` });
    }
  }

  private async openPath(path: string): Promise<void> {
    return this.selectionQueue.run(() => this.navigateToPath(path));
  }

  private async navigateToPath(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) { new Notice("That authoritative note could not be opened."); return; }
    let existingLeaf: WorkspaceLeaf | null = null;
    this.app.workspace.iterateRootLeaves((candidate) => {
      if (!existingLeaf && candidate.view instanceof MarkdownView && candidate.view.file?.path === path) existingLeaf = candidate;
    });
    const leaf = timelineSelectionLeaf(existingLeaf, () => this.app.workspace.getLeaf("tab"));
    await navigateTimelineSelection({
      openSelectedNote: async () => { await leaf.openFile(file, { active: true }); await this.app.workspace.revealLeaf(leaf); },
      setSelectedNoteActive: () => this.app.workspace.setActiveLeaf(leaf, { focus: true }),
      activateCompanion: () => this.plugin.activateView(),
      focusSelectedEditor: () => { if (leaf.view instanceof MarkdownView) leaf.view.editor.focus(); }
    });
  }
}
