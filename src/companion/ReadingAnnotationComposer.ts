import { App, Modal, Notice } from "obsidian";
import type { Annotation } from "../editorial/EditorialNote";
import { renderAnnotationCard } from "../ui/AnnotationCard";

/** Reuse the Companion annotation editor; cancellation never creates a stored record. */
export class ReadingAnnotationComposer extends Modal {
  private saving = false;
  private closed = false;
  constructor(app: App, private readonly annotation: Annotation,
    private readonly save: (body: string, category: string) => Promise<void>, private readonly done: () => void, private readonly heading = "Annotate selected passage") {
    super(app);
  }
  onOpen(): void {
    this.titleEl.setText(this.heading);
    const card = renderAnnotationCard(this.contentEl, this.annotation, async (_, patch) => {
      Object.assign(this.annotation, patch);
    }, this.annotation.id, undefined, undefined, undefined, "open", undefined, true);
    const actions = this.contentEl.createDiv("mwc-annotation-footer");
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.onclick = () => { if (!this.saving) this.close(); };
    const save = actions.createEl("button", { text: "Save annotation", cls: "mod-cta" });
    save.onclick = async () => {
      if (this.saving) return;
      this.saving = true; save.disabled = true; cancel.disabled = true;
      try {
        await this.save(card.querySelector("textarea")!.value, card.querySelector("select")!.value);
        this.saving = false;
        this.close();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "Could not save annotation.");
      } finally { this.saving = false; save.disabled = false; cancel.disabled = false; }
    };
  }
  override close(): void { if (!this.saving) this.dispose(); }
  dispose(): void { if (!this.closed) super.close(); }
  onClose(): void { this.closed = true; this.done(); this.contentEl.empty(); }
}
