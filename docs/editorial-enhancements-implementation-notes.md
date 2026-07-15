# Editorial Enhancements Implementation Notes

The 0.15 editorial work is intentionally divided by authority:

- book review mode belongs to portable editorial workflow state on the book record;
- book review status belongs to authoritative book-note frontmatter;
- scene progress history and frontier belong to portable editorial workflow state;
- `editorial_pass` remains the portable Markdown projection for reporting;
- POV remains authoritative scene frontmatter;
- Story World character suggestions are derived from the rebuildable index;
- no missing character entity is created by this milestone.

Existing independent pass history is migrated on first use to the furthest currently completed pass. Recognised `editorial_pass` frontmatter seeds a frontier only when no valid pass history exists. Unknown frontmatter remains unmanaged until the author makes an explicit progress choice.

The annotation locator is a transient editor-view class applied only after exact extract resolution. It is cleared after a short duration, on editor change, on active-leaf change and on plugin unload. Line fallback remains navigational only and is never presented as an exact locator.
