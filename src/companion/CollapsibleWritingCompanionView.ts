import { TFile, WorkspaceLeaf } from "obsidian";
import type { HoverPopover } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import type { PageEditorialNotes } from "../editorial/EditorialNote";
import {
  buildWorldContext,
  buildWorldContextStatus,
  buildWorldContextSummary
} from "../story-world/WorldContext";
import { renderEditorialPassChecklist } from "../ui/EditorialPassChecklist";
import { renderWorldContext } from "../ui/WorldContext";
import {
  VIEW_TYPE,
  WritingCompanionView as BaseWritingCompanionView
} from "./EditorialWritingCompanionView";
import {
  buildChapterContextSummary,
  buildChapterNoteSummary,
  SidebarSectionKey
} from "./SidebarSections";
import {
  getChapterContextField,
  getEditableChapterContextValue
} from "./ChapterContext";
import {
  createWorldContextTimePreferenceKey,
  WorldContextTimePreferences
} from "./WorldContextTimePreferences";
import {
  evaluateChapterContextContinuity
} from "../observations/ChapterContextContinuity";
import {
  ContinuityObservation,
  observationSourceNotes
} from "../observations/ContinuityObservation";
import { isBookFrontmatter } from "../editorial/BookReview";
import { parseWikilink } from "../story-world/StoryWorldIndex";

export { VIEW_TYPE };

interface CollapsibleSectionOptions {
  summary?: string;
  status?: string;
}

interface CollapsibleSectionElements {
  section: HTMLDivElement;
  content: HTMLDivElement;
  setSummary(summary: string): void;
  setStatus(status: string): void;
}

let nextViewInstanceId = 0;
const registeredHoverSources = new WeakSet<MurmurationWritingCompanionPlugin>();

function createWorldContextTimePreferences(
  plugin: MurmurationWritingCompanionPlugin
): WorldContextTimePreferences {
  const vaultName = plugin.app.vault.getName();
  let resourceRoot = vaultName;
  let storage: Storage | null = null;

  try {
    resourceRoot = plugin.app.vault.adapter.getResourcePath("");
  } catch {
    // The vault name remains a stable fallback on unusual adapters.
  }

  try {
    storage = window.localStorage;
  } catch {
    // The in-memory default remains usable when local storage is unavailable.
  }

  return new WorldContextTimePreferences(
    storage,
    createWorldContextTimePreferenceKey(
      plugin.manifest.id,
      vaultName,
      resourceRoot
    )
  );
}

export class WritingCompanionView extends BaseWritingCompanionView {
  hoverPopover: HoverPopover | null = null;

  private readonly collapsibleSectionIdPrefix =
    `mwc-collapsible-view-${++nextViewInstanceId}`;
  private readonly worldContextTimePreferences: WorldContextTimePreferences;

  constructor(leaf: WorkspaceLeaf, plugin: MurmurationWritingCompanionPlugin) {
    super(leaf, plugin);
    this.worldContextTimePreferences = createWorldContextTimePreferences(plugin);

    if (!registeredHoverSources.has(plugin)) {
      plugin.registerHoverLinkSource(VIEW_TYPE, {
        display: plugin.manifest.name,
        defaultMod: false
      });
      registeredHoverSources.add(plugin);
    }
  }

  override render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("mwc-container");

    const file = this.plugin.getCurrentChapter();
    const focusNoteId = this.plugin.getPendingFocusNoteId();

    container.createEl("h2", { text: "Writing Companion" });

    if (!file) {
      container.createEl("p", {
        cls: "mwc-muted",
        text: "Open a Markdown chapter to view its notes."
      });
      return;
    }

    const page = this.plugin.storeService.getPage(file);

