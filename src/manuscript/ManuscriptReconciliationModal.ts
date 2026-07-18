import { App, Modal } from "obsidian";
import type { ObsidianManuscriptBook } from "./ObsidianManuscript";
import { planObsidianManuscriptReconciliation } from "./ObsidianManuscriptReconciliation";
import {
  ManuscriptReconciliationChoices,
  ManuscriptReconciliationPlan,
  manuscriptReconciliationPlacementOptions
} from "./ManuscriptReconciliation";

function describeValue(value: unknown): string {
  if (value === undefined) return "removed";
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(describeValue).join(", ")}]`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function actionRow(parent: HTMLElement): HTMLElement {
  const row = parent.createDiv();
  row.style.display = "flex";
  row.style.justifyContent = "flex-end";
  row.style.gap = "8px";
  row.style.marginTop = "18px";
  return row;
}

class ManuscriptReconciliationModal extends Modal {
  private settled = false;
  private closed = false;
  private refreshing = false;
  private readonly placements: Record<string, ManuscriptReconciliationChoices["placements"][string]> = {};
  private readonly rebalanceParents = new Set<string>();
  private currentPlan: ManuscriptReconciliationPlan | null = null;

  constructor(
    app: App,
    private readonly book: ObsidianManuscriptBook,
    private readonly resolve: (plan: ManuscriptReconciliationPlan | null) => void
  ) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText("Reconcile manuscript");
    void this.refresh();
  }

  onClose() {
    this.closed = true;
    this.contentEl.empty();
    if (!this.settled) this.resolve(null);
  }

  private choices(): ManuscriptReconciliationChoices {
    return {
      placements: { ...this.placements },
      rebalanceParents: [...this.rebalanceParents]
    };
  }

  private async refresh() {
    if (this.refreshing || this.closed) return;
    this.refreshing = true;
    try {
      this.currentPlan = await planObsidianManuscriptReconciliation(
        this.app,
        this.book,
        this.choices()
      );
      if (!this.closed) this.render();
    } finally {
      this.refreshing = false;
    }
  }

  private render() {
    const plan = this.currentPlan;
    this.contentEl.empty();
    if (!plan) {
      this.contentEl.createEl("p", { text: "Inspecting manuscript structure…" });
      return;
    }

    if (plan.alreadyReconciled) {
      this.contentEl.createEl("p", {
        text: `${plan.bookTitle} has no structural drift to reconcile.`
      });
      const actions = actionRow(this.contentEl);
      const close = actions.createEl("button", { text: "Close", cls: "mod-cta" });
      close.onclick = () => this.finish(null);
      return;
    }

    this.contentEl.createEl("p", {
      text: "Review each discrepancy. MWC will not invent a position or silently rewrite unrelated notes."
    });

    const automatic = plan.issues.filter((issue) => (
      issue.kind === "canonical_parent" || issue.kind === "obsolete_array"
    ));
    if (automatic.length > 0) {
      this.contentEl.createEl("h3", { text: "Unambiguous repairs" });
      const list = this.contentEl.createEl("ul");
      for (const issue of automatic) list.createEl("li", { text: issue.message });
    }

    const placements = plan.issues.filter((issue) => issue.kind === "placement" && issue.path);
    if (placements.length > 0) {
      this.contentEl.createEl("h3", { text: "Position required" });
      for (const issue of placements) {
        const block = this.contentEl.createDiv();
        block.style.margin = "10px 0";
        block.createEl("div", { text: issue.message });
        const select = block.createEl("select", {
          attr: { "aria-label": `Choose position for ${issue.path}` }
        });
        select.style.width = "100%";
        select.style.marginTop = "5px";
        select.createEl("option", { text: "Choose a deliberate position…", value: "" });
        const options = manuscriptReconciliationPlacementOptions({
          book: this.book.record,
          result: this.book.result,
          frontmatterByPath: new Map()
        }, issue.path!);
        const selected = this.placements[issue.path!];
        let selectedId = "";
        for (const option of options) {
          select.createEl("option", { text: option.label, value: option.id });
          if (
            selected
            && selected.parentPath === option.choice.parentPath
            && selected.position === option.choice.position
            && selected.targetPath === option.choice.targetPath
          ) selectedId = option.id;
        }
        select.value = selectedId;
        select.onchange = () => {
          const option = options.find((candidate) => candidate.id === select.value);
          if (option) this.placements[issue.path!] = option.choice;
          else delete this.placements[issue.path!];
          void this.refresh();
        };
      }
    }

    const duplicates = plan.issues.filter((issue) => (
      issue.kind === "duplicate_keys" && issue.parentPath
    ));
    if (duplicates.length > 0) {
      this.contentEl.createEl("h3", { text: "Duplicate sibling keys" });
      for (const issue of duplicates) {
        const label = this.contentEl.createEl("label");
        label.style.display = "flex";
        label.style.gap = "8px";
        label.style.alignItems = "flex-start";
        label.style.margin = "8px 0";
        const checkbox = label.createEl("input", { type: "checkbox" });
        checkbox.checked = this.rebalanceParents.has(issue.parentPath!);
        label.createSpan({
          text: `${issue.message} Rebalance only this sibling set in the order currently displayed.`
        });
        checkbox.onchange = () => {
          if (checkbox.checked) this.rebalanceParents.add(issue.parentPath!);
          else this.rebalanceParents.delete(issue.parentPath!);
          void this.refresh();
        };
      }
    }

    const blockers = plan.issues.filter((issue) => (
      issue.kind === "sync_conflict" || issue.kind === "unsupported"
    ));
    if (blockers.length > 0) {
      this.contentEl.createEl("h3", { text: "Resolve before continuing" });
      const list = this.contentEl.createEl("ul");
      for (const issue of blockers) list.createEl("li", { text: issue.message });
    }

    if (plan.files.length > 0) {
      this.contentEl.createEl("h3", { text: "Markdown changes" });
      for (const file of plan.files) {
        const details = this.contentEl.createEl("details");
        details.style.margin = "6px 0";
        details.createEl("summary", {
          text: `${file.title} — ${file.changes.length} ${file.changes.length === 1 ? "change" : "changes"}`
        });
        const list = details.createEl("ul");
        for (const change of file.changes) {
          list.createEl("li", {
            text: `${change.property}: ${describeValue(change.before)} → ${describeValue(change.after)}`
          });
        }
      }
    }

    if (plan.unresolved.length > 0) {
      const note = this.contentEl.createDiv();
      note.style.marginTop = "12px";
      note.style.color = "var(--text-muted)";
      note.createEl("strong", { text: "Still required:" });
      const list = note.createEl("ul");
      for (const message of plan.unresolved) list.createEl("li", { text: message });
    }

    const actions = actionRow(this.contentEl);
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.finish(null);
    const apply = actions.createEl("button", {
      text: "Apply reconciliation",
      cls: "mod-cta"
    });
    apply.disabled = !plan.canApply;
    apply.onclick = () => {
      if (this.currentPlan?.canApply) this.finish(this.currentPlan);
    };
  }

  private finish(plan: ManuscriptReconciliationPlan | null) {
    if (this.settled) return;
    this.settled = true;
    this.resolve(plan);
    this.close();
  }
}

export function chooseManuscriptReconciliation(
  app: App,
  book: ObsidianManuscriptBook
): Promise<ManuscriptReconciliationPlan | null> {
  return new Promise((resolve) => {
    new ManuscriptReconciliationModal(app, book, resolve).open();
  });
}
