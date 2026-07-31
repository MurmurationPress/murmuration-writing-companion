import { Modal, Notice, Setting } from "obsidian";
import type MurmurationWritingCompanionEntry from "../entry";
import type { ReadinessAction, ProjectReadinessPresentation } from "./ProjectReadiness";

const DOCUMENTATION_URL = "https://github.com/MurmurationPress/murmuration-writing-companion/blob/main/docs/project-readiness.md";

export class ProjectReadinessModal extends Modal {
  private refreshing = false;
  constructor(private readonly plugin: MurmurationWritingCompanionEntry) { super(plugin.app); }

  onOpen(): void { void this.refresh(); }

  onClose(): void {
    this.contentEl.empty();
  }

  private async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    this.contentEl.empty();
    this.titleEl.setText("Project readiness");
    this.contentEl.createEl("p", { text: "Inspecting the current vault…" });
    try {
      const presentation = await this.plugin.collectProjectReadiness();
      this.render(presentation);
    } catch (error) {
      this.contentEl.empty();
      this.contentEl.createEl("h2", { text: "Readiness could not be checked" });
      this.contentEl.createEl("p", { text: error instanceof Error ? error.message : "The vault could not be inspected." });
      new Setting(this.contentEl).addButton((button) => button.setButtonText("Try again").onClick(() => void this.refresh()));
    } finally { this.refreshing = false; }
  }

  private render(model: ProjectReadinessPresentation): void {
    this.contentEl.empty();
    this.contentEl.addClass("mwc-project-readiness");
    this.contentEl.createEl("h2", { text: model.headline });
    this.contentEl.createEl("p", { text: model.summary });
    this.contentEl.createEl("p", { text: `${model.bookCount} Book${model.bookCount === 1 ? "" : "s"}, ${model.partCount} Part${model.partCount === 1 ? "" : "s"}, and ${model.sceneCount} Scene${model.sceneCount === 1 ? "" : "s"} recognised.` });

    this.contentEl.createEl("h3", { text: "Manuscript" });
    if (!model.manuscripts.length && model.markdownFileCount === 0) {
      this.contentEl.createEl("p", { text: "To begin, open Manuscript Navigator and choose New Book. MWC will show the normal creation form and will not add anything until you confirm it." });
    } else if (!model.manuscripts.length) {
      this.contentEl.createEl("p", { text: "If these notes are an existing manuscript, first identify or add one note for each Book and give that note the property type: book. Then recheck readiness. MWC can recognise the existing folder sequence and offer Prepare existing manuscript with a complete preview." });
      this.contentEl.createEl("p", { text: "Your current folders and prose will not be renamed, moved, or changed automatically." });
      if (model.unresolvedManuscriptNoteCount) this.contentEl.createEl("p", { text: `${model.unresolvedManuscriptNoteCount} manuscript-like note${model.unresolvedManuscriptNoteCount === 1 ? " has" : "s have"} unresolved structural links. The readiness guidance explains how to correct them.` });
    }
    for (const book of model.manuscripts) {
      const section = this.contentEl.createDiv({ cls: "mwc-readiness-book" });
      section.createEl("h4", { text: book.title });
      section.createEl("p", { text: `${book.stateLabel}. ${book.partCount} Part${book.partCount === 1 ? "" : "s"}; ${book.sceneCount} Scene${book.sceneCount === 1 ? "" : "s"}. Order source: ${book.sourceLabel}.` });
      section.createEl("p", { text: book.summary });
      if (book.diagnostics.length) {
        const details = section.createEl("details");
        details.createEl("summary", { text: `Technical details (${book.diagnostics.length})` });
        const list = details.createEl("ul");
        for (const diagnostic of book.diagnostics) list.createEl("li", { text: diagnostic });
      }
      for (const action of book.actions) this.addAction(section, action);
    }

    this.contentEl.createEl("h3", { text: "Story World" });
    this.contentEl.createEl("p", { text: model.storyWorld.summary });
    if (model.storyWorld.entityCount) this.contentEl.createEl("p", { text: `${model.storyWorld.entityCount} entities, including ${model.storyWorld.eventCount} Events.` });
    this.contentEl.createEl("h3", { text: "Editorial information" });
    this.contentEl.createEl("p", { text: model.editorialStorage.summary });
    this.contentEl.createEl("p", { text: "Readiness is recalculated when this window opens or when you recheck. It does not write manuscript, Story World, or editorial data." });
    this.contentEl.createEl("h3", { text: "Next actions" });
    const actions = this.contentEl.createDiv({ cls: "mwc-readiness-actions" });
    for (const action of model.actions) this.addAction(actions, action);
  }

  private addAction(container: HTMLElement, action: ReadinessAction): void {
    const button = container.createEl("button", { text: action.label, cls: "mod-cta" });
    button.addEventListener("click", () => void this.route(action));
  }

  private async route(action: ReadinessAction): Promise<void> {
    switch (action.id) {
      case "prepare_manuscript":
        if (action.bookPath) { this.close(); await this.plugin.manuscriptPreparationCommands.prepareBook(action.bookPath); }
        return;
      case "view_preparation_diagnostics": await this.plugin.activateManuscriptNavigator(); return;
      case "open_manuscript_navigator": this.close(); await this.plugin.activateManuscriptNavigator(); return;
      case "open_story_world_navigator": this.close(); await this.plugin.activateStoryWorldNavigator(); return;
      case "run_story_world_review": this.close(); await this.plugin.activateStoryWorldReview(); return;
      case "run_continuity_review":
        this.close();
        if (action.bookPath) await this.plugin.activateContinuityReviewForBook(action.bookPath, action.bookPath);
        else await this.plugin.activateContinuityReview();
        return;
      case "open_documentation": window.open(DOCUMENTATION_URL, "_blank", "noopener,noreferrer"); return;
      case "recheck": await this.refresh(); return;
      default: new Notice("That readiness action is not available.");
    }
  }
}
