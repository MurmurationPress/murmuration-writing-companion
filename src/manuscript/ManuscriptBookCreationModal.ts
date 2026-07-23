import { Modal, Notice, Setting, TFile } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import {
  manuscriptBookDefaultFolder,
  manuscriptBookDefaultPath,
  ManuscriptBookCreationPlan,
  planManuscriptBookCreation
} from "./ManuscriptBookCreation";
import {
  createObsidianManuscriptBook,
  snapshotManuscriptBookCreation,
  StaleManuscriptBookCreationError
} from "./ObsidianManuscriptBookCreation";

export interface ManuscriptBookCreationHost extends MurmurationWritingCompanionPlugin {
  refreshManuscriptNavigator(): void;
}

export class ManuscriptBookCreationModal extends Modal {
  private title = "";
  private path = "";
  private pathEdited = false;
  private preview!: HTMLElement;
  private createButton!: HTMLButtonElement;
  private pathInput: HTMLInputElement | null = null;
  private creating = false;

  constructor(private readonly plugin: ManuscriptBookCreationHost) {
    super(plugin.app);
  }

  onOpen(): void {
    this.titleEl.setText("Create manuscript book");
    this.contentEl.addClass("mwc-manuscript-book-create-modal");
    const snapshot = snapshotManuscriptBookCreation(this.app);
    const folder = manuscriptBookDefaultFolder(
      snapshot.books,
      this.plugin.manuscriptBookSelection.get().bookPath
    );

    new Setting(this.contentEl)
      .setName("Title")
      .setDesc("The authoritative author-visible book title.")
      .addText((text) => {
        text.setPlaceholder("Book title");
        text.onChange((value) => {
          this.title = value;
          if (!this.pathEdited) this.path = manuscriptBookDefaultPath(folder, value).path;
          if (this.pathInput && this.pathInput.value !== this.path) this.pathInput.value = this.path;
          this.renderPreview();
        });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(this.contentEl)
      .setName("Note location")
      .setDesc("Vault-relative Markdown path. Backslashes are normalized to slashes.")
      .addText((text) => {
        text.setPlaceholder(folder ? `${folder}/Book title.md` : "Book title.md");
        this.pathInput = text.inputEl;
        text.onChange((value) => {
          this.pathEdited = true;
          this.path = value;
          this.renderPreview();
        });
      });

    this.preview = this.contentEl.createDiv("mwc-manuscript-book-create-preview");
    const actions = this.contentEl.createDiv("modal-button-container");
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.onclick = () => { if (!this.creating) this.close(); };
    this.createButton = actions.createEl("button", {
      text: "Create book",
      cls: "mod-cta",
      attr: { type: "button" }
    });
    this.createButton.onclick = () => void this.createBook();
    this.renderPreview();
  }

  private currentPlan(): ManuscriptBookCreationPlan {
    return planManuscriptBookCreation({
      title: this.title,
      path: this.path,
      ...snapshotManuscriptBookCreation(this.app)
    });
  }

  private renderPreview(): void {
    if (!this.preview || !this.createButton) return;
    const plan = this.currentPlan();
    this.preview.empty();
    this.preview.createEl("h3", { text: "Creation preview" });
    const details = this.preview.createEl("dl");
    const detail = (label: string, value: string) => {
      const row = details.createDiv("mwc-manuscript-book-create-preview-row");
      row.createEl("dt", { text: label });
      row.createEl("dd", { text: value });
    };
    detail("Title", plan.title || "—");
    detail("Note", plan.path || "—");
    detail("Folders to create", plan.missingFolders.length > 0 ? plan.missingFolders.join(" · ") : "None");

    const defaultName = manuscriptBookDefaultPath("", this.title);
    const actualName = (plan.path.split("/").pop() ?? "").replace(/\.md$/i, "");
    if (plan.title && actualName !== plan.title) {
      this.preview.createEl("p", {
        cls: "mwc-muted",
        text: defaultName.explanation
          ? `The filename differs from the title because ${defaultName.explanation}. The title itself is unchanged.`
          : "The filename differs from the author-visible title. The title itself is unchanged."
      });
    }
    this.preview.createEl("h4", { text: "Exact Markdown" });
    this.preview.createEl("pre").createEl("code", { text: plan.markdown });
    if (plan.errors.length > 0) {
      const errors = this.preview.createEl("ul", { cls: "mwc-manuscript-book-create-errors" });
      for (const error of plan.errors) errors.createEl("li", { text: error });
    }
    this.createButton.disabled = this.creating || plan.errors.length > 0;
  }

  private async openNote(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, { active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  private async createBook(): Promise<void> {
    if (this.creating) return;
    const preview = this.currentPlan();
    if (preview.errors.length > 0) return;
    this.creating = true;
    this.renderPreview();
    try {
      const result = await createObsidianManuscriptBook(this.app, preview);
      if (result.status === "recognition-delayed") {
        this.preview.empty();
        this.preview.createEl("p", {
          text: "The book note was created and verified, but manuscript recognition is still updating. The note has been preserved."
        });
        const open = this.preview.createEl("button", { text: "Open note", attr: { type: "button" } });
        open.onclick = () => void this.openNote(result.file).catch(() => {
          new Notice(`The book note was created at ${result.file.path}, but it could not be opened.`);
        });
        this.createButton.textContent = "Close";
        this.createButton.disabled = false;
        this.createButton.onclick = () => this.close();
        return;
      }

      this.plugin.manuscriptBookSelection.select(
        result.file.path,
        result.file.path,
        "manuscript-navigator"
      );
      this.plugin.refreshManuscriptNavigator();
      this.close();
      try {
        await this.openNote(result.file);
      } catch {
        new Notice(`The book note was created and selected at ${result.file.path}, but it could not be opened.`);
      }
    } catch (error) {
      const message = error instanceof StaleManuscriptBookCreationError
        ? error.message
        : `Could not create the book: ${error instanceof Error ? error.message : String(error)}`;
      new Notice(message);
      this.creating = false;
      this.renderPreview();
    }
  }
}
