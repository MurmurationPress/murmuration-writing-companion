import {
  SidebarSectionKey,
  SidebarSectionPreferences
} from "../companion/SidebarSections";

export interface CollapsibleSectionOptions {
  summary?: string;
  status?: string;
  renderContent?: (content: HTMLDivElement) => void;
  renderContentOnEachExpansion?: boolean;
}

export interface CollapsibleSectionElements {
  section: HTMLDivElement;
  content: HTMLDivElement;
  setSummary(summary: string): void;
  setStatus(status: string): void;
}

let nextCollapsibleSectionId = 0;

export function createDeferredSectionRenderer(
  content: HTMLDivElement,
  renderContent: (content: HTMLDivElement) => void,
  renderOnEachExpansion = false
): () => void {
  let rendered = false;
  return () => {
    if (rendered && !renderOnEachExpansion) return;
    if (rendered) content.empty();
    renderContent(content);
    rendered = true;
  };
}

/**
 * Creates the standard MWC disclosure and binds it to the existing per-vault
 * sidebar preference store. Optional content rendering occurs only on the
 * first expansion of this particular DOM instance.
 */
export function createPersistedCollapsibleSection(
  container: Element,
  preferences: SidebarSectionPreferences,
  key: SidebarSectionKey,
  title: string,
  options: CollapsibleSectionOptions = {}
): CollapsibleSectionElements {
  const section = container.createDiv(
    `mwc-section mwc-collapsible-section mwc-collapsible-section--${key}`
  );
  const contentId = `mwc-collapsible-section-${++nextCollapsibleSectionId}-${key}`;
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

  let expanded = preferences.isExpanded(key);
  let currentSummary = options.summary?.trim() ?? "";
  let currentStatus = options.status?.trim() ?? "";
  const ensureContent = options.renderContent
    ? createDeferredSectionRenderer(
      content,
      options.renderContent,
      options.renderContentOnEachExpansion
    )
    : () => undefined;

  const applyState = () => {
    if (expanded) ensureContent();
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
    preferences.setExpanded(key, expanded);
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
