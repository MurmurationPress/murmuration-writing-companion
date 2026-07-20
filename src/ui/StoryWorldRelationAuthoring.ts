import { MarkdownView, Notice, TFile } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import {
  getChapterContextField,
  getEditableChapterContextValue
} from "../companion/ChapterContext";
import {
  PendingStoryWorldRelationMeaning,
  storyWorldRelationAuthoringHost
} from "../companion/StoryWorldRelationAuthoringSession";
import {
  buildStoryWorldRelationDecision,
  buildStoryWorldRelationProposal,
  formatStoryWorldRelationSentence,
  STORY_WORLD_RELATION_STATUS_OPTIONS,
  StoryWorldRelationDecision,
  StoryWorldRelationProposal
} from "../companion/StoryWorldRelationAuthoring";
import {
  addStoryWorldEntityToWorldContext,
  appendStoryWorldRelation,
  storyWorldEntityInWorldContext
} from "../companion/ObsidianStoryWorldRelationAuthoring";

function focusChapter(
  plugin: MurmurationWritingCompanionPlugin,
  chapter: TFile
): void {
  window.setTimeout(() => {
    plugin.app.workspace.iterateRootLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView && leaf.view.file?.path === chapter.path) {
        leaf.view.editor.focus();
      }
    });
  }, 0);
}

function buildProposal(
  plugin: MurmurationWritingCompanionPlugin,
  chapter: TFile,
  pending: PendingStoryWorldRelationMeaning
): StoryWorldRelationProposal | null {
  const sourceEntity = plugin.storyWorldIndex.index.getByPath(pending.sourceEntityPath);
  const targetEntity = plugin.storyWorldIndex.index.getByPath(pending.targetEntityPath);
  if (!sourceEntity || !targetEntity) return null;

  const frontmatter = plugin.app.metadataCache.getFileCache(chapter)?.frontmatter as
    Record<string, unknown> | undefined;
  const storyDate = getEditableChapterContextValue(
    frontmatter,
    getChapterContextField("story_date")
  ).value;
  const book = plugin.getOwningBook(chapter);

  return buildStoryWorldRelationProposal({
    sourceEntity,
    targetEntity,
    occurrence: pending.occurrence,
    chapterPath: chapter.path,
    sourceLine: pending.sourceLine,
    existingPaths: plugin.app.vault.getAllLoadedFiles().map((file) => file.path),
    bookPath: book?.path ?? null,
    chapterStoryDate: storyDate
  });
}

