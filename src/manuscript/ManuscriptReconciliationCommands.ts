import { ItemView, Notice, Plugin, TFile } from "obsidian";
import {
  buildObsidianManuscriptLibrary,
  ObsidianManuscriptBook
} from "./ObsidianManuscript";
import {
  applyManuscriptReconciliation,
  ManuscriptReconciliationUndoToken,
  StaleManuscriptReconciliationUndoError,
  undoManuscriptReconciliation
} from "./ObsidianManuscriptReconciliation";
import { chooseManuscriptReconciliation } from "./ManuscriptReconciliationModal";
import { MANUSCRIPT_NAVIGATOR_VIEW_TYPE } from "./ManuscriptNavigatorView";

export interface ManuscriptReconciliationCommandHost extends Plugin {
  getCurrentChapter(): TFile | null;
  refreshManuscriptNavigator(): void;
}

interface ReconciliationActions {
  readonly reconcile: HTMLElement;
  readonly undo: HTMLElement;
}

function selectedBook(
  host: ManuscriptReconciliationCommandHost,
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

export function installManuscriptReconciliationCommands(
  host: ManuscriptReconciliationCommandHost
) {
  let undoToken: ManuscriptReconciliationUndoToken | null = null;
  let operationRunning = false;
  const actionsByView = new WeakMap<ItemView, ReconciliationActions>();

  const installActions = () => {
    const leaves = host.app.workspace.getLeavesOfType(
      MANUSCRIPT_NAVIGATOR_VIEW_TYPE
    );
    for (const leaf of leaves) {
      const view = leaf.view as ItemView;
      let actions = actionsByView.get(view);
      if (!actions) {
        const reconcile = view.addAction(
          "refresh-cw",
          "Reconcile manuscript",
          () => void reconcileManuscript(view)
        );
        const undo = view.addAction(
          "undo-2",
          "Undo manuscript reconciliation",
          () => void undoReconciliation()
        );
        actions = { reconcile, undo };
        actionsByView.set(view, actions);
      }
      actions.reconcile.style.display = operationRunning ? "none" : "";
      actions.undo.style.display = undoToken && !operationRunning ? "" : "none";
    }
  };

  const refresh = () => {
    host.refreshManuscriptNavigator();
    window.setTimeout(installActions, 0);
  };

  const reconcileManuscript = async (view?: ItemView) => {
    if (operationRunning) return;
    const book = selectedBook(host, view);
    if (!book) {
      new Notice("Open a chapter or select the manuscript you want to reconcile.");
      return;
    }
    if (book.result.source !== "distributed") {
      new Notice("Prepare this manuscript before reconciling distributed structure.");
      return;
    }

    const plan = await chooseManuscriptReconciliation(host.app, book);
    if (!plan) return;

    operationRunning = true;
    installActions();
    try {
      undoToken = await applyManuscriptReconciliation(host.app, book, plan);
      new Notice(undoToken.message, 9000);
    } catch (error) {
      undoToken = null;
      new Notice(
        error instanceof Error ? error.message : "Could not reconcile the manuscript.",
        10000
      );
    } finally {
      operationRunning = false;
      refresh();
    }
  };

  const undoReconciliation = async () => {
    if (operationRunning) return;
    if (!undoToken) {
      new Notice("There is no manuscript reconciliation to undo.");
      return;
    }

    operationRunning = true;
    installActions();
    const token = undoToken;
    try {
      await undoManuscriptReconciliation(host.app, token);
      undoToken = null;
      new Notice("Manuscript reconciliation undone.");
    } catch (error) {
      undoToken = null;
      new Notice(
        error instanceof StaleManuscriptReconciliationUndoError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not undo manuscript reconciliation.",
        10000
      );
    } finally {
      operationRunning = false;
      refresh();
    }
  };

  host.addCommand({
    id: "reconcile-manuscript",
    name: "Reconcile manuscript",
    callback: () => void reconcileManuscript()
  });
  host.addCommand({
    id: "undo-manuscript-reconciliation",
    name: "Undo manuscript reconciliation",
    callback: () => void undoReconciliation()
  });

  host.registerEvent(
    host.app.workspace.on("layout-change", installActions)
  );
  host.app.workspace.onLayoutReady(installActions);
}
