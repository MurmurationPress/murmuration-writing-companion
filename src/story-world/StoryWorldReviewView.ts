import { ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { ContinuityObservation, ObservationSeverity } from "../observations/ContinuityObservation";
import { matchContinuityDisposition } from "../observations/ContinuityDisposition";
import { renderContinuityDispositionControls } from "../companion/ContinuityDispositionControls";
import { buildWorldContext } from "./WorldContext";
import { relinkStoryWorldOccurrence } from "./StoryWorldRelink";

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
  private reviewState = "active";
  private focusedFingerprint: string | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: StoryWorldReviewHost) { super(leaf); }
  getViewType() { return STORY_WORLD_REVIEW_VIEW_TYPE; }
  getDisplayText() { return STORY_WORLD_REVIEW_LABEL; }
  getIcon() { return "shield-alert"; }
  async onOpen() { this.render(); }

  showFingerprint(fingerprint: string): void {
    this.focusedFingerprint = fingerprint;
    const observation = this.plugin.storyWorldReviewProjection.get().observations.find((item) => item.fingerprint === fingerprint);
    const disposition = observation ? matchContinuityDisposition(observation, this.plugin.storeService.getContinuityDispositionRecords()) : null;
    const retained = disposition?.state === "current" && Boolean(disposition.record);
    this.severity = "all"; this.kind = "all"; this.scopeFilter = "global"; this.reviewState = retained ? "history" : "active";
    this.render();
    const row = this.containerEl.querySelector<HTMLElement>(`[data-observation-fingerprint="${fingerprint}"]`);
    if (row instanceof HTMLDetailsElement) row.open = true;
    row?.scrollIntoView({ block: "center" });
    row?.focus();
  }

  render(): void {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("mwc-story-world-review");
    const projection = this.plugin.storyWorldReviewProjection.get();
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
    const reviewState = controls.createEl("select", { attr: { "aria-label": "Filter Story World review by disposition" } });
    reviewState.createEl("option", { value: "active", text: "Active" });
    reviewState.createEl("option", { value: "history", text: "History / retained" });
    reviewState.value = this.reviewState;
    const rerender = () => { this.severity = severity.value; this.kind = kind.value; this.scopeFilter = scope.value; this.reviewState = reviewState.value; this.render(); };
    severity.onchange = rerender; kind.onchange = rerender; scope.onchange = rerender; reviewState.onchange = rerender;

    const bookPath = this.plugin.manuscriptBookSelection.get().bookPath;
    const relevantPaths = new Set<string>();
    if (bookPath) {
      const book = this.plugin.manuscriptProjection.get().books.find((candidate) => candidate.file.path === bookPath);
      for (const scene of book?.result.scenes ?? []) {
        const file = book?.filesByPath.get(scene.path);
        if (!file) continue;
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
        const context = buildWorldContext(frontmatter, (reference) =>
          this.plugin.storyWorldIndex.resolveWikilink(reference, file.path));
        for (const entry of context.entries) relevantPaths.add(entry.entity.path);
      }
      for (const entity of this.plugin.storyWorldIndex.index.getAll()) {
        if (entity.scope.some((reference) => this.plugin.storyWorldIndex.resolveReference(reference, entity.path)?.path === bookPath)) relevantPaths.add(entity.path);
      }
    }
    const records = this.plugin.storeService.getContinuityDispositionRecords();
    const matches = projection.observations.map((observation) => matchContinuityDisposition(observation, records));
    const visibleMatches = matches.filter((match) => {
      const retained = match.state === "current" && match.record !== null;
      return (this.reviewState === "history" ? retained : !retained)
      && (this.severity === "all" || match.observation.severity === this.severity as ObservationSeverity)
      && (this.kind === "all" || match.observation.kind === this.kind)
      && (this.scopeFilter === "global" || relevantPaths.has(match.observation.primary.path));
    });
    const visible = visibleMatches.map((match) => match.observation);
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
      row.dataset.observationFingerprint = observation.fingerprint;
      row.tabIndex = -1;
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
      const match = visibleMatches.find((candidate) => candidate.observation.fingerprint === observation.fingerprint)!;
      if (observation.kind.includes("collision") && !(match.state === "current" && match.record)) {
        const keep = actions.createEl("button", { text: "Keep both", attr: { type: "button" } });
        keep.onclick = () => {
          keep.disabled = true;
          void this.plugin.storeService.setContinuityDisposition(observation, "intentional", "Keep both Story World records.");
        };
      }
      if (observation.kind === "story-world.link.ambiguous") {
        const location = observation.evidence.find((item) => item.role === "wikilink");
        const raw = location?.value.kind === "value" && typeof location.value.value === "string" ? location.value.value : null;
        const [marker, start, end] = location?.source.property ?? [];
        for (const candidate of observation.evidence.filter((item) => item.role === "candidate" && item.value.kind === "resolved_note")) {
          if (!raw || marker !== "body" || typeof start !== "number" || typeof end !== "number" || candidate.value.kind !== "resolved_note") continue;
          const target = candidate.value.note;
          const relink = actions.createEl("button", { text: `Relink to ${target.label ?? target.path}`, attr: { type: "button" } });
          relink.onclick = () => void this.relinkOccurrence(observation.primary.path, { raw, start, end }, target.path, relink);
        }
      }
      renderContinuityDispositionControls(row, observation, match, this.plugin.storeService);
    }
  }

  private async relinkOccurrence(
    sourcePath: string,
    occurrence: { readonly raw: string; readonly start: number; readonly end: number },
    targetPath: string,
    button: HTMLButtonElement
  ): Promise<void> {
    if (!window.confirm(`Replace only ${occurrence.raw} at the reviewed location with a link to ${targetPath}?`)) return;
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) { new Notice("The source note is no longer available."); return; }
    button.disabled = true;
    try {
      const current = await this.app.vault.cachedRead(file);
      const updated = relinkStoryWorldOccurrence(current, occurrence, targetPath);
      await this.app.vault.modify(file, updated);
      this.plugin.storyWorldReviewProjection.invalidate();
      new Notice("Story World link updated.");
      this.render();
    } catch (error) {
      button.disabled = false;
      new Notice(error instanceof Error ? error.message : "The Story World link could not be updated.");
    }
  }
}
