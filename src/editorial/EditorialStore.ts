import { Notice, Plugin, TFile } from "obsidian";
import {
  Annotation,
  AnnotationAnchor,
  EditorialStore,
  PageEditorialNotes
} from "./EditorialNote";
import {
  EditorialPassChecklistItem,
  EditorialPassKey,
  EditorialPassMigrationResult,
  ensureEditorialPassFrontier,
  getEditorialPassChecklist,
  getEditorialPassFrontier,
  setEditorialPassCompleted as applyEditorialPassCompletion,
  setEditorialPassFrontier as applyEditorialPassFrontier
} from "./EditorialPass";
import {
  getBookReviewMode as readBookReviewMode,
  setBookReviewMode as applyBookReviewMode
} from "./BookReview";
import { ObsidianEditorialFileSystem } from "./ObsidianEditorialFileSystem";
import { OpenAnnotationPropertyService } from "./OpenAnnotationProperty";
import {
  AtomicTextFileStore,
  markEditorialPageDeleted,
  moveEditorialPage,
  PortableEditorialStorage,
  reconcileEditorialPagePresence,
  restoreEditorialPage
} from "./PortableEditorialStorage";
import type { ContinuityObservation } from "../observations/ContinuityObservation";
import {
  ContinuityDispositionKind,
  ContinuityDispositionQueue,
  ContinuityDispositionRecord,
  projectContinuityDispositionQueue,
  reviseContinuityDispositionNote,
  setContinuityDisposition
} from "../observations/ContinuityDisposition";

const CHAPTER_NOTE_SAVE_DELAY_MS = 400;

export class EditorialStoreService {
  private plugin: Plugin;
  private chapterNoteSaveTimers = new Map<string, number>();
  private openAnnotationProperty: OpenAnnotationPropertyService;
  private portableStorage: PortableEditorialStorage;
  private ready = false;

