import {
  App,
  Editor,
  MarkdownView,
  Menu,
  Notice,
  Platform,
  Plugin,
  PluginManifest,
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
import {
  buildLocationSuggestions,
  LocationSuggestion
} from "./companion/LocationSuggestions";
import { TransientAnnotationLocator } from "./companion/AnnotationLocator";
import { installEditorialEnhancementStyles } from "./ui/EditorialEnhancementStyles";
import {
  MANUSCRIPT_NAVIGATOR_VIEW_TYPE,
  ManuscriptNavigatorView
} from "./manuscript/ManuscriptNavigatorView";
import { WritingCompanionActivation } from "./companion/WritingCompanionActivation";
import {
  buildObsidianManuscriptChronology,
  buildObsidianManuscriptChronologyForBook,
  ObsidianManuscriptChronologyResult
} from "./manuscript/ObsidianManuscriptChronology";
import { BookReviewContinuityDisclosure } from "./companion/BookReviewContinuityDisclosure";
import {
  dispositionContinuityRefreshDecision,
  metadataContinuityRefreshDecision,
  shouldScheduleSettledStoryWorldRefresh
} from "./companion/ContinuityRefresh";
import { ManuscriptBookSelectionService } from "./manuscript/ManuscriptBookSelection";
import { collectObsidianContinuityReview } from "./manuscript/ObsidianContinuityReview";
import { projectContinuityReview } from "./observations/ContinuityReview";
import { buildObsidianManuscriptLibrary } from "./manuscript/ObsidianManuscript";
import { manuscriptChronologyOrderIsSafe } from "./observations/ManuscriptChronology";
import {
  continuityReviewActionPresentation,
  ContinuityReviewActionPresentation
} from "./companion/ContinuityReviewEntryPoint";
import { ContinuityDiagnosticPreference } from "./companion/ContinuityDiagnostics";
import { ContinuitySettingsTab } from "./companion/ContinuitySettingsTab";
import { ManuscriptIntegrityCoordinator } from "./manuscript/ManuscriptIntegrityCoordinator";
import { ManuscriptProjectionService } from "./manuscript/ManuscriptProjection";
import { StoryWorldReviewProjectionService } from "./story-world/StoryWorldReviewProjection";
import { StoryWorldStartup } from "./story-world/StoryWorldStartup";
import { classifyObsidianRename, isObsidianTrashPath } from "./ObsidianTrash";
import type { ManuscriptStoryDateOffer } from "./manuscript/ManuscriptStoryDateOffer";
import {
  acceptObsidianManuscriptStoryDateOffer,
  getObsidianManuscriptStoryDateOffer
} from "./manuscript/ObsidianManuscriptStoryDateOffer";
import { VaultBackupResult, VaultBackupService } from "./backup/VaultBackupService";
import { installAboutCommand } from "./about/AboutMurmurationPress";
import { AboutMurmurationPressModal } from "./about/AboutMurmurationPressModal";
import { installHelpCommand, openHelp } from "./help/Help";

export interface EditorialPassViewState {
  items: EditorialPassChecklistItem[];
  frontier: EditorialPassKey | null;
  projection: EditorialPassProjection;
}

export default class MurmurationWritingCompanionPlugin extends Plugin {
  readonly manuscriptBookSelection: ManuscriptBookSelectionService;
  storeService!: EditorialStoreService;
  storyWorldIndex!: ObsidianStoryWorldIndex;
  manuscriptProjection!: ManuscriptProjectionService;
  storyWorldReviewProjection!: StoryWorldReviewProjectionService;
  sidebarSectionPreferences!: SidebarSectionPreferences;
  currentChapter: TFile | null = null;
  pendingFocusNoteId: string | null = null;
  private readonly annotationLocator = new TransientAnnotationLocator();
  private readonly writingCompanionActivation = new WritingCompanionActivation();
  readonly bookReviewContinuityDisclosure = new BookReviewContinuityDisclosure();
  readonly continuityDiagnosticPreference: ContinuityDiagnosticPreference;
  private manuscriptChronologyDependencies = new Set<string>();
  private manuscriptChronologyRefreshTimer: number | null = null;
  private storyWorldMetadataRefreshTimer: number | null = null;
  private readonly pendingStoryWorldMetadataPaths = new Set<string>();
  private readonly pendingEditorialCreates = new Map<string, TFile>();
  private manuscriptIntegrityCoordinator!: ManuscriptIntegrityCoordinator;
  private storyWorldStartup!: StoryWorldStartup<boolean>;
  private vaultBackupService: VaultBackupService | null = null;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* Selection remains in memory. */ }
    this.manuscriptBookSelection = new ManuscriptBookSelectionService(
      storage,
      `${manifest.id}:${app.vault.getName()}:manuscript-navigator-book`
    );
    this.continuityDiagnosticPreference = new ContinuityDiagnosticPreference(
      storage,
      `${manifest.id}:${app.vault.getName()}:show-continuity-diagnostics`
    );
  }

  async onload() {
    const enhancementStyles = installEditorialEnhancementStyles();
    this.register(() => enhancementStyles.remove());
    this.addSettingTab(new ContinuitySettingsTab(this.app, this));
    installAboutCommand(this, () => new AboutMurmurationPressModal(this).open());
    installHelpCommand(this, () => this.openHelp());

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
    this.storyWorldStartup = new StoryWorldStartup(
      () => this.storyWorldIndex.rebuild(),
      () => this.app.vault.getMarkdownFiles().every((file) => Boolean(this.app.metadataCache.getFileCache(file)))
    );
    this.storyWorldStartup.initialise();
    this.manuscriptProjection = new ManuscriptProjectionService(this.app);
    this.storyWorldReviewProjection = new StoryWorldReviewProjectionService(this.app, this.storyWorldIndex);

    this.storeService = new EditorialStoreService(this);
    this.storeService.onChange = () => {
      this.refreshView();
      this.refreshManuscriptNavigator();
    };
    this.storeService.onContinuityChange = () => {
      const decision = dispositionContinuityRefreshDecision();
      if (decision.companion) this.refreshView();
      if (decision.manuscriptNavigator) this.refreshManuscriptNavigator();
    };

    await this.storeService.load();

    this.manuscriptIntegrityCoordinator = new ManuscriptIntegrityCoordinator(
      this.app,
      this.manuscriptBookSelection,
      {
        activePath: () => this.getActiveChapter()?.path ?? null,
        onSettled: ({ library, affectedPaths, affectedBookPaths, revealPath, clearReveal, missingSelectedBook }) => {
          void this.settleEditorialCreates(library, affectedPaths);
          if (this.currentChapter && !this.app.vault.getAbstractFileByPath(this.currentChapter.path)) {
            this.currentChapter = this.getActiveChapter();
          }
          const dependencies = new Set<string>();
          for (const bookPath of affectedBookPaths) {
            const book = library.books.find((candidate) => candidate.file.path === bookPath);
            if (!book) continue;
            for (const path of buildObsidianManuscriptChronologyForBook(this.app, book).dependencies) dependencies.add(path);
          }
          if (affectedBookPaths.size > 0) this.manuscriptChronologyDependencies = dependencies;
          if (clearReveal) this.clearManuscriptReveal(revealPath);
          if (missingSelectedBook) new Notice("The selected manuscript Book is no longer available; manuscript scope was updated.");
          this.refreshView();
          this.refreshManuscriptNavigator();
          this.recollectContinuityReview();
          this.refreshContinuityReview();
        }
      },
      this.manuscriptProjection
    );

    this.app.workspace.onLayoutReady(() => {
      this.manuscriptIntegrityCoordinator.initialise();
      if (this.storyWorldStartup.settle() !== null) {
        this.storyWorldReviewProjection.invalidate();
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

    if (Platform.isDesktopApp) {
      this.vaultBackupService = new VaultBackupService(this.app.vault.adapter);
      const backUpVault = () => void this.backUpVault();
      this.addRibbonIcon("cloud-upload", "Back up vault to GitHub", backUpVault);
      this.addCommand({
        id: "back-up-vault-to-github",
        name: "Back up vault to GitHub",
        callback: backUpVault
      });
    }

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
      this.app.workspace.on("file-open", (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        if (isObsidianTrashPath(file.path)) {
          if (this.currentChapter && isObsidianTrashPath(this.currentChapter.path)) this.currentChapter = null;
          this.refreshView();
          this.refreshManuscriptNavigator();
          return;
        }
        if (this.currentChapter?.path === file.path) return;

        this.annotationLocator.clear();
        this.currentChapter = file;
        this.refreshView();
        this.refreshManuscriptNavigator();
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (this.manuscriptProjection.affectsMetadata(file)) this.manuscriptIntegrityCoordinator.queue(file.path);
        const wasStoryWorld = this.storyWorldIndex.index.getByPath(file.path) !== null;
        const worldChanged = this.storyWorldIndex.handleMetadataChanged(file);
        this.storyWorldReviewProjection.invalidateMetadata(file, worldChanged);
        const currentChapter = this.getCurrentChapter();
        const currentChapterChanged = file.path === currentChapter?.path;
        const currentBookChanged = currentChapter
          ? file.path === this.getOwningBook(currentChapter)?.path
          : false;
        const decision = metadataContinuityRefreshDecision({
          changedPath: file.path,
          manuscriptDependencies: this.manuscriptChronologyDependencies,
          worldChanged,
          currentChapterChanged,
          currentBookChanged
        });
        if (decision.companion) this.refreshView();
        if (shouldScheduleSettledStoryWorldRefresh(wasStoryWorld, worldChanged)) this.scheduleStoryWorldMetadataRefresh(file.path);
        if (decision.deferredChronology) this.scheduleManuscriptChronologyRefresh();
        if (decision.manuscriptNavigator) this.refreshManuscriptNavigator();
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("resolved", () => this.manuscriptIntegrityCoordinator.metadataResolved())
    );

    this.registerEvent(
      this.app.vault.on("create", async (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;

        const worldChanged = this.storyWorldIndex.handleCreate(file);
        this.storyWorldReviewProjection.invalidateMetadata(file, worldChanged);
        this.manuscriptIntegrityCoordinator.queue(file.path);
        this.pendingEditorialCreates.set(file.path, file);

        // A new scene or part may not yet be in the active book's prior dependency set.
        this.refreshView();
        this.refreshManuscriptNavigator();
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;

        this.pendingEditorialCreates.delete(file.path);
        this.manuscriptIntegrityCoordinator.queue(file.path);
        const worldChanged = this.storyWorldIndex.handleDelete(file);
        this.storyWorldReviewProjection.invalidatePath(file.path);
        await this.storeService.handleDelete(file);

        if (this.currentChapter?.path === file.path) {
          this.currentChapter = null;
        }

        if (
          worldChanged
          || this.currentChapter === null
          || this.manuscriptChronologyDependencies.has(file.path)
        ) {
          this.refreshView();
        }
        this.refreshManuscriptNavigator();
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (!(file instanceof TFile)) return;

        const renameKind = classifyObsidianRename(oldPath, file.path);
        if (renameKind === "trash-delete") {
          this.manuscriptIntegrityCoordinator.queueUnmanagedMove(oldPath, file.path);
          this.pendingEditorialCreates.delete(oldPath);
          const worldChanged = this.storyWorldIndex.handleDeletePath(oldPath);
          this.storyWorldReviewProjection.invalidatePath(oldPath);
          await this.storeService.handleDeletePath(oldPath);
          if (this.currentChapter?.path === oldPath || this.currentChapter?.path === file.path) this.currentChapter = null;
          if (worldChanged || this.manuscriptChronologyDependencies.has(oldPath)) this.refreshView();
          this.refreshManuscriptNavigator();
          return;
        }
        if (renameKind === "trash-restore") {
          this.manuscriptIntegrityCoordinator.queueUnmanagedMove(oldPath, file.path);
          const worldChanged = this.storyWorldIndex.handleCreate(file);
          this.storyWorldReviewProjection.invalidateMetadata(file, worldChanged);
          this.pendingEditorialCreates.set(file.path, file);
          this.refreshView();
          this.refreshManuscriptNavigator();
          return;
        }
        if (renameKind === "trash-internal") return;

        this.manuscriptIntegrityCoordinator.queueRename(oldPath, file.path);
        const selection = this.manuscriptBookSelection.get();
        if (selection.bookPath === oldPath || selection.contextPath === oldPath) {
          this.manuscriptBookSelection.replace(
            selection.bookPath === oldPath ? file.path : selection.bookPath,
            selection.contextPath === oldPath ? file.path : selection.contextPath,
            "integrity-reconciliation"
          );
        }
        const worldChanged = this.storyWorldIndex.handleRename(file, oldPath);
        this.storyWorldReviewProjection.invalidatePath(oldPath);
        this.storyWorldReviewProjection.invalidateMetadata(file, worldChanged);
        await this.storeService.handleRename(file, oldPath);

        if (this.currentChapter?.path === oldPath) {
          this.currentChapter = file;
        }

        if (worldChanged || this.manuscriptChronologyDependencies.has(oldPath)) {
          this.refreshView();
        }
        this.refreshManuscriptNavigator();
      })
    );
  }

  private async backUpVault(): Promise<void> {
    if (!this.vaultBackupService) {
      new Notice("Vault backup is available only in the Obsidian desktop app.");
      return;
    }

    const progress = new Notice("Backing up vault to GitHub…", 0);
    const result = await this.vaultBackupService.run();
    progress.hide();
    new Notice(this.vaultBackupNotice(result), result.kind === "failed" || result.kind === "remote_ahead" || result.kind === "diverged" ? 10000 : 5000);
  }

  private vaultBackupNotice(result: VaultBackupResult): string {
    switch (result.kind) {
      case "success": return result.detail ?? "Vault backup complete.";
      case "no_changes": return "No vault changes to back up.";
      case "busy": return "A vault backup is already running.";
      case "unsupported": return "Vault backup requires a desktop filesystem vault.";
      case "missing_script": return "Backup script not found at Scripts/backup-vault.sh.";
      case "remote_ahead":
      case "diverged":
      case "failed": return `Backup failed: ${result.detail ?? "Check the script output and resolve the Git issue manually."}`;
    }
  }

  onunload() {
    this.manuscriptIntegrityCoordinator?.dispose();
    if (this.manuscriptChronologyRefreshTimer !== null) {
      window.clearTimeout(this.manuscriptChronologyRefreshTimer);
      this.manuscriptChronologyRefreshTimer = null;
    }
    if (this.storyWorldMetadataRefreshTimer !== null) {
      window.clearTimeout(this.storyWorldMetadataRefreshTimer);
      this.storyWorldMetadataRefreshTimer = null;
    }
    this.annotationLocator.dispose();
    void this.storeService.flushChapterNote();
  }

  getActiveChapter(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file ?? null;
    return file
      && !isObsidianTrashPath(file.path)
      && this.app.vault.getAbstractFileByPath(file.path) instanceof TFile
      ? file
      : null;
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

  getManuscriptChronology(chapter: TFile): ObsidianManuscriptChronologyResult {
    const result = buildObsidianManuscriptChronology(this.app, chapter);
    this.manuscriptChronologyDependencies = new Set(result.dependencies);
    return result;
  }

  getContinuityReviewActiveCount(bookPath: string): number | null {
    const collection = collectObsidianContinuityReview(this.app, this.storyWorldIndex, bookPath, this.manuscriptProjection.get(), this.storyWorldReviewProjection.get());
    if (!collection) return null;
    return projectContinuityReview({
      observations: collection.observations,
      dispositions: new Map(this.storeService.getContinuityDispositionRecords().map((record) => [record.lineageKey, record])),
      manuscriptScope: collection.scope
    }, { queue: "active", type: null, locationPath: null, entityPath: null }).counts.active;
  }

  getContinuityReviewActionPresentation(
    bookPath: string | null,
    prefix = "Continuity Review"
  ): ContinuityReviewActionPresentation {
    const book = bookPath
      ? this.manuscriptProjection.get().books.find((candidate) => candidate.file.path === bookPath)
      : null;
    const safe = Boolean(book && manuscriptChronologyOrderIsSafe(book.result));
    return continuityReviewActionPresentation(
      safe,
      safe && bookPath ? this.getContinuityReviewActiveCount(bookPath) : null,
      prefix
    );
  }

  async activateContinuityReviewForBook(bookPath: string, contextPath: string): Promise<void> {
    this.manuscriptBookSelection.select(bookPath, contextPath, "continuity-review-activation");
    new Notice("Continuity Review is unavailable in this plugin entry point.");
  }

  private scheduleManuscriptChronologyRefresh() {
    if (this.manuscriptChronologyRefreshTimer !== null) {
      window.clearTimeout(this.manuscriptChronologyRefreshTimer);
    }
    // Obsidian can emit metadata-cache changes before getFileCache exposes the
    // same fresh frontmatter to a second reader. Coalesce a follow-up render so
    // chronology never remains pinned to the preceding date fingerprint.
    this.manuscriptChronologyRefreshTimer = window.setTimeout(() => {
      this.manuscriptChronologyRefreshTimer = null;
      this.refreshView();
    }, 50);
  }

  private scheduleStoryWorldMetadataRefresh(path: string) {
    this.pendingStoryWorldMetadataPaths.add(path);
    if (this.storyWorldMetadataRefreshTimer !== null) window.clearTimeout(this.storyWorldMetadataRefreshTimer);
    this.storyWorldMetadataRefreshTimer = window.setTimeout(() => {
      this.storyWorldMetadataRefreshTimer = null;
      const paths = [...this.pendingStoryWorldMetadataPaths];
      this.pendingStoryWorldMetadataPaths.clear();
      for (const changedPath of paths) {
        const file = this.app.vault.getAbstractFileByPath(changedPath);
        if (file instanceof TFile) this.storyWorldIndex.handleMetadataChanged(file);
      }
      this.refreshView();
    }, 50);
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

  getPrecedingStoryDateOffer(chapter: TFile): ManuscriptStoryDateOffer | null {
    return getObsidianManuscriptStoryDateOffer(this, chapter);
  }

  async acceptPrecedingStoryDateOffer(offer: ManuscriptStoryDateOffer): Promise<void> {
    await acceptObsidianManuscriptStoryDateOffer(this, offer);
    this.refreshView();
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

  getLocationSuggestions(): LocationSuggestion[] {
    return buildLocationSuggestions(this.storyWorldIndex.index.getAll());
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
    this.onMwcUserInteraction();
    const activated = await this.writingCompanionActivation.activate(
      this.app.workspace,
      VIEW_TYPE
    );
    if (!activated) {
      new Notice("Could not open the writing companion sidebar.");
    }
  }

  async activateManuscriptNavigator() {
    this.onMwcUserInteraction();
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

  protected onMwcUserInteraction(): void {
    // The full plugin entry point supplies first-use readiness guidance.
  }

  openProjectReadiness(): void {
    new Notice("Project readiness is unavailable in this plugin entry point.");
  }

  openHelp(): void {
    openHelp(
      (url, target, features) => window.open(url, target, features),
      () => new Notice("Murmuration Writing Companion Help could not be opened.")
    );
  }

  prepareExistingManuscript(_bookPath: string): Promise<void> {
    new Notice("Manuscript preparation is unavailable in this plugin entry point.");
    return Promise.resolve();
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

  refreshContinuityReview() {
    // The full plugin entry point overrides this hook.
  }

  recollectContinuityReview() {
    // The full plugin entry point overrides this hook.
  }

  private clearManuscriptReveal(fallbackPath: string | null) {
    const leaves = this.app.workspace.getLeavesOfType(MANUSCRIPT_NAVIGATOR_VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof ManuscriptNavigatorView) view.reconcileReveal(fallbackPath);
    }
  }

  private async settleEditorialCreates(
    library: ReturnType<typeof buildObsidianManuscriptLibrary>,
    affectedPaths: ReadonlySet<string>
  ) {
    const manuscriptPaths = new Set<string>(library.unresolved.map((entry) => entry.file.path));
    for (const book of library.books) for (const path of book.filesByPath.keys()) manuscriptPaths.add(path);
    for (const path of affectedPaths) {
      const pending = this.pendingEditorialCreates.get(path);
      if (!pending) continue;
      this.pendingEditorialCreates.delete(path);
      const current = this.app.vault.getAbstractFileByPath(path);
      if (!(current instanceof TFile)) continue;
      await this.storeService.handleCreate(current, {
        // Presence is restored, but #149 must not write editorial projection
        // properties into a manuscript note merely because it reappeared.
        syncOpenAnnotationProperty: Boolean(this.app.metadataCache.getFileCache(current))
          && !manuscriptPaths.has(path)
      });
    }
  }

  refreshManuscriptBookAfterStructuralChange(bookPath: string) {
    const book = buildObsidianManuscriptLibrary(this.app).books.find((candidate) => candidate.file.path === bookPath);
    if (book) {
      this.manuscriptChronologyDependencies = new Set(
        buildObsidianManuscriptChronologyForBook(this.app, book).dependencies
      );
    }
    this.refreshView();
    this.refreshManuscriptNavigator();
    this.scheduleManuscriptChronologyRefresh();
  }

  revealManuscriptPath(path: string) {
    const leaves = this.app.workspace.getLeavesOfType(MANUSCRIPT_NAVIGATOR_VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof ManuscriptNavigatorView) view.revealPath(path);
    }
  }
}
