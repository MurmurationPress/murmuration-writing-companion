import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import {
  EDITORIAL_PASS_LABELS,
  isEditorialPassKey
} from "../editorial/EditorialPass";
import { parseWikilink } from "../story-world/StoryWorldIndex";
import type {
  ManuscriptDocumentRecord,
  ManuscriptOrderNode
} from "./ManuscriptOrder";
import {
  buildObsidianManuscriptLibrary,
  ObsidianManuscriptBook
} from "./ObsidianManuscript";
import {
  formatNavigatorStoryDate,
  ManuscriptSceneMetadata
} from "./ManuscriptMetadata";

export const MANUSCRIPT_NAVIGATOR_VIEW_TYPE =
  "murmuration-manuscript-navigator-view";

let nextTooltipId = 0;

function readableValue(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function povDisplay(value: string): string {
  const parsed = parseWikilink(value);
  if (!parsed) return value;
  return parsed.displayText ?? parsed.linkpath.split("/").pop() ?? parsed.linkpath;
}

function metadataRows(metadata: ManuscriptSceneMetadata): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (metadata.pov) rows.push(["POV", povDisplay(metadata.pov)]);

  const storyDate = formatNavigatorStoryDate(metadata.storyDate);
  if (storyDate) rows.push(["Story date", storyDate]);
  if (metadata.chapterStatus) {
    rows.push(["Status", readableValue(metadata.chapterStatus)]);
  }
  if (metadata.editorialPass) {
    const pass = isEditorialPassKey(metadata.editorialPass)
      ? EDITORIAL_PASS_LABELS[metadata.editorialPass]
      : readableValue(metadata.editorialPass);
    rows.push(["Pass", pass]);
  }
  return rows;
}

function nodeContainsPath(node: ManuscriptOrderNode, path: string | null): boolean {
  if (!path) return false;
  if (node.entry.path === path) return true;
  return node.children.some((child) => nodeContainsPath(child, path));
}

function collectPartPaths(nodes: readonly ManuscriptOrderNode[]): string[] {
  const paths: string[] = [];

  const visit = (node: ManuscriptOrderNode) => {
    if (node.entry.kind === "part") paths.push(node.entry.path);
    for (const child of node.children) visit(child);
  };

  for (const node of nodes) visit(node);
  return paths;
}

export class ManuscriptNavigatorView extends ItemView {
  private readonly plugin: MurmurationWritingCompanionPlugin;
  private readonly collapsedParts = new Set<string>();
  private selectedBookPath: string | null = null;
  private suppressedActiveRevealPath: string | null = null;
  private readonly preferenceKey: string;

  constructor(leaf: WorkspaceLeaf, plugin: MurmurationWritingCompanionPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.preferenceKey = [
      plugin.manifest.id,
      plugin.app.vault.getName(),
      "manuscript-navigator-book"
    ].join(":");

    try {
      this.selectedBookPath = window.localStorage.getItem(this.preferenceKey);
    } catch {
      this.selectedBookPath = null;
    }
  }

  getViewType() {
    return MANUSCRIPT_NAVIGATOR_VIEW_TYPE;
  }

  getDisplayText() {
    return "Manuscript";
  }

  getIcon() {
    return "list-tree";
  }

  async onOpen() {
    this.render();
  }

  render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("mwc-manuscript-navigator");

    const library = buildObsidianManuscriptLibrary(this.app);
    const activeFile = this.plugin.getActiveChapter();
    const activePath = activeFile?.path ?? null;
    const activeBookPath = activeFile
      ? library.owningBookPathByFile.get(activeFile.path) ?? null
      : null;

    if (
      this.suppressedActiveRevealPath
      && this.suppressedActiveRevealPath !== activePath
    ) {
      this.suppressedActiveRevealPath = null;
    }

    if (activeBookPath) this.setSelectedBookPath(activeBookPath);

    const selected = library.books.find((book) => (
      book.file.path === this.selectedBookPath
    )) ?? library.books[0] ?? null;

    const heading = container.createDiv("mwc-manuscript-heading");
    heading.createEl("h2", { text: "Manuscript" });

    if (library.books.length === 0) {
      container.createEl("p", {
        cls: "mwc-muted",
        text: "No recognised book notes were found."
      });
      return;
    }

