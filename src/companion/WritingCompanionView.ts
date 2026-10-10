import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import MurmurationWritingCompanionPlugin from "../main";
import { Annotation, PageEditorialNotes } from "../editorial/EditorialNote";
import { renderAnnotationCard } from "../ui/AnnotationCard";
import { inspectorPanelLabel, InspectorPanelRole } from "../ui/PanelLabels";

export const VIEW_TYPE = "murmuration-writing-companion-view";

export abstract class WritingCompanionView extends ItemView {
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

  // The concrete collapsible view owns rendering. Legacy non-collapsible
  // implementations were always overridden and must not ship alongside it.
  abstract render(): void;
  abstract renderChapterContext(container: Element, file: TFile): void;

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
