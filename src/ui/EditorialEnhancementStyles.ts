export const EDITORIAL_ENHANCEMENT_STYLES = `
.mwc-book-review {
  margin-top: 12px;
}

.mwc-book-continuity-indicator {
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  min-width: 0;
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mwc-book-continuity-indicator::before {
  width: 0.45em;
  height: 0.45em;
  flex: 0 0 auto;
  margin-inline-end: 0.4em;
  border-radius: 50%;
  background: var(--text-accent);
  content: "";
  opacity: 0.7;
}

.mwc-book-continuity-indicator--reviewed::before {
  display: none;
}

.mwc-continuity-disposition {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.55rem;
  padding-top: 0.45rem;
  border-top: 1px solid var(--background-modifier-border);
}

.mwc-continuity-disposition-status,
.mwc-continuity-prior-decision,
.mwc-continuity-disposition-note {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
}

.mwc-continuity-part-context {
  margin: 0.4rem 0 0;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
}

.mwc-continuity-disposition-status--stale {
  color: var(--text-warning);
  font-weight: var(--font-semibold);
}

.mwc-continuity-disposition-note {
  padding-inline-start: 0.55rem;
  border-inline-start: 2px solid var(--background-modifier-border);
  white-space: pre-wrap;
}

.mwc-continuity-disposition-actions,
.mwc-continuity-note-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.mwc-continuity-disposition-more {
  position: relative;
}

.mwc-continuity-disposition-more > summary {
  cursor: pointer;
  font-size: var(--font-ui-small);
}

.mwc-continuity-disposition-menu {
  display: grid;
  gap: 0.25rem;
  margin-top: 0.3rem;
  padding: 0.35rem;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-s);
  background: var(--background-primary);
}

.mwc-continuity-disposition-menu button,
.mwc-continuity-disposition-actions > button,
.mwc-continuity-reviewed > button,
.mwc-continuity-note-actions button {
  min-height: 1.8rem;
  height: auto;
  white-space: normal;
}

.mwc-continuity-note-editor textarea {
  width: 100%;
  resize: vertical;
}

.mwc-continuity-reviewed {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.55rem;
}

.mwc-continuity-reviewed-list {
  display: grid;
  gap: 0.5rem;
}

.mwc-continuity-reviewed-list[hidden] {
  display: none;
}

.mwc-book-review-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 7px;
  color: var(--text-muted);
  font-size: 0.82em;
}

.mwc-book-review-title-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}

.mwc-book-review-continuity-link {
  color: var(--text-accent);
}

.mwc-book-review-link,
.mwc-pov-edit,
.mwc-projection-repair {
  padding: 2px 5px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  cursor: pointer;
  box-shadow: none;
}

.mwc-book-review-link:hover,
.mwc-book-review-link:focus-visible,
.mwc-pov-edit:hover,
.mwc-pov-edit:focus-visible,
.mwc-projection-repair:hover,
.mwc-projection-repair:focus-visible {
  color: var(--text-normal);
  background: var(--background-modifier-hover);
}

.mwc-pov-display {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  min-height: 25px;
  padding: 1px 2px 1px 6px;
  border: 1px solid transparent;
  border-radius: 5px;
}

.mwc-pov-display:hover,
.mwc-pov-display:focus-within {
  border-color: var(--background-modifier-border);
  background: var(--background-primary);
}

.mwc-pov-value {
  min-width: 0;
  cursor: text;
}

.mwc-pov-value > :first-child {
  margin-top: 0;
}

.mwc-pov-value > :last-child {
  margin-bottom: 0;
}

.mwc-pov-placeholder,
.mwc-context-static--empty {
  color: var(--text-faint);
}

.mwc-context-static {
  min-height: 25px;
  padding: 3px 6px;
}

.mwc-context-projection-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 0.78em;
}

.mwc-editorial-active-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin-bottom: 7px;
  padding: 7px 9px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary);
  color: var(--text-normal);
  text-align: left;
  cursor: pointer;
}

.mwc-editorial-active-action:hover,
.mwc-editorial-active-action:focus-visible {
  border-color: var(--interactive-accent);
  background: var(--background-modifier-hover);
}

.mwc-editorial-active-action--reached {
  color: var(--text-muted);
}

.mwc-editorial-pass-item--frontier {
  box-shadow: inset 3px 0 0 var(--interactive-accent);
}

.mwc-editorial-pass-item--inferred .mwc-editorial-pass-label {
  color: var(--text-muted);
}

.mwc-editorial-pass-inferred {
  color: var(--text-faint);
  font-size: 0.72em;
  white-space: nowrap;
}

.mwc-world-context-group {
  margin-top: 12px;
}

.mwc-world-context-group:first-child {
  margin-top: 0;
}

.mwc-world-context-group-title {
  margin: 0 0 6px;
  color: var(--text-muted);
  font-size: 0.74em;
  font-weight: 700;
  letter-spacing: 0.045em;
  text-transform: uppercase;
}

.mwc-world-context-metadata {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.mwc-world-context-type {
  color: var(--text-muted);
}

.mwc-world-context-time {
  display: block;
  margin-top: 3px;
  color: var(--text-normal);
  font-size: 0.84em;
  font-variant-numeric: tabular-nums;
  line-height: 1.35;
}

.mwc-world-context-relative-time {
  margin-top: 2px;
  color: var(--text-accent);
  font-size: 0.8em;
  font-weight: 600;
  line-height: 1.35;
}

.mwc-world-context-status {
  color: var(--text-faint);
  font-size: 0.82em;
  font-weight: 500;
}

.mwc-world-context-event-link {
  display: inline-block;
  color: var(--link-color);
  font-weight: 650;
  text-decoration: none;
}

.mwc-world-context-event-link:hover,
.mwc-world-context-event-link:focus-visible {
  color: var(--link-color-hover);
  text-decoration: underline;
}

.mwc-world-context-summary {
  margin: 4px 0 0;
  color: var(--text-muted);
  line-height: 1.4;
}

.mwc-world-context-supporting-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 0;
}

.mwc-world-context-supporting-item {
  min-width: 0;
  color: var(--text-normal);
}

.mwc-world-context-supporting-item--provisional {
  color: var(--text-warning);
}

.mwc-world-context-supporting-item--unresolved {
  color: var(--text-accent);
}

.mwc-world-context-supporting-link {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 26px;
  box-sizing: border-box;
  padding: 3px 8px;
  overflow: hidden;
  border: 1px solid var(--background-modifier-border);
  border-radius: 999px;
  background: var(--background-primary-alt);
  color: inherit;
  font-size: 0.86em;
  line-height: 1.25;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mwc-world-context-supporting-link:hover,
.mwc-world-context-supporting-link:focus-visible {
  border-color: var(--interactive-accent);
  background: var(--background-modifier-hover);
  color: var(--text-normal);
  outline: none;
}

.mwc-world-context-supporting-link:focus-visible {
  box-shadow: 0 0 0 1px var(--interactive-accent);
}

.mwc-world-context-unresolved {
  margin-top: 10px;
  font-size: 0.82em;
}

.mwc-manuscript-tree {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mwc-manuscript-tooltip {
  position: absolute;
  z-index: var(--layer-popover, 1000);
  top: calc(100% - 2px);
  left: min(28px, calc(var(--mwc-manuscript-depth, 0) * 14px + 8px));
  display: block;
  visibility: hidden;
  width: min(250px, calc(100% - 16px));
  padding: 9px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary);
  box-shadow: var(--shadow-s);
  color: var(--text-normal);
  font-size: 0.82em;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-2px);
  transition:
    opacity 70ms ease 0s,
    transform 70ms ease 0s,
    visibility 0s linear 70ms;
}

.mwc-manuscript-entry:hover ~ .mwc-manuscript-tooltip {
  visibility: visible;
  opacity: 1;
  transform: translateY(0);
  transition-delay: 1.2s, 1.2s, 1.2s;
}

.mwc-manuscript-entry:focus-visible ~ .mwc-manuscript-tooltip {
  visibility: visible;
  opacity: 1;
  transform: translateY(0);
  transition-delay: 0s;
}

.mwc-manuscript-tooltip-title {
  margin-bottom: 6px;
  font-weight: 650;
}

.mwc-manuscript-tooltip dl {
  margin: 0;
}

.mwc-manuscript-tooltip-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 7px;
  margin-top: 3px;
}

.mwc-manuscript-tooltip-row dt {
  color: var(--text-muted);
}

.mwc-manuscript-tooltip-row dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.mwc-visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  clip-path: inset(50%) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

.mwc-manuscript-diagnostics {
  margin: 12px 4px 0;
  color: var(--text-muted);
  font-size: 0.78em;
}

.mwc-manuscript-diagnostics summary {
  cursor: pointer;
}

.mwc-manuscript-diagnostics ul {
  margin: 7px 0 0 18px;
  padding: 0;
}

.mwc-annotation-locator-active .cm-selectionBackground,
.mwc-annotation-locator-active .cm-selectionLayer .cm-selectionBackground {
  background: var(--text-highlight-bg) !important;
  outline: 1px solid var(--interactive-accent);
}
`;