    if (library.books.length > 1) {
      const selector = heading.createEl("select", {
        cls: "mwc-manuscript-book-selector",
        attr: { "aria-label": "Select manuscript book" }
      });

      for (const book of library.books) {
        const option = selector.createEl("option", { text: book.record.title });
        option.value = book.file.path;
      }

      selector.value = selected?.file.path ?? "";
      selector.onchange = () => {
        this.setSelectedBookPath(selector.value);
        this.suppressedActiveRevealPath = null;
        this.render();
      };
    } else if (selected) {
      heading.createDiv({
        cls: "mwc-manuscript-book-title",
        text: selected.record.title
      });
    }

    if (!selected) return;
    this.renderSourceNotice(container, selected);

    if (selected.result.roots.length === 0) {
      container.createEl("p", {
        cls: "mwc-muted",
        text: selected.result.source === "invalid"
          ? "The book's manuscript_order property needs correction."
          : "No recognised manuscript scenes were found."
      });
      this.renderDiagnostics(container, selected);
      return;
    }

    const partPaths = collectPartPaths(selected.result.roots);
    if (partPaths.length > 0) {
      this.renderTreeControls(container, partPaths, activePath);
    }

    const tree = container.createDiv({
      cls: "mwc-manuscript-tree",
      attr: {
        role: "tree",
        "aria-label": `${selected.record.title} manuscript order`
      }
    });
    let activeRow: HTMLElement | null = null;

    for (const node of selected.result.roots) {
      const rendered = this.renderNode(tree, node, selected, activeFile, 0);
      activeRow = activeRow ?? rendered;
    }

    this.renderDiagnostics(container, selected);

