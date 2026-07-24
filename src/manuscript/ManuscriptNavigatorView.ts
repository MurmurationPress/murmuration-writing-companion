import {
  App,
  ItemView,
  Menu,
  Modal,
  Notice,
  TFile,
  WorkspaceLeaf
} from "obsidian";
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
  applyManuscriptReorder,
  ManuscriptReorderUndoToken,
  StaleManuscriptUndoError,
  undoManuscriptReorder
} from "./ObsidianManuscriptReorder";
import {
  ManuscriptDropPosition,
  proposeManuscriptMove,
  siblingMoveRequest
} from "./ManuscriptReorder";
import {
  formatNavigatorStoryDate,
  ManuscriptSceneMetadata
} from "./ManuscriptMetadata";
import {
  renderAndRetainFirst
} from "./NavigatorViewState";
import { openContinuityReviewFromEntryPoint } from "../companion/ContinuityReviewEntryPoint";
import { ManuscriptBookCreationModal } from "./ManuscriptBookCreationModal";
import { ManuscriptPartCreationModal } from "./ManuscriptPartCreationModal";
import { manuscriptPartCreationAvailability } from "./ManuscriptPartCreation";
import { snapshotManuscriptPartCreation } from "./ObsidianManuscriptPartCreation";
import { ManuscriptSceneCreationModal } from "./ManuscriptSceneCreationModal";
import { defaultManuscriptSceneParent, manuscriptSceneCreationAvailability } from "./ManuscriptSceneCreation";
import { snapshotManuscriptSceneCreation } from "./ObsidianManuscriptSceneCreation";
import { ManuscriptSceneDetachmentModal } from "./ManuscriptSceneDetachmentModal";

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

function effectiveParent(
  entry: ManuscriptDocumentRecord,
  bookPath: string
): string {
  return entry.parentPath ?? bookPath;
}

function plainButton(button: HTMLButtonElement) {
  button.addClass("mwc-quiet-button");
}

class ConfirmOrderAdoptionModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly resolve: (accepted: boolean) => void
  ) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText("Adopt manuscript order");
    this.contentEl.createEl("p", {
      text: "This manuscript currently uses filename order. Reordering will adopt the displayed sequence as authoritative manuscript order and apply this move."
    });
    this.contentEl.createEl("p", {
      cls: "mwc-muted",
      text: "Filenames will not be renamed. Codex Press alignment remains a separate migration step."
    });

    const actions = this.contentEl.createDiv();
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";
    actions.style.marginTop = "16px";

    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.finish(false);
    const adopt = actions.createEl("button", {
      text: "Adopt and reorder",
      cls: "mod-cta"
    });
    adopt.onclick = () => this.finish(true);
    window.setTimeout(() => adopt.focus(), 0);
  }

  onClose() {
    this.contentEl.empty();
    if (!this.settled) this.resolve(false);
  }

  private finish(accepted: boolean) {
    if (this.settled) return;
    this.settled = true;
    this.resolve(accepted);
    this.close();
  }
}

function confirmOrderAdoption(app: App): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmOrderAdoptionModal(app, resolve).open();
  });
}

