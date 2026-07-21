import { Editor, MarkdownView, TFile } from "obsidian";
import MurmurationWritingCompanionPlugin from "./main";
import { installManuscriptPreparationCommands } from "./manuscript/ManuscriptPreparationCommands";
import { installManuscriptReconciliationCommands } from "./manuscript/ManuscriptReconciliationCommands";
import { installPovCharacterCreationStyles } from "./ui/PovCharacterCreationStyles";
import { installStoryWorldEventAuthoringStyles } from "./ui/StoryWorldEventAuthoringStyles";
import { installStoryWorldRelationAuthoringStyles } from "./ui/StoryWorldRelationAuthoringStyles";
import { renderStoryWorldEventAuthoring } from "./ui/StoryWorldEventAuthoring";
import { renderStoryWorldRelationAuthoring } from "./ui/StoryWorldRelationAuthoring";
import { renderStoryWorldEntityInspector, storyWorldBuilderItemForFile } from "./ui/StoryWorldEntityInspector";
import { STORY_WORLD_NAVIGATOR_VIEW_TYPE, StoryWorldNavigatorView } from "./story-world/StoryWorldNavigatorView";
import { PendingProseEventCreation, PendingStoryWorldEventAuthoring, PendingWorldContextAddition, StoryWorldEventAuthoringSession } from "./companion/StoryWorldEventAuthoringSession";
import { extractProseEventName } from "./companion/StoryWorldEventCreation";
import { PendingStoryWorldRelationAuthoring, PendingStoryWorldRelationContextAddition, PendingStoryWorldRelationMeaning, StoryWorldRelationAuthoringSession } from "./companion/StoryWorldRelationAuthoringSession";
import { resolvePovRelationSource } from "./companion/StoryWorldRelationAuthoring";
import { hasCurrentStoryWorldRelationForChapter } from "./companion/ObsidianStoryWorldRelationAuthoring";
import { getChapterContextField, getEditableChapterContextValue } from "./companion/ChapterContext";
import { explicitManuscriptKind, hasSceneMetadataSignal } from "./manuscript/ManuscriptMetadata";
import { reconcileStoryWorldInspectorPath } from "./story-world/StoryWorldInspectorContext";
import { STORY_WORLD_TIMELINE_VIEW_TYPE, StoryWorldTimelineView } from "./story-world/StoryWorldTimelineView";
import { StoryWorldTimelineActivation } from "./story-world/StoryWorldTimelineActivation";
import { installStoryWorldTimelineStyles } from "./ui/StoryWorldTimelineStyles";
import { beginEventTimeEditing } from "./ui/EventTimeWorkspace";

const WRITING_COMPANION_VIEW_TYPE = "murmuration-writing-companion-view";

export default class MurmurationWritingCompanionEntry extends MurmurationWritingCompanionPlugin {
  private navigatorRefreshTimer: number | null = null;
  private storyWorldInspectorPath: string | null = null;
  private readonly storyWorldEventAuthoringSession = new StoryWorldEventAuthoringSession();
  private readonly storyWorldRelationAuthoringSession = new StoryWorldRelationAuthoringSession();
  private readonly storyWorldTimelineActivation = new StoryWorldTimelineActivation();

