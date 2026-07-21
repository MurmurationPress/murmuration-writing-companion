export const STORY_WORLD_RELATION_AUTHORING_STYLES = `
.mwc-story-world-relation-authoring { margin-top: 12px; }
.mwc-story-world-relation-offer { padding: 9px 10px; border: 1px solid var(--background-modifier-border); border-radius: 7px; background: var(--background-secondary-alt); }
.mwc-story-world-relation-title,
.mwc-story-world-relation-participants,
.mwc-story-world-relation-source,
.mwc-story-world-relation-preview { margin: 0; }
.mwc-story-world-relation-title { color: var(--text-normal); font-size: 0.86em; font-weight: 650; line-height: 1.4; }
.mwc-story-world-relation-participants { margin-top: 4px; color: var(--text-normal); font-size: 0.82em; font-weight: 600; line-height: 1.35; }
.mwc-story-world-relation-source { margin-top: 3px; overflow-wrap: anywhere; color: var(--text-muted); font-size: 0.76em; line-height: 1.35; }
.mwc-story-world-relation-controls { display: grid; gap: 7px; margin-top: 9px; }
.mwc-story-world-relation-controls label { display: grid; grid-template-columns: minmax(92px, auto) minmax(0, 1fr); align-items: center; gap: 8px; color: var(--text-muted); font-size: 0.78em; font-weight: 600; }
.mwc-story-world-relation-controls select,
.mwc-story-world-relation-controls input { min-width: 0; width: 100%; font-size: 1em; font-weight: 400; }
.mwc-story-world-relation-preview { margin-top: 9px; padding: 6px 8px; border-left: 3px solid var(--interactive-accent); background: var(--background-primary-alt); color: var(--text-normal); font-size: 0.8em; line-height: 1.4; }
.mwc-story-world-relation-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; margin-top: 8px; }
.mwc-story-world-relation-actions button { padding: 4px 7px; font-size: 0.78em; }
.mwc-story-world-relation-record { color: var(--text-on-accent); background: var(--interactive-accent); }

.mwc-entity-relationships-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mwc-entity-relationships-heading h3 { margin: 0; }
.mwc-entity-relationships-empty { margin: 6px 0 0; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-entity-relationship { margin-top: 6px; padding: 7px 0 8px 9px; border: 0; border-left: 2px solid var(--background-modifier-border); background: transparent; }
.mwc-entity-relationship:hover,
.mwc-entity-relationship:focus-within { border-left-color: var(--text-muted); }
.mwc-entity-relationship-invalid { border-left-style: dashed; border-left-color: var(--text-warning); }
.mwc-entity-relationship-sentence { display: inline; margin: 0; color: var(--text-normal); font-size: var(--font-ui-small); line-height: 1.5; }
.mwc-entity-relationship-link { display: inline; margin: 0; padding: 0; border: 0; background: transparent; color: var(--link-color); text-decoration: underline; cursor: pointer; }
.mwc-entity-relationship-status { margin-left: 6px; padding: 1px 5px; border-radius: 999px; background: var(--background-secondary-alt); color: var(--text-muted); font-size: var(--font-ui-smaller); white-space: nowrap; }
.mwc-entity-relationship-warning { margin: 6px 0 0; color: var(--text-muted); font-size: var(--font-ui-smaller); font-style: italic; }
.mwc-entity-relationship-details { margin-top: 6px; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-entity-relationship-details dl { margin: 6px 0 0; }
.mwc-entity-relationship-actions { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 2px; margin-top: 5px; opacity: .65; }
.mwc-entity-relationship:hover .mwc-entity-relationship-actions,
.mwc-entity-relationship:focus-within .mwc-entity-relationship-actions { opacity: 1; }
.mwc-entity-relationship-editor:not(:empty) { margin-top: 8px; }
.mwc-entity-relationship-form { padding: 10px; border: 1px solid var(--background-modifier-border); border-radius: var(--radius-s); background: var(--background-secondary-alt); }
.mwc-entity-relationship-form h4 { margin: 0 0 7px; }
.mwc-entity-relationship-controls { display: grid; gap: 7px; }
.mwc-entity-relationship-controls label { display: grid; grid-template-columns: minmax(90px, auto) minmax(0, 1fr); align-items: center; gap: 7px; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-entity-relationship-controls input,
.mwc-entity-relationship-controls select { min-width: 0; width: 100%; }
.mwc-entity-relationship-target-error { grid-column: 1 / -1; margin: 0; color: var(--text-warning); font-size: var(--font-ui-smaller); }
.mwc-entity-relationship-date { display: grid; gap: 4px; }
.mwc-entity-relationship-date button { justify-self: start; }
.mwc-entity-relationship-preserved-date { color: var(--text-muted); overflow-wrap: anywhere; }
.mwc-entity-relationship-advanced { margin: 8px 0; }
.mwc-entity-relationship-preview { margin: 8px 0; padding: 7px 9px; border-left: 2px solid var(--interactive-accent); background: var(--background-primary-alt); line-height: 1.5; }
.mwc-entity-relationship-form > button { margin-right: 6px; }

.mwc-event-time-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mwc-event-time-heading h3 { margin: 0; }
.mwc-event-time-muted,
.mwc-event-time-precision { color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-event-time-editor:not(:empty) { margin-top: 8px; }
.mwc-event-time-form,
.mwc-event-time-preserved { padding: 10px; border: 1px solid var(--background-modifier-border); border-radius: var(--radius-s); background: var(--background-secondary-alt); }
.mwc-event-time-form h4 { margin: 0 0 7px; }
.mwc-event-time-controls { display: grid; gap: 7px; }
.mwc-event-time-controls label { display: grid; grid-template-columns: minmax(70px, auto) minmax(0, 1fr); align-items: center; gap: 7px; }
.mwc-event-time-endpoint { display: grid; grid-template-columns: minmax(70px, auto) minmax(0, 1fr); align-items: center; gap: 7px; }
.mwc-event-time-endpoint input { grid-column: 2; min-width: 0; width: 100%; }
.mwc-event-time-error { color: var(--text-warning); font-size: var(--font-ui-smaller); }
.mwc-event-time-preview { margin: 8px 0; padding: 7px 9px; border-left: 2px solid var(--interactive-accent); background: var(--background-primary-alt); line-height: 1.5; }
.mwc-event-time-form > button,
.mwc-event-time-preserved > button { margin-right: 6px; }

@media (max-width: 320px) {
  .mwc-entity-relationship-controls label,
  .mwc-event-time-controls label,
  .mwc-event-time-endpoint { grid-template-columns: minmax(0, 1fr); align-items: stretch; }
  .mwc-event-time-endpoint input { grid-column: 1; }
}
`;

export function installStoryWorldRelationAuthoringStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.dataset.mwcStoryWorldRelationAuthoring = "true";
  style.textContent = STORY_WORLD_RELATION_AUTHORING_STYLES;
  document.head.appendChild(style);
  return style;
}
