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
} from "./companion/CollapsibleWritingCompanionView";
import { Annotation } from "./editorial/EditorialNote";
import { EditorialStoreService } from "./editorial/EditorialStore";
import { resolveAnnotationRange } from "./companion/AnnotationNavigation";
import {
  EditableChapterContextField,
  getChapterContextField,
  getEditableChapterContextValue,
  updateEditableChapterContextFrontmatter
} from "./companion/ChapterContext";
import {
  createSidebarSectionPreferenceKey,
  SidebarSectionPreferences
} from "./companion/SidebarSections";
import { ObsidianStoryWorldIndex } from "./story-world/ObsidianStoryWorldIndex";
import {
  buildEditorialPassProjection,
  EditorialPassChecklistItem,
  EditorialPassKey,
  EditorialPassProjection
} from "./editorial/EditorialPass";
import { updateBookReviewStatusFrontmatter } from "./editorial/BookReview";
import {
  resolveExplicitOwningBookWithSource,
  resolveOwningBook
} from "./companion/ManuscriptHierarchy";
import {
  buildPovSuggestions,
  PovSuggestion
} from "./companion/PovSuggestions";
import { TransientAnnotationLocator } from "./companion/AnnotationLocator";
import { installEditorialEnhancementStyles } from "./ui/EditorialEnhancementStyles";
import {
  MANUSCRIPT_NAVIGATOR_VIEW_TYPE,
  ManuscriptNavigatorView
} from "./manuscript/ManuscriptNavigatorView";
import { WritingCompanionActivation } from "./companion/WritingCompanionActivation";

export interface EditorialPassViewState {
  items: EditorialPassChecklistItem[];
  frontier: EditorialPassKey | null;
  projection: EditorialPassProjection;
}

export default class MurmurationWritingCompanionPlugin extends Plugin {
  storeService!: EditorialStoreService;
  storyWorldIndex!: ObsidianStoryWorldIndex;
  sidebarSectionPreferences!: SidebarSectionPreferences;
  currentChapter: TFile | null = null;
  pendingFocusNoteId: string | null = null;
  private readonly annotationLocator = new TransientAnnotationLocator();
  private readonly writingCompanionActivation = new WritingCompanionActivation();

  async onload() {
    const enhancementStyles = installEditorialEnhancementStyles();
    this.register(() => enhancementStyles.remove());

    const vaultName = this.app.vault.getName();
    let resourceRoot = vaultName;
    let preferenceStorage: Storage | null = null;

    try {
      resourceRoot = this.app.vault.adapter.getResourcePath("");
    } catch {
      // The vault name still provides a stable fallback on unusual adapters.
    }

    try {
      preferenceStorage = window.localStorage;
    } catch {
      // The layout still works with in-memory defaults when storage is unavailable.
    }

    this.sidebarSectionPreferences = new SidebarSectionPreferences(
      preferenceStorage,
      createSidebarSectionPreferenceKey(
        this.manifest.id,
        vaultName,
        resourceRoot
      )
    );

    this.storyWorldIndex = new ObsidianStoryWorldIndex(this.app);
    this.storyWorldIndex.rebuild();

    this.storeService = new EditorialStoreService(this);
    this.storeService.onChange = () => {
      this.refreshView();
      this.refreshManuscriptNavigator();
    };

    await this.storeService.load();

    this.app.workspace.onLayoutReady(() => {
      if (this.storyWorldIndex.rebuild()) {
        this.refreshView();
      }
      this.refreshManuscriptNavigator();

      void (async () => {
        await this.storeService.reconcileDeletedEditorialPages();
        await this.storeService.reconcileOpenAnnotationProperties();
      })();
    });

    this.registerView(
      VIEW_TYPE,
      (leaf) => new WritingCompanionView(leaf, this)
    );
    this.registerView(
      MANUSCRIPT_NAVIGATOR_VIEW_TYPE,
      (leaf) => new ManuscriptNavigatorView(leaf, this)
    );

    this.addRibbonIcon("notebook-pen", "Open Writing Companion", () => {
      const activeChapter = this.getActiveChapter();
      if (activeChapter) this.currentChapter = activeChapter;
      this.activateView();
    });
    this.addRibbonIcon("list-tree", "Open Manuscript", () => {
      void this.activateManuscriptNavigator();
    });

    this.addCommand({
      id: "open-writing-companion",
      name: "Open Writing Companion",
      callback: () => {
        const activeChapter = this.getActiveChapter();
        if (activeChapter) this.currentChapter = activeChapter;
        this.activateView();
      }
    });
    this.addCommand({
      id: "open-manuscript-navigator",
      name: "Open Manuscript",
      callback: () => void this.activateManuscriptNavigator()
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
      this.app.workspace.on("editor-change", () => {
        this.annotationLocator.clear();
      })
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.annotationLocator.clear();
        const activeChapter = this.getActiveChapter();
        if (activeChapter) {
          this.currentChapter = activeChapter;
        }

        this.refreshView();
        this.refreshManuscriptNavigator();
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        const worldChanged = this.storyWorldIndex.handleMetadataChanged(file);
        const currentChapter = this.getCurrentChapter();
        const currentChapterChanged = file.path === currentChapter?.path;
        const currentBookChanged = currentChapter
          ? file.path === this.getOwningBook(currentChapter)?.path
          : false;

        if (worldChanged || currentChapterChanged || currentBookChanged) {
          this.refreshView();
        }
        this.refreshManuscriptNavigator();
      })
    );

