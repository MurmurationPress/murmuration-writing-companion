export const EDITORIAL_ENHANCEMENT_STYLES = `
.mwc-book-review {
  margin-top: 12px;
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
  color: var(--text-normal);
  font-size: 0.92em;
  font-variant-numeric: tabular-nums;
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

.mwc-annotation-locator-active .cm-selectionBackground,
.mwc-annotation-locator-active .cm-selectionLayer .cm-selectionBackground {
  background: var(--text-highlight-bg) !important;
  outline: 1px solid var(--interactive-accent);
}
`;

export function installEditorialEnhancementStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.dataset.mwcEditorialEnhancements = "true";
  style.textContent = EDITORIAL_ENHANCEMENT_STYLES;
  document.head.appendChild(style);
  return style;
}
