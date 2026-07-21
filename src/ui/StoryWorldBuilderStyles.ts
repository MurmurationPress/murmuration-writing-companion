export const STORY_WORLD_BUILDER_STYLES = `
.mwc-story-world-navigator-actions,
.mwc-story-world-inspector-heading { display: flex; align-items: baseline; gap: var(--mwc-space-2, 8px); }
.mwc-story-world-navigator-actions { align-items: center; }
.mwc-story-world-navigator-actions .clickable-icon { width: 28px; height: 28px; color: var(--text-muted); }
.mwc-story-world-navigator-actions .clickable-icon:hover,
.mwc-story-world-navigator-actions .clickable-icon:focus-visible { color: var(--text-normal); }

.mwc-story-world-group-count,
.mwc-story-world-navigator-count,
.mwc-story-world-item-status,
.mwc-story-world-inspector-status {
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
}

.mwc-story-world-search { width: 100%; margin-bottom: var(--mwc-space-3, 12px); }
.mwc-story-world-group { margin-top: var(--mwc-space-4, 18px); }
.mwc-story-world-group:first-of-type { margin-top: var(--mwc-space-3, 12px); }
.mwc-story-world-group-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--mwc-space-2, 8px);
  margin: 0 4px var(--mwc-space-1, 4px);
  color: var(--text-muted);
  font-size: var(--font-ui-small);
  font-weight: 650;
}
.mwc-story-world-list { margin: 0; padding: 0; list-style: none; }
.mwc-story-world-item { min-width: 0; margin: 0; }
.mwc-story-world-item-button {
  appearance: none;
  display: block;
  width: 100%;
  min-height: 32px;
  padding: var(--mwc-space-1, 4px) 7px 5px;
  border: 0;
  border-radius: var(--radius-s);
  background: transparent;
  box-shadow: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.mwc-story-world-item-button:hover { background: var(--background-modifier-hover); }
.mwc-story-world-item--active .mwc-story-world-item-button {
  background: var(--background-modifier-active-hover);
  box-shadow: inset 2px 0 0 var(--interactive-accent);
}
.mwc-story-world-item-primary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 4px 8px;
  min-width: 0;
}

.mwc-story-world-item-name {
  min-width: 0;
  color: var(--text-normal);
  font-weight: 620;
  line-height: 1.35;
  overflow-wrap: anywhere;
  white-space: normal;
}
.mwc-story-world-item-status {
  --mwc-status-color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--mwc-status-color);
  font-weight: 450;
  line-height: 1.3;
  white-space: nowrap;
}
.mwc-story-world-item-status-dot {
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  border: 1px solid currentColor;
  border-radius: 50%;
  background: color-mix(in srgb, currentColor 48%, transparent);
}
.mwc-story-world-item-status--confirmed { --mwc-status-color: var(--text-faint); }
.mwc-story-world-item-status--planned { --mwc-status-color: var(--text-accent); }
.mwc-story-world-item-status--candidate { --mwc-status-color: var(--text-muted); }
.mwc-story-world-item-status--unresolved { --mwc-status-color: var(--text-warning); }
.mwc-story-world-item-status--superseded { --mwc-status-color: var(--text-faint); }
.mwc-story-world-item-status--superseded .mwc-story-world-item-status-label { text-decoration: line-through; }

.mwc-story-world-item-details {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
  min-width: 0;
  margin-top: var(--mwc-space-1, 4px);
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}
.mwc-story-world-item-type,
.mwc-story-world-item-time {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mwc-story-world-empty { margin: var(--mwc-space-4, 18px) 4px; color: var(--text-muted); }
.mwc-story-world-inspector > h2 { margin: 8px 0 12px; font-size: var(--font-ui-large); }
.mwc-story-world-inspector-identity { margin-top: 0; padding: 0 0 var(--mwc-space-3, 12px); border-bottom: 1px solid var(--background-modifier-border); }

.mwc-story-world-inspector-heading {
  flex-wrap: wrap;
}
.mwc-story-world-inspector-heading h3 { margin: 0; border: 0; padding: 0; color: var(--text-normal); font-size: var(--font-ui-medium); font-weight: 700; }
.mwc-story-world-inspector-status { padding: 1px 5px; border-radius: 999px; background: var(--background-secondary-alt); }

.mwc-story-world-inspector-kind {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  text-transform: lowercase;
}

.mwc-story-world-inspector-section {
  margin-top: var(--mwc-space-3, 12px);
  padding-top: var(--mwc-space-3, 12px);
  border-top: 1px solid var(--background-modifier-border);
}
.mwc-story-world-inspector-identity + .mwc-story-world-inspector-section { border-top: 0; padding-top: 0; }

.mwc-story-world-inspector-section h3 {
  margin: 0 0 6px;
  border: 0;
  padding: 0;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  font-weight: 650;
}

.mwc-story-world-inspector-values {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.mwc-story-world-inspector-value {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  padding: 1px 0;
  color: var(--text-muted);
}
.mwc-story-world-inspector-value a { color: var(--link-color); text-decoration: none; }
.mwc-story-world-inspector-value a:hover,
.mwc-story-world-inspector-value a:focus-visible { color: var(--link-color-hover); text-decoration: underline; }

.mwc-story-world-inspector-prose {
  margin: 0;
  color: var(--text-normal);
  line-height: 1.5;
}

@media (max-width: 300px) {
  .mwc-story-world-item-primary { gap: 1px 5px; }
  .mwc-story-world-item-status:not(.is-default) { grid-row: 2; grid-column: 1 / -1; }
}
`;

export function installStoryWorldBuilderStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.dataset.mwcStoryWorldBuilder = "true";
  style.textContent = STORY_WORLD_BUILDER_STYLES;
  document.head.appendChild(style);
  return style;
}
