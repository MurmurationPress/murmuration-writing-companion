import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { ContinuityObservation, ObservationSeverity } from "../observations/ContinuityObservation";
import { collectObsidianStoryWorldReview } from "./ObsidianStoryWorldReview";
import { buildObsidianManuscriptLibrary } from "../manuscript/ObsidianManuscript";

export const STORY_WORLD_REVIEW_VIEW_TYPE = "murmuration-story-world-review";
export const STORY_WORLD_REVIEW_LABEL = "Story World Review";

interface StoryWorldReviewHost extends MurmurationWritingCompanionPlugin {}

function readableKind(kind: string): string {
  return kind.replace(/^story-world\./, "").split(/[.-]/).map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

function evidenceText(observation: ContinuityObservation): string[] {
  return observation.evidence.map((evidence) => {
    const property = evidence.source.property.join(".");
    const value = evidence.value;
    if (value.kind === "missing") return `${property}: missing`;
    if (value.kind === "unresolved_reference") return `${property}: ${value.reference} (${value.reason})`;
    if (value.kind === "resolved_note") return `${property}: ${value.note.label ?? value.note.path}`;
    if (value.kind === "date") return `${property}: ${value.value} (${value.precision})`;
    if (value.kind === "malformed" || value.kind === "unsupported") return `${property}: ${JSON.stringify(value.raw)} — ${value.reason}`;
    return `${property}: ${JSON.stringify(value.value)}`;
  });
}

export class StoryWorldReviewView extends ItemView {
  private severity = "all";
  private kind = "all";
  private scopeFilter = "global";

  constructor(leaf: WorkspaceLeaf, private readonly plugin: StoryWorldReviewHost) { super(leaf); }
  getViewType() { return STORY_WORLD_REVIEW_VIEW_TYPE; }
  getDisplayText() { return STORY_WORLD_REVIEW_LABEL; }
  getIcon() { return "shield-alert"; }
  async onOpen() { this.render(); }

  render(): void {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("mwc-story-world-review");
    const projection = collectObsidianStoryWorldReview(this.app, this.plugin.storyWorldIndex);
    container.createEl("h2", { text: STORY_WORLD_REVIEW_LABEL });
    container.createEl("p", { cls: "mwc-muted", text: "Deterministic maintenance findings from explicit Story World Markdown." });
    const summary = container.createDiv("mwc-story-world-review-summary");
    for (const severity of ["conflict", "review", "information"] as const) {
      summary.createSpan({ cls: `mwc-story-world-review-count is-${severity}`, text: `${projection.counts[severity]} ${severity}` });
    }
    const controls = container.createDiv("mwc-story-world-review-controls");
    const severity = controls.createEl("select", { attr: { "aria-label": "Filter Story World review by severity" } });
    [["all", "All severities"], ["conflict", "Conflict"], ["review", "Review"], ["information", "Information"]].forEach(([value, label]) => severity.createEl("option", { value, text: label }));
    severity.value = this.severity;
    const kinds = [...new Set(projection.observations.map((item) => item.kind))].sort();
    const kind = controls.createEl("select", { attr: { "aria-label": "Filter Story World review by kind" } });
    kind.createEl("option", { value: "all", text: "All kinds" });
    kinds.forEach((value) => kind.createEl("option", { value, text: readableKind(value) }));
    kind.value = this.kind;
    const scope = controls.createEl("select", { attr: { "aria-label": "Filter Story World review by scope" } });
    scope.createEl("option", { value: "global", text: "Global Story World" });
    scope.createEl("option", { value: "book", text: "Current Book references" });
    scope.value = this.scopeFilter;
    const rerender = () => { this.severity = severity.value; this.kind = kind.value; this.scopeFilter = scope.value; this.render(); };
    severity.onchange = rerender; kind.onchange = rerender; scope.onchange = rerender;

    const bookPath = this.plugin.manuscriptBookSelection.get().bookPath;
    const relevantPaths = new Set<string>();
    if (bookPath) {
      const book = buildObsidianManuscriptLibrary(this.app).books.find((candidate) => candidate.file.path === bookPath);
      for (const scene of book?.result.scenes ?? []) {
        const file = book?.filesByPath.get(scene.path);
        if (!file) continue;
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
        const raw = frontmatter?.world_context;
        for (const reference of Array.isArray(raw) ? raw : [raw]) {
          const resolved = this.plugin.storyWorldIndex.resolveReference(reference, file.path);
          if (resolved?.indexed) relevantPaths.add(resolved.path);
        }
      }
      for (const entity of this.plugin.storyWorldIndex.index.getAll()) {
        if (entity.scope.some((reference) => this.plugin.storyWorldIndex.resolveReference(reference, entity.path)?.path === bookPath)) relevantPaths.add(entity.path);
      }
    }
    const visible = projection.observations.filter((observation) =>
      (this.severity === "all" || observation.severity === this.severity as ObservationSeverity)
      && (this.kind === "all" || observation.kind === this.kind)
      && (this.scopeFilter === "global" || relevantPaths.has(observation.primary.path))
    );
    if (this.scopeFilter === "book" && !bookPath) {
      container.createEl("p", { cls: "mwc-muted", text: "Select a manuscript Book to use Book-scoped filtering. Global review remains available." });
      return;
    }
    if (!visible.length) {
      container.createEl("p", { cls: "mwc-muted", text: projection.observations.length ? "No findings match these filters." : "No Story World maintenance findings." });
      return;
    }
    let currentSeverity = "";
    let currentKind = "";
    for (const observation of visible) {
      if (observation.severity !== currentSeverity) {
        currentSeverity = observation.severity; currentKind = "";
        container.createEl("h3", { text: `${currentSeverity[0].toUpperCase()}${currentSeverity.slice(1)}` });
      }
      if (observation.kind !== currentKind) {
        currentKind = observation.kind;
        container.createEl("h4", { text: readableKind(currentKind) });
      }
      const row = container.createEl("details", { cls: `mwc-story-world-review-row is-${observation.severity}` });
      const heading = row.createEl("summary");
      heading.createSpan({ cls: "mwc-story-world-review-title", text: observation.summary });
      heading.createSpan({ cls: "mwc-muted", text: observation.primary.label ?? observation.primary.path });
      row.createEl("p", { text: observation.explanation });
      const list = row.createEl("ul", { cls: "mwc-story-world-review-evidence" });
      evidenceText(observation).forEach((item) => list.createEl("li", { text: item }));
      const actions = row.createDiv("mwc-story-world-review-actions");
      const targets = new Map<string, string>();
      targets.set(observation.primary.path, observation.primary.label ?? observation.primary.path);
      observation.evidence.forEach((evidence) => targets.set(evidence.source.note.path, evidence.source.note.label ?? evidence.source.note.path));
      for (const [path, label] of targets) {
        const button = actions.createEl("button", { text: `Open ${label}`, attr: { type: "button" } });
        button.onclick = () => {
          const file = this.app.vault.getAbstractFileByPath(path);
          if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file, { active: true });
        };
      }
    }
  }
}
