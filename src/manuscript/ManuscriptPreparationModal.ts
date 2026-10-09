import { App, Modal } from "obsidian";
import {
  describePreparationValue,
  ManuscriptPreparationPlan
} from "./ManuscriptPreparation";

const STATE_LABELS: Record<ManuscriptPreparationPlan["state"], string> = {
  fully_prepared: "Prepared manuscript",
  legacy_array: "Legacy Book order",
  deterministic_folder_order: "Folder and natural filename order",
  partially_distributed: "Partially prepared",
  conflicting_distributed_metadata: "Conflicting metadata",
  malformed_or_incomplete_legacy_metadata: "Malformed or incomplete legacy order",
  ambiguous_hierarchy: "Ambiguous hierarchy",
  unsupported_or_unrecognised: "Unrecognised manuscript"
};

function describeChange(property: string, before: unknown, after: unknown): string {
  if (before === undefined) return `Add ${property}: ${describePreparationValue(after)}`;
  if (after === undefined) return `Remove ${property} (currently ${describePreparationValue(before)})`;
  return `Replace ${property}: ${describePreparationValue(before)} → ${describePreparationValue(after)}`;
}

export class ManuscriptPreparationModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private plan: ManuscriptPreparationPlan,
    private readonly resolve: (accepted: boolean) => void,
    private readonly reviewBody?: (container: HTMLElement) => void,
    private readonly actionLabel = "Prepare manuscript"
  ) {
    super(app);
  }

  updatePlan(plan: ManuscriptPreparationPlan) {
    this.plan = plan;
    this.onOpen();
  }

  onOpen() {
    this.contentEl.empty();
    this.titleEl.setText(this.reviewBody ? "Review manuscript inclusion" : "Prepare existing manuscript");
    this.contentEl.createEl("p", {
      text: this.plan.alreadyPrepared
        ? `${this.plan.bookTitle} is already prepared.`
        : `Review structural properties for ${this.plan.bookTitle}.`
    });
    this.contentEl.createEl("p", { text: `Detected structure: ${STATE_LABELS[this.plan.state]}. Order source: ${this.plan.source.replace(/_/g, " ")}.` });

    this.contentEl.createEl("p", {
      cls: "mwc-muted",
      text: "Review parent and sibling keys. Prose, paths and unrelated properties stay intact. Failed writes roll back; Undo restores unedited notes."
    });

    this.reviewBody?.(this.contentEl);

    if (this.plan.diagnostics.length > 0) {
      const warning = this.contentEl.createEl("section");
      warning.createEl("h3", { text: "Preparation blocked" });
      const list = warning.createEl("ul");
      for (const diagnostic of this.plan.diagnostics) {
        list.createEl("li", {
          text: diagnostic.path
            ? `${diagnostic.path}: ${diagnostic.message}`
            : diagnostic.message
        });
      }
    }

    if (this.plan.files.length > 0 && !this.reviewBody) {
      const count = (kind: string) => this.plan.files.filter(file => file.kind === kind).length;
      const summary = this.contentEl.createEl("p", {
        text: `${count("book")} Book, ${count("part")} Parts and ${count("scene")} Scenes; ${count("excluded")} exclusions (scene-draft).`
      });
      summary.style.fontWeight = "600";

      const changes = this.contentEl.createEl("div");
      changes.style.cssText = "max-height:52vh;overflow-y:auto;padding-right:6px";

      for (const file of this.plan.files) {
        const details = changes.createEl("details");
        details.style.marginBottom = "8px";
        details.createEl("summary", {
          text: `${file.title}${file.kind === "excluded" ? " (excluded)" : ""} — ${file.changes.length} ${file.changes.length === 1 ? "change" : "changes"}`
        });
        details.createEl("div", {
          cls: "mwc-muted",
          text: file.path
        });
        const list = details.createEl("ul");
        for (const change of file.changes) {
          list.createEl("li", {
            text: describeChange(change.property, change.before, change.after)
          });
        }
      }
    }

    const actions = this.contentEl.createDiv();
    actions.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:16px";

    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.finish(false);

    if (this.plan.canApply || this.reviewBody && this.plan.alreadyPrepared) {
      const prepare = actions.createEl("button", {
        text: this.actionLabel,
        cls: "mod-cta"
      });
      prepare.onclick = () => this.finish(true);
      window.setTimeout(() => prepare.focus(), 0);
    } else {
      window.setTimeout(() => cancel.focus(), 0);
    }
  }

  onClose() {
    this.contentEl.empty();
    if (!this.settled) this.resolve(false);
  }

  private finish(accepted: boolean) {
    if (this.settled) return;
    this.settled = true;
    this.resolve(accepted);
    this.close();
  }
}

export function confirmManuscriptPreparation(
  app: App,
  plan: ManuscriptPreparationPlan
): Promise<boolean> {
  return new Promise((resolve) => {
    new ManuscriptPreparationModal(app, plan, resolve).open();
  });
}
