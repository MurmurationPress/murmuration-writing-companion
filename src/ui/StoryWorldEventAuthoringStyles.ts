export const STORY_WORLD_EVENT_AUTHORING_STYLES = `
.mwc-story-world-event-authoring {
  margin-top: 12px;
}

.mwc-story-world-event-offer {
  padding: 9px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 7px;
  background: var(--background-secondary-alt);
}

.mwc-story-world-event-offer-title,
.mwc-story-world-event-offer-source {
  margin: 0;
}

.mwc-story-world-event-offer-title {
  color: var(--text-normal);
  font-size: 0.86em;
  font-weight: 650;
  line-height: 1.4;
}

.mwc-story-world-event-offer-source {
  margin-top: 3px;
  overflow-wrap: anywhere;
  color: var(--text-muted);
  font-size: 0.76em;
  line-height: 1.35;
}

.mwc-story-world-event-offer-actions,
.mwc-event-creation-modal-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}

.mwc-story-world-event-offer-actions button {
  padding: 4px 7px;
  font-size: 0.78em;
}

.mwc-story-world-event-create {
  color: var(--text-on-accent);
  background: var(--interactive-accent);
}

.mwc-event-creation-preview {
  margin: 12px 0;
}

.mwc-event-creation-preview-row {
  display: grid;
  grid-template-columns: minmax(72px, auto) minmax(0, 1fr);
  gap: 10px;
  padding: 3px 0;
}

.mwc-event-creation-preview-row dt {
  color: var(--text-muted);
  font-size: 0.82em;
  font-weight: 650;
}

.mwc-event-creation-preview-row dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.mwc-event-date-choice {
  margin: 12px 0;
  padding: 9px 11px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
}

.mwc-event-date-choice legend {
  padding: 0 4px;
  color: var(--text-muted);
  font-size: 0.82em;
  font-weight: 650;
}

.mwc-event-date-option {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 28px;
}

.mwc-event-date-custom {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.mwc-event-date-custom input[type="date"] {
  max-width: 150px;
}
`;

export function installStoryWorldEventAuthoringStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.dataset.mwcStoryWorldEventAuthoring = "true";
  style.textContent = STORY_WORLD_EVENT_AUTHORING_STYLES;
  document.head.appendChild(style);
  return style;
}