export interface EditorialEnhancementInstallation {
  remove(): void;
}

let nextAccessibleLabelId = 0;

function suppressNavigatorMoveTooltips(root: ParentNode) {
  const selector = '.mwc-manuscript-navigator button[aria-label^="Move "]';
  const buttons: HTMLButtonElement[] = [];

  if (root instanceof HTMLButtonElement && root.matches(selector)) {
    buttons.push(root);
  }
  for (const button of Array.from(
    root.querySelectorAll<HTMLButtonElement>(selector)
  )) {
    buttons.push(button);
  }

  for (const button of buttons) {
    const label = button.getAttribute("aria-label");
    if (!label || button.dataset.mwcAccessibleLabel === "true") continue;

    const hidden = document.createElement("span");
    hidden.id = `mwc-accessible-label-${++nextAccessibleLabelId}`;
    hidden.className = "mwc-visually-hidden";
    hidden.textContent = label;
    button.appendChild(hidden);
    button.removeAttribute("aria-label");
    button.setAttribute("aria-labelledby", hidden.id);
    button.dataset.mwcAccessibleLabel = "true";
  }
}

export function installEditorialEnhancementStyles(): EditorialEnhancementInstallation {
  const style = document.createElement("style");
  style.dataset.mwcEditorialEnhancements = "true";
  style.textContent = EDITORIAL_ENHANCEMENT_STYLES;
  document.head.appendChild(style);

  suppressNavigatorMoveTooltips(document);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof Element) suppressNavigatorMoveTooltips(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return {
    remove() {
      observer.disconnect();
      style.remove();
    }
  };
}
