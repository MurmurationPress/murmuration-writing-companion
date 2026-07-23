import { MarkdownRenderer, Notice, TFile, WorkspaceLeaf } from "obsidian";
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
  buildPovCharacterCreationProposal,
  PovCharacterCreationProposal
} from "./PovCharacterCreation";
import { confirmPovCharacterCreation } from "./PovCharacterCreationModal";
import { createPovCharacterFromProposal } from "./ObsidianPovCharacterCreation";
import {
  collectPovSuggestionValues,
  PovSuggestion,
  resolvePovInput
} from "./PovSuggestions";
import {
  VIEW_TYPE,
  WritingCompanionView as BaseWritingCompanionView
} from "./WritingCompanionView";
import type { ContinuityObservation } from "../observations/ContinuityObservation";
import type { BookReviewContinuityPresentation } from "./BookReviewContinuityDisclosure";
import { bookReviewToggleAriaLabel } from "./BookReviewContinuityDisclosure";
import type { DispositionMatch } from "../observations/ContinuityDisposition";
import { renderContinuityDispositionControls } from "./ContinuityDispositionControls";
import { manuscriptChronologyCardPresentation } from "./ContinuityCardPresentation";
import { openContinuityReviewFromEntryPoint } from "./ContinuityReviewEntryPoint";

export { VIEW_TYPE };

let nextPovSuggestionListId = 0;
let nextBookReviewContentId = 0;

export class WritingCompanionView extends BaseWritingCompanionView {
  private readonly dismissedPovCharacterOffers = new Set<string>();

  constructor(leaf: WorkspaceLeaf, plugin: MurmurationWritingCompanionPlugin) {
    super(leaf, plugin);
  }

