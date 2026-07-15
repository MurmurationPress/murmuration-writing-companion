import { MarkdownRenderer, TFile, WorkspaceLeaf } from "obsidian";
import MurmurationWritingCompanionPlugin from "../main";
import {
  BOOK_REVIEW_MODE_LABELS,
  BOOK_REVIEW_MODE_OPTIONS,
  getBookReviewStatusOptions,
  getBookReviewStatusValue
} from "../editorial/BookReview";
import {
  EDITORIAL_PASS_LABELS,
  isEditorialPassKey
} from "../editorial/EditorialPass";
import {
  EDITABLE_CHAPTER_CONTEXT_FIELDS,
  getChapterContextInputType,
  getChapterContextSelectOptions,
  getEditableChapterContextValue
} from "./ChapterContext";
import {
  collectPovSuggestionValues,
  PovSuggestion,
  resolvePovInput
} from "./PovSuggestions";
import {
  VIEW_TYPE,
  WritingCompanionView as BaseWritingCompanionView
} from "./WritingCompanionView";

export { VIEW_TYPE };

let nextPovSuggestionListId = 0;

export class WritingCompanionView extends BaseWritingCompanionView {
  constructor(leaf: WorkspaceLeaf, plugin: MurmurationWritingCompanionPlugin) {
    super(leaf, plugin);
  }

  renderBookReview(container: Element, chapter: TFile) {
    const book = this.plugin.getOwningBook(chapter);
    if (!book) return;

    const frontmatter = this.app.metadataCache.getFileCache(book)?.frontmatter as
      Record<string, unknown> | undefined;
    const reviewMode = this.plugin.storeService.getBookReviewMode(book);
    const reviewStatus = getBookReviewStatusValue(frontmatter);
    const section = container.createDiv("mwc-section mwc-book-review");
    section.createEl("h3", { text: "Book Review" });

    const titleRow = section.createDiv("mwc-book-review-title");
    titleRow.createSpan({ text: book.basename });
    const openBook = titleRow.createEl("button", {
      cls: "mwc-book-review-link",
      text: "Open book",
      attr: { type: "button", "aria-label": `Open book note ${book.basename}` }
    });
    openBook.onclick = () => {
      void this.app.workspace.openLinkText(
        book.path.replace(/\.md$/i, ""),
        chapter.path,
        false
      );
    };

    const list = section.createEl("dl", {
      cls: "mwc-context-list",
      attr: { "aria-label": `Editorial review for ${book.basename}` }
    });

    const modeRow = this.createContextRow(list, "Review mode", "Portable book review mode");
    const modeSelect = modeRow.value.createEl("select", {
      cls: "mwc-context-input mwc-context-select",
      attr: { "aria-label": "Current book review mode" }
    });
    const blankMode = modeSelect.createEl("option", { text: "—" });
    blankMode.value = "";
    for (const mode of BOOK_REVIEW_MODE_OPTIONS) {
      const option = modeSelect.createEl("option", {
        text: BOOK_REVIEW_MODE_LABELS[mode]
      });
      option.value = mode;
    }
    modeSelect.value = reviewMode ?? "";
    modeSelect.onchange = () => {
      const mode = isEditorialPassKey(modeSelect.value) ? modeSelect.value : null;
      void this.plugin.storeService.setBookReviewMode(book, mode);
    };

    const statusRow = this.createContextRow(
      list,
      "Review status",
      `Markdown property: ${reviewStatus.property}`
    );
    const statusSelect = statusRow.value.createEl("select", {
      cls: "mwc-context-input mwc-context-select",
      attr: { "aria-label": "Book review status" }
    });
    for (const status of getBookReviewStatusOptions(reviewStatus.value)) {
      const option = statusSelect.createEl("option", { text: status.label });
      option.value = status.value;
    }
    statusSelect.value = reviewStatus.value;
    statusSelect.onchange = () => {
      void this.plugin.updateBookReviewStatus(book, statusSelect.value);
    };
  }

  override renderChapterContext(container: Element, file: TFile) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as
      Record<string, unknown> | undefined;
    const section = container.createDiv("mwc-section mwc-chapter-context");
    section.createEl("h3", { text: "Chapter Context" });

    const list = section.createEl("dl", {
      cls: "mwc-context-list",
      attr: { "aria-label": `Chapter context for ${file.basename}` }
    });

