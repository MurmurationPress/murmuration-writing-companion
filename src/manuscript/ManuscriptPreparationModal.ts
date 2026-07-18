import { App, Modal } from "obsidian";
import {
  describePreparationValue,
  ManuscriptPreparationPlan
} from "./ManuscriptPreparation";

export class ManuscriptPreparationModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly plan: ManuscriptPreparationPlan,
    private readonly resolve: (accepted: boolean) => void
  ) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText("Prepare existing manuscript");
    this.contentEl.createEl("p", {
      text: this.plan.alreadyPrepared
        ? `${this.plan.bookTitle} already uses distributed manuscript order keys.`
        : `Review the proposed structural metadata for ${this.plan.bookTitle}.`
    });

    this.contentEl.createEl("p", {
      cls: "mwc-muted",
      text: "Each part and scene will own its parent and sibling order key. Files, folders and existing reporting properties will not be renamed, moved or removed."
    });

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

    if (this.plan.files.length > 0) {
      const summary = this.contentEl.createEl("p", {
        text: `${this.plan.files.length} ${this.plan.files.length === 1 ? "note" : "notes"} will change.`
      });
      summary.style.fontWeight = "600";

      const changes = this.contentEl.createEl("div");
      changes.style.maxHeight = "52vh";
      changes.style.overflowY = "auto";
      changes.style.paddingRight = "6px";

      for (const file of this.plan.files) {
        const details = changes.createEl("details");
        details.style.marginBottom = "8px";
        details.createEl("summary", {
          text: `${file.title} — ${file.changes.length} ${file.changes.length === 1 ? "change" : "changes"}`
        });
        details.createEl("div", {
          cls: "mwc-muted",
          text: file.path
        });
        const list = details.createEl("ul");
        for (const change of file.changes) {
          list.createEl("li", {
            text: `${change.property}: ${describePreparationValue(change.before)} → ${describePreparationValue(change.after)}`
          });
        }
      }
    }

    const actions = this.contentEl.createDiv();
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";
    actions.style.marginTop = "16px";

    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.finish(false);

    if (this.plan.canApply) {
      const prepare = actions.createEl("button", {
        text: "Prepare manuscript",
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