export class ManuscriptNavigatorView extends ItemView {
  private readonly plugin: MurmurationWritingCompanionPlugin;
  private readonly collapsedParts = new Set<string>();
  private suppressedActiveRevealPath: string | null = null;
  private draggedPath: string | null = null;
  private dropRow: HTMLElement | null = null;
  private dropPosition: ManuscriptDropPosition | null = null;
  private undoToken: ManuscriptReorderUndoToken | null = null;
  private operationMessage: string | null = null;
  private operationRunning = false;
  private revealedContextPath: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: MurmurationWritingCompanionPlugin) {
    super(leaf);
    this.plugin = plugin;
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
    this.registerDomEvent(this.containerEl, "keydown", (event) => {
      if (
        this.undoToken
        && (event.ctrlKey || event.metaKey)
        && !event.shiftKey
        && event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        event.stopPropagation();
        void this.undoLastMove();
      }
    });
    this.render();
  }

  revealPath(path: string) {
    this.revealedContextPath = path;
    this.collapsedParts.delete(path);
    this.render();
  }

  render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("mwc-manuscript-navigator");

    const library = buildObsidianManuscriptLibrary(this.app);
    const activeFile = this.plugin.getCurrentChapter();
    const activePath = activeFile?.path ?? null;

    if (
      this.suppressedActiveRevealPath
      && this.suppressedActiveRevealPath !== activePath
    ) {
      this.suppressedActiveRevealPath = null;
    }

    const selectedBookPath = this.plugin.manuscriptBookSelection.reconcileBooks(
      new Set(library.books.map((book) => book.file.path)),
      library.books[0]?.file.path ?? null
    ).bookPath;
    const selected = library.books.find((book) => book.file.path === selectedBookPath)
      ?? library.books[0] ?? null;

    const heading = container.createDiv("mwc-manuscript-heading");
    heading.createEl("h2", { text: "Manuscript" });
    const createBook = heading.createEl("button", {
      cls: "mwc-manuscript-create-book",
      text: "Create book",
      attr: { type: "button", "aria-label": "Create manuscript book" }
    });
    createBook.onclick = () => new ManuscriptBookCreationModal(this.plugin).open();

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
        const next = library.books.find((book) => book.file.path === selector.value);
        const contextPath = next?.result.scenes[0]?.path ?? selector.value;
        this.plugin.manuscriptBookSelection.select(
          selector.value,
          contextPath,
          "manuscript-navigator"
        );
        this.suppressedActiveRevealPath = null;
        this.undoToken = null;
        this.operationMessage = null;
        this.revealedContextPath = null;
        this.render();
      };
    } else if (selected) {
      heading.createDiv({
        cls: "mwc-manuscript-book-title",
        text: selected.record.title
      });
    }

    if (!selected) return;
    const reviewPresentation = this.plugin.getContinuityReviewActionPresentation(selected.file.path);
    const reviewActions = container.createDiv("mwc-manuscript-review-actions");
    const partAvailability = manuscriptPartCreationAvailability(snapshotManuscriptPartCreation(this.plugin));
    const createPart = reviewActions.createEl("button", {
      cls: "mwc-manuscript-create-part",
      text: "Create part",
      attr: {
        type: "button",
        title: partAvailability[0] ?? `Create Part in ${selected.record.title}`,
        "aria-label": partAvailability[0] ?? `Create Part in ${selected.record.title}`
      }
    });
    createPart.disabled = partAvailability.length > 0;
    createPart.onclick = () => new ManuscriptPartCreationModal(this.plugin).open();
    const sceneSnapshot = snapshotManuscriptSceneCreation(this.plugin);
    const sceneParentPath = defaultManuscriptSceneParent(sceneSnapshot);
    const sceneParent = sceneSnapshot.parents.find((parent) => parent.path === sceneParentPath);
    const sceneAvailability = manuscriptSceneCreationAvailability(sceneSnapshot, sceneParentPath);
    const createScene = reviewActions.createEl("button", {
      cls: "mwc-manuscript-create-scene",
      text: "Create scene",
      attr: {
        type: "button",
        title: sceneAvailability[0] ?? `Create Scene in ${sceneParent?.title ?? selected.record.title}`,
        "aria-label": sceneAvailability[0] ?? `Create Scene in ${sceneParent?.title ?? selected.record.title}`
      }
    });
    createScene.disabled = sceneAvailability.length > 0;
    createScene.onclick = () => new ManuscriptSceneCreationModal(this.plugin).open();
    const review = reviewActions.createEl("button", {
      cls: "mwc-manuscript-continuity-review",
      text: reviewPresentation.label,
      attr: {
        type: "button",
        title: reviewPresentation.tooltip,
        "aria-label": reviewPresentation.tooltip
      }
    });
    review.disabled = reviewPresentation.disabled;
    review.onclick = () => {
      const contextPath = selected.result.scenes[0]?.path ?? selected.file.path;
      void openContinuityReviewFromEntryPoint(this.plugin, selected.file.path, contextPath);
    };
    this.renderSourceNotice(container, selected);
    this.renderOperationStatus(container);

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
      activeRow = renderAndRetainFirst(
        activeRow,
        () => this.renderNode(tree, node, selected, activeFile, 0)
      );
    }

    this.renderDiagnostics(container, selected);

    if (activeRow) {
      window.setTimeout(() => {
        if (!activeRow?.isConnected) return;
        activeRow.scrollIntoView({ block: "nearest" });
      }, 0);
    }
  }

  async undoLastMove() {
    if (!this.undoToken || this.operationRunning) return;
    const token = this.undoToken;
    this.operationRunning = true;

    try {
      await undoManuscriptReorder(this.app, token);
      this.undoToken = null;
      this.operationMessage = "Manuscript move undone.";
    } catch (error) {
      this.undoToken = null;
      this.operationMessage = error instanceof StaleManuscriptUndoError
        ? error.message
        : "Could not undo the manuscript move.";
      new Notice(this.operationMessage);
    } finally {
      this.operationRunning = false;
      this.render();
    }
  }

  private renderOperationStatus(container: HTMLElement) {
    if (!this.operationMessage && !this.undoToken) return;

    const status = container.createDiv("mwc-manuscript-operation-status");
    status.setAttribute("role", "status");
    status.createSpan({ text: this.operationMessage ?? "Manuscript order updated." });

    if (this.undoToken) {
      const undo = status.createEl("button", {
        text: "Undo",
        attr: { type: "button", "aria-label": "Undo last manuscript move" }
      });
      plainButton(undo);
      undo.addClass("mwc-manuscript-undo");
      undo.onclick = () => void this.undoLastMove();
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
    plainButton(toggle);

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
        text: "Previewing the current filename-prefix order. The first reorder will offer to adopt it as authoritative manuscript order."
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
    const isActive = (this.revealedContextPath ?? activeFile?.path) === node.entry.path;
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
      this.createMoveMenuButton(row, node.entry, book);
      this.configureDrag(row, node.entry, book);
      this.renderMetadataTooltip(row, label, book, node.entry);

      const children = wrapper.createDiv({
        cls: "mwc-manuscript-children",
        attr: { role: "group" }
      });
      children.hidden = collapsed;
      let activeDescendant: HTMLElement | null = isActive ? row : null;

      if (!collapsed) {
        for (const child of node.children) {
          activeDescendant = renderAndRetainFirst(
            activeDescendant,
            () => this.renderNode(children, child, book, activeFile, depth + 1)
          );
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
    this.createMoveMenuButton(row, node.entry, book);
    this.configureDrag(row, node.entry, book);
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
        "aria-keyshortcuts": "Alt+ArrowUp Alt+ArrowDown",
        ...(active ? { "aria-current": "page" } : {})
      }
    });

    button.onclick = (event) => {
      const file = book.filesByPath.get(entry.path);
      if (!file) return;
      this.revealedContextPath = null;
      const leaf = this.app.workspace.getLeaf(event.metaKey || event.ctrlKey);
      void leaf.openFile(file, { active: true });
    };
    button.onkeydown = (event) => {
      if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
        return;
      }
      const request = siblingMoveRequest(
        book.file.path,
        book.result.entries,
        entry.path,
        event.key === "ArrowUp" ? -1 : 1
      );
      if (!request) return;
      event.preventDefault();
      event.stopPropagation();
      void this.handleMove(book, request.movedPath, request.targetPath, request.position);
    };
    return button;
  }

  private createMoveMenuButton(
    row: HTMLElement,
    entry: ManuscriptDocumentRecord,
    book: ObsidianManuscriptBook
  ) {
    const button = row.createEl("button", {
      cls: "mwc-manuscript-move",
      text: "⋮",
      attr: {
        type: "button",
        "aria-label": `Actions for ${entry.title}`
      }
    });
    plainButton(button);
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.showMoveMenu(button, entry, book);
    };
  }

  private showMoveMenu(
    anchor: HTMLElement,
    entry: ManuscriptDocumentRecord,
    book: ObsidianManuscriptBook
  ) {
    const menu = new Menu();
    let actionCount = 0;
    const addMove = (title: string, request: ReturnType<typeof siblingMoveRequest>) => {
      if (!request) return;
      actionCount += 1;
      menu.addItem((item) => item
        .setTitle(title)
        .setIcon(title.includes("earlier") ? "arrow-up" : "arrow-down")
        .onClick(() => void this.handleMove(
          book,
          request.movedPath,
          request.targetPath,
          request.position
        )));
    };

    addMove(
      "Move earlier",
      siblingMoveRequest(book.file.path, book.result.entries, entry.path, -1)
    );
    addMove(
      "Move later",
      siblingMoveRequest(book.file.path, book.result.entries, entry.path, 1)
    );

    if (entry.kind === "scene") {
      const currentParent = effectiveParent(entry, book.file.path);
      const parts = book.result.entries.filter((candidate) => candidate.kind === "part");

      for (const part of parts) {
        if (part.path === currentParent) continue;
        actionCount += 1;
        menu.addItem((item) => item
          .setTitle(`Move to ${part.title}`)
          .setIcon("folder-input")
          .onClick(() => void this.handleMove(
            book,
            entry.path,
            part.path,
            "inside-end"
          )));
      }

      if (currentParent !== book.file.path) {
        const roots = book.result.entries.filter((candidate) => (
          candidate.path !== entry.path
          && effectiveParent(candidate, book.file.path) === book.file.path
        ));
        const target = roots[roots.length - 1];
        if (target) {
          actionCount += 1;
          menu.addItem((item) => item
            .setTitle("Move to book level")
            .setIcon("book-open")
            .onClick(() => void this.handleMove(
              book,
              entry.path,
              target.path,
              "after"
            )));
        }
      }

      const parent = currentParent === book.file.path
        ? book.record
        : book.result.entries.find((candidate) => candidate.path === currentParent);
      if (
        !this.operationRunning
        && book.result.source === "distributed"
        && Boolean(entry.orderKey)
        && Boolean(parent && (parent.kind === "book" || parent.kind === "part"))
      ) {
        actionCount += 1;
        menu.addSeparator();
        menu.addItem((item) => item
          .setTitle("Remove from manuscript")
          .setIcon("unlink")
          .onClick(() => new ManuscriptSceneDetachmentModal(
            this.plugin,
            entry.path,
            book.file.path,
            (fallbackPath) => {
              this.revealedContextPath = null;
              this.undoToken = null;
              this.operationMessage = `“${entry.title}” removed from manuscript; its note remains in the vault.`;
              this.revealPath(fallbackPath);
            }
          ).open()));
      }
    }

    if (actionCount === 0) {
      menu.addItem((item) => item.setTitle("No available moves").setDisabled(true));
    }

    const rect = anchor.getBoundingClientRect();
    menu.showAtPosition({ x: rect.right, y: rect.bottom });
  }

  private configureDrag(
    row: HTMLElement,
    entry: ManuscriptDocumentRecord,
    book: ObsidianManuscriptBook
  ) {
    row.draggable = true;
    row.setAttribute("aria-grabbed", "false");

    row.addEventListener("dragstart", (event) => {
      if (this.operationRunning) {
        event.preventDefault();
        return;
      }
      this.draggedPath = entry.path;
      row.setAttribute("aria-grabbed", "true");
      row.style.opacity = "0.55";
      event.dataTransfer?.setData("text/plain", entry.path);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });

    row.addEventListener("dragend", () => {
      row.setAttribute("aria-grabbed", "false");
      row.style.opacity = "";
      this.clearDropIndicator();
      this.draggedPath = null;
    });

    row.addEventListener("dragover", (event) => {
      if (!this.draggedPath || this.draggedPath === entry.path) return;
      const moved = book.result.entries.find((candidate) => (
        candidate.path === this.draggedPath
      ));
      if (!moved) return;

      const rect = row.getBoundingClientRect();
      const ratio = rect.height > 0
        ? (event.clientY - rect.top) / rect.height
        : 0.5;
      const position: ManuscriptDropPosition = entry.kind === "part"
        && moved.kind === "scene"
        && ratio >= 0.3
        && ratio <= 0.7
        ? "inside-end"
        : ratio < 0.5 ? "before" : "after";
      const proposal = proposeManuscriptMove(book.file.path, book.result.entries, {
        movedPath: moved.path,
        targetPath: entry.path,
        position
      });
      if (!proposal.valid) {
        if (this.dropRow === row) this.clearDropIndicator();
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      this.setDropIndicator(row, position);
    });

    row.addEventListener("dragleave", (event) => {
      const related = event.relatedTarget;
      if (related instanceof Node && row.contains(related)) return;
      if (this.dropRow === row) this.clearDropIndicator();
    });

    row.addEventListener("drop", (event) => {
      if (!this.draggedPath || this.dropRow !== row || !this.dropPosition) return;
      event.preventDefault();
      const movedPath = this.draggedPath;
      const position = this.dropPosition;
      this.clearDropIndicator();
      this.draggedPath = null;
      void this.handleMove(book, movedPath, entry.path, position);
    });
  }

  private setDropIndicator(row: HTMLElement, position: ManuscriptDropPosition) {
    if (this.dropRow !== row) this.clearDropIndicator();
    this.dropRow = row;
    this.dropPosition = position;
    row.style.borderTop = position === "before"
      ? "2px solid var(--interactive-accent)"
      : "";
    row.style.borderBottom = position === "after"
      ? "2px solid var(--interactive-accent)"
      : "";
    row.style.outline = position === "inside-end"
      ? "2px solid var(--interactive-accent)"
      : "";
    row.style.outlineOffset = position === "inside-end" ? "-2px" : "";
  }

  private clearDropIndicator() {
    if (this.dropRow) {
      this.dropRow.style.borderTop = "";
      this.dropRow.style.borderBottom = "";
      this.dropRow.style.outline = "";
      this.dropRow.style.outlineOffset = "";
    }
    this.dropRow = null;
    this.dropPosition = null;
  }

  private async handleMove(
    book: ObsidianManuscriptBook,
    movedPath: string,
    targetPath: string,
    position: ManuscriptDropPosition
  ) {
    if (this.operationRunning) return;
    if (book.result.source === "invalid") {
      new Notice("Correct manuscript_order before reordering this book.");
      return;
    }

    const proposal = proposeManuscriptMove(book.file.path, book.result.entries, {
      movedPath,
      targetPath,
      position
    });
    if (!proposal.valid) {
      new Notice(proposal.message);
      return;
    }

    if (book.result.source === "legacy") {
      const ambiguous = book.result.diagnostics.some((diagnostic) => (
        diagnostic.kind === "legacy_ambiguous"
      ));
      if (ambiguous) {
        new Notice("Review the filename-order structure notices before adopting manuscript order.");
        return;
      }
      if (!await confirmOrderAdoption(this.app)) return;
    }

    this.operationRunning = true;
    try {
      const token = await applyManuscriptReorder(
        this.app,
        book.file,
        book.filesByPath,
        proposal
      );
      this.undoToken = token;
      this.operationMessage = token.message;
    } catch (error) {
      this.operationMessage = error instanceof Error
        ? error.message
        : "Could not update manuscript order.";
      new Notice(this.operationMessage);
    } finally {
      this.operationRunning = false;
      this.render();
    }
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

}