    this.renderBookReview(container, file);
    this.renderCollapsibleChapterContext(container, file);
    this.renderCollapsibleWorldContext(container, file);
    this.renderCollapsibleEditorialPasses(container, file);
    this.renderCollapsibleChapterNote(container, file, page);
    this.renderAnnotations(container, file, page, focusNoteId);
  }

  private renderCollapsibleChapterContext(container: Element, file: TFile) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const collapsible = this.createCollapsibleSection(
      container,
      "chapterContext",
      "Chapter Context",
      { summary: buildChapterContextSummary(frontmatter) }
    );
    collapsible.section.classList.add("mwc-chapter-context");

    super.renderChapterContext(collapsible.content, file);
    this.flattenEmbeddedSection(collapsible.content);
  }

  private renderCollapsibleWorldContext(container: Element, file: TFile) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const result = buildWorldContext(
      frontmatter,
      (reference) => this.plugin.storyWorldIndex.resolveWikilink(reference, file.path)
    );
    const storyDate = getEditableChapterContextValue(
      frontmatter,
      getChapterContextField("story_date")
    ).value;
    const collapsible = this.createCollapsibleSection(
      container,
      "worldContext",
      "World Context",
      {
        summary: buildWorldContextSummary(result),
        status: buildWorldContextStatus(result)
      }
    );
    collapsible.section.classList.add("mwc-world-context");

    renderWorldContext(
      collapsible.content,
      result,
      (entry, event) => {
        const destination = entry.entity.path.replace(/\.md$/i, "");
        void this.app.workspace.openLinkText(
          destination,
          file.path,
          event.metaKey || event.ctrlKey
        );
      },
      (entry, target, event) => {
        const destination = entry.entity.path.replace(/\.md$/i, "");
        this.app.workspace.trigger("hover-link", {
          event,
          source: VIEW_TYPE,
          hoverParent: this,
          targetEl: target,
          linktext: destination,
          sourcePath: file.path
        });
      },
      {
        storyDate,
        relativeTimeMode: this.worldContextTimePreferences.getMode(),
        onRelativeTimeModeChange: (mode) => {
          if (this.worldContextTimePreferences.setMode(mode)) {
            this.plugin.refreshView();
          }
        }
      }
    );

    this.renderContinuityObservations(collapsible.content, file, frontmatter);
  }

  private renderContinuityObservations(
    container: HTMLElement,
    file: TFile,
    frontmatter: Record<string, unknown> | undefined
  ) {
    const explicitBook = this.plugin.getExplicitOwningBookResolution(file);
    const observations = evaluateChapterContextContinuity({
      chapter: { role: "manuscript", path: file.path, label: file.basename },
      frontmatter,
      owningBook: explicitBook
        ? {
            note: {
              role: "manuscript",
              path: explicitBook.book.path,
              label: explicitBook.book.basename
            },
            source: {
              note: {
                role: "manuscript",
                path: explicitBook.source.path,
                label: explicitBook.source.basename
              },
              property: explicitBook.property
            }
          }
        : null,
      resolveEntity: (reference, sourcePath) =>
        this.plugin.storyWorldIndex.resolveWikilink(reference, sourcePath),
      resolveScope: (reference, sourcePath) => {
        const parsed = parseWikilink(reference);
        if (!parsed) return null;
        const target = this.app.metadataCache.getFirstLinkpathDest(parsed.linkpath, sourcePath);
        if (!target) return null;
        const targetFrontmatter = this.app.metadataCache.getFileCache(target)?.frontmatter as
          Record<string, unknown> | undefined;
        return {
          note: { role: "manuscript", path: target.path, label: target.basename },
          book: isBookFrontmatter(targetFrontmatter)
        };
      }
    });
    if (observations.length === 0) return;

    const section = container.createDiv("mwc-continuity");
    const heading = section.createDiv("mwc-continuity-heading");
    heading.createEl("h4", { text: "Continuity" });
    heading.createSpan({
      cls: "mwc-continuity-count",
      text: String(observations.length)
    });
    for (const observation of observations) {
      this.renderContinuityObservation(section, file, observation);
    }
  }

  private renderContinuityObservation(
    container: HTMLElement,
    chapter: TFile,
    observation: ContinuityObservation
  ) {
    const card = container.createDiv(
      `mwc-continuity-observation mwc-continuity-observation--${observation.severity}`
    );
    card.createEl("p", { cls: "mwc-continuity-summary", text: observation.summary });
    card.createEl("p", { cls: "mwc-continuity-explanation", text: observation.explanation });
    const supporting = observationSourceNotes(observation)
      .filter((note) => note.path !== chapter.path);
    if (supporting.length === 0) return;
    const navigation = card.createDiv("mwc-continuity-navigation");
    for (const note of supporting) {
      const button = navigation.createEl("button", {
        text: `Open ${note.label ?? note.path.replace(/\.md$/i, "").split("/").pop()}`,
        attr: { type: "button" }
      });
      button.onclick = (event) => {
        void this.app.workspace.openLinkText(
          note.path.replace(/\.md$/i, ""),
          chapter.path,
          event.metaKey || event.ctrlKey
        );
      };
    }
  }

  private renderCollapsibleEditorialPasses(container: Element, file: TFile) {
    const state = this.plugin.getEditorialPassState(file);
    const completedCount = state.items.filter((item) => item.completed).length;
    const book = this.plugin.getOwningBook(file);
    const activeMode = book
      ? this.plugin.storeService.getBookReviewMode(book)
      : null;
    const collapsible = this.createCollapsibleSection(
      container,
      "editorialPasses",
      "Editorial Passes",
      { status: `${completedCount} of ${state.items.length}` }
    );
    collapsible.section.classList.add("mwc-editorial-passes");

    renderEditorialPassChecklist(
      collapsible.content,
      file.basename,
      state.items,
      (pass, completed) => this.plugin.setEditorialPassCompleted(file, pass, completed),
      { activeMode }
    );
  }

  private renderCollapsibleChapterNote(
    container: Element,
    file: TFile,
    page: PageEditorialNotes
  ) {
    const noteSummary = buildChapterNoteSummary(page.chapterNote.body);
    const collapsible = this.createCollapsibleSection(
      container,
      "chapterNotes",
      "Chapter Notes",
      {
        summary: noteSummary,
        status: noteSummary ? "Has notes" : "No notes"
      }
    );
    collapsible.section.classList.add("mwc-chapter-notes");

    super.renderChapterNote(collapsible.content, file, page);
    const embedded = this.flattenEmbeddedSection(collapsible.content);
    const editor = embedded?.querySelector<HTMLTextAreaElement>(
      ".mwc-chapter-note-body"
    );

    editor?.addEventListener("input", () => {
      const summary = buildChapterNoteSummary(editor.value);
      collapsible.setSummary(summary);
      collapsible.setStatus(summary ? "Has notes" : "No notes");
    });
  }

  private flattenEmbeddedSection(content: HTMLElement): HTMLElement | null {
    const embedded = content.lastElementChild;
    if (!(embedded instanceof HTMLElement)) return null;

    embedded.classList.add("mwc-section-embedded");
    const heading = embedded.firstElementChild;
    if (heading instanceof HTMLElement && heading.tagName === "H3") {
      heading.remove();
    }

    return embedded;
  }

  private createCollapsibleSection(
    container: Element,
    key: SidebarSectionKey,
    title: string,
    options: CollapsibleSectionOptions = {}
  ): CollapsibleSectionElements {
    const section = container.createDiv(
      `mwc-section mwc-collapsible-section mwc-collapsible-section--${key}`
    );
    const contentId = `${this.collapsibleSectionIdPrefix}-${key}`;
    const heading = section.createEl("h3", {
      cls: "mwc-collapsible-heading"
    });
    const toggle = heading.createEl("button", {
      cls: "mwc-section-toggle",
      attr: {
        type: "button",
        "aria-controls": contentId
      }
    });
    const label = toggle.createSpan({ cls: "mwc-section-toggle-label" });
    label.createSpan({
      cls: "mwc-section-toggle-icon",
      text: "›",
      attr: { "aria-hidden": "true" }
    });
    label.createSpan({
      cls: "mwc-section-toggle-title",
      text: title
    });
    const status = toggle.createSpan({
      cls: "mwc-section-toggle-status"
    });
    const summary = section.createEl("p", {
      cls: "mwc-section-summary"
    });
    const content = section.createDiv({
      cls: "mwc-section-content",
      attr: { id: contentId }
    });

    let expanded = this.plugin.sidebarSectionPreferences.isExpanded(key);
    let currentSummary = options.summary?.trim() ?? "";
    let currentStatus = options.status?.trim() ?? "";

    const applyState = () => {
      section.classList.toggle(
        "mwc-collapsible-section--expanded",
        expanded
      );
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.setAttribute(
        "aria-label",
        `${expanded ? "Collapse" : "Expand"} ${title}`
      );
      content.hidden = !expanded;
      summary.hidden = expanded || currentSummary.length === 0;
      status.hidden = currentStatus.length === 0;
    };

    const setSummary = (nextSummary: string) => {
      currentSummary = nextSummary.trim();
      summary.textContent = currentSummary;
      summary.hidden = expanded || currentSummary.length === 0;
    };

    const setStatus = (nextStatus: string) => {
      currentStatus = nextStatus.trim();
      status.textContent = currentStatus;
      status.hidden = currentStatus.length === 0;
    };

    toggle.onclick = () => {
      expanded = !expanded;
      this.plugin.sidebarSectionPreferences.setExpanded(key, expanded);
      applyState();
    };

    setSummary(currentSummary);
    setStatus(currentStatus);
    applyState();

    return {
      section,
      content,
      setSummary,
      setStatus
    };
  }
}
