import { ItemView, MarkdownRenderer, TFile, WorkspaceLeaf } from "obsidian";
import MurmurationWritingCompanionPlugin from "../main";
import { Annotation, PageEditorialNotes } from "../editorial/EditorialNote";
import { renderAnnotationCard } from "../ui/AnnotationCard";
import { getChapterContextItems } from "./ChapterContext";

export const VIEW_TYPE = "murmuration-writing-companion-view";

export class WritingCompanionView extends ItemView {
  plugin: MurmurationWritingCompanionPlugin;
  private pendingReviewScrollNoteId: string | null = null;

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
    const focusNoteId = this.plugin.getPendingFocusNoteId();

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

    this.renderChapterContext(container, file);
    this.renderChapterNote(container, file, page);
    this.renderAnnotations(container, file, page, focusNoteId);
  }

  renderChapterContext(container: Element, file: TFile) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const items = getChapterContextItems(frontmatter);

    if (items.length === 0) return;

    const section = container.createDiv("mwc-section mwc-chapter-context");
    section.createEl("h3", { text: "Chapter Context" });

    const list = section.createEl("dl", {
      cls: "mwc-context-list",
      attr: { "aria-label": `Chapter context for ${file.basename}` }
    });

    for (const item of items) {
      const row = list.createDiv("mwc-context-row");
      row.createEl("dt", {
        cls: "mwc-context-label",
        text: item.label
      });
      const value = row.createEl("dd", {
        cls: "mwc-context-value",
        attr: { title: `From property: ${item.property}` }
      });

      void MarkdownRenderer.render(
        this.app,
        item.value,
        value,
        file.path,
        this
      );

      value.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const link = target.closest<HTMLAnchorElement>("a.internal-link");
        if (!link || !value.contains(link)) return;

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
    const annotations = sortOpenAnnotations(page.annotations);
    const section = container.createDiv("mwc-section");
    const heading = section.createEl("h3", { cls: "mwc-section-heading" });

    heading.createSpan({ text: "Annotations" });
    heading.createSpan({
      cls: "mwc-annotation-count",
      text: `${annotations.length} open`
    });

    if (annotations.length === 0) {
      section.createEl("p", {
        cls: "mwc-muted",
        text: "No open annotations."
      });
      this.pendingReviewScrollNoteId = null;
      return;
    }

    const scrollTargetId = this.pendingReviewScrollNoteId;
    let scrollTarget: HTMLElement | null = null;

    for (const [index, annotation] of annotations.entries()) {
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
          const nextAnnotation = annotations[index + 1] ?? annotations[index - 1] ?? null;
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

function sortOpenAnnotations(annotations: Annotation[]): Annotation[] {
  return annotations
    .map((annotation, originalIndex) => ({ annotation, originalIndex }))
    .filter(({ annotation }) => annotation.status === "open")
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