    if (activeRow) {
      window.setTimeout(() => {
        if (!activeRow?.isConnected) return;
        activeRow.scrollIntoView({ block: "nearest" });
      }, 0);
    }
  }

  private renderTreeControls(
    container: HTMLElement,
    partPaths: readonly string[],
    activePath: string | null
  ) {
    const allCollapsed = partPaths.every((path) => this.collapsedParts.has(path));
    const controls = container.createDiv("mwc-manuscript-controls");
    const toggle = controls.createEl("button", {
      cls: "mwc-manuscript-collapse-all",
      text: allCollapsed ? "Expand all" : "Collapse all",
      attr: {
        type: "button",
        "aria-label": allCollapsed
          ? "Expand all manuscript parts"
          : "Collapse all manuscript parts"
      }
    });

    toggle.onclick = () => {
      if (allCollapsed) {
        for (const path of partPaths) this.collapsedParts.delete(path);
        this.suppressedActiveRevealPath = null;
      } else {
        for (const path of partPaths) this.collapsedParts.add(path);
        this.suppressedActiveRevealPath = activePath;
      }
      this.render();
    };
  }

  private renderSourceNotice(
    container: HTMLElement,
    book: ObsidianManuscriptBook
  ) {
    if (book.result.source === "legacy") {
      container.createDiv({
        cls: "mwc-manuscript-notice",
        text: "Previewing the current filename-prefix order. It has not yet been adopted as authoritative manuscript order."
      });
    } else if (book.result.source === "invalid") {
      container.createDiv({
        cls: "mwc-manuscript-notice mwc-manuscript-notice--warning",
        text: "The explicit manuscript order is malformed. Filename order has not been substituted silently."
      });
    }
  }

  private renderNode(
    parent: HTMLElement,
    node: ManuscriptOrderNode,
    book: ObsidianManuscriptBook,
    activeFile: TFile | null,
    depth: number
  ): HTMLElement | null {
    const isPart = node.entry.kind === "part";
    const isActive = activeFile?.path === node.entry.path;
    const wrapper = parent.createDiv({
      cls: isPart
        ? "mwc-manuscript-node mwc-manuscript-node--part"
        : "mwc-manuscript-node mwc-manuscript-node--scene",
      attr: {
        role: "treeitem",
        "aria-level": String(depth + 1),
        "aria-selected": String(isActive)
      }
    });
    wrapper.style.setProperty("--mwc-manuscript-depth", String(depth));

    if (isPart) {
      const activePath = activeFile?.path ?? null;
      const containsActive = nodeContainsPath(node, activePath);
      const revealActive = containsActive
        && this.suppressedActiveRevealPath !== activePath;
      const collapsed = this.collapsedParts.has(node.entry.path) && !revealActive;
      wrapper.setAttribute("aria-expanded", String(!collapsed));
      const row = wrapper.createDiv("mwc-manuscript-row mwc-manuscript-row--part");
      const disclosure = row.createEl("button", {
        cls: "mwc-manuscript-disclosure",
        text: collapsed ? "›" : "⌄",
        attr: {
          type: "button",
          "aria-label": `${collapsed ? "Expand" : "Collapse"} ${node.entry.title}`
        }
      });
      disclosure.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.collapsedParts.has(node.entry.path)) {
          this.collapsedParts.delete(node.entry.path);
          if (containsActive) this.suppressedActiveRevealPath = null;
        } else {
          this.collapsedParts.add(node.entry.path);
          if (containsActive) this.suppressedActiveRevealPath = activePath;
        }
        this.render();
      };

      const label = this.createOpenButton(row, node.entry, book, isActive);
      this.renderMetadataTooltip(row, label, book, node.entry);

      const children = wrapper.createDiv({
        cls: "mwc-manuscript-children",
        attr: { role: "group" }
      });
      children.hidden = collapsed;
      let activeDescendant: HTMLElement | null = isActive ? row : null;

      if (!collapsed) {
        for (const child of node.children) {
          activeDescendant = activeDescendant
            ?? this.renderNode(children, child, book, activeFile, depth + 1);
        }
      }
      return activeDescendant;
    }

    const row = wrapper.createDiv(
      isActive
        ? "mwc-manuscript-row mwc-manuscript-row--active"
        : "mwc-manuscript-row"
    );
    const label = this.createOpenButton(row, node.entry, book, isActive);
    this.renderMetadataTooltip(row, label, book, node.entry);
    return isActive ? row : null;
  }

  private createOpenButton(
    row: HTMLElement,
    entry: ManuscriptDocumentRecord,
    book: ObsidianManuscriptBook,
    active: boolean
  ): HTMLButtonElement {
    const button = row.createEl("button", {
      cls: "mwc-manuscript-entry",
      text: entry.title,
      attr: {
        type: "button",
        "aria-label": `Open ${entry.title}`,
        ...(active ? { "aria-current": "page" } : {})
      }
    });

    button.onclick = (event) => {
      const file = book.filesByPath.get(entry.path);
      if (!file) return;
      const leaf = this.app.workspace.getLeaf(event.metaKey || event.ctrlKey);
      void leaf.openFile(file, { active: true });
    };
    return button;
  }

  private renderMetadataTooltip(
    row: HTMLElement,
    button: HTMLButtonElement,
    book: ObsidianManuscriptBook,
    entry: ManuscriptDocumentRecord
  ) {
    const metadata = book.metadataByPath.get(entry.path);
    if (!metadata) return;
    const rows = metadataRows(metadata);
    if (rows.length === 0) return;

    const id = `mwc-manuscript-tooltip-${++nextTooltipId}`;
    button.setAttribute("aria-describedby", id);
    const tooltip = row.createDiv({
      cls: "mwc-manuscript-tooltip",
      attr: { id, role: "tooltip" }
    });
    tooltip.createDiv({ cls: "mwc-manuscript-tooltip-title", text: entry.title });
    const list = tooltip.createEl("dl");

    for (const [label, value] of rows) {
      const metadataRow = list.createDiv("mwc-manuscript-tooltip-row");
      metadataRow.createEl("dt", { text: label });
      metadataRow.createEl("dd", { text: value });
    }
  }

  private renderDiagnostics(
    container: HTMLElement,
    book: ObsidianManuscriptBook
  ) {
    if (book.result.diagnostics.length === 0) return;

    const details = container.createEl("details", {
      cls: "mwc-manuscript-diagnostics"
    });
    details.createEl("summary", {
      text: `${book.result.diagnostics.length} structure ${book.result.diagnostics.length === 1 ? "notice" : "notices"}`
    });
    const list = details.createEl("ul");

    for (const diagnostic of book.result.diagnostics) {
      list.createEl("li", { text: diagnostic.message });
    }
  }

  private setSelectedBookPath(path: string) {
    this.selectedBookPath = path;
    try {
      window.localStorage.setItem(this.preferenceKey, path);
    } catch {
      // Selection remains valid for the current view instance.
    }
  }
}
