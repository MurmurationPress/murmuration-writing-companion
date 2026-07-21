export const STORY_WORLD_TIMELINE_STYLES = `
.mwc-story-world-timeline { box-sizing: border-box; width: 100%; max-width: none; padding: 18px 24px; overflow: auto; }
.mwc-timeline-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.mwc-timeline-heading h2, .mwc-timeline-heading p { margin: 0; }
.mwc-timeline-heading p, .mwc-timeline-empty { color: var(--text-muted); }
.mwc-timeline-filters { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
.mwc-timeline-filters label { display: grid; gap: 3px; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-timeline-section { width: 100%; min-width: 0; margin-top: 22px; }
.mwc-timeline-section h3 { margin-bottom: 10px; }
.mwc-timeline-axis { position: relative; display: grid; width: 100%; min-width: 0; gap: 12px; }
.mwc-timeline-axis::before { content: ""; position: absolute; top: 0; bottom: 0; left: 8px; width: 2px; background: var(--background-modifier-border); }
.mwc-timeline-event { position: relative; display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px; width: 100%; min-width: 0; }
.mwc-timeline-marker { z-index: 1; grid-column: 1; align-self: start; box-sizing: border-box; width: 14px; height: 14px; margin: 12px 0 0 2px; border: 2px solid var(--interactive-accent); border-radius: 50%; background: var(--background-primary); }
.mwc-timeline-ranges .mwc-timeline-marker { height: 34px; border-radius: 8px; }
.mwc-timeline-unsupported .mwc-timeline-marker { border-style: dashed; border-color: var(--color-orange); }
.mwc-timeline-undated .mwc-timeline-marker { border-color: var(--text-muted); background: var(--background-secondary); }
.mwc-timeline-event-content { grid-column: 2; box-sizing: border-box; width: 100%; min-width: min(28rem, 100%); padding: 10px 12px; border: 1px solid var(--background-modifier-border); border-radius: var(--radius-m); background: var(--background-secondary); }
.mwc-timeline-event[data-precision="year"] .mwc-timeline-event-content,
.mwc-timeline-event[data-precision="month"] .mwc-timeline-event-content { border-left: 4px solid var(--color-blue); }
.mwc-timeline-event-name { display: block; width: 100%; padding: 0; border: 0; background: transparent; color: var(--text-normal); font-size: var(--font-ui-medium); font-weight: 700; line-height: 1.35; text-align: left; white-space: normal; }
.mwc-timeline-time { margin: 5px 0 0; line-height: 1.4; white-space: nowrap; }
.mwc-timeline-meta { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 5px; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-timeline-meta-field { min-width: max-content; max-width: 100%; overflow-wrap: normal; word-break: normal; }
.mwc-timeline-scopes { display: inline-flex; flex-wrap: wrap; gap: 4px; min-width: 0; }
.mwc-timeline-scope-link { padding: 0 4px; font: inherit; }
.mwc-timeline-scope-unresolved { color: var(--text-warning); }
.mwc-timeline-interval { margin: 5px 0 0; color: var(--text-muted); font-size: var(--font-ui-smaller); line-height: 1.4; }
.mwc-timeline-sources { display: flex; flex-wrap: wrap; gap: 5px; align-items: baseline; margin-top: 7px; font-size: var(--font-ui-smaller); }
.mwc-timeline-sources button { padding: 2px 5px; }
.mwc-timeline-source-unresolved { color: var(--text-warning); }
.mwc-timeline-edit { margin-top: 8px; }
@media (max-width: 520px) {
  .mwc-story-world-timeline { padding: 14px 12px; }
  .mwc-timeline-heading { align-items: flex-start; flex-direction: column; }
  .mwc-timeline-filters { gap: 7px; }
  .mwc-timeline-filters label { flex: 1 1 9rem; }
  .mwc-timeline-event { grid-template-columns: 16px minmax(0, 1fr); gap: 7px; }
  .mwc-timeline-axis::before { left: 7px; }
  .mwc-timeline-marker { margin-left: 1px; }
  .mwc-timeline-time { white-space: normal; }
}
`;
export function installStoryWorldTimelineStyles(): HTMLStyleElement { const style = document.createElement("style"); style.textContent = STORY_WORLD_TIMELINE_STYLES; document.head.appendChild(style); return style; }
