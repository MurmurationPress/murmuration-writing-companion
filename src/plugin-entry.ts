import { ItemView, Notice } from "obsidian";
import MurmurationWritingCompanionPlugin from "./main";
import {
  buildObsidianManuscriptLibrary,
  ObsidianManuscriptBook
} from "./manuscript/ObsidianManuscript";
import {
  applyManuscriptPreparation,
  ManuscriptPreparationUndoToken,
  planObsidianManuscriptPreparation,
  StaleManuscriptPreparationUndoError,
  undoManuscriptPreparation
} from "./manuscript/ObsidianManuscriptPreparation";
import { confirmManuscriptPreparation } from "./manuscript/ManuscriptPreparationModal";
import { MANUSCRIPT_NAVIGATOR_VIEW_TYPE } from "./manuscript/ManuscriptNavigatorView";

interface NavigatorPreparationActions {
  readonly prepare: HTMLElement;
  readonly undo: HTMLElement;
}

export default class MurmurationWritingCompanionEntry extends MurmurationWritingCompanionPlugin {
  private preparationUndoToken: ManuscriptPreparationUndoToken | null = null;
  private readonly preparationActions = new WeakMap<
    ItemView,
    NavigatorPreparationActions
  >();

  async onload() {
    await super.onload();

    this.addCommand({
      id: "prepare-existing-manuscript",
      name: "Prepare existing manuscript",
      callback: () => void this.prepareSelectedManuscript()
    });
    this.addCommand({
      id: "undo-manuscript-preparation",
      name: "Undo manuscript preparation",
      callback: () => void this.undoPreparation()
    });

    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.installPreparationActions())
    );
    this.app.workspace.onLayoutReady(() => this.installPreparationActions());
  }

  private installPreparationActions() {
    const leaves = this.app.workspace.getLeavesOfType(
      MANUSCRIPT_NAVIGATOR_VIEW_TYPE
    );

    for (const leaf of leaves) {
      const view = leaf.view as ItemView;
      let actions = this.preparationActions.get(view);
      if (!actions) {
        const prepare = view.addAction(
          "wand-sparkles",
          "Prepare existing manuscript",
          () => void this.prepareSelectedManuscript(view)
        );
        const undo = view.addAction(
          "undo-2",
          "Undo manuscript preparation",
          () => void this.undoPreparation()
        );
        actions = { prepare, undo };
        this.preparationActions.set(view, actions);
      }
      actions.undo.style.display = this.preparationUndoToken ? "" : "none";
    }
  }

  private selectedBook(view?: ItemView): ObsidianManuscriptBook | null {
    const library = buildObsidianManuscriptLibrary(this.app);
    const selector = view?.containerEl.querySelector<HTMLSelectElement>(
      ".mwc-manuscript-book-selector"
    );
    const selectedPath = selector?.value || null;
    if (selectedPath) {
      const selected = library.books.find((book) => book.file.path === selectedPath);
      if (selected) return selected;
    }

    const active = this.getCurrentChapter();
    const activeBookPath = active
      ? library.owningBookPathByFile.get(active.path) ?? null
      : null;
    if (activeBookPath) {
      const activeBook = library.books.find((book) => (
        book.file.path === activeBookPath
      ));
      if (activeBook) return activeBook;
    }

    return library.books.length === 1 ? library.books[0] : null;
  }

  private async prepareSelectedManuscript(view?: ItemView) {
    const book = this.selectedBook(view);
    if (!book) {
      new Notice("Select a manuscript book in the navigator first.");
      return;
    }

    const plan = planObsidianManuscriptPreparation(book);
    if (plan.alreadyPrepared) {
      new Notice(`${book.record.title} already has authoritative manuscript metadata.`);
      return;
    }

    if (!await confirmManuscriptPreparation(this.app, plan)) return;

    try {
      this.preparationUndoToken = await applyManuscriptPreparation(
        this.app,
        book,
        plan
      );
      new Notice(this.preparationUndoToken.message, 8000);
      this.refreshPreparationViews();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Could not prepare the manuscript.";
      new Notice(message, 10000);
    }
  }

  private async undoPreparation() {
    if (!this.preparationUndoToken) {
      new Notice("There is no manuscript preparation to undo.");
      return;
    }

    const token = this.preparationUndoToken;
    try {
      await undoManuscriptPreparation(this.app, token);
      this.preparationUndoToken = null;
      new Notice("Manuscript preparation undone.");
    } catch (error) {
      this.preparationUndoToken = null;
      const message = error instanceof StaleManuscriptPreparationUndoError
        ? error.message
        : "Could not undo manuscript preparation.";
      new Notice(message, 10000);
    } finally {
      this.refreshPreparationViews();
    }
  }

  private refreshPreparationViews() {
    this.installPreparationActions();
    window.setTimeout(() => {
      this.refreshManuscriptNavigator();
      this.installPreparationActions();
    }, 0);
  }
}
