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

.mwc-manuscript-navigator {
  position: relative;
  padding: 10px 8px 18px;
  overflow: auto;
}

.mwc-manuscript-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 4px 10px;
}

.mwc-manuscript-heading h2 {
  margin: 0;
  font-size: 1.05em;
}

.mwc-manuscript-book-title {
  min-width: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.78em;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mwc-manuscript-book-selector {
  min-width: 0;
  max-width: 66%;
  height: 28px;
  font-size: 0.82em;
}

.mwc-manuscript-notice {
  margin: 0 4px 9px;
  padding: 6px 8px;
  border-radius: 5px;
  background: var(--background-secondary-alt);
  color: var(--text-muted);
  font-size: 0.76em;
  line-height: 1.35;
}

.mwc-manuscript-notice--warning {
  color: var(--text-warning);
}

.mwc-manuscript-tree {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mwc-manuscript-node {
  min-width: 0;
}

.mwc-manuscript-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  min-height: 29px;
  padding-left: calc(var(--mwc-manuscript-depth, 0) * 14px);
  border-radius: 5px;
}

.mwc-manuscript-row--part {
  grid-template-columns: 22px minmax(0, 1fr);
  margin-top: 4px;
}

.mwc-manuscript-row:hover,
.mwc-manuscript-row:focus-within {
  background: var(--background-modifier-hover);
}

.mwc-manuscript-row--active {
  background: var(--background-modifier-active-hover);
  box-shadow: inset 3px 0 0 var(--interactive-accent);
}

.mwc-manuscript-disclosure,
.mwc-manuscript-entry {
  min-width: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--text-normal);
  font: inherit;
  cursor: pointer;
}

.mwc-manuscript-disclosure {
  width: 22px;
  height: 26px;
  padding: 0;
  color: var(--text-muted);
  font-size: 1.05em;
  line-height: 1;
}

.mwc-manuscript-entry {
  width: 100%;
  padding: 4px 7px;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mwc-manuscript-row--part .mwc-manuscript-entry {
  font-size: 0.78em;
  font-weight: 700;
  letter-spacing: 0.035em;
  text-transform: uppercase;
}

.mwc-manuscript-entry:focus-visible,
.mwc-manuscript-disclosure:focus-visible {
  outline: 1px solid var(--interactive-accent);
  outline-offset: -1px;
}

.mwc-manuscript-tooltip {
  position: absolute;
  z-index: var(--layer-popover, 1000);
  top: calc(100% - 2px);
  left: min(28px, calc(var(--mwc-manuscript-depth, 0) * 14px + 8px));
  display: none;
  width: min(250px, calc(100% - 16px));
  padding: 9px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary);
  box-shadow: var(--shadow-s);
  color: var(--text-normal);
  font-size: 0.82em;
}

.mwc-manuscript-row:hover .mwc-manuscript-tooltip,
.mwc-manuscript-row:focus-within .mwc-manuscript-tooltip {
  display: block;
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

export function installEditorialEnhancementStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.dataset.mwcEditorialEnhancements = "true";
  style.textContent = EDITORIAL_ENHANCEMENT_STYLES;
  document.head.appendChild(style);
  return style;
}
