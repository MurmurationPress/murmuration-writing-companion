export const STORY_WORLD_TIMELINE_STYLES = `
.mwc-story-world-timeline { padding: 18px 24px; overflow: auto; }
.mwc-timeline-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.mwc-timeline-heading h2, .mwc-timeline-heading p { margin: 0; }
.mwc-timeline-heading p, .mwc-timeline-empty { color: var(--text-muted); }
.mwc-timeline-filters { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
.mwc-timeline-filters label { display: grid; gap: 3px; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-timeline-section { margin-top: 22px; }
.mwc-timeline-section h3 { margin-bottom: 10px; }
.mwc-timeline-axis { position: relative; display: grid; gap: 12px; margin-left: 8px; padding-left: 26px; }
.mwc-timeline-axis::before { content: ""; position: absolute; top: 0; bottom: 0; left: 7px; width: 2px; background: var(--background-modifier-border); }
.mwc-timeline-event { position: relative; display: grid; grid-template-columns: 0 minmax(0, 1fr); }
.mwc-timeline-marker { position: absolute; left: -25px; top: 13px; width: 12px; height: 12px; border: 2px solid var(--interactive-accent); border-radius: 50%; background: var(--background-primary); }
.mwc-timeline-ranges .mwc-timeline-marker { height: 34px; border-radius: 8px; }
.mwc-timeline-unsupported .mwc-timeline-marker { border-style: dashed; border-color: var(--color-orange); }
.mwc-timeline-undated .mwc-timeline-marker { border-color: var(--text-muted); background: var(--background-secondary); }
.mwc-timeline-event-content { padding: 10px 12px; border: 1px solid var(--background-modifier-border); border-radius: var(--radius-m); background: var(--background-secondary); }
.mwc-timeline-event[data-precision="year"] .mwc-timeline-event-content,
.mwc-timeline-event[data-precision="month"] .mwc-timeline-event-content { border-left: 4px solid var(--color-blue); }
.mwc-timeline-event-name { padding: 0; border: 0; background: transparent; color: var(--text-normal); font-weight: 650; text-align: left; }
.mwc-timeline-time { margin: 4px 0 0; }
.mwc-timeline-meta, .mwc-timeline-interval { margin: 4px 0 0; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-timeline-sources { display: flex; flex-wrap: wrap; gap: 5px; align-items: baseline; margin-top: 7px; font-size: var(--font-ui-smaller); }
.mwc-timeline-sources button { padding: 2px 5px; }
.mwc-timeline-source-unresolved { color: var(--text-warning); }
.mwc-timeline-edit { margin-top: 8px; }
`;
export function installStoryWorldTimelineStyles(): HTMLStyleElement { const style = document.createElement("style"); style.textContent = STORY_WORLD_TIMELINE_STYLES; document.head.appendChild(style); return style; }
