import {
  MarkdownView,
  Notice,
  Plugin,
  TFile
} from "obsidian";
import {
  VIEW_TYPE,
  WritingCompanionView
} from "./companion/WritingCompanionView";
import { EditorialStoreService } from "./editorial/EditorialStore";

export default class MurmurationWritingCompanionPlugin extends Plugin {
  storeService!: EditorialStoreService;

  async onload() {
    this.storeService = new EditorialStoreService(this);
    this.storeService.onChange = () => this.refreshView();

    await this.storeService.load();

    this.registerView(
      VIEW_TYPE,
      (leaf) => new WritingCompanionView(leaf, this)
    );

    this.addRibbonIcon("notebook-pen", "Murmuration Writing Companion", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-writing-companion",
      name: "Open writing companion",
      callback: () => this.activateView()
    });

    this.addCommand({
      id: "add-document-note",
      name: "Add document note",
      checkCallback: (checking) => {
        const file = this.getActiveFile();
        if (!file) return false;

        if (!checking) {
          this.storeService.addDocumentNote(file, "New document note", "Editorial");
          this.activateView();
        }

        return true;
      }
    });

    this.addCommand({
      id: "annotate",
      name: "Annotate",
      editorCallback: async (editor, view) => {
        const file = view.file;
        if (!file) return;

        const selected = editor.getSelection().trim();

        if (!selected) {
          new Notice("Select text first.");
          return;
        }

        await this.storeService.addAnnotation(
          file,
          {
            text: selected,
            line: editor.getCursor("from").line + 1
          },
          "New annotation",
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
        await this.storeService.handleRename(file, oldPath);
      })
    );
  }

  getActiveFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.file ?? null;
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
