import { Editor, MarkdownView, TFile } from "obsidian";
import MurmurationWritingCompanionPlugin from "./main";
import { installManuscriptPreparationCommands } from "./manuscript/ManuscriptPreparationCommands";
import { installManuscriptReconciliationCommands } from "./manuscript/ManuscriptReconciliationCommands";
import { installPovCharacterCreationStyles } from "./ui/PovCharacterCreationStyles";
import { installStoryWorldEventAuthoringStyles } from "./ui/StoryWorldEventAuthoringStyles";
import { renderStoryWorldEventAuthoring } from "./ui/StoryWorldEventAuthoring";
import {
  PendingProseEventCreation,
  PendingStoryWorldEventAuthoring,
  PendingWorldContextAddition,
  StoryWorldEventAuthoringSession
} from "./companion/StoryWorldEventAuthoringSession";
import { extractProseEventName } from "./companion/StoryWorldEventCreation";
import {
  explicitManuscriptKind,
  hasSceneMetadataSignal
} from "./manuscript/ManuscriptMetadata";

const WRITING_COMPANION_VIEW_TYPE = "murmuration-writing-companion-view";

export default class MurmurationWritingCompanionEntry extends MurmurationWritingCompanionPlugin {
  private navigatorRefreshTimer: number | null = null;
  private readonly storyWorldEventAuthoringSession =
    new StoryWorldEventAuthoringSession();

  async onload() {
    await super.onload();
    installManuscriptPreparationCommands(this);
    installManuscriptReconciliationCommands(this);

    const povCharacterStyles = installPovCharacterCreationStyles();
    this.register(() => povCharacterStyles.remove());
    const eventAuthoringStyles = installStoryWorldEventAuthoringStyles();
    this.register(() => eventAuthoringStyles.remove());

    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, info) => {
        this.handleStoryWorldEventEditorChange(editor, info.file);
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.seedActiveEditor())
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) this.storyWorldEventAuthoringSession.clear(file.path);
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile) {
          this.storyWorldEventAuthoringSession.rename(oldPath, file.path);
        }
      })
    );
    this.app.workspace.onLayoutReady(() => this.seedActiveEditor());

    this.registerEvent(
      this.app.metadataCache.on("changed", () => this.queueNavigatorRefresh())
    );
    this.register(() => {
      if (this.navigatorRefreshTimer !== null) {
        window.clearTimeout(this.navigatorRefreshTimer);
        this.navigatorRefreshTimer = null;
      }
    });
  }

  override async activateView() {
    await super.activateView();
    this.refreshView();
  }

  override refreshView() {
    super.refreshView();
    const chapter = this.getCurrentChapter();
    if (!chapter) return;

    for (const leaf of this.app.workspace.getLeavesOfType(WRITING_COMPANION_VIEW_TYPE)) {
      const container = leaf.view.containerEl.children[1];
      if (!(container instanceof HTMLElement)) continue;
      const staging = document.createElement("div");
      renderStoryWorldEventAuthoring(staging, chapter, this);
      const before = container.querySelector(".mwc-world-context");
      while (staging.firstElementChild) {
        const child = staging.firstElementChild;
        if (before) before.before(child);
        else container.appendChild(child);
      }
    }
  }

  getPendingStoryWorldEventAuthoring(
    chapter: TFile
  ): PendingStoryWorldEventAuthoring | null {
    return this.storyWorldEventAuthoringSession.getPending(chapter.path);
  }

  dismissPendingStoryWorldEventAuthoring(chapter: TFile): void {
    this.storyWorldEventAuthoringSession.dismiss(chapter.path);
  }

  markPendingStoryWorldEventCreated(
    chapter: TFile,
    pending: PendingProseEventCreation,
    followUp: Omit<PendingWorldContextAddition, "kind" | "chapterPath">
  ): void {
    this.storyWorldEventAuthoringSession.markCreated(
      chapter.path,
      pending,
      followUp
    );
  }

  completePendingStoryWorldEventAuthoring(chapter: TFile): void {
    this.storyWorldEventAuthoringSession.complete(chapter.path);
  }

  private seedActiveEditor(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) return;
    this.storyWorldEventAuthoringSession.seed(
      view.file.path,
      view.editor.getValue()
    );
  }

  private handleStoryWorldEventEditorChange(
    editor: Editor,
    file: TFile | null
  ): void {
    if (!file) return;
    const text = editor.getValue();
    const cursorOffset = editor.posToOffset(editor.getCursor());
    const occurrence = this.storyWorldEventAuthoringSession.updateText(
      file.path,
      text,
      cursorOffset
    );
    if (!occurrence || !this.isManuscriptScene(file)) return;

    const resolved = this.app.metadataCache.getFirstLinkpathDest(
      occurrence.linkpath,
      file.path
    );
    if (resolved) return;
    if (this.storyWorldIndex.resolveWikilink(occurrence.raw, file.path)) return;

    const name = extractProseEventName(occurrence);
    if (!name) return;
    if (this.storyWorldEventAuthoringSession.enqueueCandidate(
      file.path,
      occurrence,
      name
    )) {
      this.refreshView();
    }
  }

  private isManuscriptScene(file: TFile): boolean {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as
      Record<string, unknown> | undefined;
    const kind = explicitManuscriptKind(frontmatter);
    if (kind) return kind === "scene";
    return hasSceneMetadataSignal(frontmatter) && this.getOwningBook(file) !== null;
  }

  private queueNavigatorRefresh() {
    if (this.navigatorRefreshTimer !== null) {
      window.clearTimeout(this.navigatorRefreshTimer);
    }
    this.navigatorRefreshTimer = window.setTimeout(() => {
      this.navigatorRefreshTimer = null;
      this.refreshManuscriptNavigator();
    }, 100);
  }
}
