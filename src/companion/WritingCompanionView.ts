import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import MurmurationWritingCompanionPlugin from "../main";
import { PageEditorialNotes } from "../editorial/EditorialNote";
import { renderNoteCard } from "../ui/NoteCard";

export const VIEW_TYPE = "murmuration-writing-companion-view";

export class WritingCompanionView extends ItemView {
  plugin: MurmurationWritingCompanionPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: MurmurationWritingCompanionPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Writing Companion";
  }

  getIcon() {
    return "notebook-pen";
  }

  async onOpen() {
    this.render();
  }

  render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("mwc-container");

    const file = this.plugin.getCurrentChapter();
    const focusNoteId = this.plugin.consumePendingFocusNoteId();

    container.createEl("h2", { text: "Writing Companion" });

    if (!file) {
      container.createEl("p", {
        cls: "mwc-muted",
        text: "Open a Markdown page to view its notes."
      });
      return;
    }

    container.createEl("div", {
      cls: "mwc-file-name",
      text: file.basename
    });

    const page = this.plugin.storeService.getPage(file);

    this.renderDocumentNotes(container, file, page, focusNoteId);
    this.renderAnnotations(container, page, focusNoteId);
  }

  renderDocumentNotes(
    container: Element,
    file: TFile,
    page: PageEditorialNotes,
    focusNoteId: string | null
  ) {
    const section = container.createDiv("mwc-section");
    section.createEl("h3", { text: "Document Notes" });

    const addButton = section.createEl("button", {
      cls: "mwc-button",
      text: "Add document note"
    });

    addButton.onclick = async () => {
      await this.plugin.storeService.addDocumentNote(
        file,
        "New document note",
        "Editorial"
      );
    };

    const notes = page.documentNotes.filter((note) => note.status === "open");

    if (notes.length === 0) {
      section.createEl("p", {
        cls: "mwc-muted",
        text: "No open document notes."
      });
    }

    for (const note of notes) {
      renderNoteCard(
        section,
        note,
        this.plugin.storeService.updateNote.bind(this.plugin.storeService),
        focusNoteId
      );
    }
  }

  renderAnnotations(
    container: Element,
    page: PageEditorialNotes,
    focusNoteId: string | null
  ) {
    const section = container.createDiv("mwc-section");
    section.createEl("h3", { text: "Annotations" });

    const annotations = page.annotations.filter((note) => note.status === "open");

    if (annotations.length === 0) {
      section.createEl("p", {
        cls: "mwc-muted",
        text: "No open annotations."
      });
    }

    for (const annotation of annotations) {
      const card = renderNoteCard(
        section,
        annotation,
        this.plugin.storeService.updateNote.bind(this.plugin.storeService),
        focusNoteId
      );

      card.createEl("blockquote", {
        cls: "mwc-anchor",
        text: annotation.anchor.text
      });

      if (annotation.anchor.line) {
        card.createEl("div", {
          cls: "mwc-line",
          text: `Line ${annotation.anchor.line}`
        });
      }
    }
  }
}