    for (const field of EDITABLE_CHAPTER_CONTEXT_FIELDS) {
      const contextValue = getEditableChapterContextValue(frontmatter, field);
      const row = this.createContextRow(
        list,
        field.label,
        `Markdown property: ${contextValue.property}`,
        true
      );
      const value = row.value;

      const save = async (nextValue: string) => {
        if (contextValue.value.trim() === nextValue.trim()) return;
        await this.plugin.updateChapterContextProperty(file, field, nextValue.trim());
      };

      if (field.key === "pov") {
        this.renderCompactPov(value, contextValue.value, file, field.placeholder, save);
        continue;
      }

      if (field.key === "editorial_pass") {
        this.renderEditorialPassState(value, contextValue.value, file);
        continue;
      }

      const placeholder = field.key === "title" ? file.basename : field.placeholder;
      const selectOptions = getChapterContextSelectOptions(field, contextValue.value);

      if (selectOptions) {
        const editor = value.createEl("select", {
          cls: "mwc-context-input mwc-context-select",
          attr: { "aria-label": field.label }
        });
        for (const option of selectOptions) {
          const optionEl = editor.createEl("option", { text: option.label });
          optionEl.value = option.value;
        }
        editor.value = contextValue.value;
        editor.onchange = () => void save(editor.value);
      } else if (field.multiline) {
        const editor = value.createEl("textarea", {
          cls: "mwc-context-input mwc-context-input--multiline",
          attr: { placeholder, "aria-label": field.label }
        });
        editor.value = contextValue.value;
        editor.onblur = () => void save(editor.value);
      } else {
        const editor = value.createEl("input", {
          cls: "mwc-context-input",
          type: getChapterContextInputType(field, contextValue.value),
          attr: { placeholder, "aria-label": field.label }
        });
        editor.value = contextValue.value;
        editor.onchange = () => void save(editor.value);
        editor.onkeydown = (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          editor.blur();
        };
      }
    }
  }

  private createContextRow(
    list: HTMLElement,
    label: string,
    title: string,
    editable = false
  ): { row: HTMLDivElement; value: HTMLElement } {
    const row = list.createDiv(
      editable ? "mwc-context-row mwc-context-row--editable" : "mwc-context-row"
    );
    row.createEl("dt", { cls: "mwc-context-label", text: label });
    const value = row.createEl("dd", {
      cls: editable
        ? "mwc-context-value mwc-context-value--editable"
        : "mwc-context-value",
      attr: { title }
    });
    return { row, value };
  }

  private renderCompactPov(
    container: HTMLElement,
    currentValue: string,
    file: TFile,
    placeholder: string,
    save: (value: string) => Promise<void>
  ) {
    const renderResting = (value: string) => {
      container.empty();
      const display = container.createDiv({
        cls: "mwc-pov-display",
        attr: { tabindex: "0", role: "group", "aria-label": "POV character" }
      });
      const rendered = display.createDiv({ cls: "mwc-pov-value" });

      if (value.trim()) {
        this.renderMarkdownValue(rendered, value, file);
      } else {
        rendered.createSpan({ cls: "mwc-pov-placeholder", text: placeholder });
      }

      const edit = display.createEl("button", {
        cls: "mwc-pov-edit",
        text: "Edit",
        attr: { type: "button", "aria-label": "Edit POV character" }
      });
      const startEditing = () => renderEditor(value);
      edit.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        startEditing();
      };
      display.onclick = (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("a.internal-link, button")) return;
        startEditing();
      };
      display.onkeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const target = event.target;
        if (target instanceof Element && target.closest("a.internal-link, button")) return;
        event.preventDefault();
        startEditing();
      };
    };

    const renderEditor = (value: string) => {
      container.empty();
      const suggestions = this.plugin.getPovSuggestions(file);
      const listId = `mwc-pov-suggestions-${++nextPovSuggestionListId}`;
      const editor = container.createEl("input", {
        cls: "mwc-context-input mwc-pov-input",
        attr: { placeholder, "aria-label": "POV character", list: listId }
      });
      editor.value = value;

      const list = container.createEl("datalist", { attr: { id: listId } });
      this.renderPovSuggestionOptions(list, suggestions);

      let closed = false;
      const commit = async () => {
        if (closed) return;
        closed = true;
        const nextValue = resolvePovInput(editor.value, suggestions);
        await save(nextValue);
        renderResting(nextValue);
      };
      const cancel = () => {
        if (closed) return;
        closed = true;
        renderResting(value);
      };

      editor.onkeydown = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void commit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      };
      editor.onblur = () => window.setTimeout(() => void commit(), 0);
      editor.focus();
      editor.select();
    };

    renderResting(currentValue);
  }

  private renderPovSuggestionOptions(
    list: HTMLDataListElement,
    suggestions: readonly PovSuggestion[]
  ) {
    for (const value of collectPovSuggestionValues(suggestions)) {
      const suggestion = suggestions.find((candidate) => candidate.matches.includes(value));
      const option = list.createEl("option");
      option.value = value;
      if (suggestion && suggestion.entity.name !== value) {
        option.label = suggestion.entity.name;
      }
    }
  }

  private renderEditorialPassState(
    container: HTMLElement,
    frontmatterValue: string,
    file: TFile
  ) {
    const state = this.plugin.getEditorialPassState(file);
    const displayValue = state.frontier
      ? EDITORIAL_PASS_LABELS[state.frontier]
      : state.projection.managed
        ? "No pass reached"
        : frontmatterValue.trim() || "No pass reached";
    container.createDiv({
      cls: displayValue === "No pass reached"
        ? "mwc-context-static mwc-context-static--empty"
        : "mwc-context-static",
      text: displayValue
    });

    if (state.projection.status === "match" || state.projection.status === "unmanaged") {
      return;
    }

    const note = container.createDiv({ cls: "mwc-context-projection-note" });
    const messages: Record<string, string> = {
      missing: "Markdown projection is missing.",
      mismatch: "Markdown differs from editorial history.",
      unknown: "Markdown contains an unmanaged value."
    };
    note.createSpan({
      text: messages[state.projection.status] ?? "Markdown projection needs attention."
    });
    const repair = note.createEl("button", {
      cls: "mwc-projection-repair",
      text: "Repair",
      attr: { type: "button", "aria-label": "Repair editorial pass projection" }
    });
    repair.onclick = () => {
      repair.disabled = true;
      void this.plugin.repairEditorialPassProjection(file).catch((error) => {
        console.error("Writing Companion could not repair editorial pass projection", error);
        repair.disabled = false;
      });
    };
  }

  private renderMarkdownValue(container: HTMLElement, markdown: string, file: TFile) {
    void MarkdownRenderer.render(this.app, markdown, container, file.path, this);

    container.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a.internal-link");
      if (!link || !container.contains(link)) return;
      const destination = link.dataset.href ?? link.getAttribute("href");
      if (!destination) return;

      event.preventDefault();
      event.stopPropagation();
      void this.app.workspace.openLinkText(
        destination,
        file.path,
        event.metaKey || event.ctrlKey
      );
    });
  }
}
