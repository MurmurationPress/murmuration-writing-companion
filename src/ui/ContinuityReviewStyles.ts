const STYLE_ID = "mwc-continuity-review-styles";

export const CONTINUITY_REVIEW_ROW_LAYOUT = {
  autoHeight: true,
  clampsText: false,
  narrowActionBelowText: true
} as const;

export function installContinuityReviewStyles(): HTMLStyleElement {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.mwc-continuity-review { padding: 18px; overflow: auto; }
.mwc-continuity-review-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 16px; align-items: start; }
.mwc-continuity-review-header h2, .mwc-continuity-review-header p { margin: 0 0 4px; }
.mwc-continuity-review-header > .mwc-continuity-review-counts { grid-column: 1 / -1; color: var(--text-muted); font-size: var(--font-ui-small); }
.mwc-continuity-review-header-actions, .mwc-continuity-review-filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
.mwc-continuity-review-header-actions select { max-width: 14rem; font-size: var(--font-ui-small); }
.mwc-continuity-review-filters { margin: 12px 0; padding: 6px 8px; border: 1px solid var(--background-modifier-border); border-radius: var(--radius-s); }
.mwc-continuity-review-filters label { display: flex; gap: 5px; align-items: center; font-size: var(--font-ui-smaller); color: var(--text-muted); }
.mwc-continuity-review-filters select { min-width: 7rem; max-width: 11rem; font-size: var(--font-ui-small); }
.mwc-continuity-review-workspace { display: grid; grid-template-columns: minmax(250px, .85fr) minmax(340px, 1.5fr); gap: 16px; min-height: 0; }
.mwc-continuity-review-list { display: grid; align-content: start; gap: 8px; }
.mwc-continuity-review-row { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; height: auto; border: 1px solid var(--background-modifier-border); border-left: 3px solid var(--background-modifier-border); border-radius: var(--radius-s); }
.mwc-continuity-review-row-main { display: grid; gap: 5px; width: 100%; min-height: 86px; height: auto; padding: 11px 12px; text-align: left; white-space: normal; background: transparent; border: 0; box-shadow: none; }
.mwc-continuity-review-row-open { align-self: start; margin: 9px 8px 0 0; padding: 3px 7px; font-size: var(--font-ui-smaller); }
.mwc-continuity-review-row--conflict { border-left-color: var(--text-error); }
.mwc-continuity-review-row--review { border-left-color: var(--text-warning); }
.mwc-continuity-review-row[aria-current="true"] { background: var(--background-modifier-hover); box-shadow: 0 0 0 2px var(--interactive-accent); }
.mwc-continuity-review-row-main:focus-visible, .mwc-continuity-review-detail button:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 2px; }
.mwc-continuity-review-row-context { color: var(--text-muted); font-size: var(--font-ui-smaller); font-weight: var(--font-semibold); letter-spacing: .04em; text-transform: uppercase; }
.mwc-continuity-review-row-title { font-weight: var(--font-semibold); font-size: var(--font-ui-medium); }
.mwc-continuity-review-row-finding { line-height: 1.35; }
.mwc-continuity-review-row-status { color: var(--text-muted); font-size: var(--font-ui-smaller); line-height: 1.35; text-transform: capitalize; }
.mwc-continuity-review-detail { min-width: 0; padding: 14px; border: 1px solid var(--background-modifier-border); border-radius: var(--radius-m); }
.mwc-continuity-review-back { display: none; }
.mwc-continuity-review-detail-context { margin: 0 0 6px; color: var(--text-muted); font-size: var(--font-ui-small); font-weight: var(--font-semibold); letter-spacing: .03em; text-transform: uppercase; }
.mwc-continuity-review-detail h3 { margin: 4px 0 8px; }
.mwc-continuity-review-detail-explanation { max-width: 64ch; }
.mwc-continuity-review-primary-action { margin: 4px 0 12px; }
.mwc-continuity-review-evidence { margin-top: 18px; }
.mwc-continuity-review-evidence-group { margin-top: 12px; }
.mwc-continuity-review-evidence-group h5 { margin: 0 0 4px; color: var(--text-muted); }
.mwc-continuity-review-evidence-row { display: grid; grid-template-columns: minmax(110px, .35fr) minmax(0, 1fr); gap: 8px; padding: 7px 0; border-top: 1px solid var(--background-modifier-border); }
.mwc-continuity-review-evidence-row dt { font-weight: var(--font-semibold); }
.mwc-continuity-review-evidence-row dd { margin: 0; overflow-wrap: anywhere; }
.mwc-continuity-review-related ul { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
.mwc-continuity-review-related button { height: auto; padding: 2px 0; color: var(--link-color); background: transparent; border: 0; box-shadow: none; }
.mwc-continuity-review-technical { margin-top: 18px; color: var(--text-muted); font-size: var(--font-ui-small); }
.mwc-continuity-review-technical-row { display: grid; grid-template-columns: minmax(110px, .35fr) minmax(0, 1fr); gap: 8px; padding: 5px 0; border-top: 1px solid var(--background-modifier-border); }
.mwc-continuity-review-technical-row dd { margin: 0; overflow-wrap: anywhere; }
.mwc-continuity-review-empty { padding: 24px; color: var(--text-muted); text-align: center; }
@media (max-width: 720px) {
  .mwc-continuity-review { padding: 10px; }
  .mwc-continuity-review-header { grid-template-columns: 1fr; }
  .mwc-continuity-review-header-actions { justify-content: start; }
  .mwc-continuity-review-workspace { grid-template-columns: 1fr; }
  .mwc-continuity-review-row { grid-template-columns: 1fr; }
  .mwc-continuity-review-row-main { min-height: 94px; }
  .mwc-continuity-review-row-open { justify-self: start; margin: 0 12px 10px; }
  .mwc-continuity-review-detail { display: none; margin-top: 4px; }
  .mwc-continuity-review-workspace.is-showing-detail .mwc-continuity-review-list { display: none; }
  .mwc-continuity-review-workspace.is-showing-detail .mwc-continuity-review-detail { display: block; }
  .mwc-continuity-review-back { display: inline-block; }
  .mwc-continuity-review-evidence-row { grid-template-columns: 1fr; }
  .mwc-continuity-review-technical-row { grid-template-columns: 1fr; }
}
`;
  document.head.appendChild(style);
  return style;
}
