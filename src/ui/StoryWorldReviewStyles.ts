export function installStoryWorldReviewStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = `
.mwc-story-world-review{padding:16px;overflow:auto}.mwc-story-world-review-summary,.mwc-story-world-review-controls,.mwc-story-world-review-actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.mwc-story-world-review-count{padding:2px 8px;border:1px solid var(--background-modifier-border);border-radius:999px}.mwc-story-world-review-row{border-left:3px solid var(--background-modifier-border);padding:8px 10px;margin:8px 0;background:var(--background-secondary)}.mwc-story-world-review-row.is-conflict{border-left-color:var(--text-error)}.mwc-story-world-review-row.is-review{border-left-color:var(--text-warning)}.mwc-story-world-review-row summary{cursor:pointer}.mwc-story-world-review-title{display:block;font-weight:600}.mwc-story-world-review-evidence{font-family:var(--font-monospace);font-size:var(--font-smallest)}
`;
  document.head.appendChild(style);
  return style;
}
