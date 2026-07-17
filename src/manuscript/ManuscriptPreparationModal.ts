import { App, Modal } from "obsidian";
import {
  describePreparationValue,
  ManuscriptPreparationPlan
} from "./ManuscriptPreparation";

class ConfirmManuscriptPreparationModal extends Modal {
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
      text: `Prepare ${this.plan.bookTitle} for authoritative manuscript structure.`
    });
    this.contentEl.createEl("p", {
      cls: "mwc-muted",
      text: "This adds canonical type, parent and manuscript_order metadata. Files are not renamed or moved, and existing book, Part and chapter reporting properties remain untouched."
    });

    if (this.plan.diagnostics.length > 0) {
      const warning = this.contentEl.createDiv({
        cls: "mwc-manuscript-notice mwc-manuscript-notice--warning"
      });
      warning.createEl("strong", { text: "Preparation is blocked." });
      const list = warning.createEl("ul");
      for (const diagnostic of this.plan.diagnostics) {
        list.createEl("li", { text: diagnostic.message });
      }
    }

    const summary = this.contentEl.createEl("p");
    summary.createEl("strong", {
      text: `${this.plan.files.length} ${this.plan.files.length === 1 ? "note" : "notes"}`
    });
    summary.appendText(" will be updated:");

    const preview = this.contentEl.createDiv();
    preview.style.maxHeight = "52vh";
    preview.style.overflow = "auto";
    preview.style.border = "1px solid var(--background-modifier-border)";
    preview.style.borderRadius = "6px";
    preview.style.padding = "4px 10px";

    for (const [index, file] of this.plan.files.entries()) {
      const details = preview.createEl("details");
      details.open = index < 4;
      details.createEl("summary", {
        text: `${file.title} · ${file.kind}`
      });
      const path = details.createDiv({
        cls: "mwc-muted",
        text: file.path
      });
      path.style.fontSize = "0.78em";
      path.style.margin = "4px 0";
      const changes = details.createEl("ul");

      for (const change of file.changes) {
        changes.createEl("li", {
          text: `${change.property}: ${describePreparationValue(change.before)} → ${describePreparationValue(change.after)}`
        });
      }
    }

    const actions = this.contentEl.createDiv();
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";
    actions.style.marginTop = "16px";

    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.finish(false);
    const prepare = actions.createEl("button", {
      text: "Prepare manuscript",
      cls: "mod-cta"
    });
    prepare.disabled = !this.plan.canApply;
    prepare.onclick = () => this.finish(true);
    window.setTimeout(() => (
      this.plan.canApply ? prepare.focus() : cancel.focus()
    ), 0);
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
    new ConfirmManuscriptPreparationModal(app, plan, resolve).open();
  });
}
