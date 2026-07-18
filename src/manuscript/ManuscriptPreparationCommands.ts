import { ItemView, Notice, Plugin, TFile } from "obsidian";
import {
  buildObsidianManuscriptLibrary,
  ObsidianManuscriptBook
} from "./ObsidianManuscript";
import {
  applyManuscriptPreparation,
  ManuscriptPreparationUndoToken,
  planObsidianManuscriptPreparation,
  StaleManuscriptPreparationUndoError,
  undoManuscriptPreparation
} from "./ObsidianManuscriptPreparation";
import { confirmManuscriptPreparation } from "./ManuscriptPreparationModal";
import { MANUSCRIPT_NAVIGATOR_VIEW_TYPE } from "./ManuscriptNavigatorView";

export interface ManuscriptPreparationCommandHost extends Plugin {
  getCurrentChapter(): TFile | null;
  refreshManuscriptNavigator(): void;
}

interface PreparationActions {
  readonly prepare: HTMLElement;
  readonly undo: HTMLElement;
}

function selectedBook(
  host: ManuscriptPreparationCommandHost,
  view?: ItemView
): ObsidianManuscriptBook | null {
  const library = buildObsidianManuscriptLibrary(host.app);
  const selector = view?.containerEl.querySelector<HTMLSelectElement>(
    ".mwc-manuscript-book-selector"
  );
  const selectedPath = selector?.value || null;
  if (selectedPath) {
    const selected = library.books.find((book) => book.file.path === selectedPath);
    if (selected) return selected;
  }

  const active = host.getCurrentChapter();
  const activeBookPath = active
    ? library.owningBookPathByFile.get(active.path) ?? null
    : null;
  if (activeBookPath) {
    return library.books.find((book) => book.file.path === activeBookPath) ?? null;
  }
  return library.books.length === 1 ? library.books[0] : null;
}

export function installManuscriptPreparationCommands(
  host: ManuscriptPreparationCommandHost
) {
  let undoToken: ManuscriptPreparationUndoToken | null = null;
  let operationRunning = false;
  const actionsByView = new WeakMap<ItemView, PreparationActions>();

  const installActions = () => {
    const leaves = host.app.workspace.getLeavesOfType(
      MANUSCRIPT_NAVIGATOR_VIEW_TYPE
    );
    for (const leaf of leaves) {
      const view = leaf.view as ItemView;
      let actions = actionsByView.get(view);
      if (!actions) {
        const prepare = view.addAction(
          "wand-sparkles",
          "Prepare existing manuscript",
          () => void prepareManuscript(view)
        );
        const undo = view.addAction(
          "undo-2",
          "Undo manuscript preparation",
          () => void undoPreparation()
        );
        actions = { prepare, undo };
        actionsByView.set(view, actions);
      }
      actions.prepare.style.display = operationRunning ? "none" : "";
      actions.undo.style.display = undoToken && !operationRunning ? "" : "none";
    }
  };

  const refresh = () => {
    host.refreshManuscriptNavigator();
    window.setTimeout(installActions, 0);
  };

  const prepareManuscript = async (view?: ItemView) => {
    if (operationRunning) return;
    const book = selectedBook(host, view);
    if (!book) {
      new Notice("Open a chapter or select the manuscript you want to prepare.");
      return;
    }

    const plan = planObsidianManuscriptPreparation(host.app, book);
    if (plan.alreadyPrepared) {
      new Notice(`${book.record.title} already uses distributed manuscript order keys.`);
      return;
    }
    if (!await confirmManuscriptPreparation(host.app, plan)) return;

    operationRunning = true;
    installActions();
    try {
      undoToken = await applyManuscriptPreparation(host.app, book, plan);
      new Notice(undoToken.message, 9000);
    } catch (error) {
      undoToken = null;
      new Notice(
        error instanceof Error ? error.message : "Could not prepare the manuscript.",
        10000
      );
    } finally {
      operationRunning = false;
      refresh();
    }
  };

  const undoPreparation = async () => {
    if (operationRunning) return;
    if (!undoToken) {
      new Notice("There is no manuscript preparation to undo.");
      return;
    }

    operationRunning = true;
    installActions();
    const token = undoToken;
    try {
      await undoManuscriptPreparation(host.app, token);
      undoToken = null;
      new Notice("Manuscript preparation undone.");
    } catch (error) {
      undoToken = null;
      new Notice(
        error instanceof StaleManuscriptPreparationUndoError
          ? error.message
          : "Could not undo manuscript preparation.",
        10000
      );
    } finally {
      operationRunning = false;
      refresh();
    }
  };

  host.addCommand({
    id: "prepare-existing-manuscript",
    name: "Prepare existing manuscript",
    callback: () => void prepareManuscript()
  });
  host.addCommand({
    id: "undo-manuscript-preparation",
    name: "Undo manuscript preparation",
    callback: () => void undoPreparation()
  });

  host.registerEvent(
    host.app.workspace.on("layout-change", installActions)
  );
  host.app.workspace.onLayoutReady(installActions);
}
