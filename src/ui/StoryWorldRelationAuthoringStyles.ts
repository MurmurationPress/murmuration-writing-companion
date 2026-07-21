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

.mwc-story-world-navigator-heading,
.mwc-story-world-group-title,
.mwc-story-world-item-primary,
.mwc-story-world-inspector-heading { display: flex; align-items: baseline; gap: 0.45rem; }
.mwc-story-world-group-title { justify-content: space-between; }
.mwc-story-world-group-count,
.mwc-story-world-navigator-count,
.mwc-story-world-item-status,
.mwc-story-world-inspector-status { color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-story-world-item-button { display: block; width: 100%; padding: 0.35rem 0.45rem; border: 0; background: transparent; text-align: left; }
.mwc-story-world-item-name { min-width: 0; overflow-wrap: anywhere; color: var(--text-normal); font-weight: 600; }
.mwc-story-world-item-details { margin-top: 0.12rem; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-story-world-inspector-heading { flex-wrap: wrap; }
.mwc-story-world-inspector-kind,
.mwc-story-world-inspector-note { margin: 0.2rem 0 0; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-story-world-inspector-section { margin-top: 0.75rem; padding-top: 0.65rem; border-top: 1px solid var(--background-modifier-border); }
.mwc-story-world-inspector-section h3 { margin: 0 0 0.35rem; font-size: var(--font-ui-small); }
.mwc-story-world-inspector-values { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.mwc-story-world-inspector-value { min-width: 0; max-width: 100%; overflow-wrap: anywhere; padding: 0.18rem 0.38rem; border-radius: var(--radius-s); background: var(--background-secondary); }
.mwc-story-world-inspector-prose { margin: 0; line-height: 1.45; }
`;

export function installStoryWorldRelationAuthoringStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.dataset.mwcStoryWorldRelationAuthoring = "true";
  style.textContent = STORY_WORLD_RELATION_AUTHORING_STYLES;
  document.head.appendChild(style);
  return style;
}
