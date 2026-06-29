import {
  ItemView,
  MarkdownView,
  Notice,
  Plugin,
  TFile,
  WorkspaceLeaf
} from "obsidian";

const VIEW_TYPE = "murmuration-editorial-notes-view";

type NoteStatus = "open" | "resolved";

interface EditorialNote {
  id: string;
  body: string;
  category: string;
  status: NoteStatus;
  created: string;
  updated: string;
}

interface AnchoredEditorialNote extends EditorialNote {
  anchorText: string;
  line?: number;
}

interface PageEditorialNotes {
  documentNotes: EditorialNote[];
  anchoredNotes: AnchoredEditorialNote[];
}

interface EditorialStore {
  pages: Record<string, PageEditorialNotes>;
}

const DEFAULT_CATEGORIES = [
  "Editorial",
  "Canon",
  "Continuity",
  "Style",
  "Pace",
  "Structure",
  "Fact-check",
  "Compiler",
  "Book 2",
  "Book 3",
  "Book 4"
];

export default class MurmurationEditorialNotesPlugin extends Plugin {
  store: EditorialStore = { pages: {} };

  async onload() {
    await this.loadStore();

    this.registerView(
      VIEW_TYPE,
      (leaf) => new EditorialNotesView(leaf, this)
    );

    this.addRibbonIcon("notebook-pen", "Murmuration Writing Companion", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-editorial-inspector",
      name: "Open writing companion",
      callback: () => this.activateView()
    });

    this.addCommand({
      id: "add-document-editorial-note",
      name: "Add document note",
      checkCallback: (checking) => {
        const file = this.getActiveFile();
        if (!file) return false;
        if (!checking) {
          this.addDocumentNote(file, "New document note", "Editorial");
          this.activateView();
        }
        return true;
      }
    });

    this.addCommand({
      id: "add-selection-editorial-note",
      name: "Add selection note",
      editorCallback: async (editor, view) => {
        const file = view.file;
        if (!file) return;

        const selected = editor.getSelection().trim();
        if (!selected) {
          new Notice("Select text first.");
          return;
        }

        await this.addAnchoredNote(
          file,
          selected,
          editor.getCursor("from").line + 1,
          "New selection note",
          "Editorial"
        );

        await this.activateView();
      }
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.refreshView();
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (!(file instanceof TFile)) return;
        if (!this.store.pages[oldPath]) return;

        this.store.pages[file.path] = this.store.pages[oldPath];
        delete this.store.pages[oldPath];
        await this.saveStore();
        this.refreshView();
      })
    );
  }

  async loadStore() {
    this.store = (await this.loadData()) ?? { pages: {} };
    if (!this.store.pages) this.store.pages = {};
  }

  async saveStore() {
    await this.saveData(this.store);
  }

  getActiveFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.file ?? null;
  }

  getPage(file: TFile): PageEditorialNotes {
    if (!this.store.pages[file.path]) {
      this.store.pages[file.path] = {
        documentNotes: [],
        anchoredNotes: []
      };
    }
    return this.store.pages[file.path];
  }

  async addDocumentNote(file: TFile, body: string, category: string) {
    const now = new Date().toISOString();
    const page = this.getPage(file);

    page.documentNotes.push({
      id: crypto.randomUUID(),
      body,
      category,
      status: "open",
      created: now,
      updated: now
    });

    await this.saveStore();
    this.refreshView();
    new Notice("Document note added.");
  }

  async addAnchoredNote(
    file: TFile,
    anchorText: string,
    line: number,
    body: string,
    category: string
  ) {
    const now = new Date().toISOString();
    const page = this.getPage(file);

    page.anchoredNotes.push({
      id: crypto.randomUUID(),
      body,
      category,
      status: "open",
      created: now,
      updated: now,
      anchorText,
      line
    });

    await this.saveStore();
    this.refreshView();
    new Notice("Selection note added.");
  }

  async updateNote(note: EditorialNote, patch: Partial<EditorialNote>) {
    Object.assign(note, patch, { updated: new Date().toISOString() });
    await this.saveStore();
    this.refreshView();
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
      if (view instanceof EditorialNotesView) {
        view.render();
      }
    }
  }
}

class EditorialNotesView extends ItemView {
  plugin: MurmurationEditorialNotesPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: MurmurationEditorialNotesPlugin) {
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
    container.addClass("men-container");

    const file = this.plugin.getActiveFile();

    container.createEl("h2", { text: "Writing Companion" });

    if (!file) {
      container.createEl("p", {
        cls: "men-muted",
        text: "Open a Markdown page to view its notes."
      });
      return;
    }

    container.createEl("div", {
      cls: "men-file-name",
      text: file.basename
    });

    const page = this.plugin.getPage(file);

    this.renderDocumentNotes(container, file, page);
    this.renderAnchoredNotes(container, page);
  }

  renderDocumentNotes(container: Element, file: TFile, page: PageEditorialNotes) {
    const section = container.createDiv("men-section");
    section.createEl("h3", { text: "Document Notes" });

    const addButton = section.createEl("button", {
      cls: "men-button",
      text: "Add document note"
    });

    addButton.onclick = async () => {
      await this.plugin.addDocumentNote(file, "New document note", "Editorial");
    };

    const notes = page.documentNotes.filter((note) => note.status === "open");

    if (notes.length === 0) {
      section.createEl("p", {
        cls: "men-muted",
        text: "No open document notes."
      });
    }

    for (const note of notes) {
      this.renderNoteCard(section, note);
    }
  }

  renderAnchoredNotes(container: Element, page: PageEditorialNotes) {
    const section = container.createDiv("men-section");
    section.createEl("h3", { text: "Selection Notes" });

    const notes = page.anchoredNotes.filter((note) => note.status === "open");

    if (notes.length === 0) {
      section.createEl("p", {
        cls: "men-muted",
        text: "No open selection notes."
      });
    }

    for (const note of notes) {
      const card = this.renderNoteCard(section, note);
      card.createEl("blockquote", {
        cls: "men-anchor",
        text: note.anchorText
      });

      if (note.line) {
        card.createEl("div", {
          cls: "men-line",
          text: `Line ${note.line}`
        });
      }
    }
  }

  renderNoteCard(container: Element, note: EditorialNote): HTMLElement {
    const card = container.createDiv("men-note-card");

    const top = card.createDiv("men-note-top");
    top.createEl("span", {
      cls: "men-category",
      text: note.category
    });

    const body = card.createEl("textarea", {
      cls: "men-note-body",
      text: note.body
    });

    body.onchange = async () => {
      await this.plugin.updateNote(note, { body: body.value });
    };

    const controls = card.createDiv("men-controls");

    const category = controls.createEl("select", {
      cls: "men-select"
    });

    for (const categoryName of DEFAULT_CATEGORIES) {
      const option = category.createEl("option", {
        text: categoryName,
        value: categoryName
      });
      if (categoryName === note.category) option.selected = true;
    }

    category.onchange = async () => {
      await this.plugin.updateNote(note, { category: category.value });
    };

    const resolve = controls.createEl("button", {
      cls: "men-button",
      text: "Resolve"
    });

    resolve.onclick = async () => {
      await this.plugin.updateNote(note, { status: "resolved" });
    };

    return card;
  }
}
