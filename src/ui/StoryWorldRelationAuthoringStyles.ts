export const STORY_WORLD_RELATION_AUTHORING_STYLES = `
.mwc-story-world-relation-authoring {
  margin-top: 12px;
}

.mwc-story-world-relation-offer {
  padding: 9px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 7px;
  background: var(--background-secondary-alt);
}

.mwc-story-world-relation-title,
.mwc-story-world-relation-participants,
.mwc-story-world-relation-source,
.mwc-story-world-relation-preview {
  margin: 0;
}

.mwc-story-world-relation-title {
  color: var(--text-normal);
  font-size: 0.86em;
  font-weight: 650;
  line-height: 1.4;
}

.mwc-story-world-relation-participants {
  margin-top: 4px;
  color: var(--text-normal);
  font-size: 0.82em;
  font-weight: 600;
  line-height: 1.35;
}

.mwc-story-world-relation-source {
  margin-top: 3px;
  overflow-wrap: anywhere;
  color: var(--text-muted);
  font-size: 0.76em;
  line-height: 1.35;
}

.mwc-story-world-relation-controls {
  display: grid;
  gap: 7px;
  margin-top: 9px;
}

.mwc-story-world-relation-controls label {
  display: grid;
  grid-template-columns: minmax(92px, auto) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 0.78em;
  font-weight: 600;
}

.mwc-story-world-relation-controls select,
.mwc-story-world-relation-controls input {
  min-width: 0;
  width: 100%;
  font-size: 1em;
  font-weight: 400;
}

.mwc-story-world-relation-preview {
  margin-top: 9px;
  padding: 6px 8px;
  border-left: 3px solid var(--interactive-accent);
  background: var(--background-primary-alt);
  color: var(--text-normal);
  font-size: 0.8em;
  line-height: 1.4;
}

.mwc-story-world-relation-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}

.mwc-story-world-relation-actions button {
  padding: 4px 7px;
  font-size: 0.78em;
}

.mwc-story-world-relation-record {
  color: var(--text-on-accent);
  background: var(--interactive-accent);
}
`;

export function installStoryWorldRelationAuthoringStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.dataset.mwcStoryWorldRelationAuthoring = "true";
  style.textContent = STORY_WORLD_RELATION_AUTHORING_STYLES;
  document.head.appendChild(style);
  return style;
}
