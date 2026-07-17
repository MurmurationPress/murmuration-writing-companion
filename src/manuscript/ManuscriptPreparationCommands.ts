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
  undoManuscriptPreparation
} from "./ObsidianManuscriptPreparation";
import { confirmManuscriptPreparation } from "./ManuscriptPreparationModal";

export interface ManuscriptPreparationCommandHost extends Plugin {
  getCurrentChapter(): TFile | null;
  refreshManuscriptNavigator(): void;
}

function selectedBook(
  host: ManuscriptPreparationCommandHost
): ObsidianManuscriptBook | null {
  const library = buildObsidianManuscriptLibrary(host.app);
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

  host.addCommand({
    id: "prepare-existing-manuscript",
    name: "Prepare existing manuscript",
    callback: async () => {
      if (operationRunning) return;
      const book = selectedBook(host);
      if (!book) {
        new Notice("Open a chapter in the manuscript you want to prepare.");
        return;
      }

      const plan = planObsidianManuscriptPreparation(host.app, book);
      if (plan.alreadyPrepared) {
        new Notice(`${book.record.title} already uses distributed manuscript order keys.`);
        return;
      }
      if (!await confirmManuscriptPreparation(host.app, plan)) return;

      operationRunning = true;
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
        host.refreshManuscriptNavigator();
      }
    }
  });

  host.addCommand({
    id: "undo-manuscript-preparation",
    name: "Undo manuscript preparation",
    callback: async () => {
      if (operationRunning) return;
      if (!undoToken) {
        new Notice("There is no manuscript preparation to undo.");
        return;
      }

      operationRunning = true;
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
        host.refreshManuscriptNavigator();
      }
    }
  });
}
