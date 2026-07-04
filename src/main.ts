import {
  Editor,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  TFile,
  WorkspaceLeaf
} from "obsidian";
import {
  VIEW_TYPE,
  WritingCompanionView
} from "./companion/WritingCompanionView";
import { EditorialStoreService } from "./editorial/EditorialStore";
import { Annotation } from "./editorial/EditorialNote";
import { resolveAnnotationRange } from "./companion/AnnotationNavigation";

export default class MurmurationWritingCompanionPlugin extends Plugin {
  storeService!: EditorialStoreService;
  currentChapter: TFile | null = null;
  pendingFocusNoteId: string | null = null;

  async onload() {
    this.storeService = new EditorialStoreService(this);
    this.storeService.onChange = () => this.refreshView();

    await this.storeService.load();

    this.registerView(
      VIEW_TYPE,
      (leaf) => new WritingCompanionView(leaf, this)
    );

    this.addRibbonIcon("notebook-pen", "Murmuration Writing Companion", () => {
      const activeChapter = this.getActiveChapter();
      if (activeChapter) this.currentChapter = activeChapter;
      this.activateView();
    });

    this.addCommand({
      id: "open-writing-companion",
      name: "Open writing companion",
      callback: () => {
        const activeChapter = this.getActiveChapter();
        if (activeChapter) this.currentChapter = activeChapter;
        this.activateView();
      }
    });

    this.addCommand({
      id: "annotate",
      name: "Annotate",
      editorCallback: async (editor, view) => {
        await this.createAnnotationFromEditor(editor, view.file);
      }
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
        if (!editor.getSelection().trim()) return;

        menu.addItem((item) => {
          item
            .setTitle("Annotate")
            .setIcon("message-square-plus")
            .onClick(async () => {
              await this.createAnnotationFromEditor(editor, view.file);
            });
        });
      })
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        const activeChapter = this.getActiveChapter();
        if (activeChapter) {
          this.currentChapter = activeChapter;
        }

        this.refreshView();
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file.path === this.getCurrentChapter()?.path) {
          this.refreshView();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (!(file instanceof TFile)) return;
        await this.storeService.handleRename(file, oldPath);

        if (this.currentChapter?.path === oldPath) {
          this.currentChapter = file;
        }
      })
    );
  }

  onunload() {
    void this.storeService.flushChapterNote();
  }

  getActiveChapter(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.file ?? null;
  }

  getCurrentChapter(): TFile | null {
    return this.currentChapter ?? this.getActiveChapter();
  }

  getPendingFocusNoteId(): string | null {
    return this.pendingFocusNoteId;
  }

  clearPendingFocusNoteId(noteId: string) {
    if (this.pendingFocusNoteId === noteId) {
      this.pendingFocusNoteId = null;
    }
  }

  async createAnnotationFromEditor(editor: Editor, chapter: TFile | null) {
    if (!chapter) return;

    const selected = editor.getSelection().trim();

    if (!selected) {
      new Notice("Select text first.");
      return;
    }

    this.currentChapter = chapter;

    const annotationId = await this.storeService.addAnnotation(
      chapter,
      {
        text: selected,
        line: editor.getCursor("from").line + 1
      },
      "",
      "Editorial"
    );

    this.pendingFocusNoteId = annotationId;

    await this.activateView();
    this.refreshView();
  }


  async navigateToAnnotation(chapter: TFile, annotation: Annotation) {
    const leaf = this.findChapterLeaf(chapter)
      ?? this.app.workspace.getMostRecentLeaf(this.app.workspace.rootSplit)
      ?? this.app.workspace.getLeaf(false);

    await leaf.openFile(chapter, { active: true });
    await this.app.workspace.revealLeaf(leaf);
    this.app.workspace.setActiveLeaf(leaf, { focus: true });

    if (!(leaf.view instanceof MarkdownView) || !leaf.view.file) {
      new Notice("Could not open the annotated chapter.");
      return;
    }

    const editor = leaf.view.editor;
    const range = resolveAnnotationRange(editor.getValue(), annotation.anchor);

    if (!range) {
      new Notice("Could not locate the annotated passage.");
      return;
    }

    const from = editor.offsetToPos(range.fromOffset);
    const to = editor.offsetToPos(range.toOffset);

    editor.setSelection(from, to);
    editor.scrollIntoView({ from, to }, true);
    editor.focus();

    if (!range.exact) {
      new Notice("The passage has changed; moved to its original line.");
    }
  }

  private findChapterLeaf(chapter: TFile): WorkspaceLeaf | null {
    let match: WorkspaceLeaf | null = null;

    this.app.workspace.iterateRootLeaves((leaf) => {
      if (match) return;

      if (
        leaf.view instanceof MarkdownView
        && leaf.view.file?.path === chapter.path
      ) {
        match = leaf;
      }
    });

    return match;
  }

  async activateView() {
    const leaf = this.app.workspace.getRightLeaf(false);

    if (!leaf) {
      new Notice("Could not open the writing companion sidebar.");
      return;
    }

    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  refreshView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);

    for (const leaf of leaves) {
      const view = leaf.view;

      if (view instanceof WritingCompanionView) {
        view.render();
      }
    }
  }
}