  async onload() {
    await super.onload();
    installManuscriptPreparationCommands(this);
    installManuscriptReconciliationCommands(this);
    this.registerView(STORY_WORLD_NAVIGATOR_VIEW_TYPE, (leaf) => new StoryWorldNavigatorView(leaf, this));
    this.registerView(STORY_WORLD_TIMELINE_VIEW_TYPE, (leaf) => new StoryWorldTimelineView(leaf, this));
    this.addRibbonIcon("map", "Open Story World navigator", () => void this.activateStoryWorldNavigator());
    this.addCommand({ id: "open-story-world-navigator", name: "Open Story World navigator", callback: () => void this.activateStoryWorldNavigator() });
    this.addCommand({ id: "open-story-world-timeline", name: "Open Story World timeline", callback: () => void this.activateStoryWorldTimeline() });

    const povCharacterStyles = installPovCharacterCreationStyles();
    this.register(() => povCharacterStyles.remove());
    const eventAuthoringStyles = installStoryWorldEventAuthoringStyles();
    this.register(() => eventAuthoringStyles.remove());
    const relationAuthoringStyles = installStoryWorldRelationAuthoringStyles();
    this.register(() => relationAuthoringStyles.remove());
    const timelineStyles = installStoryWorldTimelineStyles();
    this.register(() => timelineStyles.remove());

    this.registerEvent(this.app.workspace.on("editor-change", (editor, info) => this.handleStoryWorldAuthoringEditorChange(editor, info.file)));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => { this.seedActiveEditor(); this.refreshStoryWorldNavigator(); }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (!(file instanceof TFile)) return;
      this.storyWorldEventAuthoringSession.clear(file.path);
      this.storyWorldRelationAuthoringSession.clear(file.path);
      this.refreshStoryWorldNavigator();
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (!(file instanceof TFile)) return;
      this.storyWorldEventAuthoringSession.rename(oldPath, file.path);
      this.storyWorldRelationAuthoringSession.rename(oldPath, file.path);
      this.refreshStoryWorldNavigator();
    }));
    this.app.workspace.onLayoutReady(() => { this.seedActiveEditor(); this.refreshStoryWorldNavigator(); });
    this.registerEvent(this.app.metadataCache.on("changed", () => this.queueNavigatorRefresh()));
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
    const active = this.app.workspace.getActiveViewOfType(MarkdownView)?.file ?? null;
    const activeItem = active ? storyWorldBuilderItemForFile(this, active) : null;
    this.storyWorldInspectorPath = reconcileStoryWorldInspectorPath(
      this.storyWorldInspectorPath,
      active ? { path: active.path, isStoryWorldItem: activeItem !== null } : null
    );
    const selected = this.storyWorldInspectorPath
      ? this.app.vault.getAbstractFileByPath(this.storyWorldInspectorPath)
      : null;
    const inspectorFile = selected instanceof TFile ? selected : null;
    const item = inspectorFile
      ? (active?.path === inspectorFile.path ? activeItem : storyWorldBuilderItemForFile(this, inspectorFile))
      : null;
    if (inspectorFile && item) {
      for (const leaf of this.app.workspace.getLeavesOfType(WRITING_COMPANION_VIEW_TYPE)) {
        const container = leaf.view.containerEl.children[1];
        if (container instanceof HTMLElement) renderStoryWorldEntityInspector(container, this, inspectorFile, item);
      }
      this.refreshStoryWorldTimeline();
      return;
    }
    if (this.storyWorldInspectorPath && !inspectorFile) this.storyWorldInspectorPath = null;

    super.refreshView();
    this.refreshStoryWorldTimeline();
    const chapter = this.getCurrentChapter();
    if (!chapter) return;
    for (const leaf of this.app.workspace.getLeavesOfType(WRITING_COMPANION_VIEW_TYPE)) {
      const container = leaf.view.containerEl.children[1];
      if (!(container instanceof HTMLElement)) continue;
      const staging = document.createElement("div");
      renderStoryWorldEventAuthoring(staging, chapter, this);
      renderStoryWorldRelationAuthoring(staging, chapter, this);
      const before = container.querySelector(".mwc-world-context");
      while (staging.firstElementChild) {
        const child = staging.firstElementChild;
        if (before) before.before(child);
        else container.appendChild(child);
      }
    }
  }

  async activateStoryWorldTimeline(): Promise<void> {
    await this.storyWorldTimelineActivation.activate(this.app.workspace, STORY_WORLD_TIMELINE_VIEW_TYPE);
  }

  refreshStoryWorldTimeline(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(STORY_WORLD_TIMELINE_VIEW_TYPE)) {
      if (leaf.view instanceof StoryWorldTimelineView) leaf.view.render();
    }
  }

  async editStoryWorldEventTime(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file, { active: true });
    await this.app.workspace.revealLeaf(leaf);
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    await this.activateView();
    for (const companion of this.app.workspace.getLeavesOfType(WRITING_COMPANION_VIEW_TYPE)) {
      const editor = companion.view.containerEl.querySelector(".mwc-event-time-editor");
      if (editor) await beginEventTimeEditing(editor, this, file);
    }
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    if (leaf.view instanceof MarkdownView) leaf.view.editor.focus();
  }

  async activateStoryWorldNavigator() {
    const existing = this.app.workspace.getLeavesOfType(STORY_WORLD_NAVIGATOR_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeftLeaf(false);
    if (!leaf) return;
    if (!existing) await leaf.setViewState({ type: STORY_WORLD_NAVIGATOR_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  refreshStoryWorldNavigator() {
    for (const leaf of this.app.workspace.getLeavesOfType(STORY_WORLD_NAVIGATOR_VIEW_TYPE)) {
      if (leaf.view instanceof StoryWorldNavigatorView) leaf.view.render();
    }
  }

  getPendingStoryWorldEventAuthoring(chapter: TFile): PendingStoryWorldEventAuthoring | null { return this.storyWorldEventAuthoringSession.getPending(chapter.path); }
  dismissPendingStoryWorldEventAuthoring(chapter: TFile): void { this.storyWorldEventAuthoringSession.dismiss(chapter.path); }
  markPendingStoryWorldEventCreated(chapter: TFile, pending: PendingProseEventCreation, followUp: Omit<PendingWorldContextAddition, "kind" | "chapterPath">): void { this.storyWorldEventAuthoringSession.markCreated(chapter.path, pending, followUp); }
  completePendingStoryWorldEventAuthoring(chapter: TFile): void { this.storyWorldEventAuthoringSession.complete(chapter.path); }
  getPendingStoryWorldRelationAuthoring(chapter: TFile): PendingStoryWorldRelationAuthoring | null { return this.storyWorldRelationAuthoringSession.getPending(chapter.path); }
  dismissPendingStoryWorldRelationAuthoring(chapter: TFile): void { this.storyWorldRelationAuthoringSession.dismiss(chapter.path); }
  advancePendingStoryWorldRelationAuthoring(chapter: TFile, pending: PendingStoryWorldRelationMeaning, followUp: Omit<PendingStoryWorldRelationContextAddition, "kind" | "chapterPath"> | null): void { this.storyWorldRelationAuthoringSession.advance(chapter.path, pending, followUp); }
  completePendingStoryWorldRelationAuthoring(chapter: TFile): void { this.storyWorldRelationAuthoringSession.complete(chapter.path); }

  private seedActiveEditor(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) return;
    const text = view.editor.getValue();
    this.storyWorldEventAuthoringSession.seed(view.file.path, text);
    this.storyWorldRelationAuthoringSession.seed(view.file.path, text);
  }

  private handleStoryWorldAuthoringEditorChange(editor: Editor, file: TFile | null): void {
    if (!file) return;
    const text = editor.getValue();
    const cursorOffset = editor.posToOffset(editor.getCursor());
    const eventOccurrence = this.storyWorldEventAuthoringSession.updateText(file.path, text, cursorOffset);
    const relationOccurrence = this.storyWorldRelationAuthoringSession.updateText(file.path, text, cursorOffset);
    if (!this.isManuscriptScene(file)) return;

    let changed = false;
    if (eventOccurrence) {
      const resolved = this.app.metadataCache.getFirstLinkpathDest(eventOccurrence.linkpath, file.path);
      if (!resolved && !this.storyWorldIndex.resolveWikilink(eventOccurrence.raw, file.path)) {
        const name = extractProseEventName(eventOccurrence);
        if (name) changed = this.storyWorldEventAuthoringSession.enqueueCandidate(file.path, eventOccurrence, name) || changed;
      }
    }

    if (relationOccurrence) {
      const targetFile = this.app.metadataCache.getFirstLinkpathDest(relationOccurrence.linkpath, file.path);
      const targetEntity = targetFile ? this.storyWorldIndex.index.getByPath(targetFile.path) : null;
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
      const pov = getEditableChapterContextValue(frontmatter, getChapterContextField("pov")).value;
      const sourceEntity = resolvePovRelationSource(pov, this.getPovSuggestions(file));
      const sourceFile = sourceEntity ? this.app.vault.getAbstractFileByPath(sourceEntity.path) : null;

      if (targetFile && targetEntity && sourceEntity && sourceEntity.path !== targetEntity.path && sourceFile instanceof TFile && !hasCurrentStoryWorldRelationForChapter(this.app, sourceFile, targetFile, file, relationOccurrence.raw)) {
        const sourceLine = text.slice(0, relationOccurrence.start).split(/\r?\n/).length;
        changed = this.storyWorldRelationAuthoringSession.enqueueCandidate(file.path, relationOccurrence, sourceLine, sourceEntity.path, sourceEntity.name, targetEntity.path, targetEntity.name, targetEntity.entityType) || changed;
      }
    }
    if (changed) this.refreshView();
  }

  private isManuscriptScene(file: TFile): boolean {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
    const kind = explicitManuscriptKind(frontmatter);
    if (kind) return kind === "scene";
    return hasSceneMetadataSignal(frontmatter) && this.getOwningBook(file) !== null;
  }

  private queueNavigatorRefresh() {
    if (this.navigatorRefreshTimer !== null) window.clearTimeout(this.navigatorRefreshTimer);
    this.navigatorRefreshTimer = window.setTimeout(() => {
      this.navigatorRefreshTimer = null;
      this.refreshManuscriptNavigator();
      this.refreshStoryWorldNavigator();
    }, 100);
  }
}