function sameProposal(
  left: StoryWorldRelationProposal,
  right: StoryWorldRelationProposal
): boolean {
  return left.chapterPath === right.chapterPath
    && left.sourceRawLink === right.sourceRawLink
    && left.sourceLinkpath === right.sourceLinkpath
    && left.sourceEntityPath === right.sourceEntityPath
    && left.targetEntityPath === right.targetEntityPath
    && left.targetReference === right.targetReference
    && left.chapterReference === right.chapterReference
    && left.scopeReference === right.scopeReference
    && left.storyDate === right.storyDate;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function worldContextFollowUp(
  plugin: MurmurationWritingCompanionPlugin,
  chapter: TFile,
  targetFile: TFile,
  proposal: StoryWorldRelationProposal
) {
  if (storyWorldEntityInWorldContext(plugin.app, chapter, targetFile)) return null;
  return {
    targetEntityPath: targetFile.path,
    targetEntityName: proposal.targetEntityName,
    reference: proposal.worldContextReference,
    sourceRawLink: proposal.sourceRawLink
  };
}

function renderMeaningPrompt(
  card: HTMLElement,
  chapter: TFile,
  plugin: MurmurationWritingCompanionPlugin,
  pending: PendingStoryWorldRelationMeaning
): void {
  const host = storyWorldRelationAuthoringHost(plugin);
  const proposal = buildProposal(plugin, chapter, pending);
  if (!host || !proposal) return;

  card.createEl("p", {
    cls: "mwc-story-world-relation-title",
    text: "What does this link mean here?"
  });
  card.createEl("p", {
    cls: "mwc-story-world-relation-participants",
    text: `${proposal.sourceEntityName} → ${proposal.targetEntityName}`
  });
  card.createEl("p", {
    cls: "mwc-story-world-relation-source",
    text: `From prose link ${proposal.sourceRawLink} · line ${proposal.sourceLine}`
  });

  const controls = card.createDiv("mwc-story-world-relation-controls");
  const relationLabel = controls.createEl("label");
  relationLabel.createSpan({ text: "Relationship" });
  const relationSelect = relationLabel.createEl("select", {
    attr: { "aria-label": "Relationship meaning" }
  });
  const blank = relationSelect.createEl("option", { text: "Choose relationship…" });
  blank.value = "";
  for (const option of proposal.predicateOptions) {
    const element = relationSelect.createEl("option", { text: option.label });
    element.value = option.value;
  }
  const other = relationSelect.createEl("option", { text: "Other…" });
  other.value = "other";

  const customLabel = controls.createEl("label", {
    cls: "mwc-story-world-relation-custom"
  });
  customLabel.createSpan({ text: "Other relationship" });
  const customInput = customLabel.createEl("input", {
    type: "text",
    attr: {
      placeholder: "e.g. conceals the event from",
      "aria-label": "Custom relationship phrase"
    }
  });
  customLabel.hidden = true;

  const statusLabel = controls.createEl("label");
  statusLabel.createSpan({ text: "Status" });
  const statusSelect = statusLabel.createEl("select", {
    attr: { "aria-label": "Relationship canon status" }
  });
  for (const option of STORY_WORLD_RELATION_STATUS_OPTIONS) {
    const element = statusSelect.createEl("option", { text: option.label });
    element.value = option.value;
  }
  statusSelect.value = "confirmed";

  const preview = card.createEl("p", {
    cls: "mwc-story-world-relation-preview",
    text: "Choose the relationship the link records."
  });
  const actions = card.createDiv("mwc-story-world-relation-actions");
  const referenceOnly = actions.createEl("button", {
    text: "Just a reference",
    attr: { type: "button" }
  });
  const record = actions.createEl("button", {
    cls: "mwc-story-world-relation-record",
    text: "Record relationship",
    attr: { type: "button" }
  });
  record.disabled = true;

  const decision = (): StoryWorldRelationDecision | null => (
    buildStoryWorldRelationDecision(
      relationSelect.value,
      customInput.value,
      statusSelect.value,
      proposal.predicateOptions
    )
  );
  const update = () => {
    customLabel.hidden = relationSelect.value !== "other";
    const current = decision();
    record.disabled = current === null;
    preview.textContent = current
      ? formatStoryWorldRelationSentence(proposal, current)
      : "Choose the relationship the link records.";
  };
  relationSelect.onchange = update;
  customInput.oninput = update;
  statusSelect.onchange = update;

  const advance = (targetFile: TFile) => {
    host.advancePendingStoryWorldRelationAuthoring(
      chapter,
      pending,
      worldContextFollowUp(plugin, chapter, targetFile, proposal)
    );
    plugin.refreshView();
    focusChapter(plugin, chapter);
  };

  referenceOnly.onclick = () => {
    const targetFile = plugin.app.vault.getAbstractFileByPath(proposal.targetEntityPath);
    if (!(targetFile instanceof TFile)) {
      new Notice("The linked Story World entity can no longer be found.");
      return;
    }
    advance(targetFile);
  };

  record.onclick = async () => {
    const selected = decision();
    if (!selected) return;
    record.disabled = true;
    referenceOnly.disabled = true;
    relationSelect.disabled = true;
    customInput.disabled = true;
    statusSelect.disabled = true;

    try {
      const current = host.getPendingStoryWorldRelationAuthoring(chapter);
      if (current?.kind !== "author-relation" || current.key !== pending.key) {
        throw new Error("The pending prose link changed. Recreate the relationship choice.");
      }
      const refreshed = buildProposal(plugin, chapter, current);
      if (!refreshed || !sameProposal(proposal, refreshed)) {
        throw new Error("The relationship context changed. Review the link and try again.");
      }

      const sourceFile = plugin.app.vault.getAbstractFileByPath(proposal.sourceEntityPath);
      const targetFile = plugin.app.vault.getAbstractFileByPath(proposal.targetEntityPath);
      if (!(sourceFile instanceof TFile) || !(targetFile instanceof TFile)) {
        throw new Error("The relationship source or target note can no longer be found.");
      }

      const changed = await appendStoryWorldRelation(
        plugin.app,
        chapter,
        sourceFile,
        targetFile,
        proposal,
        selected
      );
      advance(targetFile);
      new Notice(changed
        ? `Recorded: ${formatStoryWorldRelationSentence(proposal, selected)}`
        : "That current relationship is already recorded.");
    } catch (error) {
      new Notice(errorMessage(error, "Could not record the Story World relationship."));
      record.disabled = false;
      referenceOnly.disabled = false;
      relationSelect.disabled = false;
      customInput.disabled = false;
      statusSelect.disabled = false;
      focusChapter(plugin, chapter);
    }
  };
}

export function renderStoryWorldRelationAuthoring(
  container: Element,
  chapter: TFile,
  plugin: MurmurationWritingCompanionPlugin
): void {
  if (container.querySelector(".mwc-story-world-event-authoring")) return;
  const host = storyWorldRelationAuthoringHost(plugin);
  const pending = host?.getPendingStoryWorldRelationAuthoring(chapter) ?? null;
  if (!host || !pending) return;

  const section = container.createDiv(
    "mwc-section mwc-story-world-relation-authoring"
  );
  section.createEl("h3", { text: "Story World authoring" });
  const card = section.createDiv({
    cls: "mwc-story-world-relation-offer",
    attr: { role: "status" }
  });

  if (pending.kind === "author-relation") {
    renderMeaningPrompt(card, chapter, plugin, pending);
    return;
  }

  card.createEl("p", {
    cls: "mwc-story-world-relation-title",
    text: `Add “${pending.targetEntityName}” to this chapter's World Context?`
  });
  card.createEl("p", {
    cls: "mwc-story-world-relation-source",
    text: "Relationship authoring and chapter relevance are separate decisions."
  });
  const actions = card.createDiv("mwc-story-world-relation-actions");
  const notNow = actions.createEl("button", {
    text: "Not now",
    attr: { type: "button" }
  });
  const add = actions.createEl("button", {
    cls: "mwc-story-world-relation-record",
    text: "Add to World Context",
    attr: { type: "button" }
  });

  notNow.onclick = () => {
    host.completePendingStoryWorldRelationAuthoring(chapter);
    plugin.refreshView();
    focusChapter(plugin, chapter);
  };

  add.onclick = async () => {
    const targetFile = plugin.app.vault.getAbstractFileByPath(pending.targetEntityPath);
    if (!(targetFile instanceof TFile)) {
      new Notice("The linked Story World entity can no longer be found.");
      return;
    }

    add.disabled = true;
    notNow.disabled = true;
    try {
      const changed = await addStoryWorldEntityToWorldContext(
        plugin.app,
        chapter,
        targetFile,
        pending.reference,
        pending.sourceRawLink
      );
      host.completePendingStoryWorldRelationAuthoring(chapter);
      plugin.refreshView();
      new Notice(changed
        ? `Added ${pending.targetEntityName} to World Context.`
        : `${pending.targetEntityName} is already in World Context.`);
      focusChapter(plugin, chapter);
    } catch (error) {
      new Notice(errorMessage(error, "Could not update World Context."));
      add.disabled = false;
      notNow.disabled = false;
      focusChapter(plugin, chapter);
    }
  };
}
