export const STORY_WORLD_BUILDER_STYLES = `
.mwc-story-world-navigator-heading,
.mwc-story-world-group-title,
.mwc-story-world-item-primary,
.mwc-story-world-inspector-heading {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
}

.mwc-story-world-group-title {
  justify-content: space-between;
}

.mwc-story-world-group-count,
.mwc-story-world-navigator-count,
.mwc-story-world-item-status,
.mwc-story-world-inspector-status {
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
}

.mwc-story-world-item-button {
  display: block;
  width: 100%;
  padding: 0.35rem 0.45rem;
  border: 0;
  background: transparent;
  text-align: left;
}

.mwc-story-world-item-name {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-normal);
  font-weight: 600;
}

.mwc-story-world-item-details {
  margin-top: 0.12rem;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
}

.mwc-story-world-inspector-identity {
  padding-bottom: 0.75rem;
}

.mwc-story-world-inspector-heading {
  flex-wrap: wrap;
}

.mwc-story-world-inspector-kind {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
}

.mwc-story-world-inspector-section {
  margin-top: 0.75rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--background-modifier-border);
}

.mwc-story-world-inspector-section h3 {
  margin: 0 0 0.35rem;
  font-size: var(--font-ui-small);
}

.mwc-story-world-inspector-values {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.mwc-story-world-inspector-value {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  padding: 0.18rem 0.38rem;
  border-radius: var(--radius-s);
  background: var(--background-secondary);
}

.mwc-story-world-inspector-prose {
  margin: 0;
  line-height: 1.45;
}
`;

export function installStoryWorldBuilderStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.dataset.mwcStoryWorldBuilder = "true";
  style.textContent = STORY_WORLD_BUILDER_STYLES;
  document.head.appendChild(style);
  return style;
}
