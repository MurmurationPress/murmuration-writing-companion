import { Notice, Plugin, TFile } from "obsidian";
import {
  AnnotationAnchor,
  EditorialNote,
  EditorialStore,
  PageEditorialNotes
} from "./EditorialNote";

const CHAPTER_NOTE_SAVE_DELAY_MS = 400;

export class EditorialStoreService {
  private plugin: Plugin;
  private chapterNoteSaveTimers = new Map<string, number>();

  store: EditorialStore = { pages: {} };
  onChange: () => void = () => {};

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  async load() {
    const loaded = (await this.plugin.loadData()) ?? { pages: {} };
    this.store = loaded as EditorialStore;

    if (!this.store.pages) this.store.pages = {};

    let migrated = false;

    for (const page of Object.values(this.store.pages)) {
      if (!Array.isArray(page.annotations)) {
        page.annotations = [];
        migrated = true;
      }

      if (!page.chapterNote) {
        const legacyNotes = Array.isArray(page.documentNotes)
          ? page.documentNotes.filter((note) => note.status === "open")
          : [];
        const now = new Date().toISOString();

        page.chapterNote = {
          body: legacyNotes.map((note) => note.body).join("\n\n"),
          created: legacyNotes[0]?.created ?? now,
          updated: legacyNotes.at(-1)?.updated ?? now
        };

        migrated = true;
      }
    }

    if (migrated) await this.save();
  }

  async save() {
    await this.plugin.saveData(this.store);
  }

  getPage(file: TFile): PageEditorialNotes {
    if (!this.store.pages[file.path]) {
      const now = new Date().toISOString();

      this.store.pages[file.path] = {
        chapterNote: {
          body: "",
          created: now,
          updated: now
        },
        annotations: []
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

    await this.save();
  }

  async addAnnotation(
    file: TFile,
    anchor: AnnotationAnchor,
    body: string,
    category: string
  ): Promise<string> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    this.getPage(file).annotations.push({
      id,
      body,
      category,
      status: "open",
      created: now,
      updated: now,
      anchor
    });

    await this.save();
    this.onChange();
    new Notice("Annotation added.");

    return id;
  }

  async updateNote(note: EditorialNote, patch: Partial<EditorialNote>) {
    Object.assign(note, patch, { updated: new Date().toISOString() });
    await this.save();
    this.onChange();
  }

  async handleRename(file: TFile, oldPath: string) {
    if (!this.store.pages[oldPath]) return;

    const timer = this.chapterNoteSaveTimers.get(oldPath);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.chapterNoteSaveTimers.delete(oldPath);
    }

    this.store.pages[file.path] = this.store.pages[oldPath];
    delete this.store.pages[oldPath];

    await this.save();
    this.onChange();
  }
}