    this.registerEvent(
      this.app.vault.on("create", async (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;

        const worldChanged = this.storyWorldIndex.handleCreate(file);
        await this.storeService.handleCreate(file);

        if (worldChanged) this.refreshView();
        this.refreshManuscriptNavigator();
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;

        const worldChanged = this.storyWorldIndex.handleDelete(file);
        await this.storeService.handleDelete(file);

        if (this.currentChapter?.path === file.path) {
          this.currentChapter = null;
        }

        if (worldChanged || this.currentChapter === null) {
          this.refreshView();
        }
        this.refreshManuscriptNavigator();
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (!(file instanceof TFile)) return;

        const worldChanged = this.storyWorldIndex.handleRename(file, oldPath);
        await this.storeService.handleRename(file, oldPath);

        if (this.currentChapter?.path === oldPath) {
          this.currentChapter = file;
        }

        if (worldChanged) this.refreshView();
        this.refreshManuscriptNavigator();
      })
    );
  }

  onunload() {
    this.annotationLocator.dispose();
    void this.storeService.flushChapterNote();
  }

  getActiveChapter(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.file ?? null;
  }

  getCurrentChapter(): TFile | null {
    return this.currentChapter ?? this.getActiveChapter();
  }

  getOwningBook(chapter: TFile): TFile | null {
    return resolveOwningBook(this.app, chapter);
  }

  getExplicitOwningBookResolution(chapter: TFile) {
    return resolveExplicitOwningBookWithSource(this.app, chapter);
  }

  getPendingFocusNoteId(): string | null {
    return this.pendingFocusNoteId;
  }

  clearPendingFocusNoteId(noteId: string) {
    if (this.pendingFocusNoteId === noteId) {
      this.pendingFocusNoteId = null;
    }
  }

  async updateChapterContextProperty(
    chapter: TFile,
    field: EditableChapterContextField,
    value: string
  ) {
    await this.app.fileManager.processFrontMatter(chapter, (frontmatter) => {
      updateEditableChapterContextFrontmatter(frontmatter, field, value);
    });
  }

  async updateBookReviewStatus(book: TFile, value: string) {
    await this.app.fileManager.processFrontMatter(book, (frontmatter) => {
      updateBookReviewStatusFrontmatter(frontmatter, value);
    });
  }

  getEditorialPassState(chapter: TFile): EditorialPassViewState {
    const field = getChapterContextField("editorial_pass");
    const frontmatter = this.app.metadataCache.getFileCache(chapter)?.frontmatter as
      Record<string, unknown> | undefined;
    const context = getEditableChapterContextValue(frontmatter, field);
    this.storeService.ensureEditorialPassFrontier(chapter, context.value);
    const page = this.storeService.getPage(chapter);

    return {
      items: this.storeService.getEditorialPassChecklist(chapter, context.value),
      frontier: this.storeService.getEditorialPassFrontier(chapter, context.value),
      projection: buildEditorialPassProjection(page, context.value)
    };
  }

  async setEditorialPassCompleted(
    chapter: TFile,
    pass: EditorialPassKey,
    completed: boolean
  ): Promise<boolean> {
    const changed = await this.storeService.setEditorialPassCompleted(
      chapter,
      pass,
      completed
    );

    if (changed) await this.repairEditorialPassProjection(chapter);
    return changed;
  }

  async repairEditorialPassProjection(chapter: TFile) {
    const field = getChapterContextField("editorial_pass");
    const frontier = this.storeService.getEditorialPassFrontier(chapter);
    await this.updateChapterContextProperty(chapter, field, frontier ?? "");
  }

  getPovSuggestions(chapter: TFile): PovSuggestion[] {
    const book = this.getOwningBook(chapter);
    const scopeReferences = new Set<string>();

    const addScope = (value: unknown) => {
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        if (typeof item !== "string") continue;
        const trimmed = item.trim();
        if (trimmed) scopeReferences.add(trimmed);
      }
    };

    if (book) {
      scopeReferences.add(book.path);
      scopeReferences.add(book.basename);
      const bookFrontmatter = this.app.metadataCache.getFileCache(book)?.frontmatter as
        Record<string, unknown> | undefined;
      addScope(bookFrontmatter?.title);
      addScope(bookFrontmatter?.world_name);
      addScope(bookFrontmatter?.world_scope);
      addScope(bookFrontmatter?.series);
      addScope(bookFrontmatter?.trilogy);
    }

    const chapterFrontmatter = this.app.metadataCache.getFileCache(chapter)?.frontmatter as
      Record<string, unknown> | undefined;
    addScope(chapterFrontmatter?.world_scope);
    addScope(chapterFrontmatter?.series);
    addScope(chapterFrontmatter?.trilogy);

    return buildPovSuggestions(
      this.storyWorldIndex.index.getAll(),
      [...scopeReferences]
    );
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
    this.annotationLocator.clear();
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

    if (range.exact) {
      this.annotationLocator.show(leaf.view.contentEl);
    } else {
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
    const activated = await this.writingCompanionActivation.activate(
      this.app.workspace,
      VIEW_TYPE
    );
    if (!activated) {
      new Notice("Could not open the writing companion sidebar.");
    }
  }

  async activateManuscriptNavigator() {
    const existing = this.app.workspace.getLeavesOfType(
      MANUSCRIPT_NAVIGATOR_VIEW_TYPE
    )[0];
    const leaf = existing ?? this.app.workspace.getLeftLeaf(false);

    if (!leaf) {
      new Notice("Could not open the Manuscript sidebar.");
      return;
    }

    if (!existing) {
      await leaf.setViewState({
        type: MANUSCRIPT_NAVIGATOR_VIEW_TYPE,
        active: true
      });
    }
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

  refreshManuscriptNavigator() {
    const leaves = this.app.workspace.getLeavesOfType(
      MANUSCRIPT_NAVIGATOR_VIEW_TYPE
    );

    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof ManuscriptNavigatorView) {
        view.render();
      }
    }
  }
}
