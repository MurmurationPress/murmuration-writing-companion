import { ItemView, MarkdownView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { buildObsidianStoryWorldGraph } from "./ObsidianStoryWorldGraph";
import { layoutStoryWorldGraph, STORY_WORLD_GRAPH_DENSITIES, storyWorldGraphNodeShape, storyWorldGraphStatusIsProvisional, StoryWorldGraphDensity, StoryWorldGraphEdge, StoryWorldGraphNode } from "./StoryWorldGraph";
import { selectStoryWorldGraphNode, storyWorldGraphEdgeOpenPath, storyWorldGraphNodeOpenPath, StoryWorldGraphNavigation } from "./StoryWorldGraphNavigation";

export const STORY_WORLD_GRAPH_VIEW_TYPE = "murmuration-story-world-graph";
export const STORY_WORLD_GRAPH_LABEL = "Story World Graph";

interface StoryWorldGraphHost extends MurmurationWritingCompanionPlugin {
  activateStoryWorldReview(fingerprint?: string): Promise<void>;
}

const SVG = "http://www.w3.org/2000/svg";
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

export class StoryWorldGraphView extends ItemView {
  private readonly centreHistory = new StoryWorldGraphNavigation();
  private predicate = "";
  private status = "";
  private nodeType = "";
  private validity = "";
  private referenceDate = "";
  private scopeFilter: "all" | "book" | "unscoped" = "all";
  private includeProvenance = false;
  private density: StoryWorldGraphDensity = "comfortable";

  constructor(leaf: WorkspaceLeaf, private readonly plugin: StoryWorldGraphHost) { super(leaf); }
  getViewType() { return STORY_WORLD_GRAPH_VIEW_TYPE; }
  getDisplayText() { return STORY_WORLD_GRAPH_LABEL; }
  getIcon() { return "git-fork"; }
  async onOpen() { this.followActiveSelection(); this.render(); }

  private graphCentrePaths(): Set<string> {
    const result = new Set(this.plugin.storyWorldIndex.index.getAll().map((entity) => entity.path));
    for (const file of this.app.vault.getMarkdownFiles()) {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
      if (typeof frontmatter?.world_model === "string" && frontmatter.world_model.trim()) result.add(file.path);
    }
    return result;
  }

  followActiveSelection(): void {
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
    if (file && this.graphCentrePaths().has(file.path)) this.centreHistory.observeActive(file.path);
  }

  select(path: string): void {
    if (!this.graphCentrePaths().has(path)) return;
    this.centreHistory.follow(path); this.render();
  }

  reconcileRename(oldPath: string, newPath: string): void {
    this.centreHistory.reconcile(this.graphCentrePaths(), new Map([[oldPath, newPath]]));
    this.render();
  }

  render(): void {
    const container = this.containerEl.children[1];
    container.empty(); container.addClass("mwc-story-world-graph");
    this.centreHistory.reconcile(this.graphCentrePaths());
    const navigation = this.centreHistory.get();
    const heading = container.createDiv("mwc-story-world-graph-heading");
    heading.createEl("h2", { text: STORY_WORLD_GRAPH_LABEL });
    const history = heading.createDiv("mwc-story-world-graph-history");
    const back = history.createEl("button", { text: "Back", attr: { type: "button", "aria-label": "Previous graph centre" } }); back.disabled = !navigation.canBack;
    back.onclick = () => { this.centreHistory.back(); this.render(); };
    const forward = history.createEl("button", { text: "Forward", attr: { type: "button", "aria-label": "Next graph centre" } }); forward.disabled = !navigation.canForward;
    forward.onclick = () => { this.centreHistory.forward(); this.render(); };
    const follow = history.createEl("button", { text: navigation.followsActiveNote ? "Following active note" : "Follow active note", attr: { type: "button" } });
    follow.disabled = navigation.followsActiveNote;
    follow.onclick = () => { const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file; if (file && this.graphCentrePaths().has(file.path)) { this.centreHistory.follow(file.path); this.render(); } };
    if (!navigation.centrePath) {
      container.createEl("p", { cls: "mwc-muted", text: "Open or select an indexed Story World entity to see its explicit one-hop neighbourhood." });
      return;
    }
    const selectedEntity = this.plugin.storyWorldIndex.index.getByPath(navigation.centrePath);
    const selectedFile = this.app.vault.getAbstractFileByPath(navigation.centrePath);
    const centreLabel = selectedEntity?.name ?? (selectedFile instanceof TFile ? selectedFile.basename : navigation.centrePath);
    heading.createEl("p", { cls: "mwc-muted", text: `Graph centre: ${centreLabel} · ${navigation.followsActiveNote ? "follows active note" : "manual graph navigation"}` });
    const controls = container.createDiv("mwc-story-world-graph-controls");
    const rerender = () => this.render();
    const presentation = controls.createDiv("mwc-story-world-graph-presentation");
    const density = presentation.createEl("select", { attr: { "aria-label": "Graph density" } });
    for (const [value, label] of [["compact", "Compact"], ["comfortable", "Comfortable"], ["spacious", "Spacious"]] as const) density.createEl("option", { value, text: label });
    density.value = this.density; density.onchange = () => { this.density = density.value as StoryWorldGraphDensity; rerender(); };
    const scope = controls.createEl("select", { attr: { "aria-label": "Filter graph by Story World scope" } });
    scope.createEl("option", { value: "all", text: "All explicit scope" }); scope.createEl("option", { value: "book", text: "Current Book" }); scope.createEl("option", { value: "unscoped", text: "Unscoped items" });
    scope.value = this.scopeFilter; scope.onchange = () => { this.scopeFilter = scope.value as "all" | "book" | "unscoped"; rerender(); };
    const provenance = controls.createEl("label");
    const provenanceInput = provenance.createEl("input", { type: "checkbox" }); provenanceInput.checked = this.includeProvenance;
    provenance.createSpan({ text: "Manuscript sources" }); provenanceInput.onchange = () => { this.includeProvenance = provenanceInput.checked; rerender(); };
    const reference = controls.createEl("label"); reference.createSpan({ text: "Validity date" });
    const date = reference.createEl("input", { type: "date", attr: { "aria-label": "Reference date for relationship validity" } }); date.value = this.referenceDate;
    date.onchange = () => { this.referenceDate = date.value; rerender(); };

    let graph = buildObsidianStoryWorldGraph(this.app, this.plugin.storyWorldIndex, this.plugin.manuscriptBookSelection.get().bookPath, {
      selectedPath: navigation.centrePath, predicate: this.predicate || null, status: this.status || null, nodeType: this.nodeType || null,
      validity: this.validity ? this.validity as "active" | "future" | "expired" | "indeterminate" : null,
      referenceDate: this.referenceDate || undefined, currentBookOnly: this.scopeFilter === "book", unscopedOnly: this.scopeFilter === "unscoped", includeProvenance: this.includeProvenance, nodeLimit: 36
    });
    const select = (label: string, value: string, options: readonly [string, string][], set: (next: string) => void) => {
      const control = controls.createEl("select", { attr: { "aria-label": label } });
      for (const [key, text] of options) control.createEl("option", { value: key, text });
      control.value = value; control.onchange = () => { set(control.value); rerender(); };
    };
    select("Filter graph by predicate", this.predicate, [["", "All predicates"], ...graph.availablePredicates.map((item) => [item, item] as [string, string])], (value) => this.predicate = value);
    select("Filter graph by status", this.status, [["", "All statuses"], ...graph.availableStatuses.map((item) => [item, item] as [string, string])], (value) => this.status = value);
    select("Filter graph by node type", this.nodeType, [["", "All node types"], ["entity", "Entities"], ["event", "Events"], ["model", "Models"], ["scene", "Source Scenes"]], (value) => this.nodeType = value);
    select("Filter graph by validity", this.validity, [["", "All validity"], ["active", "Active"], ["future", "Future"], ["expired", "Expired"], ["indeterminate", "Indeterminate"]], (value) => this.validity = value);
    // Rebuild after dynamic controls only when their stored values already apply; this keeps available choices derived from the unmutated source projection.
    if (graph.dateFilterUnavailable) container.createEl("p", { cls: "mwc-muted", text: "Choose an explicit validity date before filtering active, future or expired relationships." });
    if (graph.truncated) container.createEl("p", { cls: "mwc-story-world-graph-warning", text: `Showing the first 36 deterministic nodes; ${graph.omittedNodeCount} more were omitted. Use filters to reduce this neighbourhood.` });
    if (graph.nodes.length === 1) container.createEl("p", { cls: "mwc-muted", text: "This item has no explicit neighbours matching the current filters." });
    const impact = container.createEl("button", { text: `Open Impact Across Manuscript (${graph.nodes.find((node) => node.central)?.manuscriptImpactCount ?? 0})`, attr: { type: "button" } });
    impact.onclick = async () => {
      const file = this.app.vault.getAbstractFileByPath(navigation.centrePath!);
      if (!(file instanceof TFile)) return;
      await this.app.workspace.getLeaf(false).openFile(file, { active: true });
      await this.plugin.activateView();
    };
    const canvas = container.createDiv("mwc-story-world-graph-canvas");
    const detail = container.createDiv("mwc-story-world-graph-detail");
    this.renderSvg(canvas, detail, graph.nodes, graph.edges, graph);
    this.containerEl.onkeydown = (event) => {
      if (event.key === "Escape") { detail.empty(); event.preventDefault(); }
      else if (event.altKey && event.key === "ArrowLeft" && this.centreHistory.get().canBack) { this.centreHistory.back(); this.render(); event.preventDefault(); }
      else if (event.altKey && event.key === "ArrowRight" && this.centreHistory.get().canForward) { this.centreHistory.forward(); this.render(); event.preventDefault(); }
    };
    if (graph.diagnostics.length) {
      const diagnostics = container.createEl("section", { cls: "mwc-story-world-graph-diagnostics" });
      diagnostics.createEl("h3", { text: "Incomplete connections" });
      for (const item of graph.diagnostics) {
        const row = diagnostics.createDiv("mwc-story-world-graph-diagnostic");
        row.createEl("strong", { text: item.sourceProperty.join(".") }); row.createSpan({ text: ` — ${item.message}` });
        if (item.reviewFingerprints[0]) row.createEl("button", { text: "Open review", attr: { type: "button" } }).onclick = () => void this.plugin.activateStoryWorldReview(item.reviewFingerprints[0]);
      }
    }
  }

  private renderSvg(container: Element, detail: Element, nodes: readonly StoryWorldGraphNode[], edges: readonly StoryWorldGraphEdge[], graph: ReturnType<typeof buildObsidianStoryWorldGraph>): void {
    const width = 900; const height = 560; const positions = layoutStoryWorldGraph(graph, width, height, this.density);
    const labelOffset = STORY_WORLD_GRAPH_DENSITIES[this.density].labelOffset;
    const image = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `One-hop Story World graph with ${nodes.length} nodes and ${edges.length} edges at ${this.density} density` });
    container.appendChild(image);
    const definitions = svg("defs");
    const marker = svg("marker", { id: "mwc-graph-arrow", viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse" });
    marker.appendChild(svg("path", { d: "M 0 0 L 10 5 L 0 10 z", class: "mwc-story-world-graph-arrow" })); definitions.appendChild(marker); image.appendChild(definitions);
    const central = nodes.find((node) => node.central); if (central) this.showNodeDetail(detail, central);
    for (const edge of edges) {
      const from = positions.get(edge.from); const to = positions.get(edge.to); if (!from || !to) continue;
      const group = svg("g", { class: `mwc-story-world-graph-edge is-${edge.kind}${storyWorldGraphStatusIsProvisional(edge.status) ? " is-provisional" : ""}`, tabindex: "0", role: "button", "aria-label": `${edge.label}, ${edge.status ?? "no status"}, ${edge.validity}` });
      const line = svg("line", { x1: String(from.x), y1: String(from.y), x2: String(to.x), y2: String(to.y), "marker-end": "url(#mwc-graph-arrow)" }); group.appendChild(line);
      const label = svg("text", { x: String((from.x + to.x) / 2), y: String((from.y + to.y) / 2 - labelOffset), "text-anchor": "middle" }); label.textContent = edge.label; group.appendChild(label);
      const metadata = svg("text", { x: String((from.x + to.x) / 2), y: String((from.y + to.y) / 2 + labelOffset + 3), "text-anchor": "middle", class: "mwc-story-world-graph-edge-metadata" });
      metadata.textContent = edge.validityValue != null ? edge.validity : ""; if (metadata.textContent) group.appendChild(metadata);
      const show = () => this.showEdgeDetail(detail, edge); group.addEventListener("click", show); group.addEventListener("keydown", (event) => { if ((event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") show(); }); image.appendChild(group);
    }
    for (const node of nodes) {
      const position = positions.get(node.id); if (!position) continue;
      const group = svg("g", { class: `mwc-story-world-graph-node is-${node.kind}${node.central ? " is-central" : ""}${storyWorldGraphStatusIsProvisional(node.status) ? " is-provisional" : ""}`, tabindex: "0", role: "button", "aria-label": `${node.label}, ${node.entityType}${node.central ? ", centre" : ""}${node.reviewFingerprints.length ? ", has review findings" : ""}` });
      const shapeKind = storyWorldGraphNodeShape(node);
      const points = shapeKind === "chevron" ? `${position.x - 66},${position.y - 27} ${position.x + 44},${position.y - 27} ${position.x + 66},${position.y} ${position.x + 44},${position.y + 27} ${position.x - 66},${position.y + 27} ${position.x - 44},${position.y}`
        : shapeKind === "diamond" ? `${position.x},${position.y - 34} ${position.x + 68},${position.y} ${position.x},${position.y + 34} ${position.x - 68},${position.y}`
        : `${position.x - 52},${position.y - 28} ${position.x + 52},${position.y - 28} ${position.x + 68},${position.y} ${position.x + 52},${position.y + 28} ${position.x - 52},${position.y + 28} ${position.x - 68},${position.y}`;
      const shape = shapeKind === "ellipse" ? svg("ellipse", { cx: String(position.x), cy: String(position.y), rx: "66", ry: "28" })
        : shapeKind === "rectangle" ? svg("rect", { x: String(position.x - 64), y: String(position.y - 27), width: "128", height: "54", rx: "7" })
        : svg("polygon", { points }); group.appendChild(shape);
      const label = svg("text", { x: String(position.x), y: String(position.y + 4), "text-anchor": "middle" }); label.textContent = node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label; group.appendChild(label);
      const kind = svg("text", { x: String(position.x), y: String(position.y + 18), "text-anchor": "middle", class: "mwc-story-world-graph-node-kind" }); kind.textContent = node.entityType; group.appendChild(kind);
      if (node.central && node.manuscriptImpactCount !== null) { const impact = svg("text", { x: String(position.x), y: String(position.y + 48), "text-anchor": "middle", class: "mwc-story-world-graph-impact" }); impact.textContent = `${node.manuscriptImpactCount} manuscript impact`; group.appendChild(impact); }
      if (node.reviewFingerprints.length) { const marker = svg("text", { x: String(position.x + 52), y: String(position.y - 20), class: "mwc-story-world-graph-review-marker" }); marker.textContent = "!"; group.appendChild(marker); }
      const select = () => this.selectGraphNode(node, detail); group.addEventListener("click", select); group.addEventListener("keydown", (event) => { if ((event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") { select(); event.preventDefault(); } }); image.appendChild(group);
    }
  }

  private selectGraphNode(node: StoryWorldGraphNode, detail: Element): void {
    if (selectStoryWorldGraphNode(this.centreHistory, node) === "detail") { this.showNodeDetail(detail, node); return; }
    this.render();
  }

  private showNodeDetail(container: Element, node: StoryWorldGraphNode): void {
    container.empty(); container.createEl("h3", { text: node.label });
    container.createEl("p", { text: `${node.entityType} · ${node.central ? "Current graph centre" : "Selected graph node"}` });
    if (node.status) container.createEl("p", { text: `Status: ${node.status}` });
    if (node.manuscriptImpactCount !== null) container.createEl("p", { text: `Manuscript impact: ${node.manuscriptImpactCount}` });
    const open = container.createEl("button", { text: "Open note", attr: { type: "button" } });
    open.onclick = () => this.openNodeNote(storyWorldGraphNodeOpenPath(node));
    if (node.reviewFingerprints[0]) container.createEl("button", { text: "Open Story World Review", attr: { type: "button" } }).onclick = () => void this.plugin.activateStoryWorldReview(node.reviewFingerprints[0]);
  }

  private openNodeNote(path: string): void {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file, { active: true });
  }

  private showEdgeDetail(container: Element, edge: StoryWorldGraphEdge): void {
    container.empty(); container.createEl("h3", { text: edge.label });
    container.createEl("p", { text: `${edge.kind} · ${edge.status ?? "No status"} · ${edge.validity}` });
    if (edge.validityValue != null) container.createEl("p", { text: `Validity evidence: ${JSON.stringify(edge.validityValue)}` });
    container.createEl("p", { cls: "mwc-muted", text: `${edge.sourcePath} · ${edge.sourceProperty.join(".")}` });
    const open = container.createEl("button", { text: "Open source assertion", attr: { type: "button" } });
    open.onclick = () => { const file = this.app.vault.getAbstractFileByPath(storyWorldGraphEdgeOpenPath(edge)); if (file instanceof TFile) { void this.app.workspace.getLeaf(false).openFile(file, { active: true }); new Notice(`Source property: ${edge.sourceProperty.join(".")}`); } };
    if (edge.reviewFingerprints[0]) container.createEl("button", { text: "Open Story World Review", attr: { type: "button" } }).onclick = () => void this.plugin.activateStoryWorldReview(edge.reviewFingerprints[0]);
  }
}