  renderBookReview(container: Element, chapter: TFile) {
    const book = this.plugin.getOwningBook(chapter);
    if (!book) return;

    const chronology = this.plugin.getManuscriptChronology(chapter);
    const continuityQueue = this.plugin.storeService.getContinuityDispositionQueue(
      chronology.observations
    );
    const presentation = this.plugin.bookReviewContinuityDisclosure.present(
      book.path,
      continuityQueue.active.length,
      continuityQueue.reviewed.length
    );

    const frontmatter = this.app.metadataCache.getFileCache(book)?.frontmatter as
      Record<string, unknown> | undefined;
    const reviewMode = this.plugin.storeService.getBookReviewMode(book);
    const reviewStatus = getBookReviewStatusValue(frontmatter);
    const section = container.createDiv(
      "mwc-section mwc-book-review mwc-collapsible-section mwc-collapsible-section--book-review"
    );
    const contentId = `mwc-book-review-content-${++nextBookReviewContentId}`;
    const heading = section.createEl("h3", { cls: "mwc-collapsible-heading" });
    const toggle = heading.createEl("button", {
      cls: "mwc-section-toggle",
      attr: { type: "button", "aria-controls": contentId }
    });
    const toggleLabel = toggle.createSpan({ cls: "mwc-section-toggle-label" });
    toggleLabel.createSpan({
      cls: "mwc-section-toggle-icon",
      text: "›",
      attr: { "aria-hidden": "true" }
    });
    toggleLabel.createSpan({ cls: "mwc-section-toggle-title", text: "Book Review" });
    const indicator = toggle.createSpan({
      cls: presentation.count > 0
        ? "mwc-section-toggle-status mwc-book-continuity-indicator"
        : "mwc-section-toggle-status mwc-book-continuity-indicator mwc-book-continuity-indicator--reviewed",
      text: presentation.indicator
    });
    indicator.hidden = presentation.indicator.length === 0;
    const content = section.createDiv({
      cls: "mwc-section-content",
      attr: { id: contentId }
    });

    let expanded = presentation.bookReviewExpanded;
    const applyExpanded = () => {
      section.classList.toggle("mwc-collapsible-section--expanded", expanded);
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.setAttribute(
        "aria-label",
        bookReviewToggleAriaLabel(expanded, presentation.indicator)
      );
      content.hidden = !expanded;
    };
    toggle.onclick = () => {
      expanded = !expanded;
      this.plugin.bookReviewContinuityDisclosure.setBookReviewExpanded(book.path, expanded);
      applyExpanded();
    };
    applyExpanded();

    const titleRow = content.createDiv("mwc-book-review-title");
    titleRow.createSpan({ text: book.basename });
    const titleActions = titleRow.createDiv("mwc-book-review-title-actions");
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
    titleActions.appendChild(openBook);
    const reviewPresentation = this.plugin.getContinuityReviewActionPresentation(
      book.path,
      "Open Continuity Review"
    );
    const openContinuity = titleActions.createEl("button", {
      cls: "mwc-book-review-link mwc-book-review-continuity-link",
      text: reviewPresentation.label,
      attr: {
        type: "button",
        title: reviewPresentation.tooltip,
        "aria-label": reviewPresentation.tooltip
      }
    });
    openContinuity.disabled = reviewPresentation.disabled;
    openContinuity.onclick = () => {
      void openContinuityReviewFromEntryPoint(this.plugin, book.path, chapter.path);
    };

    const list = content.createEl("dl", {
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

    this.renderManuscriptChronology(
      content,
      chapter,
      book.path,
      chronology.observations,
      presentation,
      continuityQueue.active,
      continuityQueue.reviewed
    );
  }

  private renderManuscriptChronology(
    container: HTMLElement,
    chapter: TFile,
    bookPath: string,
    observations: readonly ContinuityObservation[],
    presentation: BookReviewContinuityPresentation,
    active: readonly DispositionMatch[],
    reviewed: readonly DispositionMatch[]
  ) {
    if (observations.length === 0) return;

    const details = container.createEl("details", { cls: "mwc-continuity mwc-book-continuity" });
    details.open = presentation.continuityExpanded;
    details.ontoggle = () => {
      this.plugin.bookReviewContinuityDisclosure.setContinuityExpanded(
        bookPath,
        details.open
      );
    };
    const summary = details.createEl("summary", { cls: "mwc-continuity-heading" });
    summary.createSpan({ text: "Continuity" });
    summary.createSpan({
      cls: "mwc-continuity-count",
      text: String(active.length)
    });

    const render = (host: HTMLElement, match: DispositionMatch) => {
      const observation = match.observation;
      const card = host.createDiv(
        `mwc-continuity-observation mwc-continuity-observation--${observation.severity}`
      );
      card.createEl("p", { cls: "mwc-continuity-summary", text: observation.summary });
      card.createEl("p", { cls: "mwc-continuity-explanation", text: observation.explanation });
      renderContinuityDispositionControls(
        card,
        observation,
        match,
        this.plugin.storeService
      );
      const cardPresentation = manuscriptChronologyCardPresentation(observation);
      if (cardPresentation.partContext.length > 0) {
        card.createEl("p", {
          cls: "mwc-continuity-part-context",
          text: cardPresentation.partContext.join(" · ")
        });
      }
      const navigation = card.createDiv("mwc-continuity-navigation");
      for (const target of cardPresentation.navigationNotes) {
        const button = navigation.createEl("button", {
          text: `Open ${target.label ?? target.path.replace(/\.md$/i, "").split("/").pop()}`,
          attr: { type: "button" }
        });
        button.onclick = (event) => {
          void this.app.workspace.openLinkText(
            target.path.replace(/\.md$/i, ""),
            chapter.path,
            event.metaKey || event.ctrlKey
          );
        };
      }
    };
    for (const match of active) render(details, match);
    if (reviewed.length > 0) {
      const reviewedSection = details.createDiv("mwc-continuity-reviewed");
      const toggle = reviewedSection.createEl("button", {
        text: `Show reviewed (${reviewed.length})`,
        attr: { type: "button", "aria-expanded": "false" }
      });
      const reviewedList = reviewedSection.createDiv("mwc-continuity-reviewed-list");
      reviewedList.hidden = true;
      let rendered = false;
      toggle.onclick = () => {
        reviewedList.hidden = !reviewedList.hidden;
        if (!reviewedList.hidden && !rendered) {
          rendered = true;
          for (const match of reviewed) render(reviewedList, match);
        }
        toggle.textContent = `${reviewedList.hidden ? "Show" : "Hide"} reviewed (${reviewed.length})`;
        toggle.setAttribute("aria-expanded", String(!reviewedList.hidden));
      };
    }
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
        this.renderCompactMarkdownValue(rendered, value, file);
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

      this.renderPovCharacterOffer(container, value, file, renderResting);
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

  private povCharacterOfferKey(file: TFile, value: string): string {
    return `${file.path}\u0000${value.trim().toLowerCase()}`;
  }

  private buildPovCharacterProposal(
    file: TFile,
    value: string
  ): PovCharacterCreationProposal | null {
    const book = this.plugin.getOwningBook(file);
    const scope = book
      ? [`[[${book.path.replace(/\.md$/i, "")}]]`]
      : [];

    return buildPovCharacterCreationProposal(value, {
      suggestions: this.plugin.getPovSuggestions(file),
      existingPaths: this.app.vault.getAllLoadedFiles().map((item) => item.path),
      scope
    });
  }

  private renderPovCharacterOffer(
    container: HTMLElement,
    value: string,
    file: TFile,
    renderResting: (value: string) => void
  ) {
    const key = this.povCharacterOfferKey(file, value);
    if (this.dismissedPovCharacterOffers.has(key)) return;

    const proposal = this.buildPovCharacterProposal(file, value);
    if (!proposal) return;

    const offer = container.createDiv({
      cls: "mwc-pov-character-offer",
      attr: { role: "status" }
    });
    offer.createEl("p", {
      cls: "mwc-pov-character-offer-text",
      text: `“${proposal.name}” is not yet a Story World character.`
    });
    const actions = offer.createDiv("mwc-pov-character-offer-actions");
    const keep = actions.createEl("button", {
      text: "Use without creating",
      attr: { type: "button" }
    });
    const create = actions.createEl("button", {
      cls: "mwc-pov-character-create",
      text: "Create character",
      attr: { type: "button" }
    });

    const focusDisplay = () => window.setTimeout(() => {
      container.querySelector<HTMLElement>(".mwc-pov-display")?.focus();
    }, 0);

    keep.onclick = () => {
      this.dismissedPovCharacterOffers.add(key);
      renderResting(value);
      focusDisplay();
    };

    create.onclick = async () => {
      const accepted = await confirmPovCharacterCreation(this.app, proposal);
      if (!accepted) {
        focusDisplay();
        return;
      }

      create.disabled = true;
      keep.disabled = true;

      try {
        const refreshed = this.buildPovCharacterProposal(file, value);
        if (!refreshed) {
          throw new Error(
            "A matching Story World character now exists. Reopen the POV editor to select it."
          );
        }
        if (
          refreshed.path !== proposal.path
          || refreshed.name !== proposal.name
          || refreshed.povValue !== proposal.povValue
        ) {
          throw new Error("The proposed character destination changed. Open the preview again.");
        }

        const result = await createPovCharacterFromProposal(this.app, file, proposal);
        this.dismissedPovCharacterOffers.delete(key);
        renderResting(result.povValue);
        new Notice(`Created Story World character ${proposal.name}.`);
        focusDisplay();
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Could not create the Story World character.";
        new Notice(message);
        renderResting(value);
        focusDisplay();
      }
    };
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

  private renderCompactMarkdownValue(container: HTMLElement, markdown: string, file: TFile) {
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