  store: EditorialStore = { pages: {} };
  onChange: () => void = () => {};
  onContinuityChange: () => void = () => this.onChange();

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.openAnnotationProperty = new OpenAnnotationPropertyService(plugin.app);
    this.portableStorage = new PortableEditorialStorage(
      new AtomicTextFileStore(new ObsidianEditorialFileSystem(plugin.app))
    );
  }

  async load() {
    try {
      const legacyData = await this.plugin.loadData();
      const result = await this.portableStorage.load(legacyData);
      this.store = result.store;
      this.ready = true;

      if (result.source === "legacy") {
        new Notice("Writing Companion editorial data moved into the vault.");
      } else if (result.recovered) {
        new Notice(
          `Writing Companion recovered editorial data from its ${result.source} file.`
        );
      } else if (result.migrated) {
        new Notice("Writing Companion editorial storage was upgraded safely.");
      }
    } catch (error) {
      console.error("Writing Companion portable editorial storage failed to load", error);
      new Notice(
        "Writing Companion could not load editorial data. The storage files were not overwritten; check the console."
      );
      throw error;
    }
  }

  async save() {
    if (!this.ready) return;
    await this.portableStorage.save(this.store);
  }

  getContinuityDispositionRecords(): ContinuityDispositionRecord[] {
    return Object.values(this.store.continuityDispositions ?? {});
  }

  getContinuityDispositionQueue(
    observations: readonly ContinuityObservation[]
  ): ContinuityDispositionQueue {
    return projectContinuityDispositionQueue(
      observations,
      this.getContinuityDispositionRecords()
    );
  }

  async setContinuityDisposition(
    observation: ContinuityObservation,
    disposition: ContinuityDispositionKind,
    note?: string | null
  ): Promise<void> {
    if (!this.store.continuityDispositions) this.store.continuityDispositions = {};
    const previous = this.store.continuityDispositions[observation.lineageKey] ?? null;
    this.store.continuityDispositions[observation.lineageKey] = setContinuityDisposition(
      observation,
      disposition,
      note === undefined ? previous?.note : note,
      new Date().toISOString(),
      previous
    );
    await this.save();
    this.onContinuityChange();
  }

  async reviseContinuityDispositionNote(
    lineageKey: string,
    note: string | null
  ): Promise<void> {
    const previous = this.store.continuityDispositions?.[lineageKey];
    if (!previous) return;
    const next = reviseContinuityDispositionNote(
      previous,
      note,
      new Date().toISOString()
    );
    if (next === previous) return;
    this.store.continuityDispositions![lineageKey] = next;
    await this.save();
    this.onContinuityChange();
  }

  async clearContinuityDisposition(lineageKey: string): Promise<void> {
    const records = this.store.continuityDispositions;
    if (!records?.[lineageKey]) return;
    delete records[lineageKey];
    if (Object.keys(records).length === 0) delete this.store.continuityDispositions;
    await this.save();
    this.onContinuityChange();
  }

  getPage(file: TFile): PageEditorialNotes {
    if (restoreEditorialPage(this.store, file.path)) {
      void this.save();
    }

    if (!this.store.pages[file.path]) {
      const now = new Date().toISOString();

      this.store.pages[file.path] = {
        chapterNote: {
          body: "",
          created: now,
          updated: now
        },
        annotations: [],
        editorialPassHistory: []
      };
    }

    return this.store.pages[file.path];
  }

  updateChapterNote(file: TFile, body: string) {
    const page = this.getPage(file);
    page.chapterNote.body = body;
    page.chapterNote.updated = new Date().toISOString();

    const existingTimer = this.chapterNoteSaveTimers.get(file.path);
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);

    const timer = window.setTimeout(() => {
      this.chapterNoteSaveTimers.delete(file.path);
      void this.save();
    }, CHAPTER_NOTE_SAVE_DELAY_MS);

    this.chapterNoteSaveTimers.set(file.path, timer);
  }

  ensureEditorialPassFrontier(
    file: TFile,
    frontmatterValue?: unknown
  ): EditorialPassMigrationResult {
    const result = ensureEditorialPassFrontier(this.getPage(file), frontmatterValue);
    if (result.changed) void this.save();
    return result;
  }

  getEditorialPassChecklist(
    file: TFile,
    frontmatterValue?: unknown
  ): EditorialPassChecklistItem[] {
    this.ensureEditorialPassFrontier(file, frontmatterValue);
    return getEditorialPassChecklist(this.getPage(file));
  }

  getEditorialPassFrontier(
    file: TFile,
    frontmatterValue?: unknown
  ): EditorialPassKey | null {
    this.ensureEditorialPassFrontier(file, frontmatterValue);
    return getEditorialPassFrontier(this.getPage(file));
  }

  async setEditorialPassFrontier(
    file: TFile,
    pass: EditorialPassKey | null
  ): Promise<boolean> {
    const changed = applyEditorialPassFrontier(
      this.getPage(file),
      pass,
      new Date().toISOString(),
      crypto.randomUUID()
    );

    if (!changed) return false;

    await this.save();
    this.onChange();
    return true;
  }

  async setEditorialPassCompleted(
    file: TFile,
    pass: EditorialPassKey,
    completed: boolean
  ): Promise<boolean> {
    const changed = applyEditorialPassCompletion(
      this.getPage(file),
      pass,
      completed,
      new Date().toISOString(),
      crypto.randomUUID()
    );

    if (!changed) return false;

    await this.save();
    this.onChange();
    return true;
  }

  getBookReviewMode(file: TFile): EditorialPassKey | null {
    return readBookReviewMode(this.getPage(file));
  }

  async setBookReviewMode(
    file: TFile,
    mode: EditorialPassKey | null
  ): Promise<boolean> {
    if (!applyBookReviewMode(this.getPage(file), mode)) return false;
    await this.save();
    this.onChange();
    return true;
  }

  async flushChapterNote(file?: TFile) {
    if (file) {
      const timer = this.chapterNoteSaveTimers.get(file.path);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        this.chapterNoteSaveTimers.delete(file.path);
      }
    } else {
      for (const timer of this.chapterNoteSaveTimers.values()) {
        window.clearTimeout(timer);
      }
      this.chapterNoteSaveTimers.clear();
    }

    if (this.ready) await this.save();
  }

  async addAnnotation(
    file: TFile,
    anchor: AnnotationAnchor,
    body: string,
    category: string
  ): Promise<string> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const page = this.getPage(file);

    page.annotations.push({
      id,
      body,
      category,
      status: "open",
      created: now,
      updated: now,
      anchor
    });

    await this.save();
    await this.syncOpenAnnotationProperty(file, page);
    this.onChange();
    new Notice("Annotation added.");

    return id;
  }

  async updateAnnotation(
    file: TFile,
    annotation: Annotation,
    patch: Partial<Annotation>
  ) {
    const previousStatus = annotation.status;
    Object.assign(annotation, patch, { updated: new Date().toISOString() });

    await this.save();

    if (annotation.status !== previousStatus) {
      await this.syncOpenAnnotationProperty(file, this.getPage(file));
    }

    this.onChange();
  }

  async reconcileDeletedEditorialPages() {
    const existingPaths = this.plugin.app.vault
      .getMarkdownFiles()
      .map((file) => file.path);
    const result = reconcileEditorialPagePresence(this.store, existingPaths);

    if (result.deletedPaths.length > 0 || result.restoredPaths.length > 0) {
      await this.save();
    }

    return result;
  }

  async reconcileOpenAnnotationProperties() {
    await this.openAnnotationProperty.reconcile(this.store);
  }

  async handleCreate(file: TFile) {
    if (!restoreEditorialPage(this.store, file.path)) return;

    await this.save();
    await this.syncOpenAnnotationProperty(file, this.store.pages[file.path]);
    this.onChange();
    new Notice("Writing Companion restored editorial data for this chapter.");
  }

  async handleDelete(file: TFile) {
    const timer = this.chapterNoteSaveTimers.get(file.path);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.chapterNoteSaveTimers.delete(file.path);
    }

    if (!markEditorialPageDeleted(this.store, file.path)) return;

    await this.save();
    this.onChange();
    new Notice("Writing Companion retained editorial data for the deleted chapter.");
  }

  async handleRename(file: TFile, oldPath: string) {
    let changed = false;
    try {
      changed = moveEditorialPage(this.store, oldPath, file.path) || changed;
    } catch (error) {
      console.error("Writing Companion could not move editorial data", error);
      new Notice(
        "Writing Companion did not move editorial data because the destination already has a record."
      );
    }

    // Paths are descriptive context only. Hashed observation identity remains
    // path-based and is deliberately not guessed or rewritten on rename.
    for (const [lineageKey, record] of Object.entries(
      this.store.continuityDispositions ?? {}
    )) {
      const primaryPath = record.primaryPath === oldPath ? file.path : record.primaryPath;
      const sourcePaths = record.sourcePaths.map((path) => path === oldPath ? file.path : path);
      if (
        primaryPath !== record.primaryPath
        || sourcePaths.some((path, index) => path !== record.sourcePaths[index])
      ) {
        this.store.continuityDispositions![lineageKey] = {
          ...record,
          primaryPath,
          sourcePaths
        };
        changed = true;
      }
    }

    if (!changed) return;

    const timer = this.chapterNoteSaveTimers.get(oldPath);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.chapterNoteSaveTimers.delete(oldPath);
    }

    await this.save();
    const page = this.store.pages[file.path];
    if (page) await this.syncOpenAnnotationProperty(file, page);
    this.onChange();
  }

  private async syncOpenAnnotationProperty(
    file: TFile,
    page: PageEditorialNotes
  ) {
    const openCount = page.annotations.filter(
      (annotation) => annotation.status === "open"
    ).length;

    await this.openAnnotationProperty.sync(file, openCount);
  }
}
