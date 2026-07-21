import { ItemView, MarkdownRenderer, TFile, WorkspaceLeaf } from "obsidian";
import MurmurationWritingCompanionPlugin from "../main";
import { Annotation, PageEditorialNotes } from "../editorial/EditorialNote";
import { renderAnnotationCard } from "../ui/AnnotationCard";
import { renderEditorialPassChecklist } from "../ui/EditorialPassChecklist";
import {
  EDITABLE_CHAPTER_CONTEXT_FIELDS,
  getChapterContextInputType,
  getChapterContextSelectOptions,
  getEditableChapterContextValue
} from "./ChapterContext";
import { inspectorPanelLabel, InspectorPanelRole } from "../ui/PanelLabels";

export const VIEW_TYPE = "murmuration-writing-companion-view";

export class WritingCompanionView extends ItemView {
  plugin: MurmurationWritingCompanionPlugin;
  private pendingReviewScrollNoteId: string | null = null;
  private showResolvedAnnotations = false;
  private panelRole: InspectorPanelRole = "chapter";

  constructor(leaf: WorkspaceLeaf, plugin: MurmurationWritingCompanionPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return inspectorPanelLabel(this.panelRole);
  }

  setPanelRole(role: InspectorPanelRole) {
    if (this.panelRole === role) return;
    this.panelRole = role;
    (this.leaf as WorkspaceLeaf & { updateHeader?: () => void }).updateHeader?.();
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
    const focusNoteId = this.plugin.getPendingFocusNoteId();

    container.createEl("h2", { text: "Writing Companion" });

    if (!file) {
      container.createEl("p", {
        cls: "mwc-muted",
        text: "Open a Markdown chapter to view its notes."
      });
      return;
    }

    const page = this.plugin.storeService.getPage(file);

    this.renderChapterContext(container, file);
    renderEditorialPassChecklist(
      container,
      file.basename,
      this.plugin.storeService.getEditorialPassChecklist(file),
      (pass, completed) =>
        this.plugin.storeService.setEditorialPassCompleted(file, pass, completed)
    );
    this.renderChapterNote(container, file, page);
    this.renderAnnotations(container, file, page, focusNoteId);
  }

  renderChapterContext(container: Element, file: TFile) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const section = container.createDiv("mwc-section mwc-chapter-context");
    section.createEl("h3", { text: "Chapter Context" });

    const list = section.createEl("dl", {
      cls: "mwc-context-list",
      attr: { "aria-label": `Chapter context for ${file.basename}` }
    });

    for (const field of EDITABLE_CHAPTER_CONTEXT_FIELDS) {
      const contextValue = getEditableChapterContextValue(frontmatter, field);
      const row = list.createDiv("mwc-context-row mwc-context-row--editable");
      row.createEl("dt", {
        cls: "mwc-context-label",
        text: field.label
      });
      const value = row.createEl("dd", {
        cls: "mwc-context-value mwc-context-value--editable",
        attr: { title: `Markdown property: ${contextValue.property}` }
      });

      const save = async (nextValue: string) => {
        const normalizedCurrent = contextValue.value.trim();
        const normalizedNext = nextValue.trim();
        if (normalizedCurrent === normalizedNext) return;

        await this.plugin.updateChapterContextProperty(file, field, normalizedNext);
      };

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
        editor.onchange = () => {
          void save(editor.value);
        };
      } else if (field.multiline) {
        const editor = value.createEl("textarea", {
          cls: "mwc-context-input mwc-context-input--multiline",
          attr: {
            placeholder,
            "aria-label": field.label
          }
        });
        editor.value = contextValue.value;
        editor.onblur = () => {
          void save(editor.value);
        };
      } else {
        const editor = value.createEl("input", {
          cls: "mwc-context-input",
          type: getChapterContextInputType(field, contextValue.value),
          attr: {
            placeholder,
            "aria-label": field.label
          }
        });
        editor.value = contextValue.value;
        editor.onchange = () => {
          void save(editor.value);
        };
        editor.onkeydown = (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          editor.blur();
        };
      }

