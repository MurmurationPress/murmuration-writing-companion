export const STORY_WORLD_TIMELINE_STYLES = `
.mwc-story-world-timeline { box-sizing: border-box; width: 100%; max-width: none; padding: clamp(16px, 2.5vw, 28px) clamp(16px, 3vw, 36px); overflow: auto; }
.mwc-timeline-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.mwc-timeline-heading h2, .mwc-timeline-heading p { margin: 0; }
.mwc-timeline-heading h2 { font-size: var(--font-ui-larger); letter-spacing: -.01em; }
.mwc-timeline-heading p, .mwc-timeline-empty { color: var(--text-muted); }
.mwc-timeline-filters { display: flex; flex-wrap: wrap; gap: 8px 12px; margin: 18px 0 22px; padding-bottom: 14px; border-bottom: 1px solid var(--background-modifier-border); }
.mwc-timeline-filters label { display: grid; gap: 3px; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-timeline-section { width: 100%; min-width: 0; margin-top: 26px; }
.mwc-timeline-section h3,
.mwc-event-scene-region h3 { margin: 0 0 10px; color: var(--text-muted); font-size: var(--font-ui-medium); font-weight: 650; }
.mwc-timeline-axis { position: relative; display: grid; width: 100%; min-width: 0; gap: 4px; }
.mwc-timeline-axis::before { content: ""; position: absolute; top: 0; bottom: 0; left: 8px; width: 2px; background: color-mix(in srgb, var(--interactive-accent) 40%, var(--background-modifier-border)); }
.mwc-timeline-event { position: relative; display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px; width: 100%; min-width: 0; }
.mwc-timeline-marker { z-index: 1; grid-column: 1; align-self: start; box-sizing: border-box; width: 12px; height: 12px; margin: 13px 0 0 3px; border: 2px solid var(--interactive-accent); border-radius: 50%; background: var(--background-primary); }
.mwc-timeline-ranges .mwc-timeline-marker { height: 34px; border-radius: 8px; }
.mwc-timeline-unsupported .mwc-timeline-marker { border-style: dashed; border-color: var(--text-muted); }
.mwc-timeline-undated .mwc-timeline-marker { border-color: var(--text-muted); background: var(--background-secondary); }
.mwc-timeline-event-content { grid-column: 2; box-sizing: border-box; width: 100%; min-width: min(28rem, 100%); padding: 9px 10px 10px; border: 1px solid transparent; border-radius: var(--radius-s); background: transparent; }
.mwc-timeline-event-content:hover,
.mwc-timeline-event-content:focus-within { border-color: var(--background-modifier-border); background: var(--background-secondary-alt); }
.mwc-timeline-event[data-precision="year"] .mwc-timeline-event-content,
.mwc-timeline-event[data-precision="month"] .mwc-timeline-event-content { box-shadow: inset 2px 0 0 var(--text-faint); }
.mwc-timeline-event-name { display: block; width: 100%; padding: 0; border: 0; background: transparent; color: var(--text-normal); font-size: var(--font-ui-medium); font-weight: 700; line-height: 1.35; text-align: left; white-space: normal; }
.mwc-timeline-time { margin: 3px 0 0; color: var(--text-normal); font-variant-numeric: tabular-nums; line-height: 1.4; white-space: nowrap; }
.mwc-timeline-meta { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 5px; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-timeline-meta-field { min-width: max-content; max-width: 100%; overflow-wrap: normal; word-break: normal; }
.mwc-timeline-scopes { display: inline-flex; flex-wrap: wrap; gap: 4px; min-width: 0; }
.mwc-timeline-scope-link { padding: 0 3px; font: inherit; }
.mwc-timeline-scope-unresolved { color: var(--text-muted); text-decoration: underline dotted; }
.mwc-timeline-interval { margin: 5px 0 0; color: var(--text-muted); font-size: var(--font-ui-smaller); line-height: 1.4; }
.mwc-timeline-sources { display: flex; flex-wrap: wrap; gap: 5px; align-items: baseline; margin-top: 7px; font-size: var(--font-ui-smaller); }
.mwc-timeline-sources button { padding: 2px 5px; }
.mwc-timeline-source-unresolved { color: var(--text-muted); text-decoration: underline dotted; }
.mwc-timeline-edit { margin-top: 8px; }
.mwc-event-scene-map { width: 100%; min-width: 0; }
.mwc-event-scene-legend { margin: 12px 0 18px; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-event-scene-region { margin-top: 24px; }
.mwc-event-scene-axis { position: relative; display: grid; gap: 14px; width: 100%; min-width: 0; padding-left: 22px; }
.mwc-event-scene-axis::before { content: ""; position: absolute; top: 0; bottom: 0; left: 7px; width: 2px; background: var(--interactive-accent); opacity: 0.55; }
.mwc-event-scene-row { position: relative; display: grid; grid-template-columns: minmax(15rem, 0.8fr) minmax(17rem, 1.2fr); gap: clamp(24px, 6vw, 72px); width: 100%; min-width: 0; align-items: start; }
.mwc-event-scene-row::before { content: ""; position: absolute; left: -21px; top: 18px; box-sizing: border-box; width: 15px; height: 15px; border: 3px solid var(--interactive-accent); border-radius: 50%; background: var(--background-primary); }
.mwc-event-scene-row[data-placement="range"]::before { height: 42px; border-radius: 8px; }
.mwc-event-scene-row[data-placement="point-year"]::before { border-radius: 2px; }
.mwc-event-scene-row[data-placement="point-month"]::before { border-style: double; transform: rotate(45deg); }
.mwc-event-scene-row[data-placement="point-minute"]::before { background: var(--interactive-accent); }
.mwc-event-scene-row[data-placement="point-hour"]::before { background: var(--interactive-accent); opacity: .82; }
.mwc-event-scene-row[data-placement="unsupported"]::before { border-style: dashed; border-color: var(--text-muted); }
.mwc-event-scene-row[data-placement="undated"]::before { border-color: var(--text-muted); }
.mwc-event-scene-event-node,
.mwc-event-scene-scene-node { min-width: 0; padding: 10px 12px; border: 1px solid var(--background-modifier-border); border-radius: var(--radius-s); background: var(--background-secondary-alt); transition: border-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease; }
.mwc-event-scene-event-node { border-left: 2px solid var(--interactive-accent); background: var(--background-primary-alt); }
.mwc-event-scene-event-title,
.mwc-event-scene-scene-title { display: block; max-width: 100%; padding: 0; border: 0; background: transparent; color: var(--text-normal); font-weight: 700; line-height: 1.35; text-align: left; white-space: normal; }
.mwc-event-scene-event-time { margin: 5px 0 0; color: var(--text-muted); }
.mwc-event-scene-event-meta { color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-event-scene-source-host { min-width: 0; }
.mwc-event-scene-source-host > summary { margin-bottom: 8px; color: var(--text-muted); cursor: pointer; }
.mwc-event-scene-source-lane { position: relative; display: grid; gap: 8px; min-width: 0; }
.mwc-event-scene-connection { position: relative; min-width: 0; }
.mwc-event-scene-connection::before { content: ""; position: absolute; top: 50%; right: 100%; width: clamp(24px, 6vw, 72px); border-top: 2px solid var(--background-modifier-border); transform: translateY(-50%); transition: border-color 120ms ease, border-width 120ms ease; }
.mwc-event-scene-scene-node { display: grid; gap: 3px; }
.mwc-event-scene-scene-context { color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-event-scene-scene-node.is-unresolved { border-style: dashed; border-color: var(--text-muted); }
.mwc-event-scene-no-sources { align-self: center; padding: 10px 12px; border: 1px dashed var(--background-modifier-border); border-radius: var(--radius-m); color: var(--text-muted); }
.mwc-event-scene-map.has-graph-emphasis [data-graph-node]:not(.is-emphasised) { opacity: 0.48; }
.mwc-event-scene-map.has-graph-emphasis [data-graph-edge]:not(.is-emphasised)::before { opacity: 0.35; }
[data-graph-node].is-emphasised { border-color: var(--interactive-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--interactive-accent) 28%, transparent); }
[data-graph-edge].is-emphasised::before { border-top-width: 3px; border-color: var(--interactive-accent); }
.mwc-event-scene-event-title:focus-visible,
.mwc-event-scene-scene-title:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 3px; }
.mwc-timeline-assertions { margin-top: 28px; padding-top: 16px; border-top: 1px solid var(--background-modifier-border); }
.mwc-timeline-assertions-note { color: var(--text-muted); }
.mwc-timeline-assertion { margin-top: 8px; padding: 8px 0 8px 10px; border: 0; border-left: 2px solid var(--background-modifier-border); }
.mwc-timeline-assertion.has-conflict { border-left-style: dashed; border-left-color: var(--text-warning); }
.mwc-timeline-assertion p { margin: 0; }
.mwc-timeline-assertion-status { color: var(--text-muted); font-size: var(--font-ui-smaller); }
.mwc-timeline-assertion-warning { margin-top: 5px !important; color: var(--text-warning); }
.mwc-timeline-assertion details { margin-top: 6px; }
@media (max-width: 520px) {
  .mwc-story-world-timeline { padding: 14px 12px; }
  .mwc-timeline-heading { align-items: flex-start; flex-direction: column; }
  .mwc-timeline-filters { gap: 7px; }
  .mwc-timeline-filters label { flex: 1 1 9rem; }
  .mwc-timeline-event { grid-template-columns: 16px minmax(0, 1fr); gap: 7px; }
  .mwc-timeline-axis::before { left: 7px; }
  .mwc-timeline-marker { margin-left: 1px; }
  .mwc-timeline-time { white-space: normal; }
  .mwc-event-scene-axis { padding-left: 18px; }
  .mwc-event-scene-row { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .mwc-event-scene-row::before { left: -17px; }
  .mwc-event-scene-source-lane { padding-left: 18px; }
  .mwc-event-scene-connection::before { top: 16px; right: auto; left: -18px; width: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .mwc-story-world-timeline *,
  .mwc-story-world-timeline *::before { scroll-behavior: auto !important; transition-duration: 0.01ms !important; }
}
`;
export function installStoryWorldTimelineStyles(): HTMLStyleElement { const style = document.createElement("style"); style.textContent = STORY_WORLD_TIMELINE_STYLES; document.head.appendChild(style); return style; }
