import { MarkdownView, Notice, TFile } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import {
  getChapterContextField,
  getEditableChapterContextValue
} from "../companion/ChapterContext";
import {
  PendingProseEventCreation,
  storyWorldEventAuthoringHost
} from "../companion/StoryWorldEventAuthoringSession";
import {
  buildStoryWorldEventCreationProposal,
  StoryWorldEventCreationProposal
} from "../companion/StoryWorldEventCreation";
import { confirmStoryWorldEventCreation } from "../companion/StoryWorldEventCreationModal";
import {
  addStoryWorldEventToWorldContext,
  createStoryWorldEventFromProposal
} from "../companion/ObsidianStoryWorldEventCreation";

function addStringValues(output: Set<string>, value: unknown): void {
  const values = Array.isArray(value) ? value : [value];
  for (const item of values) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed) output.add(trimmed);
  }
}

function buildProposal(
  plugin: MurmurationWritingCompanionPlugin,
  chapter: TFile,
  pending: PendingProseEventCreation
): StoryWorldEventCreationProposal | null {
  const book = plugin.getOwningBook(chapter);
  const scopeReferences = new Set<string>();
  if (book) {
    scopeReferences.add(book.path);
    scopeReferences.add(book.basename);
    const bookFrontmatter = plugin.app.metadataCache.getFileCache(book)?.frontmatter as
      Record<string, unknown> | undefined;
    addStringValues(scopeReferences, bookFrontmatter?.title);
    addStringValues(scopeReferences, bookFrontmatter?.world_name);
    addStringValues(scopeReferences, bookFrontmatter?.world_scope);
    addStringValues(scopeReferences, bookFrontmatter?.series);
    addStringValues(scopeReferences, bookFrontmatter?.trilogy);
  }

  const chapterFrontmatter = plugin.app.metadataCache.getFileCache(chapter)?.frontmatter as
    Record<string, unknown> | undefined;
  addStringValues(scopeReferences, chapterFrontmatter?.world_scope);
  addStringValues(scopeReferences, chapterFrontmatter?.series);
  addStringValues(scopeReferences, chapterFrontmatter?.trilogy);
  const storyDate = getEditableChapterContextValue(
    chapterFrontmatter,
    getChapterContextField("story_date")
  ).value;

  return buildStoryWorldEventCreationProposal(pending.occurrence, {
    entities: plugin.storyWorldIndex.index.getAll(),
    existingPaths: plugin.app.vault.getAllLoadedFiles().map((file) => file.path),
    chapterPath: chapter.path,
    bookPath: book?.path ?? null,
    scopeReferences: [...scopeReferences],
    chapterStoryDate: storyDate
  });
}

function focusChapter(plugin: MurmurationWritingCompanionPlugin, chapter: TFile): void {
  window.setTimeout(() => {
    plugin.app.workspace.iterateRootLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView && leaf.view.file?.path === chapter.path) {
        leaf.view.editor.focus();
      }
    });
  }, 0);
}

