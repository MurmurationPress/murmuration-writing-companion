import { Notice, Plugin, TFile } from "obsidian";
import {
  AnnotationAnchor,
  EditorialNote,
  EditorialStore,
  PageEditorialNotes
} from "./EditorialNote";

export class EditorialStoreService {
  private plugin: Plugin;
  store: EditorialStore = { pages: {} };
  onChange: () => void = () => {};

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  async load() {
    this.store = (await this.plugin.loadData()) ?? { pages: {} };
    if (!this.store.pages) this.store.pages = {};
  }

  async save() {
    await this.plugin.saveData(this.store);
  }

  getPage(file: TFile): PageEditorialNotes {
    if (!this.store.pages[file.path]) {
      this.store.pages[file.path] = {
        documentNotes: [],
        annotations: []
      };
    }

    return this.store.pages[file.path];
  }

  async addDocumentNote(file: TFile, body: string, category: string) {
    const now = new Date().toISOString();

    this.getPage(file).documentNotes.push({
      id: crypto.randomUUID(),
      body,
      category,
      status: "open",
      created: now,
      updated: now
    });

    await this.save();
    this.onChange();
    new Notice("Document note added.");
  }

  async addAnnotation(
    file: TFile,
    anchor: AnnotationAnchor,
    body: string,
    category: string
  ) {
    const now = new Date().toISOString();

    this.getPage(file).annotations.push({
      id: crypto.randomUUID(),
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
  }

  async updateNote(note: EditorialNote, patch: Partial<EditorialNote>) {
    Object.assign(note, patch, { updated: new Date().toISOString() });
    await this.save();
    this.onChange();
  }

  async handleRename(file: TFile, oldPath: string) {
    if (!this.store.pages[oldPath]) return;

    this.store.pages[file.path] = this.store.pages[oldPath];
    delete this.store.pages[oldPath];

    await this.save();
    this.onChange();
  }
}
