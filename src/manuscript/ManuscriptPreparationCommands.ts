import { Notice, Plugin, TFile } from "obsidian";
import {
  buildObsidianManuscriptLibrary,
  ObsidianManuscriptBook
} from "./ObsidianManuscript";
import {
  applyManuscriptPreparation,
  ManuscriptPreparationUndoToken,
  planObsidianManuscriptPreparation,
  StaleManuscriptPreparationUndoError,
  undoManuscriptPreparation,
  validateManuscriptPreparationPreview
} from "./ObsidianManuscriptPreparation";
import { confirmManuscriptPreparation } from "./ManuscriptPreparationModal";
import { ManuscriptSequencePropertyService } from "./ManuscriptSequenceProperty";
import {
  manuscriptPreparationActionsNeedInstallation,
  manuscriptPreparationUndoNoticeVisible
} from "./ManuscriptPreparationActions";
import {
  forEachInitializedManuscriptView,
  InitializedManuscriptActionView
} from "./ManuscriptViewActions";

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
  view?: InitializedManuscriptActionView,
  requestedBookPath?: string
): ObsidianManuscriptBook | null {
  const library = buildObsidianManuscriptLibrary(host.app);
  if (requestedBookPath) {
    return library.books.find((book) => book.file.path === requestedBookPath) ?? null;
  }
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
): ManuscriptPreparationCommandActions {
  let undoToken: ManuscriptPreparationUndoToken | null = null;
  let operationRunning = false;
  const actionsByView = new WeakMap<InitializedManuscriptActionView, PreparationActions>();

  const installUndoStatus = (view: InitializedManuscriptActionView) => {
    const existing = view.containerEl.querySelector<HTMLElement>(
      ".mwc-manuscript-preparation-undo-status"
    );
    if (!manuscriptPreparationUndoNoticeVisible(Boolean(undoToken), operationRunning)) {
      existing?.remove();
      return;
    }
    const content = view.containerEl.children[1] as HTMLElement | undefined;
    const heading = content?.querySelector<HTMLElement>(".mwc-manuscript-heading");
    if (!content || !heading) return;
    const status = existing ?? document.createElement("div");
    status.className = "mwc-manuscript-preparation-undo-status mwc-manuscript-notice";
    status.empty();
    status.createDiv({ text: "Manuscript preparation completed. The original files can be restored until a prepared note changes." });
    const undo = status.createEl("button", {
      text: "Undo manuscript preparation",
      attr: { type: "button", "aria-label": "Undo manuscript preparation" }
    });
    undo.disabled = operationRunning || !undoToken;
    undo.onclick = () => void undoPreparation();
    status.setAttribute("role", "status");
    if (!existing) heading.insertAdjacentElement("afterend", status);
  };

  const installActions = () => {
    forEachInitializedManuscriptView(host.app.workspace, (view) => {
      view.setPreparationActionsRenderer(installActions);
      let actions = actionsByView.get(view);
      if (manuscriptPreparationActionsNeedInstallation(actions)) {
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
        const installed = { prepare, undo };
        actionsByView.set(view, installed);
        actions = installed;
      }
      if (!actions) return;
      actions.prepare.style.display = operationRunning ? "none" : "";
      actions.undo.style.display = undoToken && !operationRunning ? "" : "none";
      installUndoStatus(view);
    });
  };

  const refresh = () => {
    host.refreshManuscriptNavigator();
    window.setTimeout(installActions, 0);
  };

  const prepareManuscript = async (view?: InitializedManuscriptActionView, requestedBookPath?: string) => {
    if (operationRunning) return;
    const book = selectedBook(host, view, requestedBookPath);
    if (!book) {
      new Notice("Open a chapter or select the manuscript you want to prepare.");
      return;
    }

    const plan = await validateManuscriptPreparationPreview(host.app, book, planObsidianManuscriptPreparation(host.app, book));
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

  const rebuildReportingSequence = async () => {
    if (operationRunning) return;
    operationRunning = true;
    installActions();
    try {
      const library = buildObsidianManuscriptLibrary(host.app);
      await new ManuscriptSequencePropertyService(host.app).reconcile(library);
      new Notice("Manuscript reporting sequence rebuilt.");
    } catch (error) {
      console.error("Writing Companion could not rebuild manuscript reporting sequence", error);
      new Notice("Could not rebuild the manuscript reporting sequence.", 10000);
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
  host.addCommand({
    id: "rebuild-manuscript-reporting-sequence",
    name: "Rebuild manuscript reporting sequence",
    callback: () => void rebuildReportingSequence()
  });

  host.registerEvent(
    host.app.workspace.on("layout-change", installActions)
  );
  host.app.workspace.onLayoutReady(installActions);
  return {
    prepareBook: (bookPath) => prepareManuscript(undefined, bookPath)
  };
}

export interface ManuscriptPreparationCommandActions {
  prepareBook(bookPath: string): Promise<void>;
}