      if (field.renderMarkdownPreview && contextValue.value.length > 0) {
        const preview = value.createDiv({
          cls: "mwc-context-preview",
          attr: { "aria-label": `${field.label} link preview` }
        });
        this.renderMarkdownValue(preview, contextValue.value, file);
      }
    }
  }

  private renderMarkdownValue(container: HTMLElement, markdown: string, file: TFile) {
    void MarkdownRenderer.render(
      this.app,
      markdown,
      container,
      file.path,
      this
    );

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
    file: TFile,
    page: PageEditorialNotes,
    focusNoteId: string | null
  ) {
    const openAnnotations = sortAnnotationsByManuscriptPosition(
      page.annotations.filter((annotation) => annotation.status === "open")
    );
    const resolvedAnnotations = sortAnnotationsByManuscriptPosition(
      page.annotations.filter((annotation) => annotation.status === "resolved")
    );
    const section = container.createDiv("mwc-section");
    const heading = section.createEl("h3", { cls: "mwc-section-heading" });

    heading.createSpan({ text: "Annotations" });
    heading.createSpan({
      cls: "mwc-annotation-count",
      text: `${openAnnotations.length} open`
    });

    const scrollTargetId = this.pendingReviewScrollNoteId;
    let scrollTarget: HTMLElement | null = null;

    if (openAnnotations.length === 0) {
      section.createEl("p", {
        cls: "mwc-muted",
        text: "No open annotations."
      });
    } else {
      for (const [index, annotation] of openAnnotations.entries()) {
        const card = renderAnnotationCard(
          section,
          annotation,
          (selectedAnnotation, patch) =>
            this.plugin.storeService.updateAnnotation(file, selectedAnnotation, patch),
          focusNoteId,
          (noteId) => this.plugin.clearPendingFocusNoteId(noteId),
          (selectedAnnotation) => {
            void this.plugin.navigateToAnnotation(file, selectedAnnotation);
          },
          async (resolvedAnnotation) => {
            const nextAnnotation =
              openAnnotations[index + 1] ?? openAnnotations[index - 1] ?? null;
            this.pendingReviewScrollNoteId = nextAnnotation?.id ?? null;

            await this.plugin.storeService.updateAnnotation(
              file,
              resolvedAnnotation,
              { status: "resolved" }
            );
          }
        );

        if (annotation.id === scrollTargetId) {
          scrollTarget = card;
        }
      }
    }

    if (resolvedAnnotations.length > 0) {
      const resolvedSection = section.createDiv("mwc-resolved-annotations");
      const toggle = resolvedSection.createEl("button", {
        cls: "mwc-resolved-toggle",
        text: this.showResolvedAnnotations
          ? `Hide ${resolvedAnnotations.length} resolved`
          : `Show ${resolvedAnnotations.length} resolved`,
        attr: {
          "aria-expanded": String(this.showResolvedAnnotations),
          "aria-label": this.showResolvedAnnotations
            ? "Hide resolved annotations"
            : "Show resolved annotations"
        }
      });

      toggle.onclick = () => {
        this.showResolvedAnnotations = !this.showResolvedAnnotations;
        this.render();
      };

      if (this.showResolvedAnnotations) {
        const resolvedList = resolvedSection.createDiv("mwc-resolved-list");

        for (const annotation of resolvedAnnotations) {
          renderAnnotationCard(
            resolvedList,
            annotation,
            (selectedAnnotation, patch) =>
              this.plugin.storeService.updateAnnotation(file, selectedAnnotation, patch),
            null,
            undefined,
            (selectedAnnotation) => {
              void this.plugin.navigateToAnnotation(file, selectedAnnotation);
            },
            undefined,
            "resolved",
            async (reopenedAnnotation) => {
              this.pendingReviewScrollNoteId = reopenedAnnotation.id;

              await this.plugin.storeService.updateAnnotation(
                file,
                reopenedAnnotation,
                { status: "open" }
              );
            }
          );
        }
      }
    }

    if (scrollTargetId) {
      this.pendingReviewScrollNoteId = null;
    }

    if (scrollTarget) {
      window.setTimeout(() => {
        if (!scrollTarget?.isConnected) return;
        scrollTarget.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }, 0);
    }
  }

}

function sortAnnotationsByManuscriptPosition(annotations: Annotation[]): Annotation[] {
  return annotations
    .map((annotation, originalIndex) => ({ annotation, originalIndex }))
    .sort((left, right) => {
      const leftLine = left.annotation.anchor.line ?? Number.MAX_SAFE_INTEGER;
      const rightLine = right.annotation.anchor.line ?? Number.MAX_SAFE_INTEGER;

      if (leftLine !== rightLine) return leftLine - rightLine;

      const createdComparison = left.annotation.created.localeCompare(
        right.annotation.created
      );

      if (createdComparison !== 0) return createdComparison;
      return left.originalIndex - right.originalIndex;
    })
    .map(({ annotation }) => annotation);
}