function sameProposal(
  left: StoryWorldEventCreationProposal,
  right: StoryWorldEventCreationProposal
): boolean {
  return left.chapterPath === right.chapterPath
    && left.sourceRawLink === right.sourceRawLink
    && left.sourceLinkpath === right.sourceLinkpath
    && left.name === right.name
    && left.path === right.path
    && left.chapterStoryDate === right.chapterStoryDate
    && left.worldContextReference === right.worldContextReference;
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function renderStoryWorldEventAuthoring(
  container: Element,
  chapter: TFile,
  plugin: MurmurationWritingCompanionPlugin
): void {
  const host = storyWorldEventAuthoringHost(plugin);
  const pending = host?.getPendingStoryWorldEventAuthoring(chapter) ?? null;
  if (!host || !pending) return;

  const section = container.createDiv("mwc-section mwc-story-world-event-authoring");
  section.createEl("h3", { text: "Story World authoring" });
  const card = section.createDiv({
    cls: "mwc-story-world-event-offer",
    attr: { role: "status" }
  });

  if (pending.kind === "create-event") {
    card.createEl("p", {
      cls: "mwc-story-world-event-offer-title",
      text: `“${pending.name}” does not exist yet.`
    });
    card.createEl("p", {
      cls: "mwc-story-world-event-offer-source",
      text: `From prose link ${pending.occurrence.raw}`
    });
    const actions = card.createDiv("mwc-story-world-event-offer-actions");
    const leave = actions.createEl("button", {
      text: "Leave as ordinary link",
      attr: { type: "button" }
    });
    const create = actions.createEl("button", {
      cls: "mwc-story-world-event-create",
      text: "Create as event",
      attr: { type: "button" }
    });

    leave.onclick = () => {
      host.dismissPendingStoryWorldEventAuthoring(chapter);
      plugin.refreshView();
      focusChapter(plugin, chapter);
    };

    create.onclick = async () => {
      const proposal = buildProposal(plugin, chapter, pending);
      if (!proposal) {
        new Notice("The link can no longer be created as a new event. Check whether it now resolves or conflicts with another note.");
        return;
      }
      const decision = await confirmStoryWorldEventCreation(plugin.app, proposal);
      if (!decision) {
        focusChapter(plugin, chapter);
        return;
      }

      create.disabled = true;
      leave.disabled = true;
      try {
        const current = host.getPendingStoryWorldEventAuthoring(chapter);
        if (current?.kind !== "create-event" || current.key !== pending.key) {
          throw new Error("The pending prose link changed. Reopen the event preview.");
        }
        const refreshed = buildProposal(plugin, chapter, current);
        if (!refreshed || !sameProposal(proposal, refreshed)) {
          throw new Error("The event proposal changed. Reopen the preview before creating it.");
        }

        const eventFile = await createStoryWorldEventFromProposal(
          plugin.app,
          chapter,
          proposal,
          decision
        );
        host.markPendingStoryWorldEventCreated(chapter, pending, {
          eventName: proposal.name,
          eventPath: eventFile.path,
          reference: proposal.worldContextReference,
          sourceRawLink: proposal.sourceRawLink
        });
        plugin.refreshView();
        new Notice(`Created Story World event ${proposal.name}.`);
        focusChapter(plugin, chapter);
      } catch (error) {
        new Notice(message(error, "Could not create the Story World event."));
        create.disabled = false;
        leave.disabled = false;
        focusChapter(plugin, chapter);
      }
    };
    return;
  }

  card.createEl("p", {
    cls: "mwc-story-world-event-offer-title",
    text: `Add “${pending.eventName}” to this chapter's World Context?`
  });
  card.createEl("p", {
    cls: "mwc-story-world-event-offer-source",
    text: "The event note has been created. This metadata link is a separate author decision."
  });
  const actions = card.createDiv("mwc-story-world-event-offer-actions");
  const notNow = actions.createEl("button", {
    text: "Not now",
    attr: { type: "button" }
  });
  const add = actions.createEl("button", {
    cls: "mwc-story-world-event-create",
    text: "Add to World Context",
    attr: { type: "button" }
  });

  notNow.onclick = () => {
    host.completePendingStoryWorldEventAuthoring(chapter);
    plugin.refreshView();
    focusChapter(plugin, chapter);
  };

  add.onclick = async () => {
    const eventFile = plugin.app.vault.getAbstractFileByPath(pending.eventPath);
    if (!(eventFile instanceof TFile)) {
      new Notice("The created event note can no longer be found.");
      return;
    }

    add.disabled = true;
    notNow.disabled = true;
    try {
      const changed = await addStoryWorldEventToWorldContext(
        plugin.app,
        chapter,
        eventFile,
        pending.reference,
        pending.sourceRawLink
      );
      host.completePendingStoryWorldEventAuthoring(chapter);
      plugin.refreshView();
      new Notice(changed
        ? `Added ${pending.eventName} to World Context.`
        : `${pending.eventName} is already in World Context.`);
      focusChapter(plugin, chapter);
    } catch (error) {
      new Notice(message(error, "Could not update World Context."));
      add.disabled = false;
      notNow.disabled = false;
      focusChapter(plugin, chapter);
    }
  };
}
