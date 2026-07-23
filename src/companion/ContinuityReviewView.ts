import { ItemView, MarkdownView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import type MurmurationWritingCompanionEntry from "../entry";
import {
  ObservationEvidence
} from "../observations/ContinuityObservation";
import {
  ContinuityReviewFilters,
  ContinuityReviewItem,
  ContinuityReviewProjection,
  projectContinuityReview,
  reconcileContinuityReviewFilters
} from "../observations/ContinuityReview";
import {
  collectObsidianContinuityReview,
  ObsidianContinuityReviewCollection
} from "../manuscript/ObsidianContinuityReview";
import { buildObsidianManuscriptLibrary } from "../manuscript/ObsidianManuscript";
import { renderContinuityDispositionControls } from "./ContinuityDispositionControls";
import { ContinuityReviewCollectionCoordinator, continuityReviewDependencyChanged } from "./ContinuityReviewActivation";
import {
  continuityListNavigationIntent,
  continuityNoteLabel,
  continuityUnresolvedReference,
  CONTINUITY_DIAGNOSTIC_DETAILS_OPEN_BY_DEFAULT,
  projectContinuityReviewPresentation
} from "./ContinuityReviewPresentation";
import { buildContinuityDiagnosticPayload, shouldShowContinuityDiagnostics } from "./ContinuityDiagnostics";

export const CONTINUITY_REVIEW_VIEW_TYPE = "murmuration-continuity-review";

function labelForPath(path: string): string {
  return path.replace(/\.md$/i, "").split("/").pop() || "Note";
}

function evidenceValue(evidence: ObservationEvidence): string {
  const value = evidence.value;
  switch (value.kind) {
    case "missing": return "Missing";
    case "value": return typeof value.value === "string" ? value.value : JSON.stringify(value.value);
    case "date": return `${value.value} (${value.precision})`;
    case "resolved_note": return value.note.label?.trim() || labelForPath(value.note.path);
    case "unresolved_reference": return `${value.reference} — ${value.reason}`;
    case "malformed": return `${JSON.stringify(value.raw)} — ${value.reason}`;
    case "unsupported": return `${JSON.stringify(value.raw)} — ${value.reason}`;
  }
}

function readableKind(kind: string): string {
  return kind.split(".").map((part) => part.replace(/[-_]+/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" · ");
}

export class ContinuityReviewView extends ItemView {
  private bookPath: string | null = null;
  private originLeaf: WorkspaceLeaf | null = null;
  private originPath: string | null = null;
  private selectedLineage: string | null = null;
  private narrowDetail = false;
  private filters: ContinuityReviewFilters = {
    queue: "active", type: null, locationPath: null, entityPath: null
  };
  private dependencyPaths = new Set<string>();
  private collection: ObsidianContinuityReviewCollection | null = null;
  private loading = false;
  private readonly collectionCoordinator = new ContinuityReviewCollectionCoordinator();

  constructor(leaf: WorkspaceLeaf, private readonly plugin: MurmurationWritingCompanionEntry) {
    super(leaf);
  }

  getViewType() { return CONTINUITY_REVIEW_VIEW_TYPE; }
  getDisplayText() { return "Continuity Review"; }
  getIcon() { return "list-checks"; }
  getState() { return { bookPath: this.plugin.manuscriptBookSelection.get().bookPath }; }

  async setState(state: unknown): Promise<void> {
    const record = typeof state === "object" && state !== null ? state as Record<string, unknown> : {};
    const restored = this.plugin.manuscriptBookSelection.get().bookPath;
    this.bookPath = restored ?? (typeof record.bookPath === "string" ? record.bookPath : null);
    if (!restored && this.bookPath) {
      this.plugin.manuscriptBookSelection.select(this.bookPath, this.bookPath, "continuity-review");
    }
    await this.refreshCollection();
  }

  async onOpen() { await this.refreshCollection(); }

  retarget(bookPath: string, originLeaf: WorkspaceLeaf | null, originPath: string | null) {
    const changed = this.bookPath !== bookPath;
    this.bookPath = bookPath;
    this.originLeaf = originLeaf;
    this.originPath = originPath;
    if (changed) {
      this.selectedLineage = null;
      this.narrowDetail = false;
      this.collection = null;
    }
    void this.refreshCollection();
  }

  setOrigin(originLeaf: WorkspaceLeaf | null, originPath: string | null): void {
    this.originLeaf = originLeaf;
    this.originPath = originPath;
    this.render();
  }

  dependsOn(path: string): boolean {
    return continuityReviewDependencyChanged(this.dependencyPaths, path);
  }

  async refreshCollection(): Promise<void> {
    const requestedBook = this.bookPath ?? this.plugin.manuscriptBookSelection.get().bookPath;
    if (!requestedBook) { this.collectionCoordinator.supersede(); this.collection = null; this.loading = false; this.render(); return; }
    this.bookPath = requestedBook;
    this.loading = true;
    this.render();
    const result = await this.collectionCoordinator.request(() => Promise.resolve().then(() => (
      collectObsidianContinuityReview(this.app, this.plugin.storyWorldIndex, requestedBook)
    )));
    if (!result.current || this.bookPath !== requestedBook) return;
    this.collection = result.value;
    this.dependencyPaths = new Set(result.value?.dependencies ?? []);
    this.loading = false;
    this.render();
  }

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("mwc-continuity-review");
    const library = buildObsidianManuscriptLibrary(this.app);
    this.bookPath = this.plugin.manuscriptBookSelection.get().bookPath ?? this.bookPath;
    const collection = this.collection?.book.file.path === this.bookPath ? this.collection : null;

    const header = container.createEl("header", { cls: "mwc-continuity-review-header" });
    const heading = header.createDiv();
    heading.createEl("h2", { text: "Continuity Review" });
    heading.createEl("p", { text: "Derived review of authoritative manuscript and Story World evidence" });
    const headerActions = header.createDiv("mwc-continuity-review-header-actions");
    const bookSelect = headerActions.createEl("select", { attr: { "aria-label": "Continuity Review book" } });
    if (library.books.length === 0) bookSelect.createEl("option", { text: "No manuscript books", value: "" });
    for (const book of library.books) bookSelect.createEl("option", { text: book.record.title, value: book.file.path });
    bookSelect.value = this.bookPath ?? "";
    bookSelect.onchange = () => {
      const next = library.books.find((book) => book.file.path === bookSelect.value);
      if (!next) return;
      this.plugin.manuscriptBookSelection.select(
        next.file.path,
        next.result.scenes[0]?.path ?? next.file.path,
        "continuity-review"
      );
    };
    const returnButton = headerActions.createEl("button", { text: "Return to manuscript", attr: { type: "button" } });
    returnButton.disabled = !this.originLeaf && !this.originPath;
    returnButton.onclick = () => void this.returnToManuscript();

    if (this.loading) {
      container.createEl("p", { cls: "mwc-continuity-review-empty", text: "Updating continuity scope…" }).setAttr("role", "status");
      return;
    }
    if (!collection) {
      container.createEl("p", { cls: "mwc-continuity-review-empty", text: "Open a manuscript chapter, then open Continuity Review." });
      return;
    }
    const input = {
      observations: collection.observations,
      dispositions: new Map(this.plugin.storeService.getContinuityDispositionRecords().map((record) => [record.lineageKey, record])),
      manuscriptScope: collection.scope
    };
    let projection = projectContinuityReview(input, this.filters);
    const reconciled = reconcileContinuityReviewFilters(this.filters, projection.filterOptions);
    if (
      reconciled.type !== this.filters.type
      || reconciled.locationPath !== this.filters.locationPath
      || reconciled.entityPath !== this.filters.entityPath
    ) {
      this.filters = reconciled;
      projection = projectContinuityReview(input, this.filters);
    }
    this.renderCounts(header, projection);
    this.renderFilters(container, projection);
    this.renderWorkspace(container, projection);
  }

  private renderCounts(header: HTMLElement, projection: ContinuityReviewProjection) {
    header.createEl("p", {
      cls: "mwc-continuity-review-counts",
      text: `${projection.counts.active} active · ${projection.counts.reviewed} reviewed · Showing ${projection.counts.displayed}`
    }).setAttr("aria-live", "polite");
  }

  private renderFilters(container: HTMLElement, projection: ContinuityReviewProjection) {
    const filters = container.createDiv("mwc-continuity-review-filters");
    const select = (
      label: string,
      current: string | null,
      options: readonly { value: string; label: string }[],
      allLabel: string | null,
      change: (value: string | null) => void
    ) => {
      const host = filters.createEl("label"); host.createSpan({ text: label });
      const control = host.createEl("select");
      if (allLabel !== null) control.createEl("option", { value: "", text: allLabel });
      for (const option of options) control.createEl("option", { value: option.value, text: option.label });
      control.value = current ?? "";
      control.onchange = () => { change(control.value || null); this.render(); };
    };
    select("Queue", this.filters.queue, [
      { value: "active", label: "Active" }, { value: "reviewed", label: "Reviewed" }, { value: "all", label: "All" }
    ], null, (value) => this.filters = { ...this.filters, queue: value === "reviewed" || value === "all" ? value : "active" });
    select("Type", this.filters.type, projection.filterOptions.types, "All types", (value) => this.filters = { ...this.filters, type: value });
    select("Location", this.filters.locationPath, projection.filterOptions.locations, "All locations", (value) => this.filters = { ...this.filters, locationPath: value });
    if (projection.filterOptions.entities.length > 0) {
      select("Entity", this.filters.entityPath, projection.filterOptions.entities, "All entities", (value) => this.filters = { ...this.filters, entityPath: value });
    }
  }

  private renderWorkspace(container: HTMLElement, projection: ContinuityReviewProjection) {
    if (projection.items.length === 0) {
      container.createEl("p", { cls: "mwc-continuity-review-empty", text: "No current observations match these filters." });
      return;
    }
    if (!projection.items.some((item) => item.observation.lineageKey === this.selectedLineage)) {
      this.selectedLineage = projection.items[0].observation.lineageKey;
    }
    const workspace = container.createDiv(`mwc-continuity-review-workspace ${this.narrowDetail ? "is-showing-detail" : ""}`);
    const list = workspace.createDiv({ cls: "mwc-continuity-review-list", attr: { role: "list", "aria-label": "Continuity observations" } });
    projection.items.forEach((item, index) => this.renderListItem(list, item, projection.items, index));
    const selected = projection.items.find((item) => item.observation.lineageKey === this.selectedLineage) ?? projection.items[0];
    this.renderDetail(workspace, selected);
  }

  private renderListItem(container: HTMLElement, item: ContinuityReviewItem, items: readonly ContinuityReviewItem[], index: number) {
    const selected = item.observation.lineageKey === this.selectedLineage;
    const presentation = projectContinuityReviewPresentation(item);
    const row = container.createEl("article", {
      cls: `mwc-continuity-review-row mwc-continuity-review-row--${item.observation.severity}`,
      attr: { role: "listitem", "aria-current": selected ? "true" : "false" }
    });
    const button = row.createEl("button", {
      cls: "mwc-continuity-review-row-main",
      attr: { type: "button", "aria-label": `${presentation.primaryTitle}: ${presentation.finding}` }
    });
    if (presentation.listContext) button.createSpan({ cls: "mwc-continuity-review-row-context", text: presentation.listContext });
    button.createSpan({ cls: "mwc-continuity-review-row-title", text: presentation.primaryTitle });
    button.createSpan({ cls: "mwc-continuity-review-row-finding", text: presentation.finding });
    const marker = presentation.stateMarker ?? item.observation.severity;
    button.createSpan({ cls: "mwc-continuity-review-row-status", text: marker });
    const showDetail = () => { this.selectedLineage = item.observation.lineageKey; this.narrowDetail = true; this.render(); };
    button.onclick = showDetail;
    button.ondblclick = (event) => {
      event.preventDefault();
      void this.openEvidence(presentation.primaryTarget.path, event.metaKey || event.ctrlKey);
    };
    button.onkeydown = (event) => {
      const intent = continuityListNavigationIntent(event);
      if (intent) {
        event.preventDefault();
        if (intent === "primary") void this.openEvidence(presentation.primaryTarget.path, true);
        else showDetail();
        return;
      }
      let target = index;
      if (event.key === "ArrowDown") target = Math.min(items.length - 1, index + 1);
      else if (event.key === "ArrowUp") target = Math.max(0, index - 1);
      else if (event.key === "Home") target = 0;
      else if (event.key === "End") target = items.length - 1;
      else return;
      event.preventDefault();
      this.selectedLineage = items[target].observation.lineageKey;
      this.render();
      const rows = this.containerEl.querySelectorAll<HTMLButtonElement>(".mwc-continuity-review-row-main");
      rows[target]?.focus();
    };
    if (selected) {
      const open = row.createEl("button", {
        cls: "mwc-continuity-review-row-open",
        text: "Open note",
        attr: { type: "button", "aria-label": `Open ${presentation.primaryTitle}` }
      });
      open.onclick = (event) => void this.openEvidence(presentation.primaryTarget.path, event.metaKey || event.ctrlKey);
    }
  }

  private renderDetail(container: HTMLElement, item: ContinuityReviewItem) {
    const observation = item.observation;
    const presentation = projectContinuityReviewPresentation(item);
    const detail = container.createEl("article", { cls: "mwc-continuity-review-detail", attr: { tabindex: "-1" } });
    const back = detail.createEl("button", { cls: "mwc-continuity-review-back", text: "Back to findings", attr: { type: "button" } });
    back.onclick = () => { this.narrowDetail = false; this.render(); };
    detail.onkeydown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.narrowDetail = false;
      this.render();
      this.containerEl.querySelector<HTMLButtonElement>(".mwc-continuity-review-row[aria-current='true'] .mwc-continuity-review-row-main")?.focus();
    };
    if (presentation.locationContext) detail.createEl("p", { cls: "mwc-continuity-review-detail-context", text: presentation.locationContext });
    detail.createEl("h3", { text: presentation.finding });
    detail.createEl("p", { cls: "mwc-continuity-review-detail-explanation", text: presentation.explanation });
    const primary = detail.createEl("button", {
      cls: "mwc-continuity-review-primary-action mod-cta",
      text: `Open ${continuityNoteLabel(presentation.primaryTarget)}`,
      attr: { type: "button" }
    });
    primary.onclick = (event) => void this.openEvidence(presentation.primaryTarget.path, event.metaKey || event.ctrlKey);
    const unresolvedReference = continuityUnresolvedReference(item);
    if (unresolvedReference) {
      const actions = detail.createDiv("mwc-continuity-review-reference-actions");
      const copyReference = actions.createEl("button", { text: "Copy unresolved reference", attr: { type: "button" } });
      copyReference.onclick = () => void this.copyText(unresolvedReference, "Unresolved reference copied.");
    }
    renderContinuityDispositionControls(detail, observation, item.match, this.plugin.storeService);
    if (presentation.evidenceGroups.length > 0) {
      const evidence = detail.createEl("section", { cls: "mwc-continuity-review-evidence" });
      evidence.createEl("h4", { text: "Evidence" });
      for (const group of presentation.evidenceGroups) {
        const section = evidence.createEl("section", { cls: "mwc-continuity-review-evidence-group" });
        section.createEl("h5", { text: group.name });
        const rows = section.createEl("dl");
        for (const item of group.rows) {
          const row = rows.createDiv("mwc-continuity-review-evidence-row");
          row.createEl("dt", { text: item.label });
          row.createEl("dd", { text: item.value });
        }
      }
    }
    if (presentation.relatedNotes.length > 0) {
      const related = detail.createEl("section", { cls: "mwc-continuity-review-related" });
      related.createEl("h4", { text: "Related notes" });
      const list = related.createEl("ul");
      for (const note of presentation.relatedNotes) {
        const entry = list.createEl("li");
        const link = entry.createEl("button", { text: continuityNoteLabel(note), attr: { type: "button" } });
        link.onclick = (event) => void this.openEvidence(note.path, event.metaKey || event.ctrlKey);
      }
    }
    if (shouldShowContinuityDiagnostics(this.plugin.continuityDiagnosticPreference)) {
      const diagnostic = detail.createEl("details", { cls: "mwc-continuity-review-technical" });
      diagnostic.open = CONTINUITY_DIAGNOSTIC_DETAILS_OPEN_BY_DEFAULT;
      diagnostic.createEl("summary", { text: "Diagnostic details" });
      const copy = diagnostic.createEl("button", { text: "Copy diagnostics", attr: { type: "button" } });
      copy.onclick = () => void this.copyText(JSON.stringify(buildContinuityDiagnosticPayload(
        item,
        this.bookPath ?? "",
        this.plugin.manifest.version
      ), null, 2), "Continuity diagnostics copied.");
      diagnostic.createEl("p", { text: `${readableKind(observation.kind)} · ${observation.rule.id} v${observation.rule.version}` });
      diagnostic.createEl("p", { text: `Lineage: ${observation.lineageKey}` });
      diagnostic.createEl("p", { text: `Fingerprint: ${observation.fingerprint}` });
      const diagnosticRows = diagnostic.createEl("dl");
      for (const evidence of presentation.technicalEvidence) {
        const row = diagnosticRows.createDiv("mwc-continuity-review-technical-row");
        row.createEl("dt", { text: evidence.role.replace(/_/g, " ") });
        const label = evidence.source.note.label?.trim() || labelForPath(evidence.source.note.path);
        const value = row.createEl("dd");
        value.createSpan({ text: `${label} · ${evidence.source.property.join(".")} · ${evidenceValue(evidence)} ` });
        const open = value.createEl("button", { text: "Open property note", attr: { type: "button" } });
        open.onclick = (event) => void this.openEvidence(evidence.source.note.path, event.metaKey || event.ctrlKey);
      }
    }
  }

  private async copyText(value: string, success: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      new Notice(success);
    } catch {
      new Notice("Could not copy to the clipboard.");
    }
  }

  private async openEvidence(path: string, newTab: boolean) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) { new Notice("That authoritative note could not be opened."); return; }
    let leaf: WorkspaceLeaf | null = null;
    this.app.workspace.iterateRootLeaves((candidate) => {
      if (!leaf && candidate !== this.leaf && candidate.view instanceof MarkdownView && candidate.view.file?.path === path) leaf = candidate;
    });
    leaf = leaf ?? this.app.workspace.getLeaf(newTab ? "split" : "tab");
    await leaf.openFile(file, { active: true });
    await this.app.workspace.revealLeaf(leaf);
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }

  private async returnToManuscript() {
    if (this.originLeaf) {
      try {
        await this.app.workspace.revealLeaf(this.originLeaf);
        this.app.workspace.setActiveLeaf(this.originLeaf, { focus: true });
        return;
      } catch { this.originLeaf = null; }
    }
    if (this.originPath) await this.openEvidence(this.originPath, true);
  }
}
