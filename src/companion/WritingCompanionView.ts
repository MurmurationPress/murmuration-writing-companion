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
        text: "Open a Markdown chapter to view its notes."
      });
      return;
    }

    container.createEl("div", {
      cls: "mwc-file-name",
      text: file.basename
    });

    const page = this.plugin.storeService.getPage(file);

    this.renderChapterNote(container, file, page);
    this.renderAnnotations(container, page, focusNoteId);
  }

  renderChapterNote(
    container: Element,
    file: TFile,
    page: PageEditorialNotes
  ) {
    const section = container.createDiv("mwc-section");
    section.createEl("h3", { text: "Chapter Notes" });

    const editor = section.createEl("textarea", {
      cls: "mwc-chapter-note-body",
      attr: {
        placeholder: "General notes about this chapter…",
        "aria-label": `Chapter notes for ${file.basename}`
      }
    });

    editor.value = page.chapterNote.body;

    editor.oninput = () => {
      this.plugin.storeService.updateChapterNote(file, editor.value);
    };

    editor.onblur = () => {
      void this.plugin.storeService.flushChapterNote(file);
    };
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
